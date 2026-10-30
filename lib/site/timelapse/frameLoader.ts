// Загрузчик кадров ленты по прокрутке (full): не больше нескольких запросов разом; сначала «черновик» —
// каждый десятый кадр на весь ролик (прокрутка сразу показывает полёт целиком, пусть и грубо), затем
// остальные от текущего кадра вперёд, потом назад. Черновик может идти из более лёгкого набора: тогда
// его кадры стоят и в общей очереди и заменяются настоящими. Кадры живут как <img>
// (сжатыми в памяти): сотни раскодированных битмапов заняли бы гигабайт. Перенесён из BlueprintHero
// (git 984f4c8^).

type LoadedFrame = { image: HTMLImageElement; index: number };

export type ImageFactory = () => HTMLImageElement;

/**
 * Шаг черновика: 121 кадр → 13 грубых, 1,9 МБ из набора 1280 — как было до v3 (16 кадров q55). С шагом 8
 * черновик q75 весил бы 2,4 МБ, а экран загрузки шёл бы на 1 с дольше при 4 Мбит/с.
 */
export const DRAFT_STEP = 10;

export class FrameLoader {
  private readonly images: (HTMLImageElement | undefined)[] = [];
  private readonly loaded: boolean[] = [];
  /** Настоящий кадр запрошен: больше по этому номеру качать нечего. */
  private readonly requested = new Set<number>();
  private readonly draftRequested = new Set<number>();
  private queue: number[] = [];
  private active = 0;
  private cursor = 0;
  private running = false;
  private stopped = false;
  private draftSettled = 0;
  /** Доля черновика: кадр пришёл или не придёт совсем. По ней экран загрузки считает проценты. */
  onDraft: ((share: number) => void) | null = null;
  /** Пока даёт true, остальные кадры ждут весь черновик: канал — ему, его ждёт экран загрузки. */
  holdForDraft: (() => boolean) | null = null;

  constructor(
    private readonly count: number,
    private readonly src: (index: number) => string,
    private readonly onLoad: (index: number) => void,
    private readonly concurrency = 4,
    private readonly createImage: ImageFactory = () => new Image(),
    private readonly draftSrc: (index: number) => string = src,
  ) {}

  /** Все кадры: черновик, затем от курсора вперёд, затем назад. */
  start(): void {
    this.running = true;
    this.queue = this.order(this.cursor);
    this.pump();
  }

  /** Пауза очереди (блок ушёл с экрана): начатые загрузки докачиваются, новые ждут start(). */
  pause(): void {
    this.running = false;
  }

  /** Текущий кадр сменился — очередь строится заново от него. */
  prioritize(frame: number): void {
    this.cursor = frame;
    if (!this.running) return;
    this.queue = this.order(frame);
    this.pump();
  }

  /** Один кадр вне очереди (первый — до старта остальных): кадр черновика — из черновика. */
  load(index: number): void {
    if (this.draftRequested.has(index) || index < 0 || index >= this.count) return;
    this.requestFrame(index);
  }

  /** Ближайший загруженный кадр: сначала назад (стройка «ещё не дошла»), потом вперёд. */
  nearest(frame: number): LoadedFrame | null {
    const target = Math.round(frame);
    for (let index = Math.min(target, this.count - 1); index >= 0; index--) {
      if (this.loaded[index]) return { image: this.images[index]!, index };
    }
    for (let index = target + 1; index < this.count; index++) {
      if (this.loaded[index]) return { image: this.images[index]!, index };
    }
    return null;
  }

  draftShare(): number {
    let total = 0;
    for (let index = 0; index < this.count; index++) if (this.isDraft(index)) total++;
    return total > 0 ? this.draftSettled / total : 1;
  }

  isLoaded(index: number): boolean {
    return this.loaded[index] === true;
  }

  destroy(): void {
    this.stopped = true;
    this.running = false;
    this.queue = [];
  }

  private requestFrame(index: number): void {
    if (this.stopped || this.requested.has(index)) return;
    const draft = this.awaitsDraft(index);
    const url = draft ? this.draftSrc(index) : this.src(index);
    if (draft) this.draftRequested.add(index);
    if (url === this.src(index)) this.requested.add(index);
    this.active++;
    const image = this.createImage();
    image.decoding = "async";
    const done = () => {
      this.active--;
      if (draft) {
        this.draftSettled++;
        this.onDraft?.(this.draftShare());
      }
      this.pump();
    };
    image.onload = () => {
      if (this.stopped) return;
      // Черновик, опоздавший за настоящим кадром, его не заменяет.
      if (!draft || !this.loaded[index]) {
        this.images[index] = image;
        this.loaded[index] = true;
      }
      // Черновик раскодировать заранее, чтобы drawImage по нему не ждал; остальные кадры раскодирует
      // сам drawImage — иначе кэш декодера принял бы все кадры (≈ 1 ГБ) и вытеснял их по кругу.
      // Готовность от decode не зависит (в скрытой вкладке он может не завершиться).
      if (draft && typeof image.decode === "function") {
        image.decode().catch(() => undefined);
      }
      done();
      this.onLoad(index);
    };
    image.onerror = done;
    image.src = url;
  }

  private isDraft(index: number): boolean {
    return index % DRAFT_STEP === 0 || index === this.count - 1;
  }

  private awaitsDraft(index: number): boolean {
    return this.isDraft(index) && !this.draftRequested.has(index);
  }

  private order(from: number): number[] {
    const draft: number[] = [];
    const ahead: number[] = [];
    const behind: number[] = [];
    for (let index = 0; index < this.count; index++) {
      if (this.requested.has(index)) continue;
      const awaitsDraft = this.awaitsDraft(index);
      if (awaitsDraft) draft.push(index);
      if (!awaitsDraft || this.draftSrc(index) !== this.src(index)) {
        (index >= from ? ahead : behind).push(index);
      }
    }
    return [...draft, ...ahead, ...behind.reverse()];
  }

  private pump(): void {
    if (this.stopped || !this.running) return;
    while (this.active < this.concurrency && this.queue.length > 0) {
      if (!this.awaitsDraft(this.queue[0]!) && this.holdForDraft?.() && this.draftShare() < 1) {
        return;
      }
      this.requestFrame(this.queue.shift()!);
    }
  }
}

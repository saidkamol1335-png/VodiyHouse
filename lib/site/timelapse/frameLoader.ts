// Загрузчик кадров ленты по прокрутке (full): не больше нескольких запросов разом; сначала «черновик» —
// каждый восьмой кадр на весь ролик (прокрутка сразу показывает полёт целиком, пусть и грубо), затем
// остальные от текущего кадра вперёд, потом назад. Кадры живут как <img> (сжатыми в памяти): сотни
// раскодированных битмапов 1280×720 заняли бы почти гигабайт. Перенесён из BlueprintHero (git 984f4c8^).

type LoadedFrame = { image: HTMLImageElement; index: number };

export type ImageFactory = () => HTMLImageElement;

/** Шаг черновика: 180 кадров → 23 грубых. */
export const DRAFT_STEP = 8;

export class FrameLoader {
  private readonly images: (HTMLImageElement | undefined)[] = [];
  private readonly loaded: boolean[] = [];
  private readonly requested = new Set<number>();
  private queue: number[] = [];
  private active = 0;
  private cursor = 0;
  private running = false;
  private stopped = false;
  private draftSettled = 0;
  /** Доля черновика: кадр пришёл или не придёт совсем. По ней экран загрузки считает проценты. */
  onDraft: ((share: number) => void) | null = null;

  constructor(
    private readonly count: number,
    private readonly src: (index: number) => string,
    private readonly onLoad: (index: number) => void,
    private readonly concurrency = 4,
    private readonly createImage: ImageFactory = () => new Image(),
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

  /** Один кадр вне очереди (первый — до старта остальных). */
  load(index: number): void {
    if (this.stopped || this.requested.has(index) || index < 0 || index >= this.count) return;
    this.requested.add(index);
    this.active++;
    const image = this.createImage();
    image.decoding = "async";
    const done = () => {
      this.active--;
      if (this.isDraft(index)) {
        this.draftSettled++;
        this.onDraft?.(this.draftShare());
      }
      this.pump();
    };
    image.onload = () => {
      if (this.stopped) return;
      this.images[index] = image;
      this.loaded[index] = true;
      // Черновик раскодировать заранее, чтобы drawImage по нему не ждал; остальные кадры раскодирует
      // сам drawImage — иначе кэш декодера принял бы все кадры (≈ 0,7 ГБ) и вытеснял их по кругу.
      // Готовность от decode не зависит (в скрытой вкладке он может не завершиться).
      if (this.isDraft(index) && typeof image.decode === "function") {
        image.decode().catch(() => undefined);
      }
      done();
      this.onLoad(index);
    };
    image.onerror = done;
    image.src = this.src(index);
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

  private isDraft(index: number): boolean {
    return index % DRAFT_STEP === 0 || index === this.count - 1;
  }

  private order(from: number): number[] {
    const draft: number[] = [];
    const ahead: number[] = [];
    const behind: number[] = [];
    for (let index = 0; index < this.count; index++) {
      if (this.requested.has(index)) continue;
      if (this.isDraft(index)) draft.push(index);
      else (index >= from ? ahead : behind).push(index);
    }
    return [...draft, ...ahead, ...behind.reverse()];
  }

  private pump(): void {
    if (this.stopped || !this.running) return;
    while (this.active < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (!this.requested.has(next)) this.load(next);
    }
  }
}

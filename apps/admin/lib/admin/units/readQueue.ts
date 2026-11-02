// Когда перечитывать список квартир (12.4). Server Actions браузер шлёт по одному в порядке
// вызова: чтение, отправленное во время тапа, вернуло бы уже новый статус, и сверка «что было в
// базе» (statusOutcome) приняла бы свой же тап за чужой. Поэтому, пока сохраняется статус,
// чтение только запоминается и идёт после; повторные просьбы схлопываются в одно чтение.

export class ReadQueue {
  private run: (() => Promise<boolean>) | null = null;
  private saving = 0;
  private reading = false;
  private wanted = false;
  private waiters: Array<(read: boolean) => void> = [];

  /** run — само чтение (true — прочитано); без подключения просьбы копятся до него. */
  connect(run: () => Promise<boolean>) {
    this.run = run;
    this.pump();
  }

  disconnect() {
    this.run = null;
  }

  /** Обещание — после чтения, которое начнётся не раньше этой просьбы: удалось ли оно. */
  reload(): Promise<boolean> {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.wanted = true;
      this.pump();
    });
  }

  /**
   * Показ вкладки: нужно хотя бы одно чтение, и уже идущее годится — StrictMode в разработке
   * монтирует эффект дважды, и второе чтение тех же 5000 строк было бы лишним.
   */
  ensureRead() {
    if (!this.reading) void this.reload();
  }

  /** Сохранение статуса: пока оно идёт, чтений нет. */
  async track<T>(work: () => Promise<T>): Promise<T> {
    this.saving += 1;
    try {
      return await work();
    } finally {
      this.saving -= 1;
      this.pump();
    }
  }

  private pump() {
    const run = this.run;
    if (!run || this.reading || this.saving > 0 || !this.wanted) return;
    this.wanted = false;
    this.reading = true;
    const waiters = this.waiters.splice(0);
    void run()
      .catch(() => false)
      .then((read) => {
        this.reading = false;
        for (const resolve of waiters) resolve(read);
        this.pump();
      });
  }
}

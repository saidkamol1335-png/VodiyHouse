// Несохранённая правка строки (12.5): смена фильтра, открытие другой строки или Esc спрашивают
// «Уйти без сохранения?». Объект живёт в useState и читается из обработчиков — не из рендера.

export class EditDirty {
  private id: string | null = null;
  private message = "";

  setMessage(message: string) {
    this.message = message;
  }

  /** Форма квартиры id поменялась (null — правок нет). */
  mark(id: string, dirty: boolean) {
    if (dirty) this.id = id;
    else if (this.id === id) this.id = null;
  }

  isDirty(id: string) {
    return this.id === id;
  }

  /** Уйти можно: правок нет или их согласились бросить. */
  confirmLeave(): boolean {
    if (this.id === null) return true;
    if (!window.confirm(this.message)) return false;
    this.id = null;
    return true;
  }
}

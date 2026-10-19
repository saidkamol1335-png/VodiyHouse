// Фон экрана входа (решения К1.1, К1.5–К1.7): кинематографичный таймлапс стройки ЖК Shodlik.
// Ролик генерируется в Higgsfield после пополнения кредитов (PROGRESS, шаг 11.5) — до этого null,
// и на экране только кадр. Кадр сейчас DEMO: иллюстрация Shodlik из мокапа (ЖК вымышленный).

export type LoginVideo = {
  webm: string;
  mp4: string;
  /** Первый кадр ролика (участок) — пока видео грузится. */
  firstFrame: string;
};

export const LOGIN_VIDEO: LoginVideo | null = null;

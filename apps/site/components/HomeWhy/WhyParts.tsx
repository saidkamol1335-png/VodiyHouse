/** Заголовок и текст карточки «Почему через Vodiy House» — с задержками появления. */
export function Copy({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h3 className="home-why__tile-title home-why__rv home-why__rv--1">{title}</h3>
      <p className="home-why__text home-why__rv home-why__rv--2">{text}</p>
    </>
  );
}

/** Подпись карточки: «01 — Видео стройки». */
export function Kicker({ index, text }: { index: string; text: string }) {
  return (
    <p className="home-why__kicker home-why__rv">
      <span className="home-why__kicker-i" aria-hidden="true">
        {index}
      </span>
      <span className="home-why__kicker-bar" aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}

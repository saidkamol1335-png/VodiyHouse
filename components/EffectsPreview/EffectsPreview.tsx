import { Spotlight } from "@/components/Spotlight";

/** Базовые эффекты на /dev/preview: стекло, подсветка за курсором; линии колонок — на страницах сайта. */
export function EffectsPreview() {
  return (
    <section className="effects-preview">
      <h2 className="heading heading--h3">Эффекты</h2>

      <div className="effects-preview__photo" data-testid="glass-demo">
        <div className="effects-preview__photo-text">Квартиры в новостройках Ферганы</div>
        <div className="effects-preview__bar glass">
          <b>Vodiy House</b>
          <span>Новостройки · Спецпредложения · Застройщики · Калькулятор</span>
        </div>
      </div>

      <div className="effects-preview__cards">
        {["Карточка ЖК", "KPI кабинета", "Баннер"].map((label) => (
          <Spotlight key={label} as="article" className="effects-preview__card">
            <span className="effects-preview__label">{label}</span>
            <span className="heading heading--h3">ЖК Shodlik</span>
            <span className="effects-preview__muted">Фергана, ул. Мустакиллик, 12</span>
            <span className="effects-preview__muted">Подсветка за курсором — режим full, мышь</span>
          </Spotlight>
        ))}
      </div>
    </section>
  );
}

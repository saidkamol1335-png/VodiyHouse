import { getTranslations } from "next-intl/server";

/**
 * Бегущая строка под первым экраном (мокап .marq): города и «Новостройки» контуром, первое слово —
 * курсивом. Только украшение — диктору не читается. Движется только в full; lite и none — стоит.
 */
export async function HomeMarquee() {
  const t = await getTranslations("home");
  // Слова через « · » одной строкой: массивы в сообщениях next-intl не типизирует.
  const words = t("marquee").split(" · ");
  // Лента дважды подряд: сдвиг на половину ширины замыкается без шва.
  const line = [...words, ...words];
  return (
    <div className="home-marquee" aria-hidden="true">
      <div className="home-marquee__track">
        {line.map((word, index) => (
          <span key={index} className={index % words.length === 0 ? "home-marquee__word home-marquee__word--accent" : "home-marquee__word"}>
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

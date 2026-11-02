import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";

type Word = { text: string; accent: boolean };

/** «… <a>Документы проверены,</a> …» → слова; акцент — то, что в <a>…</a>. */
function wordsOf(text: string): Word[] {
  return text.split(/(<a>.*?<\/a>)/).flatMap((part) => {
    const accent = part.startsWith("<a>");
    const plain = accent ? part.slice(3, -4) : part;
    return plain.split(" ").filter(Boolean).map((word) => ({ text: word, accent }));
  });
}

/**
 * «Vodiy House в двух словах» (мокап .words): абзац, акценты — курсивом. В full слова проявляются
 * по мере прокрутки (CSS view timeline, без JS); lite и none — текст сразу целиком (§3).
 */
export async function HomeManifesto() {
  const t = await getTranslations("home.manifesto");
  const words = wordsOf(t.raw("text") as string);
  return (
    <section className="home-manifesto" aria-labelledby="home-manifesto-title">
      <Container>
        <h2 id="home-manifesto-title" className="home-manifesto__eyebrow">
          <Eyebrow as="span">{t("eyebrow")}</Eyebrow>
        </h2>
        <p className="home-manifesto__text">
          {words.map((word, index) => (
            <span
              key={index}
              className={word.accent ? "home-manifesto__word home-manifesto__word--accent" : "home-manifesto__word"}
              style={{ ["--word" as string]: index / words.length }}
            >
              {`${word.text} `}
            </span>
          ))}
        </p>
      </Container>
    </section>
  );
}

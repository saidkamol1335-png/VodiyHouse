import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import Link from "next/link";

/** href — готовый адрес с языком (/ru/kalkulyator?…) или стенда (/dev/kalkulyator?…). */
export type CalcHeroExample = { href: string; title: string; note: string };

type CalcHeroProps = {
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
  examplesLabel: string;
  /** «120 м² · 2 года / FARG‘ONA SIFAT QURILISH · IPOTEKA BANK» — только при DEMO. */
  examples: readonly CalcHeroExample[];
};

/** Шапка /kalkulyator (мокап SiteCalc): надзаголовок, заголовок с курсивом, подпись, примеры. */
export function CalcHero({ eyebrow, title, accent, lead, examplesLabel, examples }: CalcHeroProps) {
  return (
    <header className="calc-hero">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading level={1} accent={accent}>
        {`${title} `}
      </Heading>
      <p className="calc-hero__lead">{lead}</p>
      {examples.length > 0 ? (
        <nav className="calc-hero__examples" aria-label={examplesLabel}>
          <span className="calc-hero__examples-label">{examplesLabel}</span>
          {examples.map((example) => (
            <Link key={example.href} href={example.href} className="calc-hero__example">
              <b>{example.title}</b>
              <span className="calc-hero__example-note">{example.note}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

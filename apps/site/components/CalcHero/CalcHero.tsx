import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";

type CalcHeroProps = {
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
};

/** Шапка /kalkulyator (мокап SiteCalc): надзаголовок, заголовок с курсивом, подпись. */
export function CalcHero({ eyebrow, title, accent, lead }: CalcHeroProps) {
  return (
    <header className="calc-hero">
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading level={1} accent={accent}>
        {`${title} `}
      </Heading>
      <p className="calc-hero__lead">{lead}</p>
    </header>
  );
}

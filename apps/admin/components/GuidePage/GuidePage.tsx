import { Fragment, type ReactNode } from "react";
import type { Guide, GuideBlock } from "@/lib/admin/guide";

// Страница «Памятка» (фаза F, п. 42): тот же текст, что docs/*-guide.md, — разделы, списки, таблицы.

/** «**жирное**» — единственная разметка памяток; `код` — моноширинным. */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <b key={index}>{part.slice(2, -2)}</b>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={index} className="guide-page__code">
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case "p":
      return <p className="guide-page__text">{inline(block.text)}</p>;
    case "list":
    case "steps": {
      const List = block.kind === "steps" ? "ol" : "ul";
      return (
        <List className={`guide-page__list guide-page__list--${block.kind}`}>
          {block.items.map((item) => (
            <li key={item}>{inline(item)}</li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div className="guide-page__table">
          <table>
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th key={cell} scope="col">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={index}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <article className="guide-page" aria-label={guide.title}>
      <div className="guide-page__lead">
        {guide.lead.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>
      {guide.sections.map((section) => (
        <section key={section.title} className="guide-page__section">
          {section.sub ? (
            <h3 className="guide-page__subtitle">{section.title}</h3>
          ) : (
            <h2 className="guide-page__title">{section.title}</h2>
          )}
          {section.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </section>
      ))}
    </article>
  );
}

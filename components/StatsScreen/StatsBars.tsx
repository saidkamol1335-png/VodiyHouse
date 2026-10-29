import type { CSSProperties } from "react";

export type StatsBarRow = {
  key: string;
  label: string;
  value: string;
  share: string;
  width: number;
};

/** Полосы панели (мокап CabStats .hbars): подпись, полоса от самой длинной, число и доля. */
export function StatsBars({
  rows,
  empty,
  wide = false,
}: {
  rows: StatsBarRow[];
  empty: string;
  wide?: boolean;
}) {
  if (rows.length === 0) return <p className="stats-screen__empty">{empty}</p>;
  return (
    <ul className={wide ? "stats-bars stats-bars--wide" : "stats-bars"}>
      {rows.map((row) => (
        <li key={row.key} className="stats-bars__row">
          <span className="stats-bars__label">{row.label}</span>
          <span className="stats-bars__track" aria-hidden="true">
            <i style={{ "--w": `${row.width}%` } as CSSProperties} />
          </span>
          <span className="stats-bars__value">
            {row.value}
            <small>{row.share}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

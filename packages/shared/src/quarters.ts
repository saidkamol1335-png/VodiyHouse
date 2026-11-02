// Сроки по кварталам: застройщики называют срок кварталом («4 кв. 2027»), а не днём (мокап:
// сданные объекты, срок сдачи блока). В базе квартал хранится последним днём квартала (date) —
// так даты сортируются и сравниваются. Строки ISO разбираются вручную: без часовых поясов.

export type QuarterNumber = 1 | 2 | 3 | 4;

export type Quarter = { quarter: QuarterNumber; year: number };

export const QUARTERS: readonly QuarterNumber[] = [1, 2, 3, 4];

const MONTHS_IN_QUARTER = 3;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** «2023-03-31» → 1-й квартал 2023; не дата ISO — null. */
export function quarterOf(isoDate: string): Quarter | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { quarter: Math.ceil(month / MONTHS_IN_QUARTER) as QuarterNumber, year: Number(match[1]) };
}

/** Последний день квартала в ISO — так квартал лежит в базе. */
export function quarterEndDate({ quarter, year }: Quarter): string {
  const month = quarter * MONTHS_IN_QUARTER;
  // День 0 следующего месяца — последний день нужного; UTC — чтобы пояс не сдвинул дату.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

const quarterIndex = ({ quarter, year }: Quarter) => year * 4 + (quarter - 1);

export type DeliveryStatus = { kind: "onTime" } | { kind: "delayed"; months: number };

/**
 * Плашка сданного объекта (мокап, страница застройщика): факт не позже плана — «Сдан в срок»,
 * позже — «Перенос на N мес.» с шагом в квартал. Нет плана или факта — плашки нет.
 */
export function deliveryStatus(
  plannedOn: string | null,
  deliveredOn: string | null,
): DeliveryStatus | null {
  const planned = plannedOn ? quarterOf(plannedOn) : null;
  const delivered = deliveredOn ? quarterOf(deliveredOn) : null;
  if (!planned || !delivered) return null;
  const quarters = quarterIndex(delivered) - quarterIndex(planned);
  return quarters <= 0
    ? { kind: "onTime" }
    : { kind: "delayed", months: quarters * MONTHS_IN_QUARTER };
}

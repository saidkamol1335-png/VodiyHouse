import { DEMO_COMPLEX_ROWS } from "./demo";
import { COMPLEX_REQUIREMENTS, type ComplexRequirement, type ReadinessItem } from "./readiness";
import type { ComplexRecord } from "./record";

// Страница ЖК на стенде /dev/zhk/<id>: поля «Основного» — как supabase/demo/seed.sql (мокап:
// JKS), точки — условные (DEMO); готовность — какой она была бы у DEMO без фото и чертежей.

type DemoFacts = Pick<
  ComplexRecord,
  | "class"
  | "houseType"
  | "ceilingHeight"
  | "parking"
  | "address"
  | "landmark"
  | "minutesToCenter"
  | "lat"
  | "lng"
  | "permitCheckedAt"
  | "staffVisitedAt"
>;

const FACTS: Record<string, DemoFacts> = {
  "demo-shodlik": {
    class: "comfort",
    houseType: "monolith",
    ceilingHeight: 3,
    parking: "underground",
    address: { ru: "ул. Мустакиллик, 12", uz: "Mustaqillik ko‘chasi, 12" },
    landmark: { ru: "напротив центрального парка", uz: "markaziy bog‘ ro‘parasida" },
    minutesToCenter: 7,
    lat: 40.3842,
    lng: 71.7843,
    permitCheckedAt: "2026-09-12",
    staffVisitedAt: "2026-09-20",
  },
  "demo-namuna": {
    class: "business",
    houseType: "monolith",
    ceilingHeight: 3.1,
    parking: "underground",
    address: { ru: "ул. Навои, 45", uz: "Navoiy ko‘chasi, 45" },
    landmark: { ru: "рядом с площадью Мустакиллик", uz: "Mustaqillik maydoni yonida" },
    minutesToCenter: 4,
    lat: 40.3889,
    lng: 71.7831,
    permitCheckedAt: "2026-09-11",
    staffVisitedAt: "2026-09-18",
  },
};

const EMPTY_FACTS: DemoFacts = {
  class: null,
  houseType: null,
  ceilingHeight: null,
  parking: null,
  address: null,
  landmark: null,
  minutesToCenter: null,
  lat: null,
  lng: null,
  permitCheckedAt: null,
  staffVisitedAt: null,
};

/** Фергана — первая в справочнике городов и районов (lib/admin/dictionaries/seed.ts). */
const FERGANA_ID = 1;

export function demoComplex(id: string): ComplexRecord | null {
  const row = DEMO_COMPLEX_ROWS.find((item) => item.id === id);
  if (!row) return null;
  const facts = FACTS[row.slug] ?? EMPTY_FACTS;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    archivedAt: row.archivedAt,
    developerId: row.developerId,
    developerName: row.developerName,
    developerStatus: row.developerStatus,
    shortDescription: null,
    locationId: facts.address ? FERGANA_ID : null,
    landCheckedAt: facts.permitCheckedAt,
    ...facts,
  };
}

/** Готовность DEMO: у Shodlik и Namuna нет только фото и чертежей; у остальных — почти ничего. */
export function demoReadiness(complex: ComplexRecord): ReadinessItem[] {
  const filled = complex.address !== null;
  const ok: Record<ComplexRequirement, boolean> = {
    address: filled,
    location: complex.locationId !== null,
    point: complex.lat !== null,
    developer: complex.developerStatus !== "archived",
    blocks: filled,
    layouts: false,
    photos: false,
    cover: false,
  };
  return COMPLEX_REQUIREMENTS.map((requirement) => ({
    requirement,
    ok: ok[requirement],
    have: requirement === "photos" ? (filled ? 3 : 0) : null,
  }));
}

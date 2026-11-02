import type { LocalizedText } from "@/lib/contacts";
import { photoFrom, type CatalogPhoto, type PhotoRecord } from "@/lib/site/catalog/records";

// Записи site_developers() и site_developer(slug) (20261028120000_site_developers.sql) → модель
// страниц застройщиков (шаг 3.15). ЖК, программы и проверки по ЖК — из каталога (lib/site/catalog).

export type DeveloperRecord = {
  id: string;
  slug: string;
  name: string;
  founded_year: number | null;
  delivered_checked_at: string | null;
  logo: PhotoRecord | null;
};

export type PastProjectRecord = {
  name: LocalizedText;
  planned_on: string | null;
  delivered_on: string | null;
};

export type DeveloperPageRecord = DeveloperRecord & {
  about: LocalizedText | null;
  founders: LocalizedText | null;
  flats_delivered: number | null;
  cover: PhotoRecord | null;
  past_projects: PastProjectRecord[];
};

/** Строка списка и «Другие застройщики». */
export type DeveloperSummary = {
  id: string;
  slug: string;
  name: string;
  foundedYear: number | null;
  /** «Есть сданные объекты» — дата проверки руководителем; null — не проверено. */
  deliveredCheckedAt: string | null;
  logo: CatalogPhoto | null;
};

export type PastProject = { name: LocalizedText; plannedOn: string | null; deliveredOn: string | null };

export type DeveloperPage = DeveloperSummary & {
  about: LocalizedText | null;
  founders: LocalizedText | null;
  flatsDelivered: number | null;
  cover: CatalogPhoto | null;
  pastProjects: PastProject[];
};

const photoOrNull = (record: PhotoRecord | null) => (record ? photoFrom(record) : null);

export function developerFrom(record: DeveloperRecord): DeveloperSummary {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    foundedYear: record.founded_year,
    deliveredCheckedAt: record.delivered_checked_at,
    logo: photoOrNull(record.logo),
  };
}

export function developerPageFrom(record: DeveloperPageRecord): DeveloperPage {
  return {
    ...developerFrom(record),
    about: record.about,
    founders: record.founders,
    flatsDelivered: record.flats_delivered,
    cover: photoOrNull(record.cover),
    pastProjects: record.past_projects.map((project) => ({
      name: project.name,
      plannedOn: project.planned_on,
      deliveredOn: project.delivered_on,
    })),
  };
}

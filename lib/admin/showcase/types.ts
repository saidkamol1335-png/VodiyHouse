import type { BilingualValue } from "../bilingual";
import type { ContentErrorCode } from "../developers/errors";
import type { PublicationStatus } from "../publication";

// «Витрина» кабинета (3.16а, PLAN §3а, §6): спецпредложения, подборки и реклама — записи,
// строки списков, ответы действий и списки выбора. Без "use server": типы нужны и формам.

export const SPECIAL_KINDS = ["gift", "installment", "bank", "sales_start"] as const;
export type SpecialKind = (typeof SPECIAL_KINDS)[number];

export const SHOWCASE_KINDS = ["special", "collection", "ad"] as const;
export type ShowcaseKind = (typeof SHOWCASE_KINDS)[number];

export const COLLECTION_MODES = ["manual", "filter"] as const;
export type CollectionMode = (typeof COLLECTION_MODES)[number];

/** Параметры адреса каталога как есть: {"komnat": "1,2", "do": "45000"} (lib/site/catalog/params.ts). */
export type FilterSearch = Record<string, string>;

export type SpecialRecord = {
  id: string;
  developerId: string;
  kind: SpecialKind;
  badge: BilingualValue;
  title: BilingualValue;
  text: BilingualValue | null;
  complexIds: string[];
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: number;
};

export type CollectionRecord = {
  id: string;
  slug: string;
  title: BilingualValue;
  mode: CollectionMode;
  complexIds: string[];
  filter: FilterSearch;
  isActive: boolean;
  sort: number;
};

export type AdRecord = {
  id: string;
  developerId: string;
  title: BilingualValue;
  text: BilingualValue | null;
  complexIds: string[];
  filter: FilterSearch;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  sort: number;
};

/** На сайте · ждёт своего дня · период прошёл · выключено. */
export type ShowcaseStatus = "active" | "scheduled" | "expired" | "off";

/** Строка списка вкладки: общее у трёх видов; период у подборок пустой. */
export type ShowcaseListRow = {
  id: string;
  kind: ShowcaseKind;
  title: string;
  developerName: string | null;
  complexCount: number;
  /** Подборка по фильтру — «по фильтру» вместо числа ЖК. */
  byFilter: boolean;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  sort: number;
  /** Порядок добавления — для очереди рекламы при равном sort. */
  createdAt: string;
  coverPath: string | null;
};

export type ShowcaseListFilter = "active" | "all";
export const SHOWCASE_LIST_FILTERS: readonly ShowcaseListFilter[] = ["active", "all"];

export type DeveloperOption = { id: string; name: string };
/** ЖК для выбора: не опубликованные остаются в списке — с плашкой, на сайт не попадут. */
export type ComplexOption = { id: string; name: string; developerId: string; status: PublicationStatus };
export type LocationOption = { slug: string; name: string; kind: "city" | "district" };

export type ShowcaseOptions = {
  developers: readonly DeveloperOption[];
  complexes: readonly ComplexOption[];
  locations: readonly LocationOption[];
};

/** Ответ «Сохранить»: у новой записи успех — переход на её страницу (redirect), у правки — «Сохранено». */
export type SaveShowcaseResult<Fields, Errors> =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; error: ContentErrorCode | null; fieldErrors: Errors; fields: Fields };

/** «Удалить»: успех — переход в список (redirect). */
export type DeleteShowcaseResult = { status: "idle" } | { status: "error"; error: ContentErrorCode };

export type FormAction<Result> = (formData: FormData) => Promise<Result>;

export type MediaActionResult = { status: "done" } | { status: "error"; error: ContentErrorCode };

/** Обложка: файл кладёт браузер, строку media_assets и удаление старого файла — сервер. */
export type ShowcaseMediaActions = {
  /** Поля: owner, id, kind, path, width, height, blur, focusX, focusY, rule12. */
  attach: FormAction<MediaActionResult>;
  /** Поля: owner, id, kind. */
  remove: FormAction<MediaActionResult>;
  /** Поля: owner, id, kind, focusX, focusY. */
  setFocus: FormAction<MediaActionResult>;
};

import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { ComplexMediaResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import type { Point, UnitContour } from "./contours";

// Вкладка ЖК «Фасад и планы» (фаза 4): что читает сервер и какие действия получает форма.

export type FacadeImage = { src: string; width: number; height: number };

export type FacadeBlock = {
  id: string;
  name: string;
  floorsTotal: number | null;
  contour: Point[] | null;
  /** Подъезды блока по списку квартир (пусто — списка нет). */
  entrances: number[];
  /** Места на этаже по подъездам: позиции стояков из списка квартир. */
  slots: { entrance: number; position: number }[];
};

export type FacadePlan = {
  id: string;
  blockId: string;
  entrance: number | null;
  floorFrom: number;
  floorTo: number;
  image: FacadeImage;
  contours: UnitContour[];
};

export type FacadeTabData = {
  facade: FacadeImage | null;
  blocks: FacadeBlock[];
  plans: FacadePlan[];
};

export type FacadeResult = { status: "done" } | { status: "error"; error: ContentErrorCode };

export type FacadeActions = {
  setFacade: FormAction<ComplexMediaResult>;
  removeFacade: (complexId: string) => Promise<FacadeResult>;
  setBlockContour: (blockId: string, contour: Point[] | null) => Promise<FacadeResult>;
  /** Поля: plan?, block, entrance, from, to; с картинкой — ещё id (ЖК), path, width, height, blur, rule12. */
  savePlan: FormAction<ComplexMediaResult>;
  setPlanContours: (planId: string, entrance: number | null, contours: UnitContour[]) => Promise<FacadeResult>;
  deletePlan: (planId: string) => Promise<FacadeResult>;
};

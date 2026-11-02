import {
  attachShowcaseMediaAction,
  removeShowcaseMediaAction,
  setShowcaseMediaFocusAction,
} from "@/lib/admin/actions/showcaseMedia";
import type { ShowcaseMediaActions } from "@/lib/admin/showcase/types";

/** Обложка записи витрины: один набор действий для трёх страниц. */
export const SHOWCASE_MEDIA_ACTIONS: ShowcaseMediaActions = {
  attach: attachShowcaseMediaAction,
  remove: removeShowcaseMediaAction,
  setFocus: setShowcaseMediaFocusAction,
};

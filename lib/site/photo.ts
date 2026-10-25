import { MEDIA_FRAMES, objectPosition, type FocusPoint, type MediaFrameKey } from "@/lib/media";

// Фото сайта (PLAN 3а): кадр мокапа (обложка 16:9, карточка 4:3, телефон 4:5) и место кадра по
// точке фокуса руководителя. Пропорция и место — CSS-переменными: на телефоне кадр бывает другим.

export type SitePhotoData = {
  /** Путь в бакете media (media_assets.path). */
  path: string;
  width: number;
  height: number;
  /** Крошечное размытое превью (data URL) — заглушка, пока грузится фото. */
  blur: string | null;
  focus: FocusPoint;
};

const RATIO = Object.fromEntries(MEDIA_FRAMES.map(({ key, ratio }) => [key, ratio])) as Record<
  MediaFrameKey,
  number
>;

// aspect-ratio принимает и дробь: 16 / 9 → «1.7777…».
const ratioText = (frame: MediaFrameKey) => String(RATIO[frame]);

/** Переменные кадра: --photo-ratio, --photo-position и, если на телефоне кадр другой, их -phone пара. */
export function photoFrameVars(
  photo: SitePhotoData,
  frame: MediaFrameKey,
  phoneFrame?: MediaFrameKey,
): Record<string, string> {
  const vars: Record<string, string> = {
    "--photo-ratio": ratioText(frame),
    "--photo-position": objectPosition(photo, RATIO[frame], photo.focus),
  };
  if (phoneFrame && phoneFrame !== frame) {
    vars["--photo-ratio-phone"] = ratioText(phoneFrame);
    vars["--photo-position-phone"] = objectPosition(photo, RATIO[phoneFrame], photo.focus);
  }
  return vars;
}

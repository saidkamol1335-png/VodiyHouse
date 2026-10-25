import Image from "next/image";
import type { CSSProperties } from "react";
import type { MediaFrameKey } from "@/lib/media";
import { mediaPublicUrl } from "@/lib/media";
import { photoFrameVars, type SitePhotoData } from "@/lib/site/photo";

type SitePhotoProps = {
  photo: SitePhotoData;
  /** Подпись для диктора: alt фото на языке страницы, без него — название ЖК. */
  alt: string;
  /** Кадр мокапа: обложка 16:9, карточка 4:3, телефон 4:5. */
  frame: MediaFrameKey;
  /** Кадр на телефоне, если он другой (карточка 4:3 → 4:5). */
  phoneFrame?: MediaFrameKey;
  /** Ширина фото на экране для выбора размера: «(max-width: 760px) 100vw, 400px». */
  sizes: string;
  /** Первый экран (обложка, первые карточки) — грузится сразу: это LCP. */
  priority?: boolean;
  /** Микс с элементом блока-владельца по БЭМ (скругление, место в сетке). */
  className?: string;
};

/**
 * Фото сайта (PLAN 3а): next/image (WebP / AVIF и размеры под экран), кадр по точке фокуса,
 * размытая заглушка, пока грузится. Файлы — публичный бакет media Supabase.
 */
export function SitePhoto({ photo, alt, frame, phoneFrame, sizes, priority = false, className }: SitePhotoProps) {
  const src = mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", photo.path);
  return (
    <div
      className={["site-photo", className].filter(Boolean).join(" ")}
      style={photoFrameVars(photo, frame, phoneFrame) as CSSProperties}
    >
      <Image
        className="site-photo__image"
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={photo.blur ? "blur" : "empty"}
        blurDataURL={photo.blur ?? undefined}
      />
    </div>
  );
}

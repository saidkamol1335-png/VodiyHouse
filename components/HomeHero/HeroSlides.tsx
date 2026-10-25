"use client";

import { SitePhoto } from "@/components/SitePhoto";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { useMotion } from "@/lib/motion";

/**
 * Фото видоискателя: в lite и none видно только первое — остальные места не рисуются и не
 * скачиваются (телефон в lite не тянет четыре лишние картинки); в full — все пять по кругу.
 */
export function HeroSlides({ photos }: { photos: readonly { photo: CatalogPhoto; name: string }[] }) {
  const tier = useMotion();
  const shown = tier === "full" ? photos : photos.slice(0, 1);
  return shown.map((item, index) => (
    <div key={index} className="home-hero__vf-photo" style={{ ["--vf-index" as string]: index }}>
      <SitePhoto photo={item.photo} alt="" frame="phone" sizes="(max-width: 760px) 300px, 420px" />
    </div>
  ));
}

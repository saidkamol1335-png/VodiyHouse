"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/events/client";
import { toggleFavorite, useFavorites } from "@/lib/site/favorites";

type FavoriteButtonProps = {
  slug: string;
  /** «ЖК Shodlik» — для диктора: «В избранное: ЖК Shodlik». */
  name: string;
  /** Микс с элементом блока-владельца по БЭМ (место на фото карточки, на странице ЖК). */
  className?: string;
};

/** Сердце (мокап .jc__icons, ТЗ: избранное без входа): нажатие добавляет ЖК в избранное или убирает. */
export function FavoriteButton({ slug, name, className }: FavoriteButtonProps) {
  const t = useTranslations("share");
  const on = useFavorites().includes(slug);
  return (
    <button
      type="button"
      className={[on ? "favorite-button favorite-button--on" : "favorite-button", className].filter(Boolean).join(" ")}
      aria-pressed={on}
      aria-label={t(on ? "unfavorite" : "favorite", { name })}
      onClick={() => {
        toggleFavorite(slug);
        if (!on) track("favorite", { detail: name });
      }}
    >
      <Heart size={16} strokeWidth={2} aria-hidden />
    </button>
  );
}

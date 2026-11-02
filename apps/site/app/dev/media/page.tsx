import { notFound } from "next/navigation";
import { MediaLab } from "@/components/MediaLab";

// Стенд подготовки фото перед загрузкой (шаг 9 фазы 1). В продакшене страницы нет.
export default function DevMediaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MediaLab />;
}

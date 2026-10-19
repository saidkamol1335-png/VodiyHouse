import { notFound } from "next/navigation";
import { DevHeaderStage } from "@/components/DevHeaderStage";

// Проверка шапки поверх фото (решение Ш6). В продакшене страницы нет.
export default function DevHeaderPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevHeaderStage />;
}

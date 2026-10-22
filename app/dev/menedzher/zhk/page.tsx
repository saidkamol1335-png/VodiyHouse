import { ComplexesStand, MANAGER_STAND } from "../../zhk/stand";

export const instant = false;

// Стенд «ЖК» менеджера (Н2): тот же список без создания и статусов публикации — строка ведёт
// сразу на «Квартиры». В продакшене страницы нет.
export default async function DevManagerComplexesPage() {
  return <ComplexesStand stand={MANAGER_STAND} scopeId={null} />;
}

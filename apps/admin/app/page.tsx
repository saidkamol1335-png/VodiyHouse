import { redirect } from "next/navigation";

// Каркас фазы A: входа ещё нет — корень ведёт на экран входа. Главная кабинета — фаза D.
export default function AdminHome() {
  redirect("/vhod");
}

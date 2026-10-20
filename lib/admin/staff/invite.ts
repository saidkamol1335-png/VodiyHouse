import { ADMIN_ROUTES } from "../nav";

/** Адрес входа для сообщения сотруднику: с того же сайта, где открыт кабинет. */
export function loginUrlOf(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${ADMIN_ROUTES.login}`;
}

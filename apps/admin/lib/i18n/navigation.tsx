import type { ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { isRouteReady } from "@/lib/routes";
import { routing } from "./routing";

const navigation = createNavigation(routing);

/** redirect, usePathname и useRouter с учётом префикса /uz, /ru. */
export const { redirect, usePathname, useRouter, getPathname } = navigation;

type LinkProps = ComponentProps<typeof navigation.Link>;

/**
 * Link с префиксом языка. Ссылки на разделы, которых ещё нет в коде (шапка ведёт на страницы фазы 3),
 * не загружаются заранее: иначе продакшен-сборка ловит 404 в консоли.
 */
export function Link({ prefetch, ...props }: LinkProps) {
  const pathname = typeof props.href === "string" ? props.href : props.href.pathname;
  return <navigation.Link prefetch={prefetch ?? (isRouteReady(pathname) ? undefined : false)} {...props} />;
}

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Link, redirect, usePathname и useRouter с учётом префикса /uz, /ru. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

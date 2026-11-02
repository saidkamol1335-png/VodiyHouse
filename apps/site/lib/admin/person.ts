import { getTranslations } from "next-intl/server";
import type { CabinetViewer } from "./access";

/** Как сотрудник подписан в кабинете: имя, роль и имя для приветствия на Главной. */
export type CabinetPerson = {
  name: string;
  roleLabel: string;
  /** «Дилноза» из «Дилноза Юсупова»; null — режим разработки, приветствие без имени. */
  firstName: string | null;
};

export async function cabinetPerson(viewer: CabinetViewer): Promise<CabinetPerson> {
  const t = await getTranslations("admin.user");
  return {
    name: viewer.name ?? t("devName"),
    roleLabel: t(`roles.${viewer.role}`),
    firstName: viewer.name ? (viewer.name.split(/\s+/)[0] ?? null) : null,
  };
}

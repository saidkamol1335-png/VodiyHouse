import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminTopbar } from "@/components/AdminTopbar";
import { GuidePage } from "@/components/GuidePage";
import { GUIDES, type GuideRole } from "@/lib/admin/guide";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";
import { requireSection } from "@/lib/admin/session";

export const instant = false;

// Памятки других ролей руководителю — ?rol=menedzher|mobilograf: он вводит сотрудников в работу.
const ROLE_PARAM: Record<Exclude<GuideRole, "head">, string> = {
  manager: "menedzher",
  mobilographer: "mobilograf",
};

function shownRole(viewerRole: GuideRole, param: string | string[] | undefined): GuideRole {
  if (viewerRole !== "head") return viewerRole;
  const found = Object.entries(ROLE_PARAM).find(([, value]) => value === param);
  return found ? (found[0] as GuideRole) : "head";
}

/** «Памятка» (фаза F, п. 42): каждой роли своя; тот же текст — в docs/*-guide.md. */
export default async function GuideRoute({ searchParams }: PageProps<"/pamyatka">) {
  const { viewer, allowed } = await requireSection("guide");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar title={t("guide.title")} subtitle={t("guide.subtitle")} person={person} />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.guide")} />
      </AdminPage>
    );
  }
  const role = shownRole(viewer.role, (await searchParams).rol);
  const tabs = (["head", "manager", "mobilographer"] as const).map((key) => ({
    segment: key === "head" ? null : ROLE_PARAM[key],
    href: key === "head" ? ADMIN_ROUTES.guide : `${ADMIN_ROUTES.guide}?rol=${ROLE_PARAM[key]}`,
    label: t(`guide.roles.${key}`),
  }));
  return (
    <AdminPage topbar={topbar}>
      {viewer.role === "head" ? (
        <AdminTabs
          label={t("guide.tabsLabel")}
          tabs={tabs}
          className="guide-page__tabs"
          current={role === "head" ? null : ROLE_PARAM[role]}
        />
      ) : null}
      <GuidePage guide={GUIDES[role]} />
    </AdminPage>
  );
}

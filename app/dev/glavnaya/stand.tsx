import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/AdminPage";
import { AdminShell } from "@/components/AdminShell";
import { AdminTopbar } from "@/components/AdminTopbar";
import { SiteStockPanel } from "@/components/SiteStockPanel";
import { demoSiteStock, siteStockScenario } from "@/lib/admin/home/demo";
import { cabinetPerson } from "@/lib/admin/person";
import { devOnlyStand, type ComplexStand } from "../zhk/stand";
import { demoReadSiteStockAction } from "./actions";

// Стенд главной кабинета (шаг 13) на DEMO сида: та же панель «Остатки по ЖК», что у /admin, по
// ролям — /dev/glavnaya (руководитель) и /dev/menedzher/glavnaya (менеджер); «Квартиры →» ведёт
// на стенд «ЖК» той же роли. Сценарии — ?demo= (lib/admin/home/demo.ts). Заголовок — без
// приветствия: оно по часам сервера, а скриншоты должны совпадать. В продакшене стенда нет.

type HomeStandProps = { stand: ComplexStand; demo: unknown };

export async function HomeStand({ stand, demo }: HomeStandProps) {
  devOnlyStand();
  const scenario = siteStockScenario(demo);
  const person = await cabinetPerson(stand.viewer);
  const t = await getTranslations("admin");
  const subtitle = `DEMO · служебная страница · ${person.roleLabel}`;
  return (
    <AdminShell viewer={stand.viewer}>
      <AdminPage topbar={<AdminTopbar title={t("nav.home")} subtitle={subtitle} person={person} />}>
        <SiteStockPanel
          initial={demoSiteStock(scenario)}
          read={demoReadSiteStockAction.bind(null, scenario)}
          complexesHref={stand.base}
        />
      </AdminPage>
    </AdminShell>
  );
}

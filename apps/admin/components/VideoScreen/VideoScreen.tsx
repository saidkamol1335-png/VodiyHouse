import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { AdminPanel } from "@/components/AdminPanel";

/** «Как снимать» (мокап CabVideo; фаза E): пункты по порядку. */
const HOW_TO = ["month", "plan", "unit", "rule12", "youtube", "draft"] as const;

/**
 * «Новый отчёт» (фаза 5, мокап CabVideo .grid-main 1.6fr / 1fr; фаза E): слева форма, справа «Как
 * снимать»; до 1180 px — колонкой, подсказки под формой. «Мои отчёты» — своей вкладкой.
 */
export async function VideoScreen({ form }: { form: ReactNode }) {
  const t = await getTranslations("admin.video");
  return (
    <div className="video-screen">
      <div className="video-screen__main">{form}</div>
      <div className="video-screen__side">
        <AdminPanel title={t("howTo.title")}>
          <ul className="video-screen__howto">
            {HOW_TO.map((key) => (
              <li key={key}>
                <Check size={16} aria-hidden="true" />
                {t(`howTo.items.${key}`)}
              </li>
            ))}
          </ul>
        </AdminPanel>
      </div>
    </div>
  );
}

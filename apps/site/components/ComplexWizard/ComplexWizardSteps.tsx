import { getTranslations } from "next-intl/server";
import { wizardSteps } from "@/lib/admin/complexes/tabs";
import { ComplexWizard } from "./ComplexWizard";

/** Шаги мастера с подписями «Далее: 3. Планировки» — для layout ЖК в кабинете и на стенде. */
export async function ComplexWizardSteps({ base }: { base: string }) {
  const t = await getTranslations("admin.complexes");
  const steps = wizardSteps(base, (key, step) => t("wizard.next", { step: `${step}. ${t(`tabs.${key}`)}` }));
  return <ComplexWizard steps={steps} label={t("wizard.label")} lastHint={t("wizard.last")} />;
}

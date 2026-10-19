import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Heading } from "@/components/Heading";

// Заглушка: экран входа и боковое меню — после дизайн-интервью (CLAUDE.md §2).
export default async function AdminEntryPage() {
  const t = await getTranslations({ locale: "ru", namespace: "admin.login" });
  return (
    <Container as="main" narrow>
      <div className="flex flex-col gap-4 py-24">
        <Heading level={2}>{t("title")}</Heading>
        <p className="text-muted-foreground">{t("phase1")}</p>
      </div>
    </Container>
  );
}

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";

/** 10 запасных кодов — один раз (п. 28); null — уже выданы раньше: только переход в кабинет. */
export function BackupCodes({ codes, next }: { codes: readonly string[] | null; next: string }) {
  const t = useTranslations("admin.secondFactor");
  return (
    <div className="second-factor second-factor__step">
      {codes ? (
        <ol className="second-factor__codes">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>
      ) : null}
      <Button href={next} block>
        {codes ? t("backupDone") : t("toCabinet")}
      </Button>
    </div>
  );
}

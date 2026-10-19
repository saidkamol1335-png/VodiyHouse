import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { LoginForm } from "@/components/LoginForm";
import { LogoMark } from "@/components/Logo";

type LoginCardProps = {
  devOpenHref: string | null;
};

/** Карточка входа мокапа: 440 px, стекло, луч по рамке (решения К1.2, К1.3). */
export async function LoginCard({ devOpenHref }: LoginCardProps) {
  const t = await getTranslations("admin.login");
  return (
    <section className="login-card" aria-labelledby="login-title">
      <span className="login-card__beam" aria-hidden="true" />
      <div className="login-card__brand">
        <LogoMark className="login-card__mark" />
        Vodiy House
      </div>
      <h1 id="login-title" className="login-card__title">
        {t("title")}
      </h1>
      <p className="login-card__lead">{t("lead")}</p>
      <LoginForm devOpenHref={devOpenHref} />
      <p className="login-card__forgot">{t("forgot")}</p>
      <Button href="/" variant="ghost" size="sm" className="login-card__to-site">
        <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
        {t("toSite")}
      </Button>
    </section>
  );
}

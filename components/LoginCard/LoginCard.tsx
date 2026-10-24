import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Beam } from "@/components/Beam";
import { Button } from "@/components/Button";
import { LogoMark } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";

type LoginCardProps = {
  title: string;
  lead: string;
  /** Форма карточки: вход или смена пароля. */
  children: ReactNode;
  /** login — «Забыли пароль?» и «На сайт»; password — «Выйти» (смена пароля после входа). */
  footer: "login" | "password";
};

/** Карточка входа мокапа: 440 px, стекло, луч по рамке (решения К1.2, К1.3, С4). */
export async function LoginCard({ title, lead, children, footer }: LoginCardProps) {
  const t = await getTranslations("admin.login");
  return (
    <section className="login-card" aria-labelledby="login-title">
      <Beam />
      <div className="login-card__brand">
        <LogoMark className="login-card__mark" />
        Vodiy House
      </div>
      <h1 id="login-title" className="login-card__title">
        {title}
      </h1>
      <p className="login-card__lead">{lead}</p>
      {children}
      {footer === "login" ? (
        <>
          <p className="login-card__forgot">{t("forgot")}</p>
          <Button href="/" variant="ghost" size="sm" className="login-card__to-site">
            <ArrowLeft size={16} strokeWidth={1.8} aria-hidden />
            {t("toSite")}
          </Button>
        </>
      ) : (
        <div className="login-card__logout">
          <LogoutButton variant="ghost" />
        </div>
      )}
    </section>
  );
}

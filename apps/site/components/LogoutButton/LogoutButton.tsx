import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { signOutAction } from "@/lib/admin/actions/auth";

type LogoutButtonProps = {
  /** icon — в карточке сотрудника панели, menu — строка меню аватара, ghost — под формой пароля. */
  variant: "icon" | "menu" | "ghost";
};

/** «Выйти» — POST-форма с Server Action, а не ссылка: GET не должен закрывать сессию. */
export function LogoutButton({ variant }: LogoutButtonProps) {
  const t = useTranslations("admin.user");
  const label = t("logout");
  return (
    <form action={signOutAction} className={`logout-button logout-button--${variant}`}>
      {variant === "icon" ? (
        <button type="submit" className="icon-button icon-button--sm icon-button--bare" aria-label={label} title={label}>
          <LogOut size={18} strokeWidth={1.8} aria-hidden />
        </button>
      ) : null}
      {variant === "menu" ? (
        <button type="submit" className="logout-button__menu-item">
          <LogOut size={16} strokeWidth={1.8} aria-hidden />
          {label}
        </button>
      ) : null}
      {variant === "ghost" ? (
        <Button type="submit" variant="ghost" size="sm">
          <LogOut size={16} strokeWidth={1.8} aria-hidden />
          {label}
        </Button>
      ) : null}
    </form>
  );
}

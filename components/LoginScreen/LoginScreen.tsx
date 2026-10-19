import { LoginBackdrop } from "@/components/LoginBackdrop";
import { LoginCard } from "@/components/LoginCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LOGIN_VIDEO } from "@/lib/admin/loginMedia";

type LoginScreenProps = {
  devOpenHref: string | null;
};

/** Экран входа: таймлапс стройки на весь экран, карточка по центру, ☀/☾ в шапке экрана (К1.4). */
export function LoginScreen({ devOpenHref }: LoginScreenProps) {
  return (
    <main className="login-screen">
      <LoginBackdrop video={LOGIN_VIDEO} />
      <div className="login-screen__bar">
        <ThemeToggle className="login-screen__theme" />
      </div>
      <div className="login-screen__stage">
        <LoginCard devOpenHref={devOpenHref} />
      </div>
    </main>
  );
}

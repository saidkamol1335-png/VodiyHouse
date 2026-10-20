import type { ReactNode } from "react";
import { LoginBackdrop } from "@/components/LoginBackdrop";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LOGIN_VIDEO } from "@/lib/admin/loginMedia";

/** Экран входа: таймлапс стройки на весь экран, карточка по центру, ☀/☾ в шапке экрана (К1.4). */
export function LoginScreen({ children }: { children: ReactNode }) {
  return (
    <main className="login-screen">
      <LoginBackdrop video={LOGIN_VIDEO} />
      <div className="login-screen__bar">
        <ThemeToggle className="login-screen__theme" />
      </div>
      <div className="login-screen__stage">{children}</div>
    </main>
  );
}

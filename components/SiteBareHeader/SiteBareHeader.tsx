import { Container } from "@/components/Container";
import { Logo } from "@/components/Logo";

/**
 * Шапка экранов 404 и «временно недоступно»: только знак со ссылкой на главную. Полная SiteHeader
 * (клиентская: меню, язык, тема) в границах ошибки и 404 у Turbopack попадает в свои чанки — и
 * каждая страница сайта грузила её код дважды.
 */
export function SiteBareHeader() {
  return (
    <header className="site-bare-header">
      <Container>
        <div className="site-bare-header__inner">
          <Logo />
        </div>
      </Container>
    </header>
  );
}

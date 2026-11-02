// Экран входа — каркас фазы A: разметка и стиль без логики. Вход, роли, Turnstile и код
// руководителя в Telegram — фаза D (PLAN §10, п. 8).
export function AdminLogin() {
  return (
    <main className="admin-login">
      <section className="admin-login__card" aria-labelledby="admin-login-title">
        <p className="admin-login__brand">
          Vodiy House <span className="admin-login__brand-note">кабинет</span>
        </p>
        <h1 id="admin-login-title" className="admin-login__title">
          Вход для сотрудников
        </h1>
        <form className="admin-login__form">
          <label className="admin-login__field">
            <span className="admin-login__label">Email</span>
            <input className="admin-login__input" type="email" name="email" autoComplete="username" disabled />
          </label>
          <label className="admin-login__field">
            <span className="admin-login__label">Пароль</span>
            <input className="admin-login__input" type="password" name="password" autoComplete="current-password" disabled />
          </label>
          <button className="admin-login__submit" type="submit" disabled>
            Войти
          </button>
        </form>
        <p className="admin-login__note">Кабинет переезжает на этот адрес. Вход откроется после переезда.</p>
      </section>
    </main>
  );
}

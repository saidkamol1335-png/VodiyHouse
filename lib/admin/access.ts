// Фаза 0: настоящего входа ещё нет (Supabase Auth — фаза 1). Оболочка кабинета открыта
// без входа только при разработке; в продакшен-сборке — только экран входа.
export const isCabinetOpenWithoutLogin = process.env.NODE_ENV !== "production";

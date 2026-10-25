-- Фаза 2 · 2.9б: права сервера (service_role) на таблицы — как решено в шаге 8 фазы 1 и в 2.2.
-- Облачный проект создан с правами по умолчанию на новые таблицы public для anon, authenticated
-- и service_role (pg_default_acl владельца postgres). anon и authenticated миграции закрывают
-- сами, а service_role — нет: заглушка PGlite считала его закрытым, и секретный ключ получил все
-- таблицы. Серверу нужны только профили (сотрудники, первый руководитель) и настройки (курс ЦБ).
revoke all on all tables in schema public from service_role;
revoke all on all sequences in schema public from service_role;
grant select, insert, update on public.profiles, public.settings to service_role;

-- Таблицы следующих миграций — тоже без прав сервера: нужны — явный grant, как выше.
alter default privileges for role postgres in schema public revoke all on tables from service_role;
alter default privileges for role postgres in schema public revoke all on sequences from service_role;

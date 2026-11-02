-- Проект-2, фаза C: находки ревью (агент, только чтение, 02.11.2026).
--  1. Сайт включает предпросмотр только по гранту, который база подтвердила: site_preview_slug()
--     отдаёт slug ЖК из действующего гранта (токен — заголовок x-vh-preview), иначе null.
--  2. Адрес вебхука заявок — в Vault (lead_hook_url), а не в settings: настройки правит руководитель
--     через API, и подменённый адрес увёл бы секрет вебхука. Только https. Выборки — внутри
--     обработчика ошибок: сбой вебхука никогда не роняет заявку.
--  3. Подписанный JSON с \u0000 (22P05) — тот же отказ vh:invalid, что и прочий неверный JSON.

create function public.site_preview_slug()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug from public.complexes c where c.id = private.preview_complex()
$$;

revoke all on function public.site_preview_slug() from public, authenticated;
grant execute on function public.site_preview_slug() to anon;

create or replace function private.notify_lead_hook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
  secret text;
begin
  if to_regnamespace('net') is null then
    return null;
  end if;
  hook_url := private.vault_secret('lead_hook_url');
  secret := private.vault_secret('lead_hook_secret');
  if hook_url is null or hook_url !~ '^https://[a-z0-9.-]+(:[0-9]+)?/api/hooks/lead$'
     or secret is null or length(secret) < 32 then
    return null;
  end if;
  -- Запрос уходит после фиксации транзакции (pg_net — очередь); динамически: без pg_net функция
  -- создаётся и в окружении без расширения (тесты).
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 5000)'
    using hook_url,
      jsonb_build_object('id', new.id),
      jsonb_build_object('content-type', 'application/json', 'x-vh-hook-secret', secret);
  return null;
exception when others then
  -- Вебхук не должен ронять заявку: её доставит расписание.
  raise warning 'leads hook: %', sqlerrm;
  return null;
end;
$$;

-- Адрес из settings больше не читается; строка, если была, — удаляется (адрес — в Vault).
delete from public.settings where key = 'leads.hook_url';

do $$
declare
  body text := pg_get_functiondef('private.verify_site_signature(text, text, bigint, text)'::regprocedure);
begin
  if position('exception when invalid_text_representation then' in body) = 0 then
    raise exception 'private.verify_site_signature: не найден обработчик неверного JSON';
  end if;
  execute replace(body, 'exception when invalid_text_representation then',
    'exception when invalid_text_representation or untranslatable_character then');
end;
$$;

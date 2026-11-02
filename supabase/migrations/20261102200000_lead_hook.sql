-- Проект-2, фаза C (PLAN §10, п. 5): доставка заявок — в админке. Новая заявка (подписанный вызов
-- сайта или бот) → триггер → pg_net POST <админка>/api/hooks/lead {id} с секретом из Vault
-- (lead_hook_secret; тот же — env админки LEAD_HOOK_SECRET). Адрес — настройка leads.hook_url
-- (у тестового и боевого окружения он свой). Нет pg_net, адреса или секрета — вебхук молчит, заявку
-- доставит расписание админки (cron leads, каждые 5 минут) — заявка не теряется ни при каком сбое.

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net недоступен — вебхук заявок выключен, доставка по расписанию';
end;
$$;

-- Секрет из Vault по имени; нет Vault или секрета — null (как site_signing_secret).
create function private.vault_secret(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (select s.decrypted_secret from vault.decrypted_secrets s where s.name = p_name limit 1);
exception when undefined_table or invalid_schema_name then
  return null;
end;
$$;

revoke all on function private.vault_secret(text) from public, anon, authenticated;

create function private.notify_lead_hook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text := (select s.value #>> '{}' from public.settings s where s.key = 'leads.hook_url' and jsonb_typeof(s.value) = 'string');
  secret text;
begin
  if hook_url is null or hook_url !~ '^https?://' or to_regnamespace('net') is null then
    return null;
  end if;
  secret := private.vault_secret('lead_hook_secret');
  if secret is null or length(secret) < 32 then
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

revoke all on function private.notify_lead_hook() from public;

create trigger leads_notify_hook
  after insert on public.leads
  for each row execute function private.notify_lead_hook();

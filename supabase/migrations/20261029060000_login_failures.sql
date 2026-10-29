-- Проверка безопасности 29.10 (п. 4): свой лимит неверных паролей на форме входа в кабинет — строже
-- лимита Supabase Auth (30 входов за 5 минут на адрес). Ключ — HMAC от email и адреса посетителя
-- (считает сервер секретным ключом, lib/admin/server/deps.ts): 10 попыток за 15 минут закрывают вход
-- с этим email только с этого адреса. Сотрудника с другого адреса чужой подбор не запирает, а по
-- ответу не узнать, есть ли такой email. Прямой запрос в Auth мимо формы этот лимит не видит — там
-- остаётся лимит Auth по адресу (полная защита — CAPTCHA Auth, TODO-заказчик «Запуск»).
-- Вызывает только сервер секретным ключом.

create table public.login_failures (
  id bigint generated always as identity primary key,
  attempt_key text not null check (attempt_key ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index login_failures_key_time on public.login_failures (attempt_key, created_at);
create index login_failures_time on public.login_failures (created_at);

comment on table public.login_failures is
  'Попытки входа в кабинет по HMAC(email, адрес); удачный вход стирает свои, старше суток удаляются.';

alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated, service_role;

-- Перед проверкой пароля: false — вход закрыт (10 попыток за 15 минут), иначе попытка записана
-- заранее. Счёт и запись под замком ключа: параллельная пачка не проходит больше 10.
create function public.begin_login_attempt(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('login-attempt:' || p_key, 0));
  if (select count(*) from public.login_failures f
      where f.attempt_key = p_key and f.created_at > now() - interval '15 minutes') >= 10 then
    return false;
  end if;
  insert into public.login_failures (attempt_key) values (p_key);
  delete from public.login_failures f where f.created_at < now() - interval '1 day';
  return true;
end;
$$;

-- Пароль верный — попытки этого ключа стёрты.
create function public.clear_login_attempts(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.login_failures f where f.attempt_key = p_key
$$;

revoke all on function public.begin_login_attempt(text), public.clear_login_attempts(text)
  from public, anon, authenticated;
grant execute on function public.begin_login_attempt(text), public.clear_login_attempts(text)
  to service_role;

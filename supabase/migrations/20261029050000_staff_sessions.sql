-- Проверка безопасности 29.10 (п. 1): «Новый пароль» и «Отключить» закрывают уже открытые сессии
-- сотрудника, а сессия с флагом «сменить пароль» не получает в базе прав роли.
-- Раньше флаг проверял только Next (кабинет вёл на /admin/parol), а украденная сессия через Data API
-- (публичный ключ + токен сотрудника) работала со всеми правами роли и продлевалась refresh-токеном:
-- смена пароля через Auth Admin API открытые сессии не закрывает.
--
-- Закрытие — два слоя. Строки auth.sessions удаляются (refresh-токены — каскадом): Auth больше не
-- продлевает вход и не принимает токен этой сессии. Но уже выданный access-токен (до jwt_expiry,
-- час) Data API проверяет только по подписи — его отсекает profiles.sessions_revoked_at: роль есть
-- только у токена, выданного позже (claim iat). Иначе после смены пароля или «Включить» старый
-- токен снова получил бы права до конца своего часа.
-- Закрывает триггер на любом пути (сессия руководителя, сервер, scripts/staff-create-head.mjs --reset,
-- SQL-консоль): отключение и флаг смены пароля false → true. «Новый пароль» при уже стоящем флаге
-- закрывает сессии сам.

alter table public.profiles add column sessions_revoked_at timestamptz;

comment on column public.profiles.sessions_revoked_at is
  'Когда закрыты все сессии сотрудника; токены, выданные раньше, прав роли не дают. Ставят только триггер и require_password_change.';

-- ─── Роль — только после смены временного пароля и только у токена новее закрытия ─────────
-- Свой профиль такая сессия по-прежнему видит (политика «каждый — себя»): его читают вход и /admin/parol.
create or replace function private.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and not p.must_change_password
    and (p.sessions_revoked_at is null
         or coalesce((auth.jwt() ->> 'iat')::bigint, 0) > floor(extract(epoch from p.sessions_revoked_at)))
$$;

comment on function private.staff_role() is
  'Роль текущего сотрудника; null — посетитель, чужой, отключённый, ещё не сменивший временный пароль или токен старше закрытия сессий.';

-- ─── Закрыть сессии ───────────────────────────────────────────────────────────────────────
create function private.end_staff_sessions(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions s where s.user_id = p_user
$$;

revoke all on function private.end_staff_sessions(uuid) from public, anon, authenticated;

-- BEFORE: отметка времени попадает в ту же строку и ту же запись журнала, что и сама правка.
create function private.revoke_sessions_on_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.is_active and not new.is_active) or (new.must_change_password and not old.must_change_password) then
    new.sessions_revoked_at := now();
    perform private.end_staff_sessions(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.revoke_sessions_on_lock() from public, anon, authenticated;

create trigger profiles_revoke_sessions
  before update of is_active, must_change_password on public.profiles
  for each row execute function private.revoke_sessions_on_lock();

-- «Новый пароль»: тело прежнее (20261020120000_staff_auth.sql), плюс закрытие сессий и тогда, когда
-- флаг уже стоял (сотрудник ещё не входил, а пароль выдают снова).
create or replace function public.require_password_change(staff_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Новый пароль выдаёт руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if staff_id = (select auth.uid()) then
    raise exception 'Свой пароль меняют на экране смены пароля'
      using errcode = 'insufficient_privilege', hint = 'vh:self';
  end if;
  update public.profiles set must_change_password = true, sessions_revoked_at = now() where id = staff_id;
  if not found then
    raise exception 'Сотрудник не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.end_staff_sessions(staff_id);
end;
$$;

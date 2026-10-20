-- Фаза 1 · шаг 8: вход сотрудников и «Настройки → Сотрудники».
-- Пользователя Auth создаёт сервер (Auth Admin API, секретный ключ). Профиль, отключение и
-- «Новый пароль» — сессией руководителя: работают RLS, защита своего профиля и автор в журнале.
-- Флаг смены пароля снимает только сервер — после настоящей смены пароля сотрудником.

-- ─── Права сервера ────────────────────────────────────────────────────────────────────────
-- Явно, а не через права по умолчанию: в облаке они могут быть выключены для новых таблиц.
-- Нужны снятию флага смены пароля и первому руководителю (scripts/staff-create-head.mjs).
grant select, insert, update on public.profiles to service_role;

-- ─── Профиль добавляет руководитель своей сессией ─────────────────────────────────────────
-- Флагов нет в списке колонок: новый сотрудник всегда активен и обязан сменить пароль.
grant insert (id, full_name, role) on public.profiles to authenticated;

create policy "profiles: добавляет руководитель"
  on public.profiles for insert to authenticated
  with check ((select private.has_role('head')));

comment on table public.profiles is
  'Сотрудники Vodiy House. Пользователя Auth создаёт сервер (service_role), профиль — руководитель своей сессией; регистрации нет.';

-- ─── Машиночитаемые причины отказа ───────────────────────────────────────────────────────
-- hint = 'vh:…' — код для интерфейса (lib/admin/authErrors.ts); текст ошибки прежний.
create or replace function private.guard_own_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = (select auth.uid()) and (new.role is distinct from old.role or not new.is_active) then
    raise exception 'Нельзя поменять свою роль или отключить себя'
      using errcode = 'insufficient_privilege', hint = 'vh:self';
  end if;
  return new;
end;
$$;

-- ─── Хотя бы один активный руководитель ───────────────────────────────────────────────────
-- На любом пути: сессия, сервер, SQL-консоль, двое руководителей одновременно. Замок до конца
-- транзакции выстраивает такие правки в очередь: второй запрос после замка видит уже
-- зафиксированное первым, а внутри одного UPDATE — строки, обработанные раньше.
create function private.keep_active_head()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'head' and old.is_active and (new.role <> 'head' or not new.is_active) then
    perform pg_advisory_xact_lock(hashtext('vodiy.active_head'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'head' and p.is_active and p.id <> old.id
    ) then
      raise exception 'Должен остаться хотя бы один активный руководитель'
        using errcode = 'check_violation', hint = 'vh:last_head';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.keep_active_head() from public;

-- Триггеры одного вида идут по алфавиту: profiles_guard_own раньше, и себе руководитель
-- получает прежнюю ошибку «Нельзя поменять свою роль», а не про последнего руководителя.
create trigger profiles_keep_active_head
  before update of role, is_active on public.profiles
  for each row execute function private.keep_active_head();
-- DELETE не охвачен намеренно: сотрудников не удаляют, а отключают; облачные тесты базы
-- (tests/db/remote.ts) удаляют все профили внутри откатываемой транзакции.

-- ─── «Новый пароль» ──────────────────────────────────────────────────────────────────────
-- Сессией руководителя ДО смены пароля в Auth: это и проверка права, и запись в журнале с автором.
create function public.require_password_change(staff_id uuid)
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
  update public.profiles set must_change_password = true where id = staff_id;
  if not found then
    raise exception 'Сотрудник не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

comment on function public.require_password_change(uuid) is
  'Руководитель выдаёт сотруднику новый пароль: при следующем входе — обязательная смена.';

revoke all on function public.require_password_change(uuid) from public, anon;
grant execute on function public.require_password_change(uuid) to authenticated;

-- ─── Список «Сотрудники» ─────────────────────────────────────────────────────────────────
-- Email и последний вход есть только в auth.users. «Вход закрыт» считается здесь, а не в
-- интерфейсе: в Server Component текущее время без io() запрещено (cacheComponents).
create function public.staff_directory()
returns table (
  id uuid,
  full_name text,
  role public.staff_role,
  is_active boolean,
  must_change_password boolean,
  email text,
  last_sign_in_at timestamptz,
  banned boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role, p.is_active, p.must_change_password,
         u.email::text, u.last_sign_in_at, coalesce(u.banned_until > now(), false), p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where (select private.has_role('head'))
  order by p.is_active desc, p.full_name
$$;

comment on function public.staff_directory() is
  'Сотрудники для «Настройки → Сотрудники»: только руководителю; остальным — пусто.';

revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;

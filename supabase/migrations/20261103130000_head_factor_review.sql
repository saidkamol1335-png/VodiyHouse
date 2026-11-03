-- Проект-2, фаза D — ревью второго фактора и прав менеджера (03.11.2026).
--   1. Свой TOTP-фактор, заведённый напрямую через Supabase Auth тем, кто знает пароль, давал aal2 и
--      права руководителя. Теперь сессия руководителя должна быть подтверждена тем фактором, секрет
--      которого хранит сервер (private.head_totp): auth.sessions.factor_id — фактор подтверждения.
--   2. Сброс второго фактора закрывает и уже выданные токены (sessions_revoked_at), а не только сессии.
--   3. Неверные коды входа и запасные коды: не больше 10 за сутки, дальше — только через сутки.
--   4. Менеджер добавляет в справочник только видимый пункт в конец списка.
--   5. Журнал менеджеру — только записи ЖК (п. 29): общий журнал «Настроек» — руководителю.

-- ─── 1. Фактор сессии — фактор сервера ───────────────────────────────────────────────────
create or replace function private.head_factor_fresh()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
       where a ->> 'method' = 'totp'
         and (a ->> 'timestamp')::bigint > extract(epoch from now() - interval '30 days')
     )
     and exists (
       select 1
       from auth.sessions s
       join private.head_totp h on h.user_id = s.user_id and h.factor_id = s.factor_id
       where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
         and s.user_id = (select auth.uid())
     );
$$;

revoke all on function private.head_factor_fresh() from public, anon;
grant execute on function private.head_factor_fresh() to authenticated;

-- Кабинет спрашивает то же самое: роль руководителя без этой проверки он не признаёт.
create function public.own_head_factor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.head_factor_fresh();
$$;

revoke all on function public.own_head_factor() from public, anon;
grant execute on function public.own_head_factor() to authenticated;

-- ─── 2. Сброс закрывает и выданные токены ────────────────────────────────────────────────
create or replace function public.reset_head_second_factor(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.staff_telegram t where t.user_id = p_user;
  delete from private.staff_telegram_links l where l.user_id = p_user;
  delete from private.head_totp h where h.user_id = p_user;
  delete from private.head_codes c where c.user_id = p_user;
  delete from private.head_backup_codes b where b.user_id = p_user;
  delete from private.head_factor_failures f where f.user_id = p_user;
  update public.profiles p set sessions_revoked_at = now() where p.id = p_user;
  perform private.end_staff_sessions(p_user);
end;
$$;

-- ─── 3. Неверные коды: 10 за сутки ───────────────────────────────────────────────────────
create table private.head_factor_failures (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  window_start timestamptz not null default now(),
  failures smallint not null default 0
);

revoke all on private.head_factor_failures from public, anon, authenticated;

-- Можно ли пробовать код: за последние сутки меньше 10 неверных.
create function private.head_factor_open(p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1 from private.head_factor_failures f
    where f.user_id = p_user and f.window_start > now() - interval '1 day' and f.failures >= 10
  );
$$;

create function private.note_head_factor(p_user uuid, p_ok boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_ok then
    delete from private.head_factor_failures f where f.user_id = p_user;
    return;
  end if;
  insert into private.head_factor_failures (user_id, failures) values (p_user, 1)
  on conflict (user_id) do update set
    failures = case when private.head_factor_failures.window_start > now() - interval '1 day'
                    then private.head_factor_failures.failures + 1 else 1 end,
    window_start = case when private.head_factor_failures.window_start > now() - interval '1 day'
                        then private.head_factor_failures.window_start else now() end;
end;
$$;

revoke all on function private.head_factor_open(uuid), private.note_head_factor(uuid, boolean) from public, anon, authenticated;

create or replace function public.check_head_code(p_user uuid, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code private.head_codes;
begin
  if not private.head_factor_open(p_user) then
    return false;
  end if;
  select * into v_code from private.head_codes c where c.user_id = p_user for update;
  if v_code.user_id is null or v_code.expires_at < now() or v_code.attempts >= 5 then
    perform private.note_head_factor(p_user, false);
    return false;
  end if;
  if v_code.code_hash = p_code_hash then
    delete from private.head_codes c where c.user_id = p_user;
    perform private.note_head_factor(p_user, true);
    return true;
  end if;
  update private.head_codes c set attempts = c.attempts + 1 where c.user_id = p_user;
  perform private.note_head_factor(p_user, false);
  return false;
end;
$$;

create or replace function public.use_head_backup_code(p_user uuid, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_used boolean;
begin
  if not private.head_factor_open(p_user) then
    return false;
  end if;
  update private.head_backup_codes b set used_at = now()
    where b.user_id = p_user and b.code_hash = p_code_hash and b.used_at is null;
  v_used := found;
  perform private.note_head_factor(p_user, v_used);
  return v_used;
end;
$$;

revoke all on function public.check_head_code(uuid, text), public.use_head_backup_code(uuid, text)
  from public, anon, authenticated;
grant execute on function public.check_head_code(uuid, text), public.use_head_backup_code(uuid, text) to service_role;

-- ─── 4. Справочники: менеджер — только видимый пункт в конец ─────────────────────────────
create function private.manager_dictionary_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.has_role('manager') and not private.has_role('head') then
    new.is_active := true;
    execute format('select coalesce(max(sort), 0) + 10 from public.%I', tg_table_name) into new.sort;
  end if;
  return new;
end;
$$;

revoke all on function private.manager_dictionary_insert() from public, anon, authenticated;

do $$
declare
  dictionary text;
begin
  foreach dictionary in array array['locations', 'document_types', 'detail_topics', 'finishings'] loop
    execute format(
      'create trigger %I before insert on public.%I for each row execute function private.manager_dictionary_insert()',
      dictionary || '_manager_insert', dictionary);
  end loop;
end;
$$;

-- ─── 5. Журнал менеджеру — только записи ЖК ──────────────────────────────────────────────
drop policy "audit_log: читают руководитель и менеджер" on public.audit_log;

create policy "audit_log: руководитель — всё, менеджер — записи ЖК"
  on public.audit_log for select to authenticated
  using (
    (select private.has_role('head'))
    or ((select private.has_role('manager')) and complex_id is not null)
  );

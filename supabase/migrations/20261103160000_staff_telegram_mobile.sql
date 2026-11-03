-- Проект-2, фаза E (PLAN §10, п. 36): мобилограф по желанию привязывает Telegram — туда приходят
-- «Возвращён: причина» и «Опубликован». Таблицы и ссылки — второго фактора руководителя
-- (20261103110000); вид привязки (kind) база берёт из роли, формат токена общий. Мобилограф сам
-- отвязывает и привязывает заново; руководитель — только сбросом разработчика (п. 28). Смена роли
-- снимает привязку, уход с роли руководителя — ещё и его второй фактор.

alter table private.staff_telegram_links
  add column kind text not null default 'head' check (kind in ('head', 'mobile'));

create or replace function public.create_staff_telegram_link(p_user uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  select case p.role when 'head' then 'head' when 'mobilographer' then 'mobile' end
    into v_kind from public.profiles p where p.id = p_user;
  if v_kind is null or exists (select 1 from private.staff_telegram t where t.user_id = p_user) then
    return false;
  end if;
  delete from private.staff_telegram_links l where l.user_id = p_user or l.expires_at < now();
  insert into private.staff_telegram_links (token_hash, user_id, expires_at, kind)
  values (p_token_hash, p_user, now() + interval '15 minutes', v_kind);
  return true;
end;
$$;

-- Ссылка, выданная до смены роли, не срабатывает.
create or replace function public.complete_staff_telegram_link(p_token_hash text, p_chat bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_kind text;
begin
  delete from private.staff_telegram_links l
    where l.token_hash = p_token_hash and l.expires_at > now()
    returning l.user_id, l.kind into v_user, v_kind;
  if v_user is null or not exists (
    select 1 from public.profiles p
    where p.id = v_user and p.role = case v_kind when 'head' then 'head' else 'mobilographer' end::public.staff_role
  ) then
    return null;
  end if;
  insert into private.staff_telegram (user_id, chat_id) values (v_user, p_chat)
    on conflict (user_id) do nothing;
  return v_user;
end;
$$;

create function public.unlink_staff_telegram(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.role = 'mobilographer') then
    raise exception 'Отвязать Telegram может мобилограф; руководителю — сброс разработчика'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  delete from private.staff_telegram_links l where l.user_id = p_user;
  delete from private.staff_telegram t where t.user_id = p_user;
  return true;
end;
$$;

revoke all on function public.unlink_staff_telegram(uuid) from public, anon, authenticated;
grant execute on function public.unlink_staff_telegram(uuid) to service_role;
comment on function public.unlink_staff_telegram(uuid) is 'Фаза E: мобилограф отвязывает Telegram (сервер).';

create function private.staff_role_unlink_telegram()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.staff_telegram_links l where l.user_id = new.id;
  delete from private.staff_telegram t where t.user_id = new.id;
  if old.role = 'head' then
    delete from private.head_totp t where t.user_id = new.id;
    delete from private.head_codes c where c.user_id = new.id;
    delete from private.head_backup_codes c where c.user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.staff_role_unlink_telegram() from public, anon, authenticated;

create trigger profiles_role_unlink_telegram
  after update of role on public.profiles
  for each row when (old.role is distinct from new.role)
  execute function private.staff_role_unlink_telegram();

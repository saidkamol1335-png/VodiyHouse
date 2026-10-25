-- Архив (шаг 3.13, PLAN §3.12, §3а «Архив»): ЖК и застройщик в архиве 30 дней (скрыты с сайта,
-- можно восстановить), потом удаляются окончательно — /api/cron/archive раз в сутки. За 3 дня —
-- напоминание руководителю в Telegram с CSV квартир; перед удалением CSV уходит ещё раз. Адрес
-- архивного или удалённого ЖК → 301 на каталог (site_retired_slug). Всё, кроме проверки адреса, —
-- только сервер (секретный ключ).

-- Адреса удалённых ЖК: страница по такому адресу — 301 на каталог, а не 404 (ссылки в рекламе, поиск).
create table public.retired_slugs (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  retired_at timestamptz not null default now()
);

alter table public.retired_slugs enable row level security;
revoke all on public.retired_slugs from anon, authenticated, service_role;

-- Напоминание «через 3 дня удалится» — одно на каждый уход в архив (восстановили и снова убрали — новое).
create table public.archive_notices (
  kind text not null check (kind in ('complex', 'developer')),
  entity_id uuid not null,
  archived_at timestamptz not null,
  reminded_at timestamptz not null default now(),
  primary key (kind, entity_id, archived_at)
);

alter table public.archive_notices enable row level security;
revoke all on public.archive_notices from anon, authenticated, service_role;

-- Что в архиве и когда уйдёт: ЖК (вне архивного застройщика — его ЖК уходят вместе с ним) и
-- застройщики; файлы — пути в бакете media, их сервер удалит через Storage API.
create function private.archive_items(p_from interval, p_to interval)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by item ->> 'archived_at'), '[]') from (
    select jsonb_build_object(
      'kind', 'complex', 'id', c.id, 'slug', c.slug, 'name', c.name, 'archived_at', c.archived_at,
      'purge_at', c.archived_at + interval '30 days',
      'complexes', jsonb_build_array(c.id),
      'media', (select coalesce(jsonb_agg(m.path), '[]') from public.media_assets m where m.complex_id = c.id)
    ) as item
    from public.complexes c
    join public.developers d on d.id = c.developer_id
    where c.status = 'archived' and d.status <> 'archived'
      and c.archived_at <= now() - p_from and c.archived_at > now() - p_to
    union all
    select jsonb_build_object(
      'kind', 'developer', 'id', d.id, 'slug', d.slug, 'name', d.name, 'archived_at', d.archived_at,
      'purge_at', d.archived_at + interval '30 days',
      'complexes', (select coalesce(jsonb_agg(c.id), '[]') from public.complexes c where c.developer_id = d.id),
      'media', (select coalesce(jsonb_agg(m.path), '[]') from public.media_assets m
                where m.developer_id = d.id
                   or m.complex_id in (select c.id from public.complexes c where c.developer_id = d.id))
    )
    from public.developers d
    where d.status = 'archived' and d.archived_at <= now() - p_from and d.archived_at > now() - p_to
  ) as items;
$$;

-- Пора удалять: 30 дней в архиве прошли.
create function public.archive_due()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.archive_items(interval '30 days', interval '100 years');
$$;

-- Напомнить: до удаления 3 дня или меньше, напоминания по этому уходу в архив ещё не было. Отмечает
-- сразу: сбой отправки не повторит напоминание каждый день.
create function public.take_archive_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb := private.archive_items(interval '27 days', interval '30 days');
  v_fresh jsonb := '[]';
  v_item jsonb;
begin
  for v_item in select value from jsonb_array_elements(v_items) loop
    insert into public.archive_notices (kind, entity_id, archived_at)
    values (v_item ->> 'kind', (v_item ->> 'id')::uuid, (v_item ->> 'archived_at')::timestamptz)
    on conflict do nothing;
    if found then
      v_fresh := v_fresh || jsonb_build_array(v_item);
    end if;
  end loop;
  return v_fresh;
end;
$$;

-- Квартиры ЖК для CSV руководителю: блок, подъезд, этаж, номер, планировка, цена, статус.
create function public.archive_units(p_complexes uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'complex', c.name ->> 'ru', 'block', b.name, 'entrance', u.entrance, 'floor', u.floor,
      'number', u.number, 'rooms', l.rooms, 'area', l.area, 'price', u.price,
      'price_per_m2', u.price_per_m2, 'currency', b.currency, 'status', u.status
    ) order by c.name ->> 'ru', b.sort, b.name, u.entrance, u.floor, u.position), '[]')
  from public.units u
  join public.blocks b on b.id = u.block_id
  join public.complexes c on c.id = b.complex_id
  left join public.layouts l on l.id = u.layout_id
  where c.id = any (p_complexes);
$$;

-- Окончательное удаление — только того, что всё ещё в архиве 30 дней (восстановили за минуту до
-- запуска — не тронет). Каскад (блоки, планировки, квартиры, фото, документы) журналом не пишем
-- построчно: одна запись «удалён после архива» на ЖК. Адреса ЖК — в retired_slugs для 301.
create function public.purge_archived(p_kind text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_complex record;
  v_developer record;
begin
  if p_kind = 'complex' then
    select c.id, c.slug, c.name into v_complex from public.complexes c
      where c.id = p_id and c.status = 'archived' and c.archived_at <= now() - interval '30 days';
    if v_complex.id is null then
      return false;
    end if;
  elsif p_kind = 'developer' then
    select d.id, d.slug, d.name into v_developer from public.developers d
      where d.id = p_id and d.status = 'archived' and d.archived_at <= now() - interval '30 days';
    if v_developer.id is null then
      return false;
    end if;
  else
    return false;
  end if;
  perform set_config('vodiy.skip_audit', 'on', true);
  for v_complex in
    select c.id, c.slug, c.name from public.complexes c
    where (p_kind = 'complex' and c.id = p_id) or (p_kind = 'developer' and c.developer_id = p_id)
  loop
    insert into public.retired_slugs (slug) values (v_complex.slug) on conflict (slug) do update set retired_at = now();
    insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, changes)
    values (null, 'delete', 'complexes', v_complex.id::text, v_complex.id,
            jsonb_build_object('name', v_complex.name, 'slug', v_complex.slug, 'reason', 'archive_30_days'));
    delete from public.complexes c where c.id = v_complex.id;
  end loop;
  if p_kind = 'developer' then
    insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, changes)
    values (null, 'delete', 'developers', p_id::text, null,
            jsonb_build_object('name', v_developer.name, 'slug', v_developer.slug, 'reason', 'archive_30_days'));
    delete from public.developers d where d.id = p_id;
  end if;
  perform set_config('vodiy.skip_audit', 'off', true);
  return true;
end;
$$;

-- Адрес ЖК, которого на сайте больше нет (в архиве или удалён), — для 301 на каталог. Посетителю
-- видно только «да / нет»: ни названия, ни даты.
create function public.site_retired_slug(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.complexes c where c.slug = p_slug and c.status = 'archived')
      or exists (select 1 from public.retired_slugs r where r.slug = p_slug);
$$;

revoke all on function private.archive_items(interval, interval) from public, anon, authenticated;
revoke all on function public.archive_due() from public, anon, authenticated;
revoke all on function public.take_archive_reminders() from public, anon, authenticated;
revoke all on function public.archive_units(uuid[]) from public, anon, authenticated;
revoke all on function public.purge_archived(text, uuid) from public, anon, authenticated;
revoke all on function public.site_retired_slug(text) from public;
grant execute on function public.archive_due() to service_role;
grant execute on function public.take_archive_reminders() to service_role;
grant execute on function public.archive_units(uuid[]) to service_role;
grant execute on function public.purge_archived(text, uuid) to service_role;
grant execute on function public.site_retired_slug(text) to anon, authenticated, service_role;

comment on table public.retired_slugs is 'Адреса удалённых после архива ЖК (3.13): страница по ним — 301 на каталог.';

-- Исправления ревью блока F (шаг 3.13, архив):
-- 1) застройщика восстановили на 28-й день — его ЖК (остаются в архиве, их восстанавливают по
--    одному) несли дату архивации застройщика и удалялись той же ночью без напоминания. Теперь при
--    восстановлении застройщика у его архивных ЖК отсчёт 30 дней начинается заново;
-- 2) адрес ЖК: в архиве (ещё можно восстановить) — временный редирект 307, удалён — постоянный 308;
--    адрес, который снова занял ЖК (то же название после удаления), больше не уводит в каталог.

create or replace function private.archive_developer_complexes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' then
    update public.complexes set status = 'archived' where developer_id = new.id and status <> 'archived';
  elsif old.status = 'archived' and new.status <> 'archived' then
    -- status не меняется — триггер stamp_archived_at дату не трогает, ставим её сами.
    update public.complexes set archived_at = now() where developer_id = new.id and status = 'archived';
  end if;
  return null;
end;
$$;

drop function public.site_retired_slug(text);

-- Что с адресом ЖК: 'archived' — ЖК в архиве; 'deleted' — удалён после архива и адрес никто не
-- занял; null — адреса нет (404) или ЖК на сайте. Посетителю — только это, без названия и даты.
create function public.site_slug_state(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.complexes c where c.slug = p_slug and c.status = 'archived') then 'archived'
    when exists (select 1 from public.retired_slugs r where r.slug = p_slug)
         and not exists (select 1 from public.complexes c where c.slug = p_slug) then 'deleted'
  end;
$$;

revoke all on function public.site_slug_state(text) from public;
grant execute on function public.site_slug_state(text) to anon, authenticated, service_role;

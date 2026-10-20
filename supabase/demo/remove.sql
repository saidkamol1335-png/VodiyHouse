-- Удаление DEMO одной командой (PLAN §0.11): `npm run demo:remove`.
-- DEMO — застройщики и ЖК со slug «demo-…»; блоки, планировки, квартиры, медиа, сданные
-- объекты и внутренние контакты уходят каскадом. Записи журнала о DEMO тоже удаляются.

begin;

select set_config('vodiy.skip_audit', 'on', true);

-- Настоящий ЖК, по ошибке заведённый у DEMO-застройщика, не удаляем молча — останавливаемся.
do $$
declare
  real_complexes integer;
begin
  select count(*) into real_complexes
  from public.complexes c
  join public.developers d on d.id = c.developer_id
  where d.slug like 'demo-%' and c.slug not like 'demo-%';
  if real_complexes > 0 then
    raise exception 'У DEMO-застройщиков есть ЖК без пометки demo- (%), удаление DEMO остановлено', real_complexes;
  end if;
end;
$$;

-- Правки DEMO из кабинета (например, проба смены статуса) — тоже DEMO. developer_id есть
-- с шага 10.2 и ловит и удалённые сданные объекты; старые записи — по сущности и id.
delete from public.audit_log
where complex_id in (select id from public.complexes where slug like 'demo-%')
   or developer_id in (select id from public.developers where slug like 'demo-%')
   or (entity in ('developers', 'developer_private')
       and entity_id in (select id::text from public.developers where slug like 'demo-%'))
   or (entity = 'developer_past_projects'
       and entity_id in (
         select p.id::text
         from public.developer_past_projects p
         join public.developers d on d.id = p.developer_id
         where d.slug like 'demo-%'
       ));

delete from public.complexes where slug like 'demo-%';
delete from public.developers where slug like 'demo-%';

commit;

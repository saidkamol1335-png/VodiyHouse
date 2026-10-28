-- Удаление DEMO одной командой (PLAN §0.11): `npm run demo:remove`.
-- DEMO — застройщики, ЖК и банки со slug «demo-…»; блоки, планировки, квартиры, медиа, сданные
-- объекты, внутренние контакты и программы оплаты уходят каскадом. Записи журнала о DEMO тоже удаляются.

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

-- Программа настоящего застройщика с DEMO-банком (названия банков настоящие) — тоже стоп с
-- понятной причиной, а не ошибка внешнего ключа в конце.
do $$
declare
  real_programs integer;
begin
  select count(*) into real_programs
  from public.payment_programs p
  join public.banks b on b.id = p.bank_id
  join public.developers d on d.id = p.developer_id
  where b.slug like 'demo-%' and d.slug not like 'demo-%';
  if real_programs > 0 then
    raise exception 'Программы настоящих застройщиков ссылаются на DEMO-банки (%) — смените банк, удаление DEMO остановлено', real_programs;
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

-- Снимки расчётов по DEMO-программам — тоже DEMO (фаза 2), и по уже удалённым из кабинета:
-- застройщик есть в снимке условий.
delete from public.calculations
where program_snapshot ->> 'developer_id' in (select id::text from public.developers where slug like 'demo-%');

-- Витрина (3.16а): подборки DEMO — по адресу «demo-…» и их журнал (у удалённых адрес остался в
-- записи); спецпредложения и реклама уходят каскадом с DEMO-застройщиками, их журнал — по
-- developer_id выше.
delete from public.audit_log
where entity = 'collections'
  and (entity_id in (select id::text from public.collections where slug like 'demo-%')
    or changes ->> 'slug' like 'demo-%');
delete from public.collections where slug like 'demo-%';

delete from public.complexes where slug like 'demo-%';
delete from public.developers where slug like 'demo-%';

-- Банки DEMO и их журнал (программы ушли каскадом с застройщиками; программа настоящего
-- застройщика с DEMO-банком остановит удаление — внешний ключ). Курс — только помеченный demo.
delete from public.audit_log
where entity = 'banks' and entity_id in (
  select id::text from public.banks where slug like 'demo-%'
  union
  -- и уже удалённые из справочника: их адрес остался в записи добавления или удаления
  select entity_id from public.audit_log where entity = 'banks' and changes ->> 'slug' like 'demo-%'
);
delete from public.banks where slug like 'demo-%';
delete from public.settings where key = 'exchange.usd_uzs' and value ? 'demo';

commit;

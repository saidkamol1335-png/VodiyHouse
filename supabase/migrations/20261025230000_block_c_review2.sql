-- Ревью блока C, второй круг:
-- 1. Порядок каталога: неопубликованные перенумеровываются, только если попали в номера
--    опубликованных, — остальные (архив, давно скрытые) не получают ложных «Порядок» в журнале.
-- 2. private.page_program — security invoker: её зовут только definer-функции сайта, свой
--    definer ей не нужен, а p_complex задаёт вызывающий.
-- 3. Описание site_layout_calc — с предпросмотром руководителя.

create or replace function public.reorder_complexes(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  last_published integer := cardinality(p_ids) * 10;
begin
  if not private.has_role('head') then
    raise exception 'Порядок каталога меняет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if cardinality(p_ids) is distinct from (
       select count(*) from public.complexes c where c.status = 'published')
     or exists (
       select 1 from unnest(p_ids) as x (id)
       where not exists (select 1 from public.complexes c where c.id = x.id and c.status = 'published')
     )
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'Список ЖК изменился — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:stale_list';
  end if;
  update public.complexes c set sort = x.ord * 10
    from unnest(p_ids) with ordinality as x (id, ord)
    where c.id = x.id and c.sort is distinct from (x.ord * 10)::integer;
  -- Неопубликованные в номерах опубликованных — за всеми остальными, в прежнем порядке:
  -- опубликованный потом черновик или вернувшийся из скрытых встанет в конец каталога.
  with collided as (
    select r.id, row_number() over (order by r.sort, r.created_at, r.id) as ord
    from public.complexes r
    where r.status <> 'published' and r.sort <= last_published
  ), tail as (
    select greatest(last_published, coalesce(max(r.sort), 0)) as top
    from public.complexes r
    where r.status <> 'published' and r.sort > last_published
  )
  update public.complexes c set sort = tail.top + collided.ord * 10
    from collided, tail
    where c.id = collided.id;
end;
$$;

alter function private.page_program(public.payment_programs, timestamptz, uuid) security invoker;

comment on function public.site_layout_calc(uuid) is
  '«Расчёт для этой квартиры»: планировка ЖК на сайте (черновик и скрытый — только руководителю, предпросмотр), её свободные квартиры с ценой и программы блока без скидок.';

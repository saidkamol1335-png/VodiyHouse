-- Порядок ЖК в каталоге (шаг 3.6): «Рекомендуемые» — порядок руководителя (решение фазы 3).
-- Список — опубликованные ЖК, как их видит посетитель; новый в конце (create_complex). Права —
-- RLS complexes (правит руководитель), роль — первой строкой; журнал видит только настоящие сдвиги.

create function public.reorder_complexes(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
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
    raise exception 'Список ЖК устарел — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  update public.complexes c set sort = x.ord * 10
    from unnest(p_ids) with ordinality as x (id, ord)
    where c.id = x.id and c.sort is distinct from (x.ord * 10)::integer;
end;
$$;

comment on function public.reorder_complexes(uuid[]) is
  'Порядок опубликованных ЖК в каталоге («Рекомендуемые»): все в новом порядке.';

revoke all on function public.reorder_complexes(uuid[]) from public, anon;
grant execute on function public.reorder_complexes(uuid[]) to authenticated;

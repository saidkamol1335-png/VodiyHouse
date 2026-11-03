-- Проект-2, фаза D (PLAN §10, п. 21): «Частые вопросы» ЖК — вкладка «О ЖК» кабинета, раздел страницы
-- ЖК на сайте (без данных скрыт). До 8 пар «вопрос — ответ» на двух языках; в минимум публикации
-- не входят. Сайт читает их отдельной функцией, как «Ход строительства».

-- Пара: {"q": {"ru", "uz"}, "a": {"ru", "uz"}}; вопрос до 160 знаков, ответ до 600, оба языка.
create function private.valid_faq(p_faq jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_faq) = 'array'
     and jsonb_array_length(p_faq) <= 8
     and not exists (
       select 1 from jsonb_array_elements(p_faq) item
       where jsonb_typeof(item) <> 'object'
          or (select count(*) from jsonb_object_keys(item)) <> 2
          or not (item ? 'q' and item ? 'a')
          or exists (
            select 1 from (values ('q', 160), ('a', 600)) as part(key, max_length)
            where jsonb_typeof(item -> part.key) <> 'object'
               or (select count(*) from jsonb_object_keys(item -> part.key)) <> 2
               or length(btrim(coalesce(item -> part.key ->> 'ru', ''))) not between 1 and part.max_length
               or length(btrim(coalesce(item -> part.key ->> 'uz', ''))) not between 1 and part.max_length
          )
     );
$$;

alter table public.complexes
  add column faq jsonb not null default '[]'::jsonb
  constraint complexes_faq_valid check (private.valid_faq(faq));

comment on column public.complexes.faq is
  'Частые вопросы ЖК: до 8 пар {"q": {"ru","uz"}, "a": {"ru","uz"}}; пусто — раздела на сайте нет.';

-- Сайт: вопросы ЖК, который посетитель может видеть (или по гранту предпросмотра).
create function public.site_complex_faq(p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.can_see_complex(p_complex) then (
    select c.faq from public.complexes c where c.id = p_complex
  ) end
$$;

revoke all on function public.site_complex_faq(uuid) from public;
grant execute on function public.site_complex_faq(uuid) to anon, authenticated;
revoke all on function private.valid_faq(jsonb) from public, anon;
-- Ограничение проверяет функцию правами того, кто пишет: руководителю и менеджеру — можно.
grant execute on function private.valid_faq(jsonb) to authenticated, service_role;

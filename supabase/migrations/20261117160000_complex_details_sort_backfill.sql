-- Правки 15.11, п. 22 (ревью блока C): пункты «Деталей проекта», сохранённые до карусели, пришли с
-- sort = 0. Сайт ставит их по порядку тем, а кабинет — по sort и id (то есть вперемешку); первое же
-- «Сохранить» в кабинете записало бы этот случайный порядок. Здесь у таких ЖК (все пункты с sort = 0)
-- порядок становится порядком сайта: тема, затем пункт.

with ranked as (
  select d.id, (row_number() over (partition by d.complex_id order by t.sort, t.id, d.id) * 10)::integer as sort
  from public.complex_details d
  join public.detail_topics t on t.id = d.topic_id
  where not exists (
    select 1 from public.complex_details other where other.complex_id = d.complex_id and other.sort <> 0)
)
update public.complex_details d
set sort = ranked.sort
from ranked
where ranked.id = d.id;

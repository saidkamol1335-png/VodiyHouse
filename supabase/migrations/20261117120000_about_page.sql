-- Правки 15.11, п. 25: «Biz haqimizda» как у Uzum — «Tarix» (история по годам) и «Jamoa» (команда:
-- фото, имя, должность). Без новой таблицы: две публичные записи settings, их читает сайт
-- (public_settings); правит руководитель (RLS settings), журнал — триггер settings_audit.
--   site.about_history: [{year, title: {ru, uz}, text: {ru, uz} | null}] — до 20 событий;
--   site.about_team:    [{id, name, position: {ru, uz}, photo: {path, width, height, blur} | null,
--                         consent_at}] — до 24 человек; без отметки согласия (consent_at) запись
--                         база не примет: фото и имя сотрудника — персональные данные.
-- Фото команды — media/team/<id сотрудника>/<файл>.(jpg|png): загружает руководитель (политика
-- Storage), папку владельца не проверяем — сотрудник появляется в записи после загрузки фото.

create function private.valid_bilingual(p_value jsonb, p_min integer, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'object'
     and (select count(*) from jsonb_object_keys(p_value)) = 2
     and length(btrim(coalesce(p_value ->> 'ru', ''))) between p_min and p_max
     and length(btrim(coalesce(p_value ->> 'uz', ''))) between p_min and p_max
$$;

create function private.valid_about_history(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
     and jsonb_array_length(p_value) <= 20
     and not exists (
       select 1 from jsonb_array_elements(p_value) item
       where jsonb_typeof(item) <> 'object'
          or jsonb_typeof(item -> 'year') <> 'number'
          or (item ->> 'year')::numeric not between 1990 and 2100
          or (item ->> 'year')::numeric <> trunc((item ->> 'year')::numeric)
          or not private.valid_bilingual(item -> 'title', 1, 120)
          or not (jsonb_typeof(item -> 'text') = 'null' or private.valid_bilingual(item -> 'text', 1, 600))
     )
$$;

create function private.valid_about_team(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
     and jsonb_array_length(p_value) <= 24
     and not exists (
       select 1 from jsonb_array_elements(p_value) item
       where jsonb_typeof(item) <> 'object'
          or coalesce(item ->> 'id', '') !~ '^[0-9a-f-]{36}$'
          or length(btrim(coalesce(item ->> 'name', ''))) not between 2 and 60
          or not private.valid_bilingual(item -> 'position', 1, 80)
          or jsonb_typeof(item -> 'consent_at') is distinct from 'string'
          or (item ->> 'consent_at') !~ '^\d{4}-\d{2}-\d{2}'
          or not (
            jsonb_typeof(item -> 'photo') = 'null'
            or (
              jsonb_typeof(item -> 'photo') = 'object'
              and (item -> 'photo' ->> 'path') ~ ('^team/' || (item ->> 'id') || '/[0-9a-f-]{36}\.(jpg|png)$')
              and jsonb_typeof(item -> 'photo' -> 'width') = 'number'
              and jsonb_typeof(item -> 'photo' -> 'height') = 'number'
            )
          )
     )
$$;

-- Проверки записи выполняются правами того, кто пишет (как private.valid_faq).
revoke all on function
  private.valid_bilingual(jsonb, integer, integer),
  private.valid_about_history(jsonb),
  private.valid_about_team(jsonb)
from public;
grant execute on function
  private.valid_bilingual(jsonb, integer, integer),
  private.valid_about_history(jsonb),
  private.valid_about_team(jsonb)
to authenticated, service_role;

alter table public.settings
  add constraint settings_about_history_valid check (key <> 'site.about_history' or private.valid_about_history(value)),
  add constraint settings_about_team_valid check (key <> 'site.about_team' or private.valid_about_team(value));

-- Политика Storage: путь — папка существующего владельца; команда (team) — без проверки владельца
-- (тот же шаблон — lib/media/path.ts, tests/db/storage.test.ts сверяет).
create or replace function private.is_media_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    object_name ~ '^(complexes|developers|specials|collections|ads|team)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$'
    and case split_part(object_name, '/', 1)
      when 'complexes' then exists (
        select 1 from public.complexes c where c.id::text = split_part(object_name, '/', 2))
      when 'developers' then exists (
        select 1 from public.developers d where d.id::text = split_part(object_name, '/', 2))
      when 'specials' then exists (
        select 1 from public.specials s where s.id::text = split_part(object_name, '/', 2))
      when 'collections' then exists (
        select 1 from public.collections c where c.id::text = split_part(object_name, '/', 2))
      when 'team' then true
      else exists (
        select 1 from public.ads a where a.id::text = split_part(object_name, '/', 2))
    end,
    false
  )
$$;

-- Правки 15.11, п. 22: «Loyiha tafsilotlari» — карусель «фото + подпись», как «Особенности комплекса»
-- на Cian. В кабинете — список пунктов с порядком: тема из справочника, фото из галереи ЖК (на нём уже
-- отметка правила 1.2), текст ru/uz; одна тема может быть в нескольких пунктах (фасад, двор, лифт…).
-- Сохраняется целиком: удалённые пункты удаляются, остальные правятся по id — журнал без лишних
-- «удалил и добавил снова». Правят руководитель и менеджер (как раньше, 20261102110000).

alter table public.complex_details drop constraint complex_details_complex_id_topic_id_key;
alter table public.complex_details add column sort integer not null default 0;
create index complex_details_complex_sort_idx on public.complex_details (complex_id, sort);

-- [{id | null, topic_id, text: {ru, uz}, photo_id | null}] — порядок на сайте — порядок массива.
create or replace function public.save_complex_details(p_complex uuid, p_details jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Детали проекта правят руководитель и менеджер' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_details) is distinct from 'array' or jsonb_array_length(p_details) > 20 then
    raise exception 'Нужен список до 20 пунктов' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.locked_complex_status(p_complex);
  if exists (
    select 1 from jsonb_array_elements(p_details) as item
    where case
      when not private.json_number_between(item -> 'topic_id', 1, 32767, true) then true
      else not exists (select 1 from public.detail_topics t where t.id = (item ->> 'topic_id')::smallint)
    end
  ) then
    raise exception 'Тема не найдена — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  -- Пункт по id — только этого ЖК и не дважды.
  if exists (
    select 1 from jsonb_array_elements(p_details) as item
    where nullif(item ->> 'id', '') is not null
      and not exists (
        select 1 from public.complex_details d
        where d.id = (item ->> 'id')::uuid and d.complex_id = p_complex
      )
  ) or (
    select count(distinct item ->> 'id') <> count(item ->> 'id')
    from jsonb_array_elements(p_details) as item
    where nullif(item ->> 'id', '') is not null
  ) then
    raise exception 'Пункт не найден — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  -- Фото — только из галереи этого ЖК.
  if exists (
    select 1 from jsonb_array_elements(p_details) as item
    where nullif(item ->> 'photo_id', '') is not null
      and not exists (
        select 1 from public.media_assets m
        where m.id = (item ->> 'photo_id')::uuid and m.complex_id = p_complex and m.kind = 'photo'
      )
  ) then
    raise exception 'Фото не из галереи ЖК — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;

  delete from public.complex_details d
  where d.complex_id = p_complex
    and d.id not in (
      select (item ->> 'id')::uuid from jsonb_array_elements(p_details) as item
      where nullif(item ->> 'id', '') is not null
    );
  update public.complex_details d
  set topic_id = (item.value ->> 'topic_id')::smallint,
      text = (item.value -> 'text')::public.i18n_text,
      photo_id = nullif(item.value ->> 'photo_id', '')::uuid,
      sort = item.ordinality * 10
  from jsonb_array_elements(p_details) with ordinality as item
  where nullif(item.value ->> 'id', '') is not null
    and d.id = (item.value ->> 'id')::uuid
    and (d.topic_id, d.text, d.photo_id, d.sort) is distinct from (
      (item.value ->> 'topic_id')::smallint, (item.value -> 'text')::public.i18n_text,
      nullif(item.value ->> 'photo_id', '')::uuid, (item.ordinality * 10)::integer);
  insert into public.complex_details (complex_id, topic_id, text, photo_id, sort)
  select p_complex, (item.value ->> 'topic_id')::smallint, (item.value -> 'text')::public.i18n_text,
         nullif(item.value ->> 'photo_id', '')::uuid, item.ordinality * 10
  from jsonb_array_elements(p_details) with ordinality as item
  where nullif(item.value ->> 'id', '') is null;
end;
$$;

-- Детали — в порядке кабинета (у старых записей sort 0 — по справочнику тем, как раньше).
create or replace function private.complex_page_content(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'slug', t.slug, 'name', t.name, 'hint', t.hint, 'checked_on', d.checked_on)
        order by t.sort, t.id), '[]'::jsonb)
      from public.complex_documents d
      join public.document_types t on t.id = d.document_type_id
      where d.complex_id = p_complex),
    'videos', (
      select coalesce(jsonb_agg(jsonb_build_object('youtube_id', v.youtube_id, 'title', v.title)
        order by v.sort, v.id), '[]'::jsonb)
      from public.complex_videos v
      where v.complex_id = p_complex),
    'details', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', d.id, 'slug', t.slug, 'name', t.name, 'text', d.text, 'photo', private.site_media(m))
        order by d.sort, t.sort, t.id, d.id), '[]'::jsonb)
      from public.complex_details d
      join public.detail_topics t on t.id = d.topic_id
      left join public.media_assets m on m.id = d.photo_id
      where d.complex_id = p_complex)
  )
$$;

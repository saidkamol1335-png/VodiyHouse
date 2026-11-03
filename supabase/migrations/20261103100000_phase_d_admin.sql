-- Проект-2, фаза D (PLAN §10, пп. 24, 25, 30).
--   «Удалить сейчас» — руководитель удаляет ЖК из архива, не дожидаясь 30 дней: сначала CSV квартир
--   в Telegram (archived_complex_units), потом строки (purge_complex_now), файлы — сервер Storage API.
--   Напоминания бота: запрос менеджера ждёт руководителя больше 24 часов; раз в неделю — черновики
--   старше 14 дней и чего им не хватает. Отметки — сразу при выдаче (сбой отправки не повторит
--   сообщение каждые 5 минут).

-- ─── «Удалить сейчас» ────────────────────────────────────────────────────────────────────
-- Квартиры архивного ЖК для CSV — тот же состав, что у ночной очистки (archive_units).
create function public.archived_complex_units(p_complex uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Удаляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:head_only';
  end if;
  if not exists (select 1 from public.complexes c where c.id = p_complex and c.status = 'archived') then
    raise exception 'ЖК не в архиве' using errcode = 'check_violation', hint = 'vh:status_move';
  end if;
  return public.archive_units(array[p_complex]);
end;
$$;

-- Удаляет архивный ЖК сейчас. Как purge_archived: адрес — в retired_slugs (301 на каталог), одна
-- запись журнала на ЖК (кто удалил), каскад построчно не пишется. Ответ — адрес и пути файлов.
create function public.purge_complex_now(p_complex uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_complex record;
  v_media jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Удаляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:head_only';
  end if;
  select c.id, c.slug, c.name into v_complex from public.complexes c
    where c.id = p_complex and c.status = 'archived'
    for update;
  if v_complex.id is null then
    raise exception 'ЖК не в архиве' using errcode = 'check_violation', hint = 'vh:status_move';
  end if;
  select coalesce(jsonb_agg(m.path), '[]') into v_media from public.media_assets m where m.complex_id = p_complex;
  perform set_config('vodiy.skip_audit', 'on', true);
  insert into public.retired_slugs (slug) values (v_complex.slug) on conflict (slug) do update set retired_at = now();
  insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, changes)
  values (auth.uid(), 'delete', 'complexes', v_complex.id::text, v_complex.id,
          jsonb_build_object('name', v_complex.name, 'slug', v_complex.slug, 'reason', 'deleted_now'));
  delete from public.complexes c where c.id = p_complex;
  perform set_config('vodiy.skip_audit', 'off', true);
  return jsonb_build_object('slug', v_complex.slug, 'media', v_media);
end;
$$;

revoke all on function public.archived_complex_units(uuid) from public, anon;
revoke all on function public.purge_complex_now(uuid) from public, anon;
grant execute on function public.archived_complex_units(uuid) to authenticated;
grant execute on function public.purge_complex_now(uuid) to authenticated;

-- ─── Напоминания бота ────────────────────────────────────────────────────────────────────
alter table public.publication_requests add column reminded_at timestamptz;

-- Запросы старше 24 часов без ответа; повтор — не чаще раза в сутки на запрос.
create function public.take_publication_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  -- Отметка напоминания — служебная, в журнал изменений не пишется.
  perform set_config('vodiy.skip_audit', 'on', true);
  with due as (
    update public.publication_requests r
      set reminded_at = now()
      where r.status = 'pending'
        and r.requested_at <= now() - interval '24 hours'
        and (r.reminded_at is null or r.reminded_at <= now() - interval '24 hours')
      returning r.id, r.complex_id, r.kind, r.note, r.requested_at, r.requested_by
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', due.id, 'complex_id', due.complex_id, 'kind', due.kind, 'note', due.note,
      'requested_at', due.requested_at, 'complex', c.name ->> 'ru', 'requester', p.full_name
    ) order by due.requested_at), '[]')
    into v_items
  from due
  join public.complexes c on c.id = due.complex_id
  left join public.profiles p on p.id = due.requested_by;
  perform set_config('vodiy.skip_audit', 'off', true);
  return v_items;
end;
$$;

-- Отметки еженедельных сводок: одна строка на вид сводки.
create table public.bot_digests (
  kind text primary key check (kind in ('drafts')),
  sent_at timestamptz not null
);

alter table public.bot_digests enable row level security;
revoke all on public.bot_digests from anon, authenticated;

-- Раз в 7 дней: черновики старше 14 дней с пунктами минимума, которых не хватает. Пустой список —
-- сводка не нужна, отметка не ставится. null — неделя ещё не прошла.
create function public.take_drafts_digest()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  if exists (select 1 from public.bot_digests d where d.kind = 'drafts' and d.sent_at > now() - interval '7 days') then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name ->> 'ru', 'created_at', c.created_at,
      'missing', (select coalesce(jsonb_agg(q.requirement order by q.requirement), '[]')
                  from private.complex_requirements(c.id) q where not q.ok)
    ) order by c.created_at), '[]')
    into v_items
  from public.complexes c
  where c.status = 'draft' and c.created_at <= now() - interval '14 days';
  if jsonb_array_length(v_items) = 0 then
    return '[]'::jsonb;
  end if;
  insert into public.bot_digests (kind, sent_at) values ('drafts', now())
    on conflict (kind) do update set sent_at = excluded.sent_at;
  return v_items;
end;
$$;

-- Сводка не ушла — отметка снимается, следующий запуск расписания повторит.
create function public.release_drafts_digest()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.bot_digests d where d.kind = 'drafts';
$$;

revoke all on function public.take_publication_reminders() from public, anon, authenticated;
revoke all on function public.take_drafts_digest() from public, anon, authenticated;
revoke all on function public.release_drafts_digest() from public, anon, authenticated;
grant execute on function public.take_publication_reminders() to service_role;
grant execute on function public.take_drafts_digest() to service_role;
grant execute on function public.release_drafts_digest() to service_role;

-- ─── Справочники: менеджер добавляет пункты (п. 29) ──────────────────────────────────────
-- Только справочники заполнения ЖК; правит, скрывает, удаляет и ставит порядок — руководитель.
do $$
declare
  dictionary text;
begin
  foreach dictionary in array array['locations', 'document_types', 'detail_topics', 'finishings'] loop
    execute format(
      'create policy "%s: добавляет менеджер" on public.%I for insert to authenticated
         with check ((select private.has_role(''manager'')))', dictionary, dictionary);
  end loop;
end;
$$;

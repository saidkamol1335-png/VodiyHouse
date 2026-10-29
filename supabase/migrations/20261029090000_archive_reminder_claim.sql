-- Фаза 3, «Полировка» (блок F, архив): напоминание «через 3 дня удалится» отмечается по одному —
-- прямо перед отправкой, а не всей пачкой до неё. Сбой посреди цикла (исключение, обрыв функции)
-- теряет не больше одного напоминания; если файл не ушёл, сервер снимает отметку, и следующей ночью
-- (окно — 3 суток) напоминание повторится. Старая take_archive_reminders остаётся, пока сайт со
-- старым кодом может быть на деплое (база уходит в облако раньше пуша); убрать — шаг «Запуск».

-- Кому пора напомнить: до удаления 3 дня или меньше, по этому уходу в архив ещё не напоминали.
create function public.archive_reminders_due()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(item.value order by item.value ->> 'archived_at'), '[]')
  from jsonb_array_elements(private.archive_items(interval '27 days', interval '30 days')) as item
  where not exists (
    select 1 from public.archive_notices n
    where n.kind = item.value ->> 'kind'
      and n.entity_id = (item.value ->> 'id')::uuid
      and n.archived_at = (item.value ->> 'archived_at')::timestamptz
  );
$$;

-- Отметка перед отправкой: false — уже отмечено (второй запуск задачи), не отправлять.
create function public.claim_archive_reminder(p_kind text, p_id uuid, p_archived_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.archive_notices (kind, entity_id, archived_at)
  values (p_kind, p_id, p_archived_at)
  on conflict do nothing;
  return found;
end;
$$;

-- Не ушло — отметку снять, напоминание повторится.
create function public.release_archive_reminder(p_kind text, p_id uuid, p_archived_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.archive_notices
  where kind = p_kind and entity_id = p_id and archived_at = p_archived_at;
$$;

revoke all on function public.archive_reminders_due() from public, anon, authenticated;
revoke all on function public.claim_archive_reminder(text, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.release_archive_reminder(text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.archive_reminders_due() to service_role;
grant execute on function public.claim_archive_reminder(text, uuid, timestamptz) to service_role;
grant execute on function public.release_archive_reminder(text, uuid, timestamptz) to service_role;

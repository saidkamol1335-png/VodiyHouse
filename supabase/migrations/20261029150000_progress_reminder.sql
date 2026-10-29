-- Фаза 5 (5D.3): напоминание в Telegram (мокап CabReview: «Напоминание в Telegram: у N ЖК последний
-- отчёт старше 45 дней»). Раз в сутки (/api/cron/progress) — ЖК, у которых строится хоть один блок, а
-- последний опубликованный отчёт блока старше 45 дней или его нет совсем (как «45+ дн.» в матрице).
-- Один ЖК — не чаще раза в 7 дней, пока не появится свежий отчёт (решение, docs/design-decisions.md).
-- Отметка — прямо перед отправкой (claim), не ушло — сервер снимает её (release), как у архива.

create table public.progress_notices (
  complex_id uuid primary key references public.complexes (id) on delete cascade,
  reminded_at timestamptz not null default now()
);

alter table public.progress_notices enable row level security;
revoke all on public.progress_notices from anon, authenticated, service_role;

-- ЖК с устаревшим ходом строительства, о которых не напоминали 7 дней: по названию.
create function public.progress_reminders_due()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', late.id, 'name', late.name, 'last_published_at', late.last)
    order by late.name), '[]'::jsonb)
  from (
    select c.id, c.name ->> 'ru' as name,
      (select max(r.published_at) from public.progress_reports r
       where r.complex_id = c.id and not r.is_unit and r.status = 'published') as last
    from public.complexes c
    where c.status <> 'archived'
      and exists (select 1 from public.blocks b where b.complex_id = c.id and b.build_status = 'building')
      and not exists (select 1 from public.progress_notices n
                      where n.complex_id = c.id and n.reminded_at > now() - interval '7 days')
  ) late
  where late.last is null or late.last < now() - interval '45 days';
$$;

-- Отметка перед отправкой: возвращает отмеченные ЖК и время отметки; уже отмеченные за 7 дней
-- (второй запуск задачи) не возвращаются — им не отправлять.
create function public.claim_progress_reminders(p_ids uuid[])
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    insert into public.progress_notices as n (complex_id, reminded_at)
    select c.id, now() from public.complexes c where c.id = any (p_ids)
    on conflict (complex_id) do update set reminded_at = excluded.reminded_at
      where n.reminded_at <= now() - interval '7 days'
    returning n.complex_id
  )
  select jsonb_build_object(
    'at', now(),
    'ids', coalesce((select jsonb_agg(complex_id) from claimed), '[]'::jsonb));
$$;

-- Не ушло — отметки этого запуска снять, напоминание повторится завтра.
create function public.release_progress_reminders(p_ids uuid[], p_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.progress_notices
  where complex_id = any (p_ids) and reminded_at = p_at;
$$;

comment on function public.progress_reminders_due() is
  'Фаза 5: ЖК, где строится блок, а последний опубликованный отчёт старше 45 дней (или его нет), без напоминания 7 дней.';

revoke all on function public.progress_reminders_due() from public, anon, authenticated;
revoke all on function public.claim_progress_reminders(uuid[]) from public, anon, authenticated;
revoke all on function public.release_progress_reminders(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.progress_reminders_due() to service_role;
grant execute on function public.claim_progress_reminders(uuid[]) to service_role;
grant execute on function public.release_progress_reminders(uuid[], timestamptz) to service_role;

-- Проект-2, фаза E, ревью кода (PLAN §10, п. 31): лимит видео в проверке файла отчёта — из бакета
-- incoming, а не числом: на тарифе Pro лимит поднимается правкой бакета, без кода. Тело — как в
-- 20261103150000_progress_mobile_rpc.sql, кроме лимита видео.

create or replace function private.progress_file_ok(p_path text, p_complex uuid, p_report uuid, p_ext text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path is null then false
    when p_report is not null and (
      exists (select 1 from public.progress_photos p where p.report_id = p_report and p.path = p_path)
      or exists (select 1 from public.progress_reports r where r.id = p_report and r.video_path = p_path)
    ) then true
    when p_path !~ ('^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.' || p_ext || '$') then false
    when split_part(p_path, '/', 1) <> coalesce((select auth.uid())::text, '') then false
    when split_part(p_path, '/', 2) <> p_complex::text then false
    when exists (select 1 from public.progress_photos p where p.path = p_path)
      or exists (select 1 from public.progress_reports r where r.video_path = p_path) then false
    else exists (
      select 1 from storage.objects o
      where o.bucket_id = 'incoming' and o.name = p_path
        and o.created_at > now() - interval '24 hours'
        and coalesce(o.metadata ->> 'mimetype', '') = case p_ext when 'jpg' then 'image/jpeg' else 'video/mp4' end
        and coalesce((o.metadata ->> 'size')::bigint, 0) <= case p_ext
          when 'jpg' then 15728640
          else coalesce((select b.file_size_limit from storage.buckets b where b.id = 'incoming'), 52428800)
        end
    )
  end
$$;

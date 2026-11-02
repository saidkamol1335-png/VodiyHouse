-- Проект-2, фаза B (PLAN §10, п. 6): одобряет только руководитель — публикует и возвращает отчёты
-- хода строительства он один. Менеджер видит отчёты на проверке (RLS прежний), но решения не принимает.
-- Тела — из 20261029100000_progress_reports.sql, изменена только проверка роли.

create or replace function public.publish_progress_report(p_id uuid, p_checked boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
begin
  if not private.has_role('head') then
    raise exception 'Отчёты публикует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'review' then
    raise exception 'Отчёт уже опубликован или возвращён — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  if private.locked_complex_status(v_report.complex_id) = 'archived' then
    raise exception 'ЖК в архиве — отчёт не нужен' using errcode = 'check_violation', hint = 'vh:archived';
  end if;
  if not coalesce(p_checked, false) then
    raise exception 'Сначала отметьте проверку по правилу 1.2 — без неё отчёт не публикуется'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
  update public.progress_reports
     set status = 'published', published_at = now(), published_by = auth.uid()
   where id = p_id;
  return jsonb_build_object('id', p_id, 'complex_id', v_report.complex_id);
end;
$$;

-- Вернуть мобилографу: с причиной; он исправит и отправит снова.
create or replace function public.return_progress_report(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
begin
  if not private.has_role('head') then
    raise exception 'Отчёты проверяет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if coalesce(length(btrim(p_note)), 0) not between 1 and 300 then
    raise exception 'Напишите, что исправить (до 300 знаков)' using errcode = 'check_violation', hint = 'vh:note';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'review' then
    raise exception 'Отчёт уже опубликован или возвращён — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  update public.progress_reports set status = 'returned', return_note = btrim(p_note) where id = p_id;
  return jsonb_build_object('id', p_id, 'complex_id', v_report.complex_id);
end;
$$;

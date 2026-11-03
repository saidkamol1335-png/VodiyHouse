-- Проект-2, фаза E: «Убрать кадр» ставит новую версию отчёта по часам, а не по началу транзакции
-- (clock_timestamp): две правки в одной транзакции тоже дают разные версии. Тело — как в
-- 20261103150000_progress_mobile_rpc.sql, кроме отметки версии.

create or replace function public.remove_progress_photo(p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.progress_photos;
  v_report public.progress_reports;
  v_count integer;
begin
  if not private.has_role('head') then
    raise exception 'Кадр убирает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_photo from public.progress_photos p where p.id = p_photo;
  if not found then
    raise exception 'Кадр не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  select * into v_report from public.progress_reports r where r.id = v_photo.report_id for update;
  if v_report.status <> 'review' then
    raise exception 'Отчёт уже опубликован или возвращён — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  select count(*) into v_count from public.progress_photos p where p.report_id = v_report.id;
  if v_count <= 3 then
    raise exception 'В отчёте должно остаться не меньше 3 фото' using errcode = 'check_violation', hint = 'vh:frames';
  end if;
  delete from public.progress_photos where id = p_photo and report_id = v_report.id;
  if not found then
    raise exception 'Кадр уже убран — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  -- Новая версия отчёта: публикация из ящика, открытого до правки, — vh:stale. Журнал — строкой ниже.
  perform set_config('vodiy.skip_audit', 'on', true);
  update public.progress_reports set updated_at = clock_timestamp() where id = v_report.id;
  perform set_config('vodiy.skip_audit', 'off', true);
  insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, developer_id, changes)
  values (
    auth.uid(), 'update', 'progress_reports', v_report.id::text, v_report.complex_id,
    (select c.developer_id from public.complexes c where c.id = v_report.complex_id),
    jsonb_build_object('photos', jsonb_build_array(v_count, v_count - 1))
  );
  return jsonb_build_object(
    'report_id', v_report.id, 'complex_id', v_report.complex_id,
    'removed', jsonb_build_array(v_photo.path) || case
      when v_photo.publish_path is null then '[]'::jsonb else jsonb_build_array(v_photo.publish_path) end
  );
end;
$$;

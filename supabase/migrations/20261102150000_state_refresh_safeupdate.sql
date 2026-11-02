-- Проект-2, фаза B, исправление после выкладки в облако 02.11: Supabase держит для запросов Data API
-- расширение safeupdate — DELETE и UPDATE без WHERE отклоняются («DELETE requires a WHERE clause»).
-- private.refresh_complex_states чистил свою временную таблицу без WHERE, и любая правка квартиры
-- или ЖК из кабинета падала. Тело пересобирается заменой одной строки (в PGlite safeupdate нет —
-- страж от повторения: tests/db/project2-access.test.ts, «нет DELETE / UPDATE без WHERE»).
do $$
declare
  body text := pg_get_functiondef('private.refresh_complex_states(uuid[])'::regprocedure);
begin
  if position('delete from pg_temp.vh_complex_states;' in body) = 0 then
    raise exception 'private.refresh_complex_states: ожидалась очистка временной таблицы без WHERE';
  end if;
  execute replace(body, 'delete from pg_temp.vh_complex_states;', 'delete from pg_temp.vh_complex_states where true;');
end;
$$;

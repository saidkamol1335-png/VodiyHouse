-- Проект-2, фаза B (PLAN §10, п. 6): менеджер добавляет и правит ЖК, блоки, планировки, квартиры,
-- фото и документы. Публикует, скрывает, архивирует, удаляет ЖК и ставит его в порядок каталога —
-- только руководитель; менеджер просит его кнопкой «Запросить у руководителя» (20261102140000).
-- Стражи «опубликованный ЖК нельзя ухудшить» действуют для всех ролей, как раньше.

-- ─── Функции правки ЖК: «руководитель» → «руководитель или менеджер» ─────────────────────
-- В каждой ровно одна проверка роли на входе (сверено по телу функций 02.11); тело пересобирается
-- заменой. Не нашлось проверки — миграция падает, а не открывает функцию молча.
do $$
declare
  fn_name text;
  fn_oid oid;
  body text;
begin
  foreach fn_name in array array[
    'add_complex_drawing', 'add_complex_photo', 'add_unit', 'create_block_units', 'create_complex',
    'delete_block_units', 'delete_floor_plan', 'delete_units', 'remove_complex_facade',
    'remove_complex_photo', 'remove_deadline_change', 'reorder_complex_photos', 'save_block_layouts',
    'save_complex_blocks', 'save_complex_details', 'save_complex_documents', 'save_complex_videos',
    'save_floor_plan', 'set_block_contour', 'set_complex_facade', 'set_complex_photo_category',
    'set_complex_slug', 'set_floor_plan_contours', 'set_units_finishing', 'set_units_layouts',
    'set_units_price', 'update_unit'
  ] loop
    select p.oid into strict fn_oid
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn_name;
    body := pg_get_functiondef(fn_oid);
    if (length(body) - length(replace(body, 'private.has_role(''head'')', '')))
       <> length('private.has_role(''head'')') then
      raise exception 'public.%: ожидалась ровно одна проверка роли руководителя', fn_name;
    end if;
    execute replace(body, 'private.has_role(''head'')', 'private.has_role(''head'', ''manager'')');
  end loop;
end;
$$;

-- ─── ЖК: менеджер добавляет (create_complex — права вызывающего) и правит ─────────────────
drop policy "complexes: добавляет руководитель" on public.complexes;
drop policy "complexes: правит руководитель" on public.complexes;

create policy "complexes: добавляют руководитель и менеджер"
  on public.complexes for insert to authenticated
  with check ((select private.has_role('head', 'manager')));
create policy "complexes: правят руководитель и менеджер"
  on public.complexes for update to authenticated
  using ((select private.has_role('head', 'manager')))
  with check ((select private.has_role('head', 'manager')));

-- Чего менеджер не меняет: статус (публикация, скрытие, архив), отметку правила 1.2, порядок
-- в каталоге и застройщика ЖК, который уже не черновик (перенос к другому застройщику переписывает
-- его программы и витрину и меняет страницу на сайте). Новый ЖК менеджера — только черновик. Сервер с секретным ключом и функции без
-- сессии сотрудника (расписание) сюда не попадают: у них нет роли manager.
create function private.guard_manager_complex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.has_role('head') or not private.has_role('manager') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.files_checked_at is not null then
      raise exception 'Новый ЖК менеджера — черновик; публикует руководитель'
        using errcode = 'insufficient_privilege', hint = 'vh:head_only';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.files_checked_at is distinct from old.files_checked_at
     or new.archived_at is distinct from old.archived_at
     or new.sort is distinct from old.sort
     or (new.developer_id is distinct from old.developer_id and old.status <> 'draft') then
    raise exception 'Публикует, скрывает, архивирует и ставит порядок руководитель — запросите у него'
      using errcode = 'insufficient_privilege', hint = 'vh:head_only';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_manager_complex() from public;

-- Имя с «a_» — раньше стражей и штампов: отказ без лишней работы.
create trigger complexes_a_guard_manager
  before insert or update on public.complexes
  for each row execute function private.guard_manager_complex();

-- ─── Таблицы ЖК ──────────────────────────────────────────────────────────────────────────
-- Часть функций правки работает с правами вызывающего (create_complex, save_complex_blocks,
-- save_complex_documents…), поэтому менеджеру нужны и политики записи. Фото застройщика
-- (media_assets без complex_id) — по-прежнему руководитель. Квартиры (units) напрямую не пишет
-- никто: только функции (20261021120000).
do $$
declare
  content_table text;
  allowed text;
begin
  foreach content_table in array array[
    'blocks', 'layouts', 'media_assets',
    'complex_documents', 'complex_videos', 'complex_details', 'deadline_changes'
  ] loop
    allowed := case content_table
      when 'media_assets' then
        '(select private.has_role(''head'')) or ((select private.has_role(''manager'')) and complex_id is not null)'
      else '(select private.has_role(''head'', ''manager''))'
    end;
    execute format('drop policy %I on public.%I', content_table || ': добавляет руководитель', content_table);
    execute format('drop policy %I on public.%I', content_table || ': правит руководитель', content_table);
    execute format('drop policy %I on public.%I', content_table || ': удаляет руководитель', content_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
      content_table || ': добавляют руководитель и менеджер', content_table, allowed);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      content_table || ': правят руководитель и менеджер', content_table, allowed, allowed);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',
      content_table || ': удаляют руководитель и менеджер', content_table, allowed);
  end loop;
end;
$$;

-- ─── Фото ЖК в Storage: менеджер загружает и удаляет файлы ЖК ────────────────────────────
-- Застройщики и витрина — по-прежнему руководитель.
create policy "media: менеджер загружает фото ЖК"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select private.has_role('manager'))
    and name like 'complexes/%'
    and private.is_media_path(name)
  );

-- Удаляет только файлы-сироты: строку фото уже убрала функция кабинета, либо привязка не удалась.
-- Файл, на который ссылается фото или отчёт, менеджер в обход кабинета не сотрёт. Чужой файл без
-- строки — только старше часа: иначе это может быть загрузка коллеги, которая ещё привязывается.
create policy "media: менеджер удаляет файлы-сироты ЖК"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (select private.has_role('manager'))
    and name like 'complexes/%'
    and not exists (select 1 from public.media_assets m where m.path = objects.name)
    and not exists (select 1 from public.progress_photos p where p.path = objects.name)
    and (owner = (select auth.uid()) or created_at < now() - interval '1 hour')
  );

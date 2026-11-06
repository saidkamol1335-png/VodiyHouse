-- Архив кнопок фильтра каталога (06.11.2026, «Настройки → Фильтр сайта»): кнопки и блоки фильтра
-- сайта, скрытые до ручного возврата. Публичная запись settings `site.filter_archive` — её читает
-- сайт (public_settings). Остальные настройки по-прежнему правит только руководитель; менеджеру —
-- только эта запись и только публичной (решение заказчика 06.11: «руководитель и менеджер»).
-- Журнал — существующий триггер settings_audit.

create policy "settings: архив фильтра добавляет менеджер"
  on public.settings for insert to authenticated
  with check (key = 'site.filter_archive' and is_public and (select private.has_role('manager')));

create policy "settings: архив фильтра правит менеджер"
  on public.settings for update to authenticated
  using (key = 'site.filter_archive' and (select private.has_role('manager')))
  with check (key = 'site.filter_archive' and is_public and (select private.has_role('manager')));

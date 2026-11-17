-- Правки 15.11, п. 7 + 23: общие «Частые вопросы» Vodiy House — публичная запись settings `site.faq`
-- (её читает сайт через public_settings): на главной после «Quruvchimisiz?» и на странице каждого ЖК
-- вместе с вопросами ЖК. Формат — как у вопросов ЖК (private.valid_faq: до 8 пар, оба языка). Правят
-- руководитель и менеджер — как вопросы ЖК и архив фильтра; журнал — существующий триггер settings_audit.

alter table public.settings
  add constraint settings_site_faq_valid check (key <> 'site.faq' or private.valid_faq(value));

create policy "settings: общие вопросы добавляет менеджер"
  on public.settings for insert to authenticated
  with check (key = 'site.faq' and is_public and (select private.has_role('manager')));

create policy "settings: общие вопросы правит менеджер"
  on public.settings for update to authenticated
  using (key = 'site.faq' and (select private.has_role('manager')))
  with check (key = 'site.faq' and is_public and (select private.has_role('manager')));

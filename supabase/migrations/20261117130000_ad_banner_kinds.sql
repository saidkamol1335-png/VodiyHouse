-- Правки 15.11, п. 4 + 13: реклама в «Витрине» — баннер. Новые значения enum нельзя использовать в той
-- же транзакции, поэтому отдельный файл (как 20261029010000_media_floor_plan.sql):
--   · media_kind: banner (картинка для ПК) и banner_mobile (для телефона) — у рекламы;
--   · lead_type: ad — заявка «Ariza qoldirish» с баннера (тип «Реклама», застройщик — в предмете заявки).

alter type public.media_kind add value if not exists 'banner';
alter type public.media_kind add value if not exists 'banner_mobile';
alter type public.lead_type add value if not exists 'ad';

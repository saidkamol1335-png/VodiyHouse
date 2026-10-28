-- Ревью 3.16а: начало периода по умолчанию — current_date, то есть дата базы в UTC, а видимость
-- считает private.tashkent_today(). Запись с 00:00 до 05:00 по Ташкенту получала вчерашнее начало.
-- Теперь и умолчание — ташкентская дата. Права у anon, authenticated и service_role уже есть:
-- usage схемы private (20261019160000_staff_dictionaries_audit.sql) и execute функции
-- (20261028150000_showcase.sql). Строки, вставленные раньше, не меняются.

alter table public.specials
  alter column valid_from set default private.tashkent_today();

alter table public.ads
  alter column valid_from set default private.tashkent_today();

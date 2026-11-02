-- Проект-2, фаза B: каналы доставки заявок по умолчанию — Telegram и Таблица, как сайт доставлял
-- до перехода на подписанные вызовы (20261102130000, private.lead_channels). Без строки заявка
-- сохранялась бы без каналов: ни доставки, ни тревоги «не дошла за 10 минут».
-- Уже заданное значение (тестовое облако, правка в админке) не трогаем.
insert into public.settings (key, value, is_public)
values ('leads.channels', '["telegram", "sheet"]'::jsonb, false)
on conflict (key) do nothing;

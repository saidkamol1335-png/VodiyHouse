-- Ревью блока G: запрет «скидка» ловил только слово — «−10%», «-15 %» проходили и форму, и базу.
-- Теперь скидка — ещё и минус, тире (любое) или дефис перед числом с процентом, не после цифры
-- или «%»: «−10%», «—10%», «-15 %» (пробел любой, включая неразрывный) — отказ; диапазон «10–30%»,
-- «взнос 30%», «0% рассрочка» — проходят. Латиницей «skidka» — тоже скидка. Та же правка —
-- lib/admin/discountGuard.ts. Права и check-ограничения прежние: replace их не трогает.
create or replace function private.mentions_discount(value public.i18n_text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (value ->> 'ru') ~* '(скидк|skidk|chegirma|discount|(^|[^\d%])[−—–-]\d+[\s\u00a0\u202f]?%)'
    or (value ->> 'uz') ~* '(скидк|skidk|chegirma|discount|(^|[^\d%])[−—–-]\d+[\s\u00a0\u202f]?%)',
    false)
$$;

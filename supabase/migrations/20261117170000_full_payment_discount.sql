-- Правки 15.11, п. 21 (блок D): скидка за 100 % оплату на сайте. Процент — уже в условиях застройщика
-- (payment_programs.discount_pct у программы «100% оплата»), но сайт его не получал (PLAN §3.13: цены без
-- скидок). Теперь получает — только когда руководитель включил «Скидки на сайте» (тот же выключатель,
-- что прячет спецпредложения со скидкой: private.site_shows_discounts, 20261117150000). Выключено (по
-- умолчанию) — поля нет, всё как раньше. Скидки ступеней схемы по-прежнему не уходят на сайт. Поле —
-- benefit_pct («выгода»): JS сайта не должен содержать слова «discount» (PLAN §3.13, site-calc-view.spec).

create or replace function private.site_program(p public.payment_programs, p_checked_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'method', p.method,
    'bank', (select b.name from public.banks b where b.id = p.bank_id),
    'min_down_pct', p.min_down_pct,
    'tiers', (select coalesce(jsonb_agg(t.value - 'discount_pct' order by t.ordinality), '[]'::jsonb)
              from jsonb_array_elements(p.tiers) with ordinality as t),
    'terms', p.terms, 'fees', p.fees,
    'preset_months', to_jsonb(p.preset_months), 'allow_custom_months', p.allow_custom_months,
    'over_max_behavior', p.over_max_behavior, 'currency', p.currency,
    'blocks_scope', p.blocks_scope, 'block_ids', to_jsonb(private.public_block_ids(p.block_ids)),
    -- «Условия актуальны на» (Р5): позднее из правки и отметки «проверены».
    'updated_at', greatest(p.updated_at, p_checked_at)
  )
  || case
       when p.type = 'full' and coalesce(p.discount_pct, 0) > 0 and private.site_shows_discounts()
         then jsonb_build_object('benefit_pct', p.discount_pct)
       else '{}'::jsonb
     end
$$;

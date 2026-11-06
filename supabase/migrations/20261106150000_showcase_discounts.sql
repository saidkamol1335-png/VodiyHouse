-- Скидки в витрине (слово исполнителя 06.11.2026 «Да, показывать скидки»; отменяет PLAN §3.13 для
-- спецпредложений и рекламы): условия застройщика вроде «при 100% оплате — скидка 8%» показываются
-- как есть. Снимаются только проверки private.mentions_discount у текстов спецпредложений и рекламы;
-- названия подборок — по-прежнему без скидок (это кнопки каталога, а не условия). Цены и
-- калькулятор сайта скидок не считают, как и раньше. Та же правка — lib/admin/showcase/forms.ts.

alter table public.specials
  drop constraint specials_badge_check,
  drop constraint specials_title_check,
  drop constraint specials_text_check;

alter table public.ads
  drop constraint ads_title_check,
  drop constraint ads_text_check;

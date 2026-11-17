-- Правки 15.11, п. 4 + 13: реклама в «Витрине» — новый формат. Реклама застройщика — баннер:
-- картинка для ПК (banner, обязательна для показа) и для телефона (banner_mobile, без неё — та же для
-- ПК), застройщик, даты показа, порядок; кнопка — телефон Vodiy House (cta = 'phone') или
-- «Ariza qoldirish» (cta = 'lead', заявка типа «Реклама»). Контакты застройщика — нигде (ТЗ 1.2):
-- каждую загрузку баннера руководитель отмечает галочкой 1.2, как обложку (set_showcase_media).
-- Тексты, ЖК и фильтр рекламы остаются в таблице, но сайт их больше не показывает.

alter table public.ads
  add column cta text not null default 'lead' check (cta in ('phone', 'lead'));

comment on column public.ads.cta is
  'Кнопка баннера: phone — телефон Vodiy House (tel:), lead — «Ariza qoldirish» (заявка типа ad).';

-- Баннеры — только у рекламы, по одному каждого вида.
alter table public.media_assets drop constraint media_assets_kind_by_owner;
alter table public.media_assets
  add constraint media_assets_kind_by_owner
    check (
      case kind
        when 'logo' then developer_id is not null
        when 'cover' then complex_id is null
        when 'banner' then ad_id is not null
        when 'banner_mobile' then ad_id is not null
        else complex_id is not null
      end);

create unique index media_assets_one_ad_banner_idx on public.media_assets (ad_id) where kind = 'banner';
create unique index media_assets_one_ad_banner_mobile_idx on public.media_assets (ad_id) where kind = 'banner_mobile';

-- Обложка или баннер витрины: вид файла — p_kind (по умолчанию обложка, как было). Баннеры — только у
-- рекламы. Отметка правила 1.2 — на каждую загрузку, руководитель — как раньше.
drop function public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean);
drop function public.remove_showcase_media(text, uuid);

create function public.set_showcase_media(
  p_owner text,
  p_id uuid,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_focus_x real default 0.5,
  p_focus_y real default 0.5,
  p_rule12 boolean default false,
  p_kind text default 'cover'
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Обложку витрины загружает руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_owner not in ('special', 'collection', 'ad')
    or p_kind not in ('cover', 'banner', 'banner_mobile')
    or (p_kind <> 'cover' and p_owner <> 'ad') then
    raise exception 'Обложка — у спецпредложения, подборки или рекламы; баннер — только у рекламы'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if not coalesce(p_rule12, false) then
    raise exception 'Отметьте, что на файле нет контактов застройщика (правило 1.2)'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
  if not exists (
    select 1 from public.specials s where p_owner = 'special' and s.id = p_id
    union all select 1 from public.collections c where p_owner = 'collection' and c.id = p_id
    union all select 1 from public.ads a where p_owner = 'ad' and a.id = p_id
  ) then
    raise exception 'Запись витрины не найдена' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  delete from public.media_assets m
  where m.kind = p_kind::public.media_kind
    and ((p_owner = 'special' and m.special_id = p_id)
      or (p_owner = 'collection' and m.collection_id = p_id)
      or (p_owner = 'ad' and m.ad_id = p_id))
  returning m.path into old_path;
  insert into public.media_assets (special_id, collection_id, ad_id, kind, path, width, height, blur, focus_x, focus_y)
  values (
    case when p_owner = 'special' then p_id end,
    case when p_owner = 'collection' then p_id end,
    case when p_owner = 'ad' then p_id end,
    p_kind::public.media_kind, p_path, p_width, p_height, p_blur, p_focus_x, p_focus_y);
  return old_path;
end;
$$;

create function public.remove_showcase_media(p_owner text, p_id uuid, p_kind text default 'cover')
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Обложку витрины удаляет руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_owner not in ('special', 'collection', 'ad')
    or p_kind not in ('cover', 'banner', 'banner_mobile')
    or (p_kind <> 'cover' and p_owner <> 'ad') then
    raise exception 'Обложка — у спецпредложения, подборки или рекламы; баннер — только у рекламы'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  delete from public.media_assets m
  where m.kind = p_kind::public.media_kind
    and ((p_owner = 'special' and m.special_id = p_id)
      or (p_owner = 'collection' and m.collection_id = p_id)
      or (p_owner = 'ad' and m.ad_id = p_id))
  returning m.path into old_path;
  return old_path;
end;
$$;

comment on function public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean, text) is
  'Обложка витрины или баннер рекламы (p_kind): заменяет прежний файл того же вида одной транзакцией, возвращает путь старого; нужна отметка правила 1.2.';
comment on function public.remove_showcase_media(text, uuid, text) is
  'Удаляет обложку витрины или баннер рекламы (p_kind), возвращает путь файла для Storage API.';

revoke all on function
  public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean, text),
  public.remove_showcase_media(text, uuid, text)
from public, anon;
grant execute on function
  public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean, text),
  public.remove_showcase_media(text, uuid, text)
to authenticated;

-- Сайт: реклама — только с баннером для ПК; кнопка (cta), баннеры и застройщик. Остальное — как было.
create or replace function public.site_showcase()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'today', private.tashkent_today(),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', k.id, 'slug', k.slug, 'title', k.title, 'mode', k.mode, 'filter', k.filter,
          'complex_ids', private.showcase_public_complexes(k.complex_ids),
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.collection_id = k.id and m.kind = 'cover'))
        order by k.sort, k.created_at)
      from public.collections k
      where k.is_active), '[]'::jsonb),
    'specials', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'kind', s.kind, 'badge', s.badge, 'title', s.title, 'text', s.text,
          'developer', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name),
          'complex_ids', private.showcase_public_complexes(s.complex_ids),
          'valid_to', s.valid_to,
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.special_id = s.id and m.kind = 'cover'))
        order by s.sort, s.created_at)
      from public.specials s
      join public.developers d on d.id = s.developer_id
      where private.showcase_visible(s.is_active, s.valid_from, s.valid_to, s.developer_id)), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'cta', a.cta,
          'developer', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name),
          'valid_to', a.valid_to,
          'banner', private.site_media(banner),
          'banner_mobile', (select private.site_media(m) from public.media_assets m
                            where m.ad_id = a.id and m.kind = 'banner_mobile'))
        order by a.sort, a.created_at)
      from public.ads a
      join public.developers d on d.id = a.developer_id
      join public.media_assets banner on banner.ad_id = a.id and banner.kind = 'banner'
      where private.showcase_visible(a.is_active, a.valid_from, a.valid_to, a.developer_id)), '[]'::jsonb)
  )
$$;

-- Отзывы покупателей на главной (PLAN §10, п. 47; ТЗ 5.11, 1б). Только реальные отзывы с письменным
-- согласием клиента: опубликовать без отметки согласия нельзя (check), сайт видит только
-- опубликованные с согласием и только когда их не меньше трёх (site_reviews). Форма в кабинете —
-- отдельным шагом; до неё строки добавляет руководитель (RLS: правит только head, читают head и
-- manager). Снятие с сайта — сразу при сбросе REVIEWS_TAG, иначе через минуты (кэш сайта).

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  -- Имя — как разрешил клиент («Дилшод», «Семья Каримовых»).
  author_name text not null check (length(btrim(author_name)) between 2 and 60),
  -- «Кто он»: «купил 2-комн. в ЖК Shodlik».
  author_role public.i18n_text not null,
  -- Оценка 1–5 с половинками.
  rating numeric(2, 1) not null check (rating between 1 and 5 and rating * 2 = trunc(rating * 2)),
  quote public.i18n_text not null,
  -- Выделенная фраза — кусок цитаты на том же языке.
  accent public.i18n_text check (
    accent is null
    or (strpos(quote ->> 'ru', accent ->> 'ru') > 0 and strpos(quote ->> 'uz', accent ->> 'uz') > 0)
  ),
  complex_id uuid references public.complexes (id) on delete set null,
  -- Фото (вручение ключей или квартира клиента) — файл бакета media; или ролик YouTube.
  -- Файл бакета media в папке отзывов: reviews/<id отзыва>/<файл>.jpg|png|webp.
  photo_path text check (photo_path ~ '^reviews/[0-9a-f-]{36}/[A-Za-z0-9_.-]{1,80}\.(jpg|jpeg|png|webp)$'),
  photo_width integer check (photo_width > 0),
  photo_height integer check (photo_height > 0),
  photo_blur text check (length(photo_blur) <= 4000),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- Письменное согласие клиента: когда и кто из сотрудников отметил.
  consent_at timestamptz,
  consent_by uuid references public.profiles (id) on delete set null,
  is_published boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((photo_path is null) = (photo_width is null) and (photo_path is null) = (photo_height is null)),
  check (photo_path is not null or photo_blur is null),
  check (not is_published or consent_at is not null)
);

create index reviews_published_idx on public.reviews (sort, created_at) where is_published;

create trigger reviews_set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create trigger reviews_audit after insert or update or delete on public.reviews
  for each row execute function private.write_audit();

alter table public.reviews enable row level security;

-- Посетитель таблицу не читает: только site_reviews() (там же правило «не меньше трёх»).
revoke all on public.reviews from anon, authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

-- Черновики (имена, цитаты, согласие) — только руководитель и менеджер; мобилографу не нужны.
create policy "reviews: читают руководитель и менеджер"
  on public.reviews for select to authenticated
  using ((select private.has_role('head', 'manager')));
create policy "reviews: добавляет руководитель"
  on public.reviews for insert to authenticated
  with check ((select private.has_role('head')));
create policy "reviews: правит руководитель"
  on public.reviews for update to authenticated
  using ((select private.has_role('head'))) with check ((select private.has_role('head')));
create policy "reviews: удаляет руководитель"
  on public.reviews for delete to authenticated
  using ((select private.has_role('head')));

-- Отзывы для сайта: опубликованные с согласием, в порядке руководителя; меньше трёх — пусто (блок
-- скрыт). ЖК — только если он сейчас опубликован (ссылка не ведёт на снятый).
create function public.site_reviews()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select r.* from public.reviews r
    where r.is_published and r.consent_at is not null
  )
  select case when (select count(*) from visible) < 3 then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', v.id,
        'author_name', v.author_name,
        'author_role', v.author_role,
        'rating', v.rating,
        'quote', v.quote,
        'accent', v.accent,
        'photo', case when v.photo_path is null then null else jsonb_build_object(
          'path', v.photo_path, 'width', v.photo_width, 'height', v.photo_height, 'blur', v.photo_blur) end,
        'youtube_id', v.youtube_id,
        'complex', (select jsonb_build_object('slug', c.slug, 'name', c.name)
                    from public.complexes c
                    where c.id = v.complex_id and private.is_public_complex(c.id)))
      order by v.sort, v.created_at, v.id)
    from visible v), '[]'::jsonb) end
$$;

revoke all on function public.site_reviews() from public;
grant execute on function public.site_reviews() to anon, authenticated, service_role;

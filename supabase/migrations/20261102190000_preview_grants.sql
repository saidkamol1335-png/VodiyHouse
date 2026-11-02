-- Проект-2, фаза C (PLAN §10): предпросмотр ЖК на сайте без сессии руководителя. Кабинет живёт на
-- своём домене, cookie сотрудника сайт не видит. Кабинет (руководитель или менеджер) берёт грант на
-- 15 минут — случайный токен, в базе только его хэш; открывает /preview/zhk/<slug>?token=… на сайте.
-- Сайт в режиме предпросмотра (draftMode, мимо кэша) шлёт токен заголовком x-vh-preview, и функции
-- сайта видят этот ЖК как опубликованный. Без заголовка (весь обычный сайт и кэш) — ничего не меняется.

create table private.preview_grants (
  token_hash bytea primary key,
  complex_id uuid not null references public.complexes (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null
);

create index preview_grants_expires_idx on private.preview_grants (expires_at);
revoke all on private.preview_grants from public, anon, authenticated;

-- Токен предпросмотра для кабинета: 24 случайных байта hex. Старые гранты чистятся на ходу.
create function public.create_preview_grant(p_complex uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Предпросмотр открывают руководитель и менеджер' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if not exists (select 1 from public.complexes c where c.id = p_complex) then
    raise exception 'ЖК не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  delete from private.preview_grants g where g.expires_at < now();
  token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.preview_grants (token_hash, complex_id, created_by, expires_at)
  values (extensions.digest(token, 'sha256'), p_complex, auth.uid(), now() + interval '15 minutes');
  return token;
end;
$$;

revoke all on function public.create_preview_grant(uuid) from public, anon;
grant execute on function public.create_preview_grant(uuid) to authenticated;

-- ЖК из действующего гранта в заголовке запроса (Data API кладёт заголовки в request.headers) или null.
create function private.preview_complex()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  token text;
begin
  token := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-vh-preview';
  if token is null or token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  return (
    select g.complex_id from private.preview_grants g
    where g.token_hash = extensions.digest(token, 'sha256') and g.expires_at > now()
  );
exception when invalid_text_representation then
  return null;
end;
$$;

revoke all on function private.preview_complex() from public, anon, authenticated;

-- Опубликован ли ЖК на самом деле (тело прежней is_public_complex, 20261019170000): пометка
-- предпросмотра «увидит ли посетитель» не должна зависеть от гранта.
create function private.is_published_complex(complex uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.complexes c
    join public.developers d on d.id = c.developer_id
    where c.id = complex and c.status = 'published' and d.status = 'published'
  )
$$;

revoke all on function private.is_published_complex(uuid) from public, anon, authenticated;

-- Видимость ЖК для сайта: опубликован — или открыт грантом предпросмотра.
create or replace function private.is_public_complex(complex uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_published_complex(complex)
    or (complex is not null and private.preview_complex() is not distinct from complex)
$$;

-- on_site страницы ЖК — по настоящей публикации (тело site_complex пересобирается заменой строки).
do $$
declare
  body text := pg_get_functiondef('public.site_complex(text)'::regprocedure);
begin
  if position('''on_site'', private.is_public_complex(c.id)' in body) = 0 then
    raise exception 'public.site_complex: не найдено on_site';
  end if;
  execute replace(body, '''on_site'', private.is_public_complex(c.id)', '''on_site'', private.is_published_complex(c.id)');
end;
$$;

-- Проект-2, фаза B (PLAN §10, пп. 6, 10, 13).
--   publication_requests — «Запросить у руководителя»: менеджер просит опубликовать, вернуть на сайт
--   (из «Скрыт») или убрать ЖК; в списке ЖК — бейдж «Ожидает руководителя», руководителю — Telegram
--   (отправляет админка, фаза D). Открытый запрос на ЖК один; любая смена статуса ЖК его закрывает:
--   «выполнен», если руководитель сделал то, о чём просили, иначе «снят».
--   incoming — приватный бакет загрузок мобилографа до проверки: файл виден автору и руководителю,
--   при публикации админка копирует его в публичный media (фаза E).

-- ─── Запросы руководителю ────────────────────────────────────────────────────────────────
create type public.publication_request_kind as enum ('publish', 'unhide', 'hide', 'archive');
create type public.publication_request_status as enum ('pending', 'done', 'declined', 'cancelled');

create table public.publication_requests (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  kind public.publication_request_kind not null,
  status public.publication_request_status not null default 'pending',
  note text check (length(btrim(note)) between 1 and 300),
  requested_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  -- Ответ руководителя: причина отказа видна менеджеру.
  answer text check (length(btrim(answer)) between 1 and 300),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  check ((status = 'pending') = (resolved_at is null)),
  check (status <> 'declined' or answer is not null)
);

-- Один открытый запрос на ЖК: повторное нажатие — тот же запрос.
create unique index publication_requests_pending on public.publication_requests (complex_id) where status = 'pending';
create index publication_requests_complex_idx on public.publication_requests (complex_id, requested_at desc);

alter table public.publication_requests enable row level security;
revoke all on public.publication_requests from anon, authenticated;
grant select on public.publication_requests to authenticated;

create policy "publication_requests: руководитель и менеджер"
  on public.publication_requests for select to authenticated
  using ((select private.has_role('head', 'manager')));

create trigger publication_requests_audit
  after insert or update or delete on public.publication_requests
  for each row execute function private.write_audit();

-- Запросить: менеджер (руководителю просить себя не нужно). Возвращает id запроса.
create function public.request_publication(
  p_complex uuid, p_kind public.publication_request_kind, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.publication_status;
  v_id uuid;
begin
  if not private.has_role('manager') then
    raise exception 'Запросить может менеджер' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select c.status into v_status from public.complexes c where c.id = p_complex;
  if v_status is null then
    raise exception 'ЖК не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if (p_kind = 'publish' and v_status <> 'draft')
     or (p_kind = 'unhide' and v_status <> 'hidden')
     or (p_kind = 'hide' and v_status <> 'published')
     or (p_kind = 'archive' and v_status = 'archived') then
    raise exception 'Запрос не подходит к состоянию ЖК' using errcode = 'check_violation', hint = 'vh:status_move';
  end if;

  -- Тот же запрос — тот же id; запрос другого вида заменяет открытый (менеджер передумал).
  select r.id into v_id from public.publication_requests r
    where r.complex_id = p_complex and r.status = 'pending' and r.kind = p_kind;
  if v_id is not null then
    return v_id;
  end if;
  update public.publication_requests r
    set status = 'cancelled', resolved_by = auth.uid(), resolved_at = now()
    where r.complex_id = p_complex and r.status = 'pending';
  insert into public.publication_requests (complex_id, kind, note, requested_by)
  values (p_complex, p_kind, nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Ответить: руководитель отклоняет с причиной; менеджер отзывает свой запрос.
create function public.resolve_publication_request(
  p_request uuid, p_status public.publication_request_status, p_answer text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.publication_requests;
begin
  select * into r from public.publication_requests q where q.id = p_request;
  if r.id is null or r.status <> 'pending' then
    raise exception 'Запрос уже закрыт' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if not (
    (p_status = 'declined' and private.has_role('head'))
    or (p_status = 'cancelled' and private.has_role('manager') and r.requested_by = auth.uid())
  ) then
    raise exception 'Отклоняет руководитель, отзывает автор запроса'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  update public.publication_requests q
    set status = p_status, answer = nullif(btrim(p_answer), ''), resolved_by = auth.uid(), resolved_at = now()
    where q.id = p_request;
end;
$$;

revoke all on function public.request_publication(uuid, public.publication_request_kind, text) from public, anon;
revoke all on function public.resolve_publication_request(uuid, public.publication_request_status, text) from public, anon;
grant execute on function public.request_publication(uuid, public.publication_request_kind, text) to authenticated;
grant execute on function public.resolve_publication_request(uuid, public.publication_request_status, text) to authenticated;

-- Руководитель сделал то, о чём просили (сменил статус ЖК) — запрос закрывается как выполненный.
create function private.close_publication_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.publication_requests r
    set status = case
          when (r.kind in ('publish', 'unhide') and new.status = 'published')
            or (r.kind = 'hide' and new.status = 'hidden')
            or (r.kind = 'archive' and new.status = 'archived')
          then 'done'::public.publication_request_status
          else 'cancelled'::public.publication_request_status
        end,
        resolved_by = auth.uid(),
        resolved_at = now()
    where r.complex_id = new.id and r.status = 'pending';
  return null;
end;
$$;

revoke all on function private.close_publication_requests() from public;

create trigger complexes_close_publication_requests
  after update of status on public.complexes
  for each row when (new.status is distinct from old.status)
  execute function private.close_publication_requests();

-- ─── Загрузки мобилографа до проверки ────────────────────────────────────────────────────
-- Путь: <id автора>/<id ЖК>/<uuid>.<jpg|mp4>. Чужие файлы мобилограф не видит и не трогает.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incoming', 'incoming', false, null, array['image/jpeg', 'video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.is_incoming_path(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|mp4)$'
    and split_part(object_name, '/', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.complexes c
      where c.id::text = split_part(object_name, '/', 2) and c.status <> 'archived'
    ),
    false
  )
$$;

revoke all on function private.is_incoming_path(text) from public, anon;
grant execute on function private.is_incoming_path(text) to authenticated, service_role;

create policy "incoming: мобилограф и руководитель загружают свои файлы"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'incoming'
    and (select private.has_role('head', 'mobilographer'))
    and private.is_incoming_path(name)
  );

create policy "incoming: автор видит свои, руководитель — все"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'incoming'
    and (
      (select private.has_role('head'))
      or ((select private.has_role('mobilographer')) and split_part(name, '/', 1) = (select auth.uid())::text)
    )
  );

create policy "incoming: автор удаляет свои, руководитель — все"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'incoming'
    and (
      (select private.has_role('head'))
      or ((select private.has_role('mobilographer')) and split_part(name, '/', 1) = (select auth.uid())::text)
    )
  );

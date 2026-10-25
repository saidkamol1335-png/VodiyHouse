-- «Написать в Telegram» через бота (шаг 3.8, Ф8 A, ТЗ 10.5): по нажатию сервер сайта сохраняет, о чём
-- и откуда пришёл посетитель (ЖК, планировка, страница, метки первого захода), под коротким кодом —
-- он уходит в ссылку t.me/<бот>?start=<код> (до 64 знаков). /start в боте привязывает код к чату,
-- «Поделиться номером» создаёт заявку «Telegram-бот» с этим контекстом. Переписку бот не хранит.
-- Всё — только сервер (секретный ключ): у посетителя и сотрудников прямого доступа нет.

create table public.tg_starts (
  code text primary key check (code ~ '^[A-Za-z0-9_-]{8,64}$'),
  created_at timestamptz not null default now(),
  site_lang text not null check (site_lang in ('ru', 'uz')),
  -- Как в заявке (submit_lead): адрес ЖК, планировка — сервер возьмёт из базы при заявке.
  object jsonb not null default '{}' check (jsonb_typeof(object) = 'object' and length(object::text) <= 500),
  page_url text check (length(page_url) <= 500),
  source jsonb not null default '{}' check (jsonb_typeof(source) = 'object' and length(source::text) <= 2000),
  -- Хэш адреса посетителя — лимит частоты, сам адрес не храним.
  client_key text check (length(client_key) <= 128),
  chat_id bigint,
  started_at timestamptz,
  lead_id uuid references public.leads (id) on delete set null
);

create index tg_starts_chat_idx on public.tg_starts (chat_id, started_at desc) where chat_id is not null;
create index tg_starts_client_idx on public.tg_starts (client_key, created_at desc) where client_key is not null;
create index tg_starts_created_idx on public.tg_starts (created_at);

alter table public.tg_starts enable row level security;
revoke all on public.tg_starts from anon, authenticated, service_role;

-- Код по нажатию кнопки: случайный uuid в base64url, 22 знака (122 бита) — не угадать и не
-- перебрать; без расширений. С одного адреса — не больше 30 кодов за 10 минут: таблицу не забить.
create function public.create_tg_start(p_start jsonb, p_client_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_');
begin
  if jsonb_typeof(p_start) is distinct from 'object' then
    raise exception 'Запрос не распознан' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if p_client_key is not null and (
       select count(*) from public.tg_starts s
       where s.client_key = p_client_key and s.created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Слишком много переходов подряд' using errcode = 'P0001', hint = 'vh:rate_limited';
  end if;
  insert into public.tg_starts (code, site_lang, object, page_url, source, client_key)
  values (v_code, coalesce(p_start ->> 'site_lang', 'uz'), coalesce(p_start -> 'object', '{}'),
          p_start ->> 'page_url', coalesce(p_start -> 'source', '{}'), p_client_key);
  return v_code;
exception
  when check_violation or invalid_text_representation then
    raise exception 'Запрос не прошёл проверку' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
end;
$$;

-- /start <код>: код — к чату (один раз; повторный /start того же чата — тот же код). Ответ — язык и
-- название ЖК для приветствия; неизвестный или чужой код — null (бот поздоровается без ЖК).
create function public.bind_tg_start(p_code text, p_chat bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start public.tg_starts%rowtype;
begin
  update public.tg_starts s set chat_id = p_chat, started_at = now()
    where s.code = p_code and (s.chat_id is null or s.chat_id = p_chat) and s.lead_id is null
      and s.created_at > now() - interval '7 days'
    returning * into v_start;
  if v_start.code is null then
    return null;
  end if;
  return jsonb_build_object(
    'site_lang', v_start.site_lang,
    'complex', (select c.name from public.complexes c
                where c.slug = v_start.object ->> 'complex' and c.status = 'published'));
end;
$$;

-- Последний /start этого чата за 7 дней без заявки — контекст заявки по «Поделиться номером».
create function public.tg_start_for_chat(p_chat bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(s) - 'client_key'
  from public.tg_starts s
  where s.chat_id = p_chat and s.lead_id is null and s.started_at > now() - interval '7 days'
  order by s.started_at desc
  limit 1;
$$;

create function public.finish_tg_start(p_code text, p_lead uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tg_starts set lead_id = p_lead where code = p_code and lead_id is null;
$$;

-- Очистка (/api/cron): не открытые в боте — через 2 дня, остальные — через 30 дней.
create function public.cleanup_tg_starts()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.tg_starts s
    where (s.started_at is null and s.created_at < now() - interval '2 days')
       or s.created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.create_tg_start(jsonb, text) from public, anon, authenticated;
revoke all on function public.bind_tg_start(text, bigint) from public, anon, authenticated;
revoke all on function public.tg_start_for_chat(bigint) from public, anon, authenticated;
revoke all on function public.finish_tg_start(text, uuid) from public, anon, authenticated;
revoke all on function public.cleanup_tg_starts() from public, anon, authenticated;
grant execute on function public.create_tg_start(jsonb, text) to service_role;
grant execute on function public.bind_tg_start(text, bigint) to service_role;
grant execute on function public.tg_start_for_chat(bigint) to service_role;
grant execute on function public.finish_tg_start(text, uuid) to service_role;
grant execute on function public.cleanup_tg_starts() to service_role;

comment on table public.tg_starts is 'Коды «Написать в Telegram» (Ф8): контекст и метки посетителя до /start в боте. Только сервер.';

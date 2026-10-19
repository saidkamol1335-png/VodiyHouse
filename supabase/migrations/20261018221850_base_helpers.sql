-- Фаза 0: общие помощники схемы. Таблицы с RLS появятся в фазе 1 (PLAN §7).

-- updated_at обновляется в базе, а не в коде: правка из кабинета, SQL-консоли или cron
-- всегда оставляет верное время («Условия актуальны на …» — PLAN §3б).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Триггер BEFORE UPDATE: проставляет updated_at = now(). Подключается к таблицам с колонкой updated_at.';

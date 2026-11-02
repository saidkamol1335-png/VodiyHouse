-- Проект-2, фаза B (PLAN §10, п. 6 и 10): роль «видеограф» теперь «мобилограф»; у отчётов хода
-- строительства появляется черновик. Значения enum — отдельной миграцией: новое значение нельзя
-- использовать в той же транзакции, где его добавили.

-- Политики хранят значение enum, а не текст — переименование их не ломает. Тела функций —
-- текст, его разбирают при вызове: где роль названа словом, тело пересобирается ниже.
alter type public.staff_role rename value 'videographer' to 'mobilographer';

do $$
declare
  fn record;
  body text;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%''videographer''%'
  loop
    body := replace(pg_get_functiondef(fn.oid), '''videographer''', '''mobilographer''');
    execute body;
  end loop;
end;
$$;

-- Черновик отчёта мобилографа: сохранён, но не отправлен на проверку (фаза E).
alter type public.progress_status add value if not exists 'draft' before 'review';

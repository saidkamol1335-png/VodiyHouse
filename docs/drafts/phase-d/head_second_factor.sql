-- ЧЕРНОВИК ФАЗЫ D — НЕ МИГРАЦИЯ. Перенесён из supabase/migrations 02.11: общая выкладка применила бы его,
-- и руководитель без второго фактора остался бы без прав. В фазе D переписать под выбранный вариант 2FA
-- и вернуть в supabase/migrations новым номером вместе с экраном кода в админке.

-- Проект-2, фаза B (PLAN §10, п. 8): права руководителя — только у сессии со вторым фактором.
-- Проверка в Next недостаточна: зная пароль руководителя, можно войти через Supabase Auth напрямую
-- и работать с правами head через Data API. Поэтому роль head база выдаёт, только когда в JWT
-- aal = 'aal2' (Supabase MFA пройден). Сессия руководителя без второго фактора — как у посетителя:
-- свой профиль она видит (политика «каждый — себя»), прав роли нет. Менеджер и мобилограф — без изменений.
-- Код второго фактора приходит руководителю в Telegram — это делает админка (фаза D): фактор Supabase
-- MFA, код которого доставляет бот; aal2 в токене ставит только сам Auth.
-- Тело — из 20261029050000_staff_sessions.sql, добавлено одно условие.
create or replace function private.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and not p.must_change_password
    and (p.sessions_revoked_at is null
         or coalesce((auth.jwt() ->> 'iat')::bigint, 0) > floor(extract(epoch from p.sessions_revoked_at)))
    and (p.role <> 'head' or (auth.jwt() ->> 'aal') = 'aal2')
$$;

comment on function private.staff_role() is
  'Роль текущего сотрудника; null — посетитель, чужой, отключённый, ещё не сменивший временный пароль, токен старше закрытия сессий или руководитель без второго фактора (aal2).';

-- «Полировка» фазы 3 (блок F): адрес удалённого после архива ЖК (retired_slugs) отвечает 308 на
-- каталог, и браузер посетителя эту переадресацию помнит. Новый ЖК на том же адресе у видевших
-- старый всё равно уводил бы в каталог — такой адрес считается занятым: create_complex и
-- set_complex_slug на unique_violation сами берут следующий суффикс (-2, -3…); прямая запись адреса
-- получает отказ vh:slug_retired. Адреса demo-… не проверяются: DEMO удаляется и создаётся заново
-- одной командой (demo:seed), и удалённый когда-то DEMO-ЖК не должен ломать пересоздание.

create function private.guard_retired_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.slug is distinct from old.slug)
     and new.slug !~ '^demo(-|$)'
     and exists (select 1 from public.retired_slugs r where r.slug = new.slug) then
    raise exception 'Адрес «%» был у удалённого ЖК — браузеры посетителей помнят переадресацию', new.slug
      using errcode = 'unique_violation', hint = 'vh:slug_retired';
  end if;
  return new;
end;
$$;

create trigger complexes_retired_slug before insert or update of slug on public.complexes
  for each row execute function private.guard_retired_slug();

revoke all on function private.guard_retired_slug() from public, anon;

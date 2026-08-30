-- Sync auth.users into public.users and keep the table updated when auth records change.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    name,
    image,
    role,
    "isActive",
    "createdAt",
    "updatedAt"
  )
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), ''),
    nullif(new.raw_user_meta_data->>'avatar_url', ''),
    'user',
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    image = excluded.image,
    "updatedAt" = now();

  return new;
end;
$$;

do $$
begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
    execute 'drop trigger if exists on_auth_user_updated on auth.users';
    execute '
      create trigger on_auth_user_created
      after insert or update on auth.users
      for each row
      execute function public.handle_new_auth_user()
    ';

    insert into public.users (
      id,
      email,
      name,
      image,
      role,
      "isActive",
      "createdAt",
      "updatedAt"
    )
    select
      au.id,
      au.email,
      nullif(coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'), ''),
      nullif(au.raw_user_meta_data->>'avatar_url', ''),
      'user',
      true,
      now(),
      now()
    from auth.users au
    where au.email is not null
    on conflict (id) do update
    set
      email = excluded.email,
      name = excluded.name,
      image = excluded.image,
      "updatedAt" = now();
  end if;
end
$$;

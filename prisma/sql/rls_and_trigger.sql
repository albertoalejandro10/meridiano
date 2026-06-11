-- Appended to the init migration (created with `prisma migrate dev --create-only`).
-- RLS is the second defense layer; the Nitro auth middleware is the primary one.
-- Prisma connects as `postgres` and bypasses RLS — these policies guard
-- direct/PostgREST access and any future supabase-js data usage.

-- Mirror auth.users into public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.users enable row level security;
create policy "owner_all" on public.users
  for all
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter table public.accounts enable row level security;
create policy "owner_all" on public.accounts
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.categories enable row level security;
create policy "owner_all" on public.categories
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.transactions enable row level security;
create policy "owner_all" on public.transactions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

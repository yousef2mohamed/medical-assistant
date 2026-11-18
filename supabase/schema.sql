-- جدول المحادثات
create table if not exists messages (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  mode text,
  role text not null check (role in ('user','bot')),
  text text not null,
  created_at timestamptz default now()
);
alter table messages enable row level security;
create policy "own select" on messages for select using (auth.uid() = user_id);
create policy "own insert" on messages for insert with check (auth.uid() = user_id);
create policy "own delete" on messages for delete using (auth.uid() = user_id);

-- جدول الاستخدام اليومي
create table if not exists usage (
  user_id uuid references auth.users(id) on delete cascade,
  day date default current_date,
  count int default 0,
  primary key (user_id, day)
);
alter table usage enable row level security;

create or replace function increment_usage(p_user uuid)
returns int language plpgsql security definer
set search_path = public as $$
declare c int;
begin
  insert into usage(user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = usage.count + 1
  returning count into c;
  return c;
end $$;

revoke execute on function increment_usage(uuid) from public, anon, authenticated;

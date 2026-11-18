-- جدول المحادثات
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text default 'محادثة جديدة',
  created_at timestamptz default now()
);
alter table conversations enable row level security;

create policy "own conv select" on conversations
  for select using (auth.uid() = user_id);
create policy "own conv insert" on conversations
  for insert with check (auth.uid() = user_id);
create policy "own conv update" on conversations
  for update using (auth.uid() = user_id);
create policy "own conv delete" on conversations
  for delete using (auth.uid() = user_id);

-- ربط الرسائل بالمحادثات
alter table messages
  add column if not exists conversation_id uuid
  references conversations(id) on delete cascade;

-- نقل الرسائل القديمة لمحادثة واحدة "محادثة قديمة" لكل مستخدم
insert into conversations (user_id, title)
select distinct user_id, 'محادثة قديمة'
from messages where conversation_id is null;

update messages m
set conversation_id = c.id
from conversations c
where m.conversation_id is null
  and c.user_id = m.user_id
  and c.title = 'محادثة قديمة';

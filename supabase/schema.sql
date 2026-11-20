-- 한 해 가계부 · Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행하세요.

-- 1) 가계부 데이터: 사용자별 문서 저장소
--    doc_id 예시: 'index'(가계부 목록), 'lg…'(가계부 정보), 'lg…__y2026'(그 해 기록)
create table if not exists public.docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  doc_id     text        not null check (char_length(doc_id) between 1 and 100),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_id),
  constraint docs_size check (pg_column_size(data) < 1000000)   -- 문서 하나 1MB 미만
);

alter table public.docs enable row level security;

-- 본인 행만 읽고 쓸 수 있어요. (user_id 는 로그인 세션에서만 결정돼요)
drop policy if exists "docs_select_own" on public.docs;
drop policy if exists "docs_insert_own" on public.docs;
drop policy if exists "docs_update_own" on public.docs;
drop policy if exists "docs_delete_own" on public.docs;
create policy "docs_select_own" on public.docs for select to authenticated using (auth.uid() = user_id);
create policy "docs_insert_own" on public.docs for insert to authenticated with check (auth.uid() = user_id);
create policy "docs_update_own" on public.docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "docs_delete_own" on public.docs for delete to authenticated using (auth.uid() = user_id);

-- 사용자당 저장 한도: 문서 100개, 전체 5MB (남용 방지)
-- 새로 만들 때는 개수와 용량을, 고칠 때는 용량을 검사해요.
create or replace function public.docs_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; total bigint;
begin
  select count(*), coalesce(sum(pg_column_size(data)), 0) into n, total
  from public.docs where user_id = new.user_id and doc_id <> new.doc_id;
  if tg_op = 'INSERT' and n >= 100 then
    raise exception 'doc limit reached';
  end if;
  if total + pg_column_size(new.data) > 5000000 then
    raise exception 'storage limit reached';
  end if;
  return new;
end $$;
drop trigger if exists docs_limit on public.docs;
create trigger docs_limit before insert or update on public.docs for each row execute function public.docs_limit();

-- 2) AI 기능 사용량 (하루 단위). 사용자는 직접 고칠 수 없고, 아래 함수로만 늘어나요.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select to authenticated using (auth.uid() = user_id);

create or replace function public.bump_ai_usage() returns int
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_usage(user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into c;
  return c;
end $$;
revoke all on function public.bump_ai_usage() from public, anon;
grant execute on function public.bump_ai_usage() to authenticated;

-- 3) 계정 삭제: 로그인한 본인 계정만 지워요. 지울 대상은 로그인 세션(auth.uid())에서만 정해져요.
--    docs, ai_usage 는 on delete cascade 라서 함께 지워져요.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

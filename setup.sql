-- Aja tämä Supabasen SQL Editorissa (kerran)
create table public.games (
  id bigint generated always as identity primary key,
  day text not null check (day in ('perjantai', 'lauantai')),
  kartta text not null default '',
  omat_score text not null default '',
  vihu_score text not null default '',
  t_danger boolean not null default false,
  devi boolean not null default false,
  jannejalopeura boolean not null default false,
  laama boolean not null default false,
  batari boolean not null default false,
  turisti boolean not null default false,
  muhinaattori boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.games (day, id);

alter table public.games enable row level security;

-- Kuka tahansa linkin tietävä saa lukea ja muokata (ok viikonlopun lanipeliin)
create policy "anon select" on public.games for select to anon using (true);
create policy "anon insert" on public.games for insert to anon with check (true);
create policy "anon update" on public.games for update to anon using (true) with check (true);
create policy "anon delete" on public.games for delete to anon using (true);

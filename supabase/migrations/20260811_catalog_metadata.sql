-- Run this once in Supabase SQL Editor before using the updated Manage Lists UI.
alter table public.schedules
  add column if not exists term text,
  add column if not exists program text,
  add column if not exists year integer,
  add column if not exists section text,
  add column if not exists lec_hours integer,
  add column if not exists lab_hours integer,
  add column if not exists delivery text;

alter table public.subjects
  add column if not exists course_code text,
  add column if not exists units integer default 3 check (units >= 0);

alter table public.rooms
  add column if not exists building text;

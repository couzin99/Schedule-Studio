-- Backward-compatible metadata support for the Schedule Studio curriculum UI.
-- This migration only adds nullable columns; it does not alter or rewrite data.
alter table public.subjects
  add column if not exists lec_hours integer,
  add column if not exists lab_hours integer,
  add column if not exists delivery text;

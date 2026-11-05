-- Public, read-only Teacher Portal for Sir Shem's schedules.
-- This migration does not change schedules, Scheduler table policies, or
-- direct access to the schedules, teachers, or schedule_periods tables.

create table if not exists public.teacher_portal_settings (
    singleton boolean not null default true,
    owner_id uuid not null references auth.users(id),
    schedule_period_id uuid not null references public.schedule_periods(id),
    updated_at timestamptz not null default now(),
    updated_by uuid not null references auth.users(id),
    constraint teacher_portal_settings_pkey primary key (singleton),
    constraint teacher_portal_settings_singleton_check check (singleton)
);

-- The earlier private-portal table had the same four core columns but no
-- updated_by column. Validate that structure before upgrading it in place.
do $$
declare
    v_table oid := 'public.teacher_portal_settings'::regclass;
    v_count integer;
    v_column record;
    v_ref record;
    v_attnum smallint;
    v_ref_attnum smallint;
begin
    select count(*)
      into v_count
      from pg_catalog.pg_attribute as a
     where a.attrelid = v_table
       and a.attnum > 0
       and not a.attisdropped;

    if v_count not in (4, 5) then
        raise exception 'Incompatible public.teacher_portal_settings: expected four core columns and optional updated_by; found % columns.', v_count;
    end if;

    if v_count = 5 and not exists (
        select 1
          from pg_catalog.pg_attribute as a
         where a.attrelid = v_table
           and a.attname = 'updated_by'
           and not a.attisdropped
    ) then
        raise exception 'Incompatible public.teacher_portal_settings: unexpected columns are present.';
    end if;

    for v_column in
        select expected.name, expected.data_type, expected.required_not_null
          from (values
              ('singleton', 'boolean'::regtype, true),
              ('owner_id', 'uuid'::regtype, true),
              ('schedule_period_id', 'uuid'::regtype, true),
              ('updated_at', 'timestamp with time zone'::regtype, true)
          ) as expected(name, data_type, required_not_null)
    loop
        if not exists (
            select 1
              from pg_catalog.pg_attribute as a
             where a.attrelid = v_table
               and a.attname = v_column.name
               and a.atttypid = v_column.data_type
               and a.attnotnull = v_column.required_not_null
               and not a.attisdropped
        ) then
            raise exception 'Incompatible public.teacher_portal_settings: column % must have type % and NOT NULL.', v_column.name, v_column.data_type;
        end if;
    end loop;

    if not exists (
        select 1
          from pg_catalog.pg_attribute as a
         where a.attrelid = v_table
           and a.attname = 'singleton'
           and pg_catalog.pg_get_expr(
               (select d.adbin
                  from pg_catalog.pg_attrdef as d
                 where d.adrelid = a.attrelid
                   and d.adnum = a.attnum),
               a.attrelid
           ) = 'true'
           and not a.attisdropped
    ) then
        raise exception 'Incompatible public.teacher_portal_settings: singleton must default to true.';
    end if;

    if not exists (
        select 1
          from pg_catalog.pg_attribute as a
         where a.attrelid = v_table
           and a.attname = 'updated_at'
           and pg_catalog.pg_get_expr(
               (select d.adbin
                  from pg_catalog.pg_attrdef as d
                 where d.adrelid = a.attrelid
                   and d.adnum = a.attnum),
               a.attrelid
           ) = 'now()'
           and not a.attisdropped
    ) then
        raise exception 'Incompatible public.teacher_portal_settings: updated_at must default to now().';
    end if;

    select a.attnum
      into v_attnum
      from pg_catalog.pg_attribute as a
     where a.attrelid = v_table
       and a.attname = 'singleton'
       and not a.attisdropped;

    if not exists (
        select 1
          from pg_catalog.pg_constraint as c
         where c.conrelid = v_table
           and c.contype = 'p'
           and c.convalidated
           and c.conkey::smallint[] = array[v_attnum]::smallint[]
    ) then
        raise exception 'Incompatible public.teacher_portal_settings: a validated primary key on singleton is required.';
    end if;

    if not exists (
        select 1
          from pg_catalog.pg_constraint as c
         where c.conrelid = v_table
           and c.contype = 'c'
           and c.convalidated
           and pg_catalog.lower(pg_catalog.regexp_replace(
               pg_catalog.pg_get_expr(c.conbin, c.conrelid),
               '[[:space:]()]',
               '',
               'g'
           )) = 'singleton'
    ) then
        raise exception 'Incompatible public.teacher_portal_settings: a validated CHECK (singleton) constraint is required.';
    end if;

    for v_ref in
        select expected.column_name, expected.referenced_table, expected.referenced_column
          from (values
              ('owner_id', 'auth.users'::regclass, 'id'),
              ('schedule_period_id', 'public.schedule_periods'::regclass, 'id')
          ) as expected(column_name, referenced_table, referenced_column)
    loop
        select a.attnum
          into v_attnum
          from pg_catalog.pg_attribute as a
         where a.attrelid = v_table
           and a.attname = v_ref.column_name
           and not a.attisdropped;

        select a.attnum
          into v_ref_attnum
          from pg_catalog.pg_attribute as a
         where a.attrelid = v_ref.referenced_table
           and a.attname = v_ref.referenced_column
           and not a.attisdropped;

        if not exists (
            select 1
              from pg_catalog.pg_constraint as c
             where c.conrelid = v_table
               and c.contype = 'f'
               and c.convalidated
               and c.confdeltype = 'a'
               and c.confrelid = v_ref.referenced_table
               and c.conkey::smallint[] = array[v_attnum]::smallint[]
               and c.confkey::smallint[] = array[v_ref_attnum]::smallint[]
        ) then
            raise exception 'Incompatible public.teacher_portal_settings: a validated foreign key from % to %.% is required.', v_ref.column_name, v_ref.referenced_table, v_ref.referenced_column;
        end if;
    end loop;

    if exists (
        select 1
          from pg_catalog.pg_attribute as a
         where a.attrelid = v_table
           and a.attname = 'updated_by'
           and not a.attisdropped
    ) then
        if not exists (
            select 1
              from pg_catalog.pg_attribute as a
             where a.attrelid = v_table
               and a.attname = 'updated_by'
               and a.atttypid = 'uuid'::regtype
               and not a.attisdropped
        ) then
            raise exception 'Incompatible public.teacher_portal_settings: updated_by must have type uuid.';
        end if;
    else
        alter table public.teacher_portal_settings add column updated_by uuid;
    end if;

    select a.attnum
      into v_attnum
      from pg_catalog.pg_attribute as a
     where a.attrelid = v_table
       and a.attname = 'updated_by'
       and not a.attisdropped;

    select a.attnum
      into v_ref_attnum
      from pg_catalog.pg_attribute as a
     where a.attrelid = 'auth.users'::regclass
       and a.attname = 'id'
       and not a.attisdropped;

    if exists (
        select 1
          from pg_catalog.pg_constraint as c
         where c.conrelid = v_table
           and c.contype = 'f'
           and c.conkey::smallint[] = array[v_attnum]::smallint[]
           and (
               c.confrelid <> 'auth.users'::regclass
               or c.confkey::smallint[] <> array[v_ref_attnum]::smallint[]
               or not c.convalidated
               or c.confdeltype <> 'a'
           )
    ) then
        raise exception 'Incompatible public.teacher_portal_settings: updated_by has an unexpected foreign-key constraint.';
    end if;

    if not exists (
        select 1
          from pg_catalog.pg_constraint as c
         where c.conrelid = v_table
           and c.contype = 'f'
           and c.convalidated
           and c.confdeltype = 'a'
           and c.confrelid = 'auth.users'::regclass
           and c.conkey::smallint[] = array[v_attnum]::smallint[]
           and c.confkey::smallint[] = array[v_ref_attnum]::smallint[]
    ) then
        alter table public.teacher_portal_settings
            add constraint teacher_portal_settings_updated_by_fkey
            foreign key (updated_by) references auth.users(id);
    end if;
end;
$$;

alter table public.teacher_portal_settings enable row level security;
revoke all on table public.teacher_portal_settings from public, anon, authenticated;

do $$
begin
    if not exists (
        select 1
          from public.teacher_portal_settings as settings
         where settings.singleton = true
    ) then
        if not exists (
            select 1
            from public.schedule_periods as p
            where p.id = 'ba3ed5b3-fc3a-4f84-9540-a6157e1034f2'::uuid
              and p.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
              and regexp_replace(
                  p.school_year,
                  '[[:space:]–—-]+',
                  '',
                  'g'
              ) = '20262027'
              and p.term = '2nd semester'
        ) then
            raise exception 'The configured initial period must belong to Sir Shem and have school year 2026 – 2027 and term 2nd semester.';
        end if;
    end if;

    if not exists (
        select 1
        from auth.users as u
        where u.id = '9e2fcb80-7cac-47c6-b495-d5b6ebf296dc'::uuid
    ) then
        raise exception 'The configured Teacher Portal administrator Auth user does not exist.';
    end if;

    update public.teacher_portal_settings
       set updated_by = '9e2fcb80-7cac-47c6-b495-d5b6ebf296dc'::uuid
     where singleton = true
       and updated_by is null;

    alter table public.teacher_portal_settings
        alter column updated_by set not null;

    if exists (
        select 1
          from public.teacher_portal_settings as settings
         where settings.singleton = true
           and settings.owner_id <> '33858728-c818-4677-b520-529b8ebe703a'::uuid
    ) then
        raise exception 'Existing teacher_portal_settings data belongs to a different owner; it was preserved. Resolve the setting explicitly before retrying.';
    end if;

    if exists (
        select 1
          from public.teacher_portal_settings as settings
          left join public.schedule_periods as p
            on p.id = settings.schedule_period_id
           and p.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
         where settings.singleton = true
           and p.id is null
    ) then
        raise exception 'Existing teacher_portal_settings data references a period that does not belong to Sir Shem; it was preserved.';
    end if;

    if exists (
        select 1
          from public.teacher_portal_settings as settings
          join public.schedule_periods as p
            on p.id = settings.schedule_period_id
           and p.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
         where settings.singleton = true
           and (
               coalesce(
                   regexp_replace(
                       p.school_year,
                       '[[:space:]–—-]+',
                       '',
                       'g'
                   ),
                   ''
               ) !~ '^[0-9]{8}$'
               or p.term is null
               or p.term not in ('1st semester', '2nd semester', 'summer')
           )
    ) then
        raise exception 'Existing teacher_portal_settings data references a period with an invalid school year or term; it was preserved.';
    end if;

    insert into public.teacher_portal_settings (
        singleton,
        owner_id,
        schedule_period_id,
        updated_by,
        updated_at
    )
    values (
        true,
        '33858728-c818-4677-b520-529b8ebe703a'::uuid,
        'ba3ed5b3-fc3a-4f84-9540-a6157e1034f2'::uuid,
        '9e2fcb80-7cac-47c6-b495-d5b6ebf296dc'::uuid,
        now()
    )
    on conflict (singleton) do nothing;
end;
$$;

create or replace function public.get_teacher_portal_teacher_directory()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
    with normalized_teachers as (
        select
            btrim(regexp_replace(coalesce(t.name, ''), '[[:space:]]+', ' ', 'g')) as display_name,
            lower(btrim(regexp_replace(coalesce(t.name, ''), '[[:space:]]+', ' ', 'g'))) as name_key
        from public.teachers as t
        where t.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
          and nullif(btrim(t.name), '') is not null
    ),
    grouped_teachers as (
        select min(display_name) as teacher_name, count(*) as matching_teacher_records
        from normalized_teachers
        group by name_key
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'name', teacher_name,
                'matching_teacher_records', matching_teacher_records
            )
            order by teacher_name
        ),
        '[]'::jsonb
    )
    from grouped_teachers;
$$;

create or replace function public.get_teacher_portal_active_period()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
    select jsonb_build_object(
        'id', p.id,
        'school_year', p.school_year,
        'term', p.term
    )
    from public.teacher_portal_settings as settings
    join public.schedule_periods as p
      on p.id = settings.schedule_period_id
     and p.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
    where settings.singleton = true
      and settings.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid;
$$;

create or replace function public.get_teacher_portal_admin_periods()
returns table (
    id uuid,
    school_year text,
    term text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
    v_admin_id constant uuid := '9e2fcb80-7cac-47c6-b495-d5b6ebf296dc'::uuid;
    v_owner_id constant uuid := '33858728-c818-4677-b520-529b8ebe703a'::uuid;
begin
    if auth.uid() is null or auth.uid() <> v_admin_id then
        raise exception 'Only the designated Teacher Portal administrator can list academic periods.'
            using errcode = '42501';
    end if;

    return query
    select p.id, p.school_year, p.term
      from public.schedule_periods as p
     where p.owner_id = v_owner_id
     order by
         p.school_year desc,
         case lower(btrim(p.term))
             when '1st semester' then 1
             when '2nd semester' then 2
             when 'summer' then 3
             else 4
         end,
         p.term;
end;
$$;

create or replace function public.get_teacher_portal_teacher_schedules(
    p_teacher_name text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'schedule_period_id', s.schedule_period_id,
                'combined_class_id', s.combined_class_id,
                'term', s.term,
                'program', s.program,
                'year', s.year,
                'section', s.section,
                'teacher_name', s.teacher_name,
                'subject', s.subject,
                'course_year', s.course_year,
                'course_code', s.course_code,
                'units', s.units,
                'lec_hours', s.lec_hours,
                'lab_hours', s.lab_hours,
                'delivery', s.delivery,
                'building', s.building,
                'day', s.day,
                'start_time', s.start_time,
                'end_time', s.end_time,
                'room', s.room
            )
            order by s.created_at
        ),
        '[]'::jsonb
    )
    from public.teacher_portal_settings as settings
    join public.schedule_periods as p
      on p.id = settings.schedule_period_id
     and p.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
    join public.schedules as s
      on s.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
     and s.schedule_period_id = p.id
    where settings.singleton = true
      and settings.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
      and nullif(btrim(p_teacher_name), '') is not null
      and lower(btrim(regexp_replace(coalesce(s.teacher_name, ''), '[[:space:]]+', ' ', 'g')))
          = lower(btrim(regexp_replace(p_teacher_name, '[[:space:]]+', ' ', 'g')));
$$;

create or replace function public.set_teacher_portal_active_period(
    p_schedule_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
    v_admin_id constant uuid := '9e2fcb80-7cac-47c6-b495-d5b6ebf296dc'::uuid;
    v_owner_id constant uuid := '33858728-c818-4677-b520-529b8ebe703a'::uuid;
    v_period_id uuid;
    v_period_owner_id uuid;
    v_school_year text;
    v_term text;
begin
    if auth.uid() is null or auth.uid() <> v_admin_id then
        raise exception 'Only the designated Teacher Portal administrator can change the active period.'
            using errcode = '42501';
    end if;

    select p.id, p.owner_id, p.school_year, p.term
      into v_period_id, v_period_owner_id, v_school_year, v_term
      from public.schedule_periods as p
     where p.id = p_schedule_period_id
       and p.owner_id = v_owner_id;

    if not found then
        raise exception 'The selected academic period does not belong to Sir Shem.'
            using errcode = '22023';
    end if;

    insert into public.teacher_portal_settings (
        singleton,
        owner_id,
        schedule_period_id,
        updated_by,
        updated_at
    )
    values (true, v_owner_id, v_period_id, v_admin_id, now())
    on conflict (singleton) do update
        set owner_id = excluded.owner_id,
            schedule_period_id = excluded.schedule_period_id,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;

    return jsonb_build_object(
        'id', v_period_id,
        'school_year', v_school_year,
        'term', v_term
    );
end;
$$;

-- The previous authenticated dashboard function is no longer appropriate:
-- it relied on editable user metadata and is replaced by public, scoped RPCs.
do $$
begin
    if pg_catalog.to_regprocedure('public.get_teacher_portal_dashboard()') is not null then
        execute 'revoke all on function public.get_teacher_portal_dashboard() from public, anon, authenticated';
    end if;
end;
$$;

revoke all on function public.get_teacher_portal_teacher_directory()
    from public, anon, authenticated;
revoke all on function public.get_teacher_portal_active_period()
    from public, anon, authenticated;
revoke all on function public.get_teacher_portal_admin_periods()
    from public, anon, authenticated;
revoke all on function public.get_teacher_portal_teacher_schedules(text)
    from public, anon, authenticated;
revoke all on function public.set_teacher_portal_active_period(uuid)
    from public, anon, authenticated;

grant execute on function public.get_teacher_portal_teacher_directory()
    to anon, authenticated;
grant execute on function public.get_teacher_portal_active_period()
    to anon, authenticated;
grant execute on function public.get_teacher_portal_admin_periods()
    to authenticated;
grant execute on function public.get_teacher_portal_teacher_schedules(text)
    to anon, authenticated;
grant execute on function public.set_teacher_portal_active_period(uuid)
    to authenticated;

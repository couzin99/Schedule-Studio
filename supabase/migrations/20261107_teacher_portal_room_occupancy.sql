-- Read-only public room occupancy for the centrally configured Teacher Portal period.
-- Returns room catalog records and only the interval fields needed to show occupancy.
create or replace function public.get_teacher_portal_room_occupancy()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
    with active_period as (
        select p.id
          from public.teacher_portal_settings as settings
          join public.schedule_periods as p
            on p.id = settings.schedule_period_id
           and p.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
         where settings.singleton = true
           and settings.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
    )
    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'room_id', r.id,
                'room_name', r.name,
                'building', r.building,
                'occupied_intervals', coalesce(room_intervals.intervals, '[]'::jsonb)
            )
            order by r.building nulls last, r.name, r.id
        ),
        '[]'::jsonb
    )
    from public.rooms as r
    left join lateral (
        select jsonb_agg(
                   jsonb_build_object(
                       'day', occupancy.day,
                       'start_time', occupancy.start_time,
                       'end_time', occupancy.end_time
                   )
                   order by occupancy.day, occupancy.start_time, occupancy.end_time
               ) as intervals
          from (
              select distinct s.day, s.start_time, s.end_time
                from public.schedules as s
                join active_period as period
                  on s.schedule_period_id = period.id
               where s.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
                 and nullif(btrim(s.room), '') is not null
                 and lower(btrim(s.room)) = lower(btrim(r.name))
                 and s.day is not null
                 and s.start_time is not null
                 and s.end_time is not null
          ) as occupancy
    ) as room_intervals on true
    where r.owner_id = '33858728-c818-4677-b520-529b8ebe703a'::uuid
      and exists (select 1 from active_period);
$$;

revoke all on function public.get_teacher_portal_room_occupancy()
    from public, anon, authenticated;
grant execute on function public.get_teacher_portal_room_occupancy()
    to anon, authenticated;

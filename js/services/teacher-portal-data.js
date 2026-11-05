(function (global) {
    async function fetchTeacherDirectory(supabaseClient) {
        return await supabaseClient.rpc('get_teacher_portal_teacher_directory');
    }

    async function fetchActivePeriod(supabaseClient) {
        return await supabaseClient.rpc('get_teacher_portal_active_period');
    }

    async function fetchAdminPeriods(supabaseClient) {
        return await supabaseClient.rpc('get_teacher_portal_admin_periods');
    }

    async function fetchTeacherSchedules(supabaseClient, teacherName) {
        return await supabaseClient.rpc('get_teacher_portal_teacher_schedules', {
            p_teacher_name: teacherName
        });
    }

    async function setActivePeriod(supabaseClient, schedulePeriodId) {
        return await supabaseClient.rpc('set_teacher_portal_active_period', {
            p_schedule_period_id: schedulePeriodId
        });
    }

    global.TeacherPortalDataService = Object.freeze({
        fetchTeacherDirectory,
        fetchActivePeriod,
        fetchAdminPeriods,
        fetchTeacherSchedules,
        setActivePeriod
    });
})(globalThis);

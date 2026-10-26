(function (global) {
    async function fetchPeriods(supabaseClient, ownerId) {
        return await supabaseClient
            .from('schedule_periods')
            .select('id,owner_id,school_year,term,created_at')
            .eq('owner_id', ownerId)
            .order('school_year', { ascending: false })
            .order('term', { ascending: true });
    }

    async function createPeriod(supabaseClient, { ownerId, schoolYear, term }) {
        return await supabaseClient
            .from('schedule_periods')
            .insert({
                owner_id: ownerId,
                school_year: schoolYear,
                term
            })
            .select('id,owner_id,school_year,term,created_at')
            .single();
    }

    global.SchedulePeriodDataService = Object.freeze({
        fetchPeriods,
        createPeriod
    });
})(globalThis);

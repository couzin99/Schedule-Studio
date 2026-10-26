(function (global) {
    async function selectCatalogRows(supabaseClient, table, ownerId = null) {
        const columns = {
            teachers: ['id,owner_id,name'],
            subjects: ['id,owner_id,name,course_code,units,lec_hours,lab_hours,delivery', 'id,owner_id,name,course_code,units', 'id,owner_id,name'],
            rooms: ['id,owner_id,name,building', 'id,owner_id,name'],
            courses: ['id,owner_id,name']
        }[table] || ['id,owner_id,name'];

        let lastResult = { data: [], error: null };
        for (const selectedColumns of columns) {
            let query = supabaseClient.from(table).select(selectedColumns);
            if (ownerId) query = query.eq('owner_id', ownerId);
            const result = await query.order('name', { ascending: true });
            if (!result.error) return result;
            lastResult = result;
        }
        return lastResult;
    }

    global.CatalogDataService = Object.freeze({
        selectCatalogRows
    });
})(globalThis);

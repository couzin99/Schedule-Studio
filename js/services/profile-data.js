(function (global) {
    async function fetchProfiles(supabaseClient) {
        return await supabaseClient
            .from('profiles')
            .select('id,email,full_name,department,role,created_at')
            .order('created_at', { ascending: true });
    }

    global.ProfileDataService = Object.freeze({
        fetchProfiles
    });
})(globalThis);

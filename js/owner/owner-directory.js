(function (global) {
    function renderOwnerDirectory({ profiles, schedules, escapeHtml }) {
        if (typeof escapeHtml !== 'function') {
            throw new TypeError('Owner directory requires an HTML escaping function.');
        }

        const userProfiles = (Array.isArray(profiles) ? profiles : [])
            .filter(profile =>
                !['owner', 'school_admin'].includes(
                    String(profile.role || '').toLowerCase()
                )
            );
        const userSchedules = Array.isArray(schedules) ? schedules : [];
        const html = userProfiles.length
            ? userProfiles.map(profile => {
                const rows = userSchedules.filter(
                    schedule => schedule.ownerId === profile.id
                ).length;
                const name = escapeHtml(
                    profile.full_name || profile.email || 'Unnamed user'
                );
                const email = escapeHtml(profile.email || '');
                const initial = escapeHtml(
                    (profile.full_name || profile.email || '?')
                        .slice(0, 1)
                        .toUpperCase()
                );
                const id = escapeHtml(profile.id);

                return `<button type="button" class="owner-user-card" data-owner-user-id="${id}"><span class="owner-avatar">${initial}</span><span class="owner-user-info"><strong>${name}</strong><small>${email}</small></span><span class="owner-user-classes">${rows} scheduled class${rows === 1 ? '' : 'es'} <span>›</span></span></button>`;
            }).join('')
            : '<p class="empty-message">No regular user accounts found.</p>';

        return {
            accountCount: userProfiles.length,
            countText: `${userProfiles.length} account${userProfiles.length === 1 ? '' : 's'}`,
            html
        };
    }

    global.ScheduleStudioOwnerDirectory = Object.freeze({
        renderOwnerDirectory
    });
})(globalThis);

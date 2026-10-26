(function (global) {
    function getOwnerDashboardPresentation({ registeredUserCount }) {
        return {
            scheduleCount: registeredUserCount,
            scheduleLabel: 'Registered users',
            scheduleNote: '',
            hideStatCardsAfterIndex: 0
        };
    }

    global.ScheduleStudioOwnerDashboard = Object.freeze({
        getOwnerDashboardPresentation
    });
})(globalThis);

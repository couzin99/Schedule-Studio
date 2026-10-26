(function (global) {
    function setWorkspaceModes({ ownerMode, ownerUserMode }) {
        const shell = document.getElementById('appShell');
        if (!shell) return;

        shell.classList.toggle('owner-mode', ownerMode);
        shell.classList.toggle('owner-user-mode', ownerUserMode);
    }

    function setBackButtonVisible(visible) {
        document
            .getElementById('ownerBackToUsers')
            ?.classList.toggle('hidden', !visible);
    }

    function showOwnerDirectory({ resetViews = false } = {}) {
        setWorkspaceModes({ ownerMode: true, ownerUserMode: false });
        setBackButtonVisible(false);

        if (!resetViews) return;

        document.querySelectorAll('.view-content').forEach(view =>
            view.classList.remove('active')
        );
        document.getElementById('ownerView')?.classList.add('active');
    }

    function showSelectedUserWorkspace({ showBackButton } = {}) {
        setWorkspaceModes({ ownerMode: false, ownerUserMode: true });
        if (typeof showBackButton === 'boolean') {
            setBackButtonVisible(showBackButton);
        }
        document.getElementById('ownerView')?.classList.remove('active');
        document.querySelectorAll('.view-content').forEach(view =>
            view.classList.remove('active')
        );
        document.getElementById('teacherView')?.classList.add('active');
        document.querySelectorAll('.toggle-btn').forEach(button =>
            button.classList.remove('active')
        );
        document
            .querySelector('.toggle-btn[data-view="teacher"]')
            ?.classList.add('active');
    }

    function showInitialOwnerView({ isViewingUser }) {
        document.querySelectorAll('.toggle-btn').forEach(button =>
            button.classList.remove('active')
        );
        document.querySelectorAll('.view-content').forEach(view =>
            view.classList.remove('active')
        );
        document
            .getElementById(isViewingUser ? 'teacherView' : 'ownerView')
            ?.classList.add('active');
    }

    function clearOwnerMode() {
        setWorkspaceModes({ ownerMode: false, ownerUserMode: false });
        setBackButtonVisible(false);
    }

    global.ScheduleStudioOwnerNavigation = Object.freeze({
        clearOwnerMode,
        setBackButtonVisible,
        setWorkspaceModes,
        showInitialOwnerView,
        showOwnerDirectory,
        showSelectedUserWorkspace
    });
})(globalThis);

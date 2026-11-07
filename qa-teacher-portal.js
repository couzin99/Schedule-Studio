/*
 * Focused checks for the public Teacher Portal and Scheduler period handling.
 * Run with: node qa-teacher-portal.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');

const elements = new Map();
function element(initial = {}) {
    const classes = new Set();
    const result = {
        value: '',
        textContent: '',
        className: '',
        disabled: false,
        hidden: false,
        children: [],
        dataset: {},
        style: {
            setProperty() {},
            removeProperty() {}
        },
        classList: {
            add(...names) {
                names.forEach(name => classes.add(name));
            },
            remove(...names) {
                names.forEach(name => classes.delete(name));
            },
            toggle(name, force) {
                const shouldAdd = force === undefined ? !classes.has(name) : force;
                if (shouldAdd) classes.add(name);
                else classes.delete(name);
                return shouldAdd;
            },
            contains(name) {
                return classes.has(name);
            }
        },
        setAttribute() {},
        replaceChildren(...children) {
            this.children = children;
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        ...initial
    };
    return result;
}

global.window = {
    location: {
        origin: 'https://schedule-studio.example',
        pathname: '/',
        hash: '',
        search: ''
    },
    SUPABASE_CONFIG: { url: 'https://project.example', anonKey: 'test-anon-key' },
    ScheduleStudioOwnerNavigation: {
        setBackButtonVisible() {}
    }
};
const localValues = new Map();
const sessionValues = new Map();
global.localStorage = {
    getItem(key) { return localValues.get(key) ?? null; },
    setItem(key, value) { localValues.set(key, String(value)); },
    removeItem(key) { localValues.delete(key); }
};
global.sessionStorage = {
    getItem(key) { return sessionValues.get(key) ?? null; },
    setItem(key, value) { sessionValues.set(key, String(value)); },
    removeItem(key) { sessionValues.delete(key); }
};
global.document = {
    addEventListener() {},
    createElement(tag) {
        return element({ tag });
    },
    getElementById(id) {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
    },
    querySelector(selector) {
        if (selector === '.main-content') return this.getElementById('main-content');
        return null;
    },
    querySelectorAll() {
        return [];
    }
};

eval(`${fs.readFileSync('script.js', 'utf8')}; globalThis.TeacherPortalQaManager = ScheduleManager;`);
eval(fs.readFileSync('js/services/teacher-portal-data.js', 'utf8'));

const ADMIN_ID = '9e2fcb80-7cac-47c6-b495-d5b6ebf296dc';
const PERIOD_ONE = {
    id: 'period-one',
    school_year: '2026-2027',
    term: '1st semester'
};
const PERIOD_TWO = {
    id: 'period-two',
    school_year: '2026-2027',
    term: '2nd semester'
};
const assignment = (id, teacherName = 'Jane Doe') => ({
    id,
    owner_id: 'schedule-owner',
    schedule_period_id: PERIOD_TWO.id,
    term: '2nd semester',
    teacher_name: teacherName,
    subject: 'MATHEMATICS',
    course_year: 'BSEE - 1A',
    day: 'Monday',
    start_time: '08:00:00',
    end_time: '09:00:00',
    room: 'R101'
});

function createManager({ user = null, isPublic = true } = {}) {
    const manager = Object.create(global.TeacherPortalQaManager.prototype);
    Object.assign(manager, {
        teacherPortalAdminUserId: ADMIN_ID,
        currentUser: user,
        isPublicTeacherPortal: isPublic,
        activeAuthPortal: isPublic ? 'teacher' : null,
        remoteEnabled: true,
        supabase: {},
        teacherPortalRequestId: 0,
        teacherPortalScheduleRequestId: 0,
        teacherPortalAdminPeriodRequestId: 0,
        teacherPortalAdminPeriodChangeRequestId: 0,
        teacherPortalAdminPeriods: [],
        teacherPortalAdminPeriodsLoading: false,
        teacherPortalAdminPeriodChanging: false,
        teacherPortalAdminPeriodError: '',
        teacherPortalActivePeriod: null,
        teacherPortalPeriodLoadError: null,
        teacherPortalSchedules: [],
        teacherPortalScheduleLoading: false,
        teacherPortalScheduleError: '',
        teacherPortalView: 'home',
        teacherPortalRoomOccupancy: [],
        teacherPortalRoomOccupancyRequestId: 0,
        teacherPortalRoomOccupancyLoading: false,
        teacherPortalRoomOccupancyError: '',
        teacherPortalRoomDay: 'Monday',
        teacherPortalRoomBuildingFilter: '',
        teacherPortalRoomFilter: '',
        teacherPortalDirectory: [],
        selectedTeacherProfile: null,
        teacherProfileTab: 'load',
        teacherProfileSearch: '',
        teacherProfilePage: 1,
        teacherPortalReturnSchedulerState: null,
        teacherPortalReturnToWorkspace: false,
        teacherPortalReturnViewType: 'teacher',
        currentUserProfile: null,
        activeSchedulePeriod: null,
        term: '',
        schedules: [],
        showNotification() {},
        showWorkspaceScreen() {},
        showScheduleStudio() {},
        switchView() {},
        syncFromRemote() {},
        loadUserLocalData() {},
        render() {}
    });
    return manager;
}

async function run() {
    assert.equal(global.TeacherPortalQaManager.prototype.enterTeacherPortal, undefined);
    assert.equal(global.TeacherPortalQaManager.prototype.handleTeacherPortalAuthSubmit, undefined);
    assert.equal(global.TeacherPortalQaManager.prototype.toggleTeacherPortalAuthMode, undefined);
    assert.equal(managerName(' \tJane   Doe\r\n'), 'Jane Doe');

    const occupancyRpcCalls = [];
    await global.TeacherPortalDataService.fetchRoomOccupancy({
        rpc(...args) {
            occupancyRpcCalls.push(args);
            return Promise.resolve({ data: [], error: null });
        }
    });
    assert.deepEqual(
        occupancyRpcCalls,
        [['get_teacher_portal_room_occupancy']],
        'room occupancy must call the exact no-argument RPC'
    );

    const directory = [
        { name: 'Jane Doe', matching_teacher_records: 2 },
        { name: 'Jane Smith', matching_teacher_records: 1 },
        { name: 'John Doe', matching_teacher_records: 1 }
    ];
    const calls = [];
    let occupancyReads = 0;
    const roomOccupancy = [
        {
            room_id: 'room-one',
            room_name: 'R101',
            building: 'BUILDING A',
            occupied_intervals: [
                { day: 'Monday', start_time: '08:00:00', end_time: '09:00:00' },
                { day: 'Monday', start_time: '09:00:00', end_time: '09:30:00' },
                { day: 'Monday', start_time: '22:00:00', end_time: '23:00:00' },
                { day: 'Tuesday', start_time: '10:00:00', end_time: '11:00:00' }
            ]
        },
        {
            room_id: 'room-two',
            room_name: 'R102',
            building: 'BUILDING B',
            occupied_intervals: []
        }
    ];
    global.TeacherPortalDataService = {
        async fetchTeacherDirectory() {
            calls.push('directory');
            return { data: directory, error: null };
        },
        async fetchActivePeriod() {
            calls.push('active-period');
            return { data: PERIOD_ONE, error: null };
        },
        async fetchAdminPeriods() {
            calls.push('admin-periods');
            return { data: [PERIOD_ONE, PERIOD_TWO], error: null };
        },
        async fetchTeacherSchedules(_client, teacherName) {
            calls.push(`schedules:${teacherName}`);
            return { data: [assignment('assignment-one', teacherName)], error: null };
        },
        async fetchRoomOccupancy() {
            occupancyReads++;
            return { data: roomOccupancy, error: null };
        },
        async setActivePeriod(_client, periodId) {
            calls.push(`set-period:${periodId}`);
            return { error: null };
        }
    };

    const visitor = createManager({ user: null });
    const markup = fs.readFileSync('index.html', 'utf8');
    const landingMarkup = markup.match(/<main id="applicationLanding"[\s\S]*?<\/main>/)?.[0] || '';
    const loginMarkup = markup.match(/<main id="authScreen"[\s\S]*?<\/main>/)?.[0] || '';
    assert.match(landingMarkup, /id="openSchedulerLogin"[\s\S]*?>Scheduler/);
    assert.match(landingMarkup, /id="openTeacherPortalLogin"[\s\S]*?>Teacher Portal/);
    assert.doesNotMatch(landingMarkup, /class="[^"]*\bhidden\b/);
    assert.doesNotMatch(loginMarkup, /Public Teacher Portal/);
    const workspaceMarkup = markup.match(/<div id="workspaceScreen"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] || '';
    assert.match(workspaceMarkup, /id="openPublicTeacherPortalWorkspace"[\s\S]*?class="[^"]*\bhidden\b/);
    const publicViewMarkup = markup.match(/<div id="teacherProfileView"[\s\S]*?<\/div>\s*<!-- Student Schedule View -->/)?.[0] || '';
    assert.match(publicViewMarkup, /class="teacher-portal-app-header"/);
    assert.match(publicViewMarkup, /SCHEDULE STUDIO/);
    assert.match(publicViewMarkup, /Teacher Portal/);
    assert.match(publicViewMarkup, /id="teacherPortalHome"/);
    assert.match(publicViewMarkup, /id="teacherPortalTeacherSearchChoice"[^>]*>[\s\S]*?Teacher Search/);
    assert.match(publicViewMarkup, /id="teacherPortalRoomAssignmentChoice"[^>]*>[\s\S]*?Room Assignment/);
    assert.match(publicViewMarkup, /id="teacherPortalRoomAssignment"/);
    assert.match(publicViewMarkup, /id="teacherPortalBackToLanding"[^>]*>\s*← Back\s*</);
    assert.match(publicViewMarkup, /id="teacherProfileBack"[^>]*>← Back to Teacher Search</);
    const sidebarMarkup = markup.match(/<nav class="view-toggle main-navigation"[\s\S]*?<\/nav>/)?.[0] || '';
    assert.match(sidebarMarkup, /id="teacherProfileNavigation" class="toggle-btn hidden" data-view="teacher-profile">TEACHER VIEW<\/button>/);
    assert.match(sidebarMarkup, /data-view="rooms">ROOM ASSIGNMENT<\/button>/);
    assert.match(markup, /id="openPublicTeacherPortalApp"[\s\S]*?class="[^"]*\bhidden\b/);
    visitor.updateTeacherPortalNavigation();
    for (const id of [
        'openPublicTeacherPortalWorkspace',
        'openPublicTeacherPortalApp',
        'teacherProfileNavigation'
    ]) {
        assert.equal(
            elements.get(id).classList.contains('hidden'),
            true,
            `logged-out visitors should not see the authenticated-only ${id} entry`
        );
    }
    assert.equal(visitor.isTeacherPortalAdministrator(), false);

    const normalUserNavigation = createManager({
        user: { id: 'normal-user' },
        isPublic: false
    });
    normalUserNavigation.updateTeacherPortalNavigation();
    for (const id of [
        'openPublicTeacherPortalWorkspace',
        'openPublicTeacherPortalApp',
        'teacherProfileNavigation'
    ]) {
        assert.equal(
            elements.get(id).classList.contains('hidden'),
            true,
            `regular users should not see ${id}`
        );
    }

    normalUserNavigation.isOwner = true;
    normalUserNavigation.ownerViewingUserId = 'another-owner';
    normalUserNavigation.updateTeacherPortalNavigation();
    assert.equal(
        elements.get('openPublicTeacherPortalApp').classList.contains('hidden'),
        true,
        'owner-viewing mode must not expose the public portal entry to regular users'
    );
    assert.equal(
        elements.get('teacherProfileNavigation').classList.contains('hidden'),
        true,
        'owner-viewing mode must not expose Teacher View to regular users'
    );
    normalUserNavigation.switchView({
        target: { dataset: { view: 'teacher-profile' }, classList: element().classList }
    });
    assert.equal(
        document.getElementById('teacherProfileView').classList.contains('active'),
        false,
        'regular users must not be able to activate Teacher View through the navigation handler'
    );

    const adminNavigation = createManager({
        user: { id: ADMIN_ID },
        isPublic: false
    });
    adminNavigation.updateTeacherPortalNavigation();
    assert.equal(
        elements.get('openPublicTeacherPortalApp').classList.contains('hidden'),
        false,
        'administrators should see the public portal entry in the Scheduler sidebar'
    );
    assert.equal(
        elements.get('teacherProfileNavigation').classList.contains('hidden'),
        true,
        'the portal entry must not add a duplicate item to the Scheduler navigation'
    );
    assert.equal(
        elements.get('openPublicTeacherPortalWorkspace').classList.contains('hidden'),
        true,
        'administrators should not see the public portal entry on period selection'
    );

    const startupLanding = element();
    const startupWorkspace = element({ classList: element().classList });
    startupWorkspace.classList.add('hidden');
    elements.set('applicationLanding', startupLanding);
    elements.set('workspaceScreen', startupWorkspace);
    elements.set('authScreen', element());
    elements.get('authScreen').classList.add('hidden');
    const startupManager = createManager({ isPublic: false });
    startupManager.currentUser = null;
    startupManager.remoteEnabled = true;
    startupManager.supabase = {
        auth: {
            onAuthStateChange(callback) {
                this.callback = callback;
            },
            async getSession() {
                return {
                    data: {
                        session: {
                            user: { id: ADMIN_ID, email: 'admin@example.com' }
                        }
                    },
                    error: null
                };
            }
        }
    };
    startupManager.initializeAuth();
    await Promise.resolve();
    await Promise.resolve();
    startupManager.supabase.auth.callback('INITIAL_SESSION', {
        user: { id: ADMIN_ID, email: 'admin@example.com' }
    });
    assert.equal(startupManager.currentUser.id, ADMIN_ID);
    assert.equal(
        elements.get('openPublicTeacherPortalWorkspace').classList.contains('hidden'),
        true,
        'period selection should not expose the public portal entry after session restoration'
    );
    assert.equal(startupLanding.classList.contains('hidden'), false);
    assert.equal(startupWorkspace.classList.contains('hidden'), true);

    let restoredSession;
    startupManager.activeAuthPortal = 'scheduler';
    startupManager.applySession = session => {
        restoredSession = session;
    };
    startupManager.supabase.auth.callback('INITIAL_SESSION', {
        user: { id: ADMIN_ID, email: 'admin@example.com' }
    });
    assert.equal(restoredSession.user.id, ADMIN_ID);

    const signedOutManager = createManager({
        user: { id: ADMIN_ID },
        isPublic: false
    });
    signedOutManager.activeAuthPortal = 'scheduler';
    signedOutManager.syncRequestId = 0;
    signedOutManager.ownerRequestId = 0;
    signedOutManager.periodRequestId = 0;
    signedOutManager.showWorkspaceScreen = show => {
        elements.get('workspaceScreen').classList.toggle('hidden', !show);
    };
    for (const id of ['applicationLanding', 'authScreen', 'appShell', 'userIdentity', 'signOutBtn']) {
        elements.set(id, element());
        elements.get(id).classList.add('hidden');
    }
    signedOutManager.supabase = {
        auth: {
            onAuthStateChange(callback) {
                this.callback = callback;
            },
            async getSession() {
                return { data: { session: null }, error: null };
            }
        }
    };
    signedOutManager.initializeAuth();
    signedOutManager.supabase.auth.callback('SIGNED_OUT', null);
    assert.equal(signedOutManager.activeAuthPortal, null);
    assert.equal(elements.get('applicationLanding').classList.contains('hidden'), false);
    assert.equal(elements.get('authScreen').classList.contains('hidden'), true);

    signedOutManager.activeAuthPortal = 'scheduler';
    signedOutManager.applySession(null);
    assert.equal(elements.get('authScreen').classList.contains('hidden'), false);
    assert.equal(elements.get('applicationLanding').classList.contains('hidden'), true);

    await visitor.enterPublicTeacherPortal();
    assert.equal(visitor.currentUser, null, 'the public portal must work without a session');
    assert.equal(visitor.teacherPortalView, 'home');
    assert.equal(elements.get('teacherPortalHome').classList.contains('hidden'), false);
    assert.equal(elements.get('teacherProfileDirectory').classList.contains('hidden'), true);
    assert.equal(elements.get('teacherPortalRoomAssignment').classList.contains('hidden'), true);
    assert.deepEqual(calls.slice(0, 2), ['directory', 'active-period']);
    assert.deepEqual(visitor.teacherPortalDirectory.map(teacher => teacher.name), [
        'Jane Doe',
        'Jane Smith',
        'John Doe'
    ]);
    assert.equal(visitor.teacherPortalActivePeriod.id, PERIOD_ONE.id);
    visitor.openTeacherPortalSearch();
    assert.equal(visitor.teacherPortalView, 'teacher-search');
    assert.equal(elements.get('teacherProfileDirectory').classList.contains('hidden'), false);
    assert.equal(elements.get('teacherPortalHome').classList.contains('hidden'), true);

    visitor.returnToTeacherPortalChoices();
    assert.equal(visitor.teacherPortalView, 'home');
    await visitor.openTeacherPortalRoomAssignment();
    assert.equal(visitor.selectedTeacherProfile, null, 'Room Assignment must not require a selected teacher');
    assert.deepEqual(visitor.teacherPortalSchedules, [], 'room occupancy must not use selected-teacher schedules');
    assert.equal(occupancyReads, 1);
    assert.equal(
        calls.filter(call => call.startsWith('schedules:')).length,
        0,
        'Room Assignment must not call the teacher-schedule RPC'
    );
    assert.equal(elements.get('teacherPortalRoomAssignment').classList.contains('hidden'), false);
    assert.match(elements.get('teacherPortalRoomPeriod').textContent, /2026-2027/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R101/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /BUILDING A/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R102/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /BUILDING B/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /Vacant/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /8:00 AM – 9:00 AM/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /9:00 AM – 9:30 AM/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /10:00 PM – 11:00 PM/);
    assert.equal(
        (elements.get('teacherPortalRoomOccupancyList').innerHTML.match(/class="teacher-portal-room-interval is-occupied"/g) || []).length,
        3,
        'adjacent occupied intervals must remain separate'
    );
    assert.match(elements.get('teacherPortalRoomBuildingFilter').innerHTML, /All Buildings/);
    assert.match(elements.get('teacherPortalRoomBuildingFilter').innerHTML, /BUILDING A/);
    assert.match(elements.get('teacherPortalRoomBuildingFilter').innerHTML, /BUILDING B/);
    assert.match(elements.get('teacherPortalRoomFilter').innerHTML, /All Rooms/);
    assert.match(elements.get('teacherPortalRoomFilter').innerHTML, /R101/);
    assert.match(elements.get('teacherPortalRoomFilter').innerHTML, /R102/);
    visitor.setTeacherPortalRoomBuilding('BUILDING A');
    assert.equal(visitor.teacherPortalRoomFilter, '', 'changing building must reset the room filter');
    assert.match(elements.get('teacherPortalRoomFilter').innerHTML, /R101/);
    assert.doesNotMatch(elements.get('teacherPortalRoomFilter').innerHTML, /R102/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R101/);
    assert.doesNotMatch(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R102/);
    visitor.setTeacherPortalRoomFilter(visitor.getTeacherPortalRoomOptions()[0].key);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R101/);
    assert.doesNotMatch(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R102/);
    visitor.setTeacherPortalRoomBuilding('BUILDING B');
    assert.equal(visitor.teacherPortalRoomFilter, '', 'changing building must return to all rooms in that building');
    assert.doesNotMatch(elements.get('teacherPortalRoomFilter').innerHTML, /R101/);
    assert.match(elements.get('teacherPortalRoomFilter').innerHTML, /R102/);
    assert.doesNotMatch(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R101/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R102/);
    visitor.setTeacherPortalRoomBuilding('');
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R101/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /R102/);
    visitor.setTeacherPortalRoomDay('Tuesday');
    assert.equal(elements.get('teacherPortalRoomDay').value, 'Tuesday');
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /10:00 AM – 11:00 AM/);
    assert.doesNotMatch(elements.get('teacherPortalRoomOccupancyList').innerHTML, /8:00 AM – 9:00 AM/);
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /Vacant<\/strong>\s*<span>7:00 AM – 10:00 AM/);
    visitor.returnToTeacherPortalChoices();
    assert.equal(elements.get('teacherPortalRoomAssignment').classList.contains('hidden'), true);

    const emptyRooms = createManager();
    emptyRooms.isPublicTeacherPortal = true;
    global.TeacherPortalDataService.fetchRoomOccupancy = async () => ({
        data: [],
        error: null
    });
    await emptyRooms.openTeacherPortalRoomAssignment();
    assert.match(elements.get('teacherPortalRoomOccupancyList').innerHTML, /No rooms are available/);

    const failedRooms = createManager();
    failedRooms.isPublicTeacherPortal = true;
    global.TeacherPortalDataService.fetchRoomOccupancy = async () => ({
        data: null,
        error: new Error('Room service unavailable')
    });
    await failedRooms.openTeacherPortalRoomAssignment();
    assert.equal(failedRooms.teacherPortalRoomOccupancyLoading, false);
    assert.match(elements.get('teacherPortalRoomMessage').textContent, /Room service unavailable/);
    assert.match(elements.get('teacherPortalRoomMessage').className, /error/);

    let resolveStaleRoomRequest;
    const staleRooms = createManager();
    staleRooms.isPublicTeacherPortal = true;
    global.TeacherPortalDataService.fetchRoomOccupancy = () =>
        new Promise(resolve => { resolveStaleRoomRequest = resolve; });
    const staleRoomRequest = staleRooms.openTeacherPortalRoomAssignment();
    assert.equal(staleRooms.teacherPortalRoomOccupancyLoading, true);
    assert.match(elements.get('teacherPortalRoomMessage').textContent, /Loading room occupancy/);
    staleRooms.returnToTeacherPortalChoices();
    resolveStaleRoomRequest({ data: roomOccupancy, error: null });
    await staleRoomRequest;
    assert.equal(staleRooms.teacherPortalView, 'home');
    assert.deepEqual(staleRooms.teacherPortalRoomOccupancy, []);

    global.TeacherPortalDataService.fetchRoomOccupancy = async () => ({
        data: roomOccupancy,
        error: null
    });
    visitor.openTeacherPortalSearch();
    visitor.teacherProfileSearch = '  jAnE   ';
    visitor.renderTeacherProfileResults();
    assert.match(elements.get('teacherProfileResults').innerHTML, /Jane Doe/);
    assert.match(elements.get('teacherProfileResults').innerHTML, /Jane Smith/);
    assert.equal(
        (elements.get('teacherProfileResults').innerHTML.match(/class="teacher-profile-result"/g) || []).length,
        2
    );
    visitor.teacherProfileSearch = ' dOe ';
    visitor.renderTeacherProfileResults();
    assert.match(elements.get('teacherProfileResults').innerHTML, /Jane Doe/);
    assert.match(elements.get('teacherProfileResults').innerHTML, /John Doe/);
    visitor.teacherProfileSearch = '  jAnE   dOe ';
    visitor.renderTeacherProfileResults();
    assert.match(elements.get('teacherProfileResults').innerHTML, /Jane Doe/);
    assert.doesNotMatch(elements.get('teacherProfileResults').innerHTML, /Jane Smith/);
    assert.match(elements.get('teacherProfileResults').innerHTML, /2 records share this name/);

    const savedDirectory = visitor.teacherPortalDirectory;
    visitor.teacherPortalDirectory = Array.from({ length: 48 }, (_, index) => {
        const name = `Teacher ${String(index + 1).padStart(2, '0')}`;
        return { key: name.toLowerCase(), name, matching_teacher_records: 1 };
    });
    visitor.teacherProfileSearch = '';
    visitor.teacherProfilePage = 1;
    elements.set('teacherProfilePagination', element());
    visitor.renderTeacherProfileResults();
    assert.equal(
        (elements.get('teacherProfileResults').innerHTML.match(/class="teacher-profile-result"/g) || []).length,
        5,
        'the directory should display exactly five teachers per page'
    );
    assert.match(elements.get('teacherProfilePagination').innerHTML, /Showing 1–5 of 48 teachers/);
    assert.match(elements.get('teacherProfilePagination').innerHTML, /data-teacher-profile-page="previous" disabled/);
    assert.match(elements.get('teacherProfilePagination').innerHTML, /class="teacher-profile-page-number active" data-teacher-profile-page="1" aria-current="page"/);
    assert.match(elements.get('teacherProfilePagination').innerHTML, /…/);

    visitor.navigateTeacherProfilePage('next');
    assert.equal(visitor.teacherProfilePage, 2, 'Next should advance one page');
    assert.match(elements.get('teacherProfilePagination').innerHTML, /Showing 6–10 of 48 teachers/);
    visitor.navigateTeacherProfilePage('previous');
    assert.equal(visitor.teacherProfilePage, 1, 'Previous should return to the first page');
    visitor.navigateTeacherProfilePage('10');
    assert.equal(visitor.teacherProfilePage, 10, 'the last page number should be selectable');
    assert.equal(
        (elements.get('teacherProfileResults').innerHTML.match(/class="teacher-profile-result"/g) || []).length,
        3,
        'the last page should contain only remaining teachers'
    );
    assert.match(elements.get('teacherProfilePagination').innerHTML, /Showing 46–48 of 48 teachers/);
    assert.match(elements.get('teacherProfilePagination').innerHTML, /data-teacher-profile-page="next" disabled/);
    visitor.navigateTeacherProfilePage('next');
    assert.equal(visitor.teacherProfilePage, 10, 'Next should not advance beyond the last page');

    visitor.setTeacherProfilePage(1);
    visitor.setTeacherProfileSearch('teacher 47');
    assert.equal(visitor.teacherProfilePage, 1, 'searching should reset pagination to page one');
    assert.match(elements.get('teacherProfileResults').innerHTML, /Teacher 47/);
    assert.doesNotMatch(elements.get('teacherProfileResults').innerHTML, /Teacher 02/);
    assert.match(elements.get('teacherProfilePagination').innerHTML, /Showing 1–1 of 1 teachers/);
    assert.match(elements.get('teacherProfilePagination').innerHTML, /teacher-profile-pagination-controls hidden/);
    visitor.setTeacherProfileSearch('no matching teacher');
    assert.match(elements.get('teacherProfileResults').innerHTML, /No teachers match your search/);
    assert.equal(elements.get('teacherProfilePagination').classList.contains('hidden'), true);

    visitor.setTeacherProfileSearch('');
    visitor.setTeacherProfilePage(2);
    const selectedFromSecondPage = visitor.getTeacherDirectoryEntries()[5];
    visitor.selectedTeacherProfile = selectedFromSecondPage;
    visitor.renderTeacherProfileResults();
    visitor.selectedTeacherProfile = null;
    visitor.renderTeacherProfileResults();
    assert.equal(visitor.teacherProfilePage, 2, 'returning from a teacher dashboard should preserve the selected page');
    assert.match(elements.get('teacherProfileResults').innerHTML, /Teacher 06/);
    visitor.teacherPortalDirectory = savedDirectory;
    visitor.setTeacherProfileSearch('Jane Doe');

    let loadArguments;
    let timetableArguments;
    visitor.generateTeacherLoadElement = (...args) => {
        loadArguments = args;
        return element();
    };
    visitor.generateTimeSlots = () => [{ start: '08:00' }];
    visitor.buildScheduleGrid = (...args) => {
        timetableArguments = args;
        return 'Rendered timetable';
    };
    const selectedTeacher = visitor.getTeacherDirectoryEntries('Jane Doe')[0];
    await visitor.selectPublicTeacher(selectedTeacher);
    assert.equal(visitor.selectedTeacherProfile.name, 'Jane Doe');
    assert.equal(visitor.teacherPortalSchedules[0].id, 'assignment-one');
    assert.equal(elements.get('teacherProfileName').textContent, 'Jane Doe');
    assert.match(elements.get('teacherProfilePeriod').textContent, /2026-2027/);
    assert.equal(loadArguments[0], 'Jane Doe');
    assert.equal(loadArguments[1], '1st semester');
    assert.equal(loadArguments[2][0].id, 'assignment-one');
    assert.equal(timetableArguments[0][0].id, 'assignment-one');
    assert.equal(elements.get('teacherProfileTimetablePanel').innerHTML, 'Rendered timetable');

    const visitorReturn = createManager({ user: null });
    visitorReturn.isPublicTeacherPortal = true;
    for (const id of ['appShell', 'workspaceScreen', 'authScreen']) {
        elements.set(id, element());
        elements.get(id).classList.remove('hidden');
    }
    elements.set('applicationLanding', element());
    elements.get('applicationLanding').classList.add('hidden');
    await visitorReturn.returnToStartingPageFromTeacherPortal();
    assert.equal(elements.get('applicationLanding').classList.contains('hidden'), false);
    assert.equal(elements.get('appShell').classList.contains('hidden'), true);
    assert.equal(visitorReturn.currentUser, null);
    assert.equal(visitorReturn.isPublicTeacherPortal, false);

    const adminReturn = createManager({ user: { id: ADMIN_ID } });
    adminReturn.isPublicTeacherPortal = true;
    elements.get('applicationLanding').classList.add('hidden');
    await adminReturn.returnToStartingPageFromTeacherPortal();
    assert.equal(elements.get('applicationLanding').classList.contains('hidden'), false);
    assert.equal(adminReturn.currentUser.id, ADMIN_ID, 'returning must not sign out an administrator');

    const visitorControl = elements.get('teacherPortalAdminPeriodControl');
    visitor.renderTeacherPortalAdminPeriodControl();
    assert.equal(visitorControl.classList.contains('hidden'), true);

    const admin = createManager({
        user: { id: ADMIN_ID, email: 'admin@example.com' }
    });
    const nonAdmin = createManager({
        user: { id: 'another-user', user_metadata: { account_type: 'teacher_portal' } }
    });
    admin.teacherPortalAdminPeriods = [PERIOD_ONE, PERIOD_TWO];
    admin.teacherPortalActivePeriod = PERIOD_ONE;
    admin.renderTeacherPortalAdminPeriodControl();
    assert.equal(elements.get('teacherPortalAdminPeriodControl').classList.contains('hidden'), false);
    nonAdmin.renderTeacherPortalAdminPeriodControl();
    assert.equal(elements.get('teacherPortalAdminPeriodControl').classList.contains('hidden'), true);

    let adminPeriodCalls = 0;
    let activePeriodReads = 0;
    let scheduleReads = 0;
    let portalPeriodSetCalls = 0;
    global.TeacherPortalDataService.fetchAdminPeriods = async () => {
        adminPeriodCalls++;
        return { data: [PERIOD_ONE, PERIOD_TWO], error: null };
    };
    global.TeacherPortalDataService.setActivePeriod = async (_client, id) => {
        assert.equal(id, PERIOD_TWO.id);
        portalPeriodSetCalls++;
        return { error: null };
    };
    global.TeacherPortalDataService.fetchActivePeriod = async () => {
        activePeriodReads++;
        return { data: PERIOD_TWO, error: null };
    };
    global.TeacherPortalDataService.fetchTeacherSchedules = async (_client, name) => {
        scheduleReads++;
        return { data: [assignment('updated-assignment', name)], error: null };
    };
    await admin.loadTeacherPortalAdminPeriods();
    assert.equal(adminPeriodCalls, 1);
    assert.equal(admin.teacherPortalAdminPeriods.length, 2);
    admin.selectedTeacherProfile = { key: 'jane doe', name: 'Jane Doe' };
    admin.teacherProfileTab = 'timetable';
    admin.generateTeacherLoadElement = () => element();
    admin.generateTimeSlots = () => [];
    admin.buildScheduleGrid = () => 'Updated timetable';
    await admin.changeTeacherPortalActivePeriod(PERIOD_TWO.id);
    assert.equal(portalPeriodSetCalls, 1, 'the public admin selector should invoke its setter');
    assert.equal(activePeriodReads, 1, 'the active period must be confirmed by refetching');
    assert.equal(admin.teacherPortalActivePeriod.id, PERIOD_TWO.id);
    assert.equal(scheduleReads, 1, 'selected teacher assignments should refresh');
    assert.equal(admin.selectedTeacherProfile.name, 'Jane Doe');
    assert.equal(admin.teacherProfileTab, 'timetable');
    assert.equal(admin.teacherPortalSchedules[0].id, 'updated-assignment');

    nonAdmin.teacherPortalAdminPeriods = [PERIOD_ONE, PERIOD_TWO];
    nonAdmin.teacherPortalActivePeriod = PERIOD_ONE;
    await nonAdmin.changeTeacherPortalActivePeriod(PERIOD_TWO.id);
    assert.equal(portalPeriodSetCalls, 1, 'non-admin users must not invoke the setter');

    let resolveAdminPeriods;
    const staleAdminPeriods = createManager({
        user: { id: ADMIN_ID }
    });
    const pendingAdminPeriods = global.TeacherPortalDataService.fetchAdminPeriods;
    global.TeacherPortalDataService.fetchAdminPeriods = () =>
        new Promise(resolve => {
            resolveAdminPeriods = resolve;
        });
    const adminPeriodsRequest = staleAdminPeriods.loadTeacherPortalAdminPeriods();
    staleAdminPeriods.invalidateTeacherPortalAdminPeriodRequests();
    staleAdminPeriods.isPublicTeacherPortal = false;
    resolveAdminPeriods({ data: [PERIOD_ONE], error: null });
    await adminPeriodsRequest;
    assert.deepEqual(staleAdminPeriods.teacherPortalAdminPeriods, []);
    global.TeacherPortalDataService.fetchAdminPeriods = pendingAdminPeriods;

    let resolvePeriodSetter;
    const staleAdminChange = createManager({
        user: { id: ADMIN_ID }
    });
    staleAdminChange.teacherPortalAdminPeriods = [PERIOD_ONE, PERIOD_TWO];
    staleAdminChange.teacherPortalActivePeriod = PERIOD_ONE;
    global.TeacherPortalDataService.setActivePeriod = () =>
        new Promise(resolve => {
            resolvePeriodSetter = resolve;
        });
    const stalePeriodChange = staleAdminChange.changeTeacherPortalActivePeriod(PERIOD_TWO.id);
    staleAdminChange.invalidateTeacherPortalAdminPeriodRequests();
    staleAdminChange.isPublicTeacherPortal = false;
    resolvePeriodSetter({ error: null });
    await stalePeriodChange;
    assert.equal(staleAdminChange.teacherPortalActivePeriod.id, PERIOD_ONE.id);
    assert.equal(activePeriodReads, 1, 'stale admin changes must not refetch or overwrite the active period');

    const failedUpdate = createManager({
        user: { id: ADMIN_ID }
    });
    failedUpdate.teacherPortalAdminPeriods = [PERIOD_ONE, PERIOD_TWO];
    failedUpdate.teacherPortalActivePeriod = PERIOD_ONE;
    failedUpdate.selectedTeacherProfile = { key: 'jane doe', name: 'Jane Doe' };
    failedUpdate.renderTeacherProfileDashboard();
    const displayedPeriodBeforeFailure = elements.get('teacherProfilePeriod').textContent;
    global.TeacherPortalDataService.setActivePeriod = async () => ({
        error: new Error('period update failed')
    });
    const originalConsoleError = console.error;
    let updateErrorLogged = false;
    console.error = (...args) => {
        updateErrorLogged = args[0] === 'Teacher Portal active-period update failed:';
    };
    await failedUpdate.changeTeacherPortalActivePeriod(PERIOD_TWO.id);
    console.error = originalConsoleError;
    assert.equal(failedUpdate.teacherPortalActivePeriod.id, PERIOD_ONE.id);
    assert.match(failedUpdate.teacherPortalAdminPeriodError, /period update failed/);
    assert.equal(updateErrorLogged, true);
    assert.equal(
        elements.get('teacherProfilePeriod').textContent,
        displayedPeriodBeforeFailure
    );

    let resolveFirstSchedule;
    let resolveSecondSchedule;
    const staleSelection = createManager();
    staleSelection.teacherPortalDirectory = [
        { key: 'jane doe', name: 'Jane Doe' },
        { key: 'jane smith', name: 'Jane Smith' }
    ];
    staleSelection.generateTeacherLoadElement = () => element();
    staleSelection.generateTimeSlots = () => [];
    staleSelection.buildScheduleGrid = () => '';
    global.TeacherPortalDataService.fetchTeacherSchedules = (_client, name) =>
        new Promise(resolve => {
            if (name === 'Jane Doe') resolveFirstSchedule = resolve;
            else resolveSecondSchedule = resolve;
        });
    const firstSelection = staleSelection.selectPublicTeacher(staleSelection.teacherPortalDirectory[0]);
    const secondSelection = staleSelection.selectPublicTeacher(staleSelection.teacherPortalDirectory[1]);
    resolveSecondSchedule({ data: [assignment('newer-selection', 'Jane Smith')], error: null });
    await secondSelection;
    resolveFirstSchedule({ data: [assignment('stale-selection', 'Jane Doe')], error: null });
    await firstSelection;
    assert.equal(staleSelection.selectedTeacherProfile.name, 'Jane Smith');
    assert.equal(staleSelection.teacherPortalSchedules[0].id, 'newer-selection');

    let resolveAfterExit;
    const exitedPortal = createManager({ user: { id: ADMIN_ID } });
    exitedPortal.teacherPortalDirectory = [{ key: 'jane doe', name: 'Jane Doe' }];
    exitedPortal.generateTeacherLoadElement = () => element();
    exitedPortal.generateTimeSlots = () => [];
    exitedPortal.buildScheduleGrid = () => '';
    global.TeacherPortalDataService.fetchTeacherSchedules = () =>
        new Promise(resolve => {
            resolveAfterExit = resolve;
        });
    const pendingSelection = exitedPortal.selectPublicTeacher(exitedPortal.teacherPortalDirectory[0]);
    exitedPortal.returnToSchedulerFromTeacherPortal();
    resolveAfterExit({ data: [assignment('after-exit')], error: null });
    await pendingSelection;
    assert.equal(exitedPortal.isPublicTeacherPortal, false);
    assert.deepEqual(exitedPortal.teacherPortalSchedules, []);

    const oldTeacherAccount = createManager({ user: null, isPublic: false });
    oldTeacherAccount.remoteEnabled = false;
    oldTeacherAccount.showWorkspaceScreen = () => {};
    oldTeacherAccount.loadUserLocalData = () => {};
    oldTeacherAccount.render = () => {};
    oldTeacherAccount.syncFromRemote = () => {};
    oldTeacherAccount.applySession({
        user: {
            id: 'old-teacher-user',
            user_metadata: { account_type: 'teacher_portal' }
        }
    });
    assert.equal(oldTeacherAccount.activeAuthPortal, 'scheduler');
    assert.equal(oldTeacherAccount.isPublicTeacherPortal, false);

    let schedulerPortalSetterCalls = 0;
    global.TeacherPortalDataService.setActivePeriod = async () => {
        schedulerPortalSetterCalls++;
        return { error: null };
    };
    const schedulerPeriod = createManager({
        user: { id: 'scheduler-user', email: 'kentlumapas395@gmail.com' },
        isPublic: false
    });
    schedulerPeriod.schedulePeriods = [
        { id: 'scheduler-period', owner_id: 'scheduler-user', school_year: '2027-2028', term: '1st semester' }
    ];
    schedulerPeriod.periodRequestId = 0;
    schedulerPeriod.schedules = [assignment('old-schedule')];
    schedulerPeriod.ownerAllSchedules = [...schedulerPeriod.schedules];
    schedulerPeriod.getSchedulePeriodStorageKey = ownerId => `schedule-period:${ownerId}`;
    schedulerPeriod.getActivePeriodSessionKey = ownerId => `session-period:${ownerId}`;
    assert.equal(
        schedulerPeriod.setActiveSchedulePeriod(schedulerPeriod.schedulePeriods[0]),
        true
    );
    assert.equal(schedulerPeriod.activeSchedulePeriod.id, 'scheduler-period');
    assert.equal(schedulerPeriod.schedules.length, 0);
    assert.equal(schedulerPeriod.ownerAllSchedules.length, 0);
    assert.equal(
        localStorage.getItem('schedule-period:scheduler-user'),
        'scheduler-period'
    );
    assert.equal(
        sessionStorage.getItem('session-period:scheduler-user'),
        'scheduler-period'
    );
    assert.equal(schedulerPortalSetterCalls, 0);

    schedulerPeriod.schedulePeriods.push(PERIOD_ONE);
    sessionStorage.setItem('session-period:scheduler-user', PERIOD_ONE.id);
    assert.equal(
        schedulerPeriod.restoreSessionActiveSchedulePeriod('scheduler-user').id,
        PERIOD_ONE.id
    );
    assert.equal(schedulerPeriod.activeSchedulePeriod.id, PERIOD_ONE.id);
    assert.equal(schedulerPeriod.term, PERIOD_ONE.term);
    assert.equal(schedulerPortalSetterCalls, 0);

    const refreshedRows = [];
    schedulerPeriod.currentUser = { id: 'scheduler-user' };
    schedulerPeriod.remoteEnabled = true;
    schedulerPeriod.supabase = {
        from(table) {
            assert.equal(table, 'schedules');
            return {
                select() {
                    return this;
                },
                eq() {
                    return this;
                },
                order() {
                    return this;
                },
                then(resolve) {
                    resolve({
                        data: [{
                            ...assignment('scheduler-schedule'),
                            owner_id: 'scheduler-user',
                            schedule_period_id: PERIOD_ONE.id
                        }],
                        error: null
                    });
                }
            };
        }
    };
    schedulerPeriod.parseCourseYear = () => null;
    schedulerPeriod.normalizeProgram = value => value;
    schedulerPeriod.normalizeCourseYear = value => value;
    assert.equal(await schedulerPeriod.refreshSchedulesForActivePeriod(), true);
    refreshedRows.push(...schedulerPeriod.schedules);
    assert.equal(refreshedRows.length, 1);
    assert.equal(refreshedRows[0].schedulePeriodId, PERIOD_ONE.id);
    assert.equal(schedulerPortalSetterCalls, 0);

    console.log('Teacher Portal QA passed.');
}

function managerName(value) {
    return global.TeacherPortalQaManager.prototype.normalizeTeacherName.call({}, value);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});

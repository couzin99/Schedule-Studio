// Schedule Manager Application
class ScheduleManager {
    constructor() {
        this.schedules = this.loadSchedules();
        this.teachers = this.loadTeachers();
        this.rooms = this.loadRooms();
        this.subjects = this.loadSubjects();
        this.courses = this.loadCourses();
        this.buildings = this.loadBuildings();
        this.subjectDetails = this.loadListDetails('subjectDetails');
        this.roomDetails = this.loadListDetails('roomDetails');
        this.schoolYear = this.loadSchoolYear();

        this.schedulePeriods = [];
        this.activeSchedulePeriod = null;
        this.workspaceScreenVisible = false;
        this.screenTransitionTimeout = null;
        this.currentProfile = null;
        this.isOwner = false;
        this.ownerProfiles = [];
        this.ownerSelectedUserId = null;
        this.ownerViewingUserId = null;
        this.ownerAllSchedules = [];
        this.ownerCatalog = {};
        this.syncRequestId = 0;
        this.periodRequestId = 0;
        this.ownerRequestId = 0;
        this.editingCombinedClassId = null;
        this.curriculumCatalog = Array.isArray(window.CURRICULUM_CATALOG)
            ? window.CURRICULUM_CATALOG.map(entry => ({ ...entry, term: entry.term === '3rd term' ? 'summer' : entry.term }))
            : [];
        this.selectedCurriculumEntry = null;
        this.selectedCurriculumOptionKey = null;
        this.selectedClassSections = [];
        this.classSectionSearchQuery = '';
        this.term = '';
        this.teacherViewSearch = '';
        this.teacherScheduleSearch = '';
        this.studentSectionSearch = '';
        this.roomAssignmentSearch = '';
        this.roomsViewBuildingFilter = '';
        // Pagination state
        this.pagination = {
            teacher: 1,
            all: 1,
            students: 1,
            rooms: 1,
            manageTeachers: 1,
            manageRooms: 1,
            manageBuildings: 1,
            manageSubjects: 1,
            manageCourses: 1,
            owner: 1
        };

        this.itemsPerPage = 3;
        this.teacherSchedulesPerPage = 10;
        this.pendingOwnerViewingUserId = sessionStorage.getItem('scheduleStudioOwnerUser') || null;
        this.buildings = Array.from(new Set([...this.buildings, ...Object.values(this.roomDetails).map(info => info && info.building).filter(Boolean)]));
        this.subjectColors = this.loadSubjectColors();
        this.migrateSchedules();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initSupabase();
        this.ensureUniqueSubjectColors();
        this.render();
        this.renderTeacherOptions();
        this.renderRoomOptions();
        this.renderBuildingOptions();
        this.renderRoomBuildingOptions();
        this.renderSubjectOptions();
        this.renderCourseOptions();
        this.renderClassSectionOptions();
        this.renderSectionScheduleOptions();
        this.checkPrereqs();
        this.initializeAuth();
    }

    setupEventListeners() {
        document.getElementById('scheduleForm').addEventListener('submit', (e) => this.handleAddSchedule(e));
        const classSectionButton = document.getElementById('classSectionSelect');
        const classSectionOptions = document.getElementById('classSectionOptions');
        classSectionButton?.addEventListener('click', () => {
            if (classSectionButton.disabled) return;

            const isOpen =
                !classSectionOptions?.hidden;

            if (classSectionOptions) {
                classSectionOptions.hidden = isOpen;
            }

            classSectionButton.setAttribute(
                'aria-expanded',
                String(!isOpen)
            );
        });
        document.addEventListener('click', event => {
            const container = document.querySelector('.class-section-combobox');
            const button = document.getElementById('classSectionSelect');
            const list = document.getElementById('classSectionOptions');

            if (
                !container ||
                !button ||
                !list ||
                container.contains(event.target)
            ) {
                return;
            }

            list.hidden = true;

            button.setAttribute(
                'aria-expanded',
                'false'
            );
        });
        document.getElementById('teacherSelect')?.addEventListener('change', () => {
            this.renderCourseOptions();
            this.renderClassSectionOptions();
            this.checkPrereqs();
        });
        document.getElementById('courseSelect')?.addEventListener('change', () => {
            this.renderSubjectOptions();
            this.checkPrereqs();
        });
        document.getElementById('sectionInput')?.addEventListener('input', () => {
            this.renderSubjectOptions(
                document.getElementById('subjectSelect')?.value || ''
            );
            this.checkPrereqs();
        });
        document.getElementById('subjectSelect')?.addEventListener('input', () => {
            this.selectedCurriculumOptionKey = null;
            this.renderSubjectOptions(document.getElementById('subjectSelect').value);
            this.updateSelectedSubjectDetails();
            this.checkPrereqs();
        });
        document.getElementById('subjectSelect')?.addEventListener('focus', () => this.renderSubjectOptions());
        document.getElementById('subjectSelect')?.addEventListener('click', () => this.renderSubjectOptions());
        document.getElementById('subjectOptions')?.addEventListener('click', e => {
            const option = e.target.closest('[data-subject-value]');
            if (!option) return;
            const input = document.getElementById('subjectSelect');
            input.value = option.dataset.subjectValue;
            this.selectedCurriculumOptionKey =
                option.dataset.curriculumKey || null;
            this.updateSelectedSubjectDetails();
            this.renderSubjectOptions();
            this.checkPrereqs();
        });
        document.getElementById('subjectClearBtn')?.addEventListener('click', () => {
            const input = document.getElementById('subjectSelect');
            input.value = '';
            this.selectedCurriculumOptionKey = null;
            input.focus();
            this.renderSubjectOptions();
            this.updateSelectedSubjectDetails();
            this.checkPrereqs();
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.subject-combobox')) this.closeSubjectOptions();
        });
        document.getElementById('teacherViewSearch')?.addEventListener('input', e => {
            this.teacherViewSearch = e.target.value.trim().toLowerCase();
            if (this.pagination) this.resetPage('teacher');
            this.renderTeacherView();
        });
        document.getElementById('teacherScheduleSearch')?.addEventListener('input', e => {
            this.teacherScheduleSearch = e.target.value.trim().toLowerCase();
            this.renderAllView();
        });
        document.getElementById('studentSectionSearch')?.addEventListener('input', e => {
            this.studentSectionSearch = e.target.value.trim().toLowerCase();
            this.renderStudentsView();
        });
        document.getElementById('roomAssignmentSearch')?.addEventListener('input', e => {
            this.roomAssignmentSearch = e.target.value.trim().toLowerCase();
            this.renderRoomAssignmentsView();
        });
        document.getElementById('roomsViewBuildingFilter')?.addEventListener('change', e => {
            this.roomsViewBuildingFilter = e.target.value;
            this.renderRoomAssignmentsView();
        });
        document.getElementById('clearScheduleBtn')?.addEventListener('click', () => this.clearScheduleForm());
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            // view toggles already wired in HTML; keep existing behavior
            btn.addEventListener('click', (e) => {
                if (e.target.dataset && e.target.dataset.view) this.switchView(e);
            });
        });

        // Add Teacher
        document.getElementById('addTeacherBtn').addEventListener('click', () => this.handleAddTeacher());

        document.getElementById('newTeacher').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleAddTeacher();
            }
        });

        // Add Room
        document.getElementById('addRoomBtn').addEventListener('click', () => this.handleAddRoom());

        document.getElementById('newRoom').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleAddRoom();
            }
        });

        // Add Schedule Slot
        document.getElementById('addScheduleSlotBtn')?.addEventListener('click', () => this.addScheduleSlot());

        document.getElementById('scheduleSlots')?.addEventListener('change', e => {
            if (e.target.matches('.schedule-slot select, .schedule-slot input')) {
                this.updateRoomOptions(e.target.closest('.schedule-slot'));
            }
        });

        // Add Building
        document.getElementById('addBuildingBtn').addEventListener('click', () => this.handleAddBuilding());

        document.getElementById('newBuilding').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleAddBuilding();
            }
        });
        
        const addSubjectBtn = document.getElementById('addSubjectBtn');
        if (addSubjectBtn) addSubjectBtn.addEventListener('click', () => this.handleAddSubject());
        const addCourseBtn = document.getElementById('addCourseBtn');
        if (addCourseBtn) addCourseBtn.addEventListener('click', () => this.handleAddCourse());
        document.getElementById('closeScheduleModal').addEventListener('click', () => this.hideTeacherSchedule());
        document.getElementById('teacherScheduleModal').addEventListener('click', (e) => {
            if (e.target.id === 'teacherScheduleModal') this.hideTeacherSchedule();
        });

        // PDF / Print buttons in modal
        const viewPdfBtn = document.getElementById('viewPdfBtn');
        const downloadPdfBtn = document.getElementById('downloadPdfBtn');
        const viewLoadBtn = document.getElementById('viewLoadBtn');
        if (viewPdfBtn) viewPdfBtn.addEventListener('click', () => this.viewSchedulePdf());
        if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', () => this.downloadCurrentPdf());
        if (viewLoadBtn) viewLoadBtn.addEventListener('click', () => this.viewTeacherLoadPdf());

        // update available rooms when day/time changes
        // Re-check prerequisites when select lists change
        ['teacherSelect','subjectSelect','courseSelect','buildingSelect','roomSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.checkPrereqs());
        });

        // Remote sync controls (optional)
        const syncBtn = document.getElementById('syncNowBtn');
        if (syncBtn) syncBtn.addEventListener('click', () => this.syncFromRemote());
        const connectBtn = document.getElementById('connectRemoteBtn');
        if (connectBtn) connectBtn.addEventListener('click', () => this.promptForRemoteConfig());
        const createSchedulePeriodBtn = document.getElementById('createSchedulePeriodBtn');
        const schedulePeriodModal = document.getElementById('schedulePeriodModal');
        const schedulePeriodModalClose = document.getElementById('schedulePeriodModalClose');
        const schedulePeriodCancel = document.getElementById('schedulePeriodCancel');

        const openSchedulePeriodModal = () => {
            const schoolYearInput = document.getElementById('schedulePeriodSchoolYear');
            const termInput = document.getElementById('schedulePeriodTerm');
            const message = document.getElementById('schedulePeriodMessage');

            if (schoolYearInput) {
                schoolYearInput.value = this.getCurrentSchoolYear() || '';
            }

            if (termInput) {
                termInput.value = '';
            }

            if (message) {
                message.textContent = '';
            }

            if (schedulePeriodModal) {
                schedulePeriodModal.classList.remove('hidden');
                schedulePeriodModal.setAttribute('aria-hidden', 'false');
            }

            schoolYearInput?.focus();
        };

        const closeSchedulePeriodModal = () => {
            if (schedulePeriodModal) {
                schedulePeriodModal.classList.add('hidden');
                schedulePeriodModal.setAttribute('aria-hidden', 'true');
            }
        };

        createSchedulePeriodBtn?.addEventListener(
            'click',
            openSchedulePeriodModal
        );

        schedulePeriodModalClose?.addEventListener(
            'click',
            closeSchedulePeriodModal
        );

        schedulePeriodCancel?.addEventListener(
            'click',
            closeSchedulePeriodModal
        );
        document.getElementById('schedulePeriodForm')?.addEventListener(
            'submit',
            e => this.handleCreateSchedulePeriod(e)
        );
        const authForm = document.getElementById('authForm');
        if (authForm) authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));
        const resetPasswordForm = document.getElementById('resetPasswordForm');
        if (resetPasswordForm) resetPasswordForm.addEventListener('submit', (e) => this.handleSetNewPassword(e));
        const authModeToggle = document.getElementById('authModeToggle');
        if (authModeToggle) authModeToggle.addEventListener('click', () => this.toggleAuthMode());
        const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
        if (forgotPasswordBtn) forgotPasswordBtn.addEventListener('click', () => this.handlePasswordReset());
        const signOutBtn = document.getElementById('signOutBtn');
        if (signOutBtn) signOutBtn.addEventListener('click', () => this.signOut());
        ['actionModalClose', 'actionModalCancel'].forEach(id => document.getElementById(id)?.addEventListener('click', () => this.closeActionModal(false)));
        document.getElementById('actionModal')?.addEventListener('click', e => { if (e.target.id === 'actionModal') this.closeActionModal(false); });
        const viewSectionBtn = document.getElementById('viewSectionBtn');
        if (viewSectionBtn) viewSectionBtn.addEventListener('click', () => {
            const section = document.getElementById('sectionScheduleSelect').value;
            if (!section) return this.showNotification('Select a section first.', 'error');
            this.showSectionSchedule(section);
        });
        const viewSectionOfficialModalBtn = document.getElementById('viewSectionOfficialModalBtn');
        if (viewSectionOfficialModalBtn) viewSectionOfficialModalBtn.addEventListener('click', () => {
            const section = document.getElementById('teacherScheduleModal')?.dataset.section;
            const term = document.getElementById('teacherScheduleModal')?.dataset.term || null;
            if (section) this.viewSectionOfficialPdf(section, term);
        });
        document.getElementById('ownerClearSelection')?.addEventListener('click', () => {
            this.ownerSelectedUserId = null;
            this.renderOwnerView();
        });
        document.getElementById('ownerUsersList')?.addEventListener('click', event => {
            const card = event.target.closest('.owner-user-card[data-owner-user-id]');
            if (card) this.selectOwnerUser(card.dataset.ownerUserId);
        });
        document.getElementById('ownerEditClose')?.addEventListener('click', () => this.closeOwnerEdit());
        document.getElementById('ownerEditCancel')?.addEventListener('click', () => this.closeOwnerEdit());
        document.getElementById('ownerEditForm')?.addEventListener('submit', e => this.saveOwnerEdit(e));
        document.getElementById('ownerEditBuilding')?.addEventListener('change', () => this.renderEditRoomOptions());
        document.getElementById('ownerBackToUsers')?.addEventListener('click', () => this.exitOwnerUserView());
        document.getElementById('changeSchedulePeriodBtn')
        ?.addEventListener('click', () => {
            this.changeSchedulePeriod();
        });
    }

    async handleAddTeacher() {
        const input = document.getElementById('newTeacher');
        const name = input.value.trim().toUpperCase();
        if (!name) return this.showNotification('Please enter a teacher name to add.', 'error');
        if (this.teachers.includes(name)) return this.showNotification('Teacher already exists.', 'error');
        if (!(await this.addListItemToRemote('teachers', name))) return;
        this.teachers.push(name);
        this.saveTeachers();
        input.value = '';
        this.renderTeacherOptions();
        this.render();
        this.showNotification('Teacher added.', 'success');
        this.checkPrereqs();
    }

    async handleAddRoom() {
        const input = document.getElementById('newRoom');
        const name = input.value.trim().toUpperCase();
        const building = document.getElementById('newRoomBuilding').value.trim().toUpperCase();
        if (!name) return this.showNotification('Please enter a room name to add.', 'error');
        if (!building) return this.showNotification('Add and select a building before adding a room.', 'error');
        if (this.rooms.includes(name)) return this.showNotification('Room already exists.', 'error');
        if (!(await this.addListItemToRemote('rooms', { name, building: building || null }))) return;
        this.rooms.push(name);
        this.roomDetails[name] = { building };
        this.saveRooms();
        this.saveListDetails('roomDetails', this.roomDetails);
        input.value = '';
        this.renderRoomOptions();
        this.render();
        this.showNotification('Room added.', 'success');
        this.updateRoomOptions();
        this.checkPrereqs();
    }

    openActionModal({ mode = 'text', title, message = '', value = '', confirmLabel = 'Confirm' }) {
        return new Promise(resolve => {
            const modal = document.getElementById('actionModal');
            const input = document.getElementById('actionModalInput');
            if (!modal || !input) return resolve(null);
            document.getElementById('actionModalTitle').textContent = title;
            document.getElementById('actionModalMessage').textContent = message;
            document.getElementById('actionModalConfirm').textContent = confirmLabel;
            input.value = value;
            input.classList.toggle('hidden', mode !== 'text');
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
            const finish = result => { this._actionModalResolver = null; modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); resolve(result); };
            this._actionModalResolver = () => finish(mode === 'text' ? input.value : true);
            this._actionModalCancelResolver = () => finish(null);
            const confirm = document.getElementById('actionModalConfirm');
            confirm.onclick = () => this._actionModalResolver?.();
            input.focus(); input.select();
        });
    }

    closeActionModal(result = false) {
        const resolver = this._actionModalCancelResolver;
        this._actionModalResolver = null;
        this._actionModalCancelResolver = null;
        if (resolver) resolver();
        else document.getElementById('actionModal')?.classList.add('hidden');
    }

    handleAddBuilding() {
        const input = document.getElementById('newBuilding');
        const name = input.value.trim().toUpperCase();
        if (!name) return this.showNotification('Please enter a building name to add.', 'error');
        if (this.buildings.some(b => b.toLowerCase() === name.toLowerCase())) return this.showNotification('Building already exists.', 'error');
        this.buildings.push(name);
        this.saveBuildings();
        input.value = '';
        this.renderBuildingOptions();
        this.renderRoomBuildingOptions();
        this.render();
        this.showNotification('Building added.', 'success');
    }

    // Subjects & Courses
    async handleAddSubject() {
        const input = document.getElementById('newSubject');
        const name = input.value.trim().toUpperCase();
        const courseCode = document.getElementById('newSubjectCode').value.trim().toUpperCase();
        const unitsInput = document.getElementById('newSubjectUnits').value;
        const units = unitsInput === '' ? 3 : Number.parseInt(unitsInput, 10);
        if (!name) return this.showNotification('Please enter a subject to add.', 'error');
        if (this.subjects.includes(name)) return this.showNotification('Subject already exists.', 'error');
        if (!Number.isFinite(units) || units < 0) return this.showNotification('Units must be zero or greater.', 'error');
        if (!(await this.addListItemToRemote('subjects', { name, course_code: courseCode || null, units }))) return;
        this.subjects.push(name);
        this.subjectDetails[name] = { courseCode, units };
        this.saveSubjects();
        this.saveListDetails('subjectDetails', this.subjectDetails);
        // Ensure newly added subject receives a unique color
        this.ensureUniqueSubjectColors();
        input.value = '';
        document.getElementById('newSubjectCode').value = '';
        document.getElementById('newSubjectUnits').value = '3';
        this.renderSubjectOptions();
        this.render();
        this.showNotification('Subject added.', 'success');
        this.checkPrereqs();
    }

    async handleEditBuilding(buildingName) {
        const next = await this.openActionModal({ title: 'Rename building', message: 'Enter a new name for this building.', value: buildingName, confirmLabel: 'Save changes' });
        if (next === null) return;
        const name = next.trim().toUpperCase();
        if (!name || name === buildingName) return;
        if (this.buildings.some(b => b.toLowerCase() === name.toLowerCase())) return this.showNotification('Building already exists.', 'error');
        const index = this.buildings.indexOf(buildingName);
        if (index < 0) return;
        this.buildings[index] = name;
        Object.keys(this.roomDetails).forEach(room => {
            if ((this.roomDetails[room] || {}).building === buildingName) this.roomDetails[room].building = name;
        });
        this.saveBuildings();
        this.saveListDetails('roomDetails', this.roomDetails);
        this.renderBuildingOptions();
        this.renderRoomBuildingOptions();
        this.render();
        this.showNotification('Building updated.', 'success');
    }

    async handleDeleteBuilding(buildingName) {
        const assignedRooms = this.rooms.filter(room => (this.roomDetails[room] || {}).building === buildingName);
        const relatedSchedules = this.schedules.filter(schedule => assignedRooms.includes(schedule.room));
        const message = assignedRooms.length
            ? `${buildingName} contains ${assignedRooms.length} room(s) and ${relatedSchedules.length} related schedule(s). Deleting it will remove all of them.`
            : `This will remove ${buildingName}.`;
        if (!await this.openActionModal({ mode: 'confirm', title: assignedRooms.length ? 'Delete building and assigned rooms?' : 'Delete building?', message, confirmLabel: assignedRooms.length ? 'Delete all' : 'Delete' })) return;
        if (this.remoteEnabled && this.supabase) {
            const ownerScope = this.ownerViewingUserId || this.currentUser?.id;
            if (assignedRooms.length) {
                let roomDelete = this.supabase.from('rooms').delete().in('name', assignedRooms);
                if (ownerScope) roomDelete = roomDelete.eq('owner_id', ownerScope);
                const { error } = await roomDelete;
                if (error) return this.showNotification(error.message || 'Unable to delete the assigned rooms.', 'error');
            }
            if (relatedSchedules.length) {
                let scheduleDelete = this.supabase.from('schedules').delete().in('id', relatedSchedules.map(schedule => schedule.id));
                if (ownerScope) scheduleDelete = scheduleDelete.eq('owner_id', ownerScope);
                const { error } = await scheduleDelete;
                if (error) return this.showNotification(error.message || 'Unable to delete related schedules.', 'error');
            }
        }
        this.schedules = this.schedules.filter(schedule => !relatedSchedules.includes(schedule));
        this.rooms = this.rooms.filter(room => !assignedRooms.includes(room));
        assignedRooms.forEach(room => delete this.roomDetails[room]);
        this.saveRooms();
        this.saveSchedules();
        this.saveListDetails('roomDetails', this.roomDetails);
        this.buildings = this.buildings.filter(building => building !== buildingName);
        this.saveBuildings();
        this.renderBuildingOptions();
        this.renderRoomBuildingOptions();
        this.render();
        this.showNotification('Building deleted.', 'success');
    }

    async handleAddCourse() {
        const input = document.getElementById('newCourse');
        const name = input.value.trim().toUpperCase();
        if (!name) return this.showNotification('Please enter a section to add.', 'error');
        if (this.courses.includes(name)) return this.showNotification('Section already exists.', 'error');
        if (!(await this.addListItemToRemote('courses', name))) return;
        this.courses.push(name);
        this.saveCourses();
        input.value = '';
        this.renderCourseOptions();
        this.renderClassSectionOptions();
        this.renderSectionScheduleOptions();
        this.render();
        this.showNotification('Section added.', 'success');
        this.checkPrereqs();
    }

    async handleAddSchedule(e) {
        e.preventDefault();

        if (!this.activeSchedulePeriod) {
            this.showNotification(
                'Please open a scheduling period before adding a schedule.',
                'error'
            );
            return;
        }

        const teacherName =
            document.getElementById('teacherSelect')?.value || '';

        const term =
            this.activeSchedulePeriod?.term || '';

        const subject =
            document.getElementById('subjectSelect')?.value.trim() || '';

        const selectedSections =
            this.getSelectedClassSectionParts();

        if (!teacherName) {
            return this.showNotification(
                'Select a teacher.',
                'error'
            );
        }

        if (!selectedSections.length) {
            return this.showNotification(
                'Select at least one class section.',
                'error'
            );
        }

        if (!subject) {
            return this.showNotification(
                'Select a subject.',
                'error'
            );
        }

        const selectedCurriculumEntry =
            this.getSelectedCurriculumEntry();

        if (!selectedCurriculumEntry) {
            return this.showNotification(
                'Select a valid subject option.',
                'error'
            );
        }

        /*
        * A combined class is one teaching assignment even when
        * it contains multiple programs/sections.
        *
        * Therefore, check the teacher's 6-subject limit using
        * the subject itself rather than counting every selected
        * section as another subject.
        */
        const existingSubjectKeys =
            this.getTeacherDistinctSubjects(teacherName);

        const combinedSubjectKey =
            `COMBINED:${String(subject).trim().toUpperCase()}`;

        const subjectAlreadyAssigned =
            existingSubjectKeys.some(key =>
                key === this.getSubjectEquivalencyKey(
                    subject,
                    selectedSections[0].courseYear.split(' - ')[0]
                ) ||
                key === `COMMON:${String(subject).trim().toUpperCase()}` ||
                key === combinedSubjectKey
            );

        if (
            !subjectAlreadyAssigned &&
            existingSubjectKeys.length >= 6
        ) {
            return this.showNotification(
                `${teacherName} already has 6 subjects in this scheduling period.`,
                'error'
            );
        }

        const slots =
            [...document.querySelectorAll(
                '#scheduleSlots .schedule-slot'
            )];

        if (!slots.length) {
            return this.showNotification(
                'Add at least one class meeting.',
                'error'
            );
        }

        if (
            slots.some(
                slot =>
                    !slot.querySelector(
                        'input[name="days"]:checked'
                    )
            )
        ) {
            return this.showNotification(
                'Select at least one day for every class meeting.',
                'error'
            );
        }

        // A combined identifier is meaningful only when multiple sections
        // make up one logical class. New single-section assignments remain
        // standalone, matching the legacy nullable-column design.
        const combinedClassId = selectedSections.length > 1
            ? (typeof crypto !== 'undefined' &&
                typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : this.createLocalScheduleId())
            : null;

        const ownerId =
            this.ownerViewingUserId ||
            this.currentUser?.id ||
            '';

        const schedules = [];

        /*
        * Build one schedule row for every selected section
        * and every selected meeting day.
        */
        for (const selectedSection of selectedSections) {
            const courseYear =
                selectedSection.courseYear;

            const section =
                selectedSection.section;

            const [program, yearText] =
                courseYear.split(' - ');

            const year =
                Number.parseInt(yearText, 10);

            /*
            * Use the selected program's prospectus entry, preferring
            * the section year and active term when that offering exists.
            */
            const normalizedProgram =
                this.normalizeProgram(program);

            const normalizedSubject =
                subject.trim().toLowerCase();

            const curriculumEntry =
                this.getCurriculumEntryForProgramSubject(
                    normalizedSubject,
                    normalizedProgram,
                    year,
                    selectedCurriculumEntry
                );

            if (!curriculumEntry) {
                return this.showNotification(
                    `${subject} is not in the curriculum for ${courseYear}.`,
                    'error'
                );
            }

            const requiredWeeklyMinutes =
                this.getCurriculumEntryRequiredWeeklyMinutes(curriculumEntry);

            const existingWeeklyMinutes =
                this.getSectionSubjectScheduledMinutes(
                    courseYear + section,
                    curriculumEntry.name || subject,
                    curriculumEntry
                );

            /*
            * Build the new meetings for this section only.
            */
            const sectionSchedules =
                slots.flatMap(slot => {
                    const legacyIds = {
                        building: 'buildingSelect',
                        room: 'roomSelect'
                    };

                    const value = field =>
                        slot.querySelector(
                            `[data-field="${field}"]`
                        )?.value ||
                        document.getElementById(
                            legacyIds[field] || field
                        )?.value ||
                        '';

                    const room =
                        value('room');

                    const roomInfo =
                        this.roomDetails[room] || {};

                    const days =
                        [
                            ...slot.querySelectorAll(
                                'input[name="days"]:checked'
                            )
                        ].map(input => input.value);

                    return days.map(day => ({
                        id: this.createLocalScheduleId(),

                        ownerId,

                        schedulePeriodId:
                            this.activeSchedulePeriod.id,

                        combinedClassId,

                        term,

                        teacherName,

                        program:
                            normalizedProgram,

                        year,

                        section,

                        subject:
                            curriculumEntry.name || subject,

                        courseYear:
                            `${courseYear}${section}`,

                        courseCode:
                            curriculumEntry.code ||
                            curriculumEntry.courseCode ||
                            '',

                        units:
                            Number.isFinite(
                                Number.parseInt(
                                    curriculumEntry.units,
                                    10
                                )
                            )
                                ? Number.parseInt(
                                    curriculumEntry.units,
                                    10
                                )
                                : 3,

                        lecHours:
                            curriculumEntry.lecHours ??
                            null,

                        labHours:
                            curriculumEntry.labHours ??
                            null,

                        delivery:
                            curriculumEntry.delivery ||
                            '',

                        building:
                            value('building') ||
                            roomInfo.building ||
                            '',

                        overload: '',

                        day,

                        startTime:
                            value('startTime'),

                        endTime:
                            value('endTime'),

                        room
                    }));
                });

            /*
            * Calculate the hours being added to this section.
            */
            const newWeeklyMinutes =
                sectionSchedules.reduce(
                    (total, schedule) => {
                        const start =
                            this.timeToMinutes(
                                schedule.startTime
                            );

                        const end =
                            this.timeToMinutes(
                                schedule.endTime
                            );

                        if (
                            !Number.isFinite(start) ||
                            !Number.isFinite(end) ||
                            end <= start
                        ) {
                            return total;
                        }

                        return total + (end - start);
                    },
                    0
                );

            /*
            * IMPORTANT:
            * Partial scheduling is allowed.
            *
            * The new meetings only need to stay within the
            * remaining weekly hours for this particular section.
            */
            if (requiredWeeklyMinutes > 0) {
                const totalAfterAdding =
                    existingWeeklyMinutes +
                    newWeeklyMinutes;

                if (
                    totalAfterAdding >
                    requiredWeeklyMinutes
                ) {
                    const remainingMinutes =
                        Math.max(
                            0,
                            requiredWeeklyMinutes -
                            existingWeeklyMinutes
                        );

                    return this.showNotification(
                        `${curriculumEntry.name || subject} for ${courseYear}${section} has only ${remainingMinutes / 60} hour${remainingMinutes === 60 ? '' : 's'} remaining this week.`,
                        'error'
                    );
                }
            }

            schedules.push(...sectionSchedules);
        }

        /*
        * Validate every generated schedule row.
        */
        const pending = [];

        for (const schedule of schedules) {
            const validationError =
                this.validateSchedule(schedule);

            if (validationError) {
                return this.showNotification(
                    validationError,
                    'error'
                );
            }

            const conflictCheck =
                this.checkConflicts(
                    schedule,
                    null,
                    pending
                );

            if (conflictCheck.hasConflict) {
                const details =
                    conflictCheck.conflicts
                        .map(
                            conflict =>
                                `${conflict.type}: ${conflict.message}`
                        )
                        .join(' ');

                return this.showNotification(
                    `⚠️ Conflict detected: ${details}`,
                    'error'
                );
            }

            pending.push(schedule);
        }

        /*
        * Save all section rows together.
        */
        if (this.remoteEnabled) {
            const rows =
                schedules.map(schedule => ({
                    owner_id:
                        ownerId,

                    schedule_period_id:
                        schedule.schedulePeriodId,

                    combined_class_id:
                        schedule.combinedClassId,

                    term:
                        schedule.term,

                    program:
                        schedule.program,

                    year:
                        schedule.year,

                    section:
                        schedule.section,

                    teacher_name:
                        schedule.teacherName,

                    subject:
                        schedule.subject,

                    course_year:
                        schedule.courseYear,

                    course_code:
                        schedule.courseCode ||
                        null,

                    units:
                        schedule.units,

                    lec_hours:
                        schedule.lecHours,

                    lab_hours:
                        schedule.labHours,

                    delivery:
                        schedule.delivery ||
                        null,

                    building:
                        schedule.building ||
                        null,

                    overload:
                        null,

                    day:
                        schedule.day,

                    start_time:
                        schedule.startTime,

                    end_time:
                        schedule.endTime,

                    room:
                        schedule.room
                }));

            const {
                data,
                error
            } =
                await this.supabase
                    .from('schedules')
                    .insert(rows)
                    .select(
                        'id,combined_class_id'
                    );

            if (
                error ||
                !data ||
                data.length !== schedules.length
            ) {
                return this.showNotification(
                    error?.message ||
                        'Unable to save all class meetings. No local changes were made.',
                    'error'
                );
            }

            schedules.forEach(
                (schedule, index) => {
                    schedule.id =
                        data[index].id;

                    schedule.combinedClassId =
                        data[index].combined_class_id ||
                        schedule.combinedClassId;
                }
            );
        }

        /*
        * Add all generated rows to the local schedule list.
        */
        this.schedules.push(...schedules);

        if (this.ownerViewingUserId) {
            this.ownerAllSchedules.push(
                ...schedules
            );
        }

        this.saveSchedules();

        this.showNotification(
            selectedSections.length > 1
                ? `✓ Combined class with ${selectedSections.length} sections added successfully!`
                : '✓ Schedule added successfully!',
            'success'
        );

        document
            .getElementById('scheduleForm')
            ?.reset();

        this.term =
            this.activeSchedulePeriod?.term ||
            '';

        this.selectedClassSections = [];

        this.classSectionSearchQuery = '';

        this.resetScheduleSlots();

        this.renderTeacherOptions();

        this.renderCourseOptions();

        this.renderClassSectionOptions();

        this.renderSubjectOptions();

        this.render();

        this.updateRoomOptions();
    }

    validateSchedule(schedule) {
        if (!schedule.teacherName || !schedule.subject || !schedule.courseYear || !schedule.day || !schedule.startTime || !schedule.endTime || !schedule.room) {
            return 'Please fill in all fields.';
        }

        const startMinutes = this.timeToMinutes(schedule.startTime);
        const endMinutes = this.timeToMinutes(schedule.endTime);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
            return 'Please enter a valid start and end time.';
        }
        if (startMinutes >= endMinutes) {
            return 'End time must be after start time.';
        }
        if (endMinutes - startMinutes < 60) {
            return 'A class must be at least 1 hour (60 minutes) long.';
        }

        const [sh] = schedule.startTime.split(':').map(x => parseInt(x));
        const [eh, em] = schedule.endTime.split(':').map(x => parseInt(x));
        // Allow classes from 7:00 up to 21:00 (9:00 PM)
        if (sh < 7 || eh > 21 || (eh === 21 && em > 0)) {
            return 'Classes must be between 7:00 AM and 9:00 PM.';
        }

        return null;
    }

    // returns structured conflict info
    checkConflicts(newSchedule, excludeId = null, additionalSchedules = [], excludeIds = []) {
        const conflicts = [];

        const excludedIds = new Set(excludeIds.map(id => String(id)));

        const isSameCombinedMeeting = schedule =>
            Boolean(
                schedule.combinedClassId &&
                newSchedule.combinedClassId &&
                schedule.combinedClassId ===
                    newSchedule.combinedClassId &&
                this.getMeetingOccurrenceKey(schedule) ===
                    this.getMeetingOccurrenceKey(newSchedule)
            );

        for (const schedule of [
            ...this.schedules,
            ...additionalSchedules
        ]) {
            if (
                excludeId !== null &&
                String(schedule.id) === String(excludeId)
            ) {
                continue;
            }

            if (excludedIds.has(String(schedule.id))) {
                continue;
            }

            if (!this.sameTerm(schedule.term, newSchedule.term)) {
                continue;
            }

            if (schedule.day !== newSchedule.day) {
                continue;
            }

            /*
            * Section rows for the same combined-class meeting are
            * storage siblings, not competing assignments.
            */
            if (isSameCombinedMeeting(schedule)) {
                continue;
            }

            // Teacher conflict
            if (
                String(schedule.teacherName || '')
                    .trim()
                    .toLowerCase() ===
                String(newSchedule.teacherName || '')
                    .trim()
                    .toLowerCase()
            ) {
                if (
                    this.timesOverlap(
                        schedule.startTime,
                        schedule.endTime,
                        newSchedule.startTime,
                        newSchedule.endTime
                    )
                ) {
                    conflicts.push({
                        type: 'Teacher conflict',
                        message:
                            `${schedule.teacherName} is already scheduled for ` +
                            `${schedule.subject} in ${schedule.room} from ` +
                            `${this.formatTime(schedule.startTime)} to ` +
                            `${this.formatTime(schedule.endTime)}.`
                    });
                }
            }

            // Room conflict
            if (
                String(schedule.room || '')
                    .trim()
                    .toLowerCase() ===
                String(newSchedule.room || '')
                    .trim()
                    .toLowerCase()
            ) {
                if (
                    this.timesOverlap(
                        schedule.startTime,
                        schedule.endTime,
                        newSchedule.startTime,
                        newSchedule.endTime
                    )
                ) {
                    conflicts.push({
                        type: 'Room conflict',
                        message:
                            `${schedule.room} is already in use by ` +
                            `${schedule.teacherName} for ${schedule.subject} ` +
                            `from ${this.formatTime(schedule.startTime)} to ` +
                            `${this.formatTime(schedule.endTime)}.`
                    });
                }
            }

            // Subject conflict
            if (
                schedule.courseYear &&
                newSchedule.courseYear &&
                schedule.courseYear
                    .trim()
                    .toLowerCase() ===
                    newSchedule.courseYear
                        .trim()
                        .toLowerCase() &&
                schedule.subject &&
                newSchedule.subject &&
                schedule.subject
                    .trim()
                    .toLowerCase() ===
                    newSchedule.subject
                        .trim()
                        .toLowerCase() &&
                this.timesOverlap(
                    schedule.startTime,
                    schedule.endTime,
                    newSchedule.startTime,
                    newSchedule.endTime
                )
            ) {
                conflicts.push({
                    type: 'Subject conflict',
                    message:
                        `${newSchedule.subject} is already scheduled for ` +
                        `${newSchedule.courseYear} on ${newSchedule.day} ` +
                        `from ${this.formatTime(schedule.startTime)} to ` +
                        `${this.formatTime(newSchedule.endTime)}.`
                });
            }

            // Section conflict
            if (
                schedule.courseYear &&
                newSchedule.courseYear &&
                schedule.courseYear
                    .trim()
                    .toLowerCase() ===
                    newSchedule.courseYear
                        .trim()
                        .toLowerCase() &&
                this.timesOverlap(
                    schedule.startTime,
                    schedule.endTime,
                    newSchedule.startTime,
                    newSchedule.endTime
                )
            ) {
                conflicts.push({
                    type: 'Section conflict',
                    message:
                        `${schedule.courseYear} already has ` +
                        `${schedule.subject} with ${schedule.teacherName} ` +
                        `from ${this.formatTime(schedule.startTime)} to ` +
                        `${this.formatTime(schedule.endTime)}.`
                });
            }
        }

        // Deduplicate based on message
        const unique = [];
        const seen = new Set();

        for (const conflict of conflicts) {
            if (!seen.has(conflict.message)) {
                unique.push(conflict);
                seen.add(conflict.message);
            }
        }

        return {
            hasConflict: unique.length > 0,
            conflicts: unique
        };
    }

    timesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && start2 < end1;
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    formatDescriptiveTitle(title) {
        const minorWords = new Set([
            'a', 'an', 'the',
            'and', 'or', 'but',
            'as', 'at', 'by', 'for',
            'in', 'of', 'on', 'to',
            'via', 'ng'
        ]);

        return String(title || '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .map((word, index) => {
                if (/^\d/.test(word)) return word;

                if (index > 0 && minorWords.has(word)) {
                    return word;
                }

                return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(' ');
    }

    getTeacherSchedules(teacherName, term = null) {
        return this.schedules.filter(s => s.teacherName.toLowerCase() === teacherName.toLowerCase() && (term === null || (term ? this.sameTerm(s.term, term) : !s.term)));
    }

    getLogicalScheduleRows(schedules) {
        const rows = new Map();
        schedules.forEach(schedule => {
            const key = schedule.combinedClassId
                ? `combined:${schedule.combinedClassId}:meeting:${this.getMeetingOccurrenceKey(schedule)}`
                : `schedule:${schedule.id}`;
            if (!rows.has(key)) {
                rows.set(key, {
                    ...schedule,
                    displaySections: new Set()
                });
            }
            if (schedule.courseYear) rows.get(key).displaySections.add(schedule.courseYear);
        });
        return [...rows.values()].map(schedule => ({
            ...schedule,
            displayCourseYear: [...schedule.displaySections]
                .sort((a, b) => a.localeCompare(b))
                .join(' + ') || schedule.courseYear
        }));
    }

    getMeetingOccurrenceKey(schedule) {
        const normalize = value =>
            String(value ?? '').trim().toLowerCase();

        return JSON.stringify([
            normalize(schedule.day),
            normalize(schedule.startTime),
            normalize(schedule.endTime),
            normalize(schedule.room),
            normalize(schedule.building)
        ]);
    }

    sameTerm(first, second) {
        if (!first || !second) return !first && !second;
        return String(first).toLowerCase() === String(second).toLowerCase();
    }

    compareTerms(first, second) {
        const order = { '1st semester': 1, '2nd semester': 2, summer: 3, '3rd term': 3, '': 4 };
        return (order[first] || 99) - (order[second] || 99);
    }

    formatTerm(term) {
        return term === 'summer' ? 'Summer' : term === '1st semester' ? '1st Semester' : term === '2nd semester' ? '2nd Semester' : term === '3rd term' ? 'Summer' : 'Term not specified';
    }

    getTeacherConflicts(teacherName, term = null) {
        const teacherSchedules = this.getTeacherSchedules(teacherName, term);
        const conflicts = [];
        for (let i = 0; i < teacherSchedules.length; i++) {
            for (let j = i + 1; j < teacherSchedules.length; j++) {
                const a = teacherSchedules[i];
                const b = teacherSchedules[j];
                if (
                    a.combinedClassId &&
                    a.combinedClassId === b.combinedClassId &&
                    this.getMeetingOccurrenceKey(a) ===
                        this.getMeetingOccurrenceKey(b)
                ) continue;
                if (a.day === b.day && this.timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
                    conflicts.push({ schedule1: a, schedule2: b });
                }
            }
        }
        return conflicts;
    }

    getAllConflicts() {
        const conflicts = [];
        const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
        for (let i = 0; i < this.schedules.length; i++) {
            for (let j = i + 1; j < this.schedules.length; j++) {
                const a = this.schedules[i];
                const b = this.schedules[j];
                if (
                    a.combinedClassId &&
                    a.combinedClassId === b.combinedClassId &&
                    this.getMeetingOccurrenceKey(a) ===
                        this.getMeetingOccurrenceKey(b)
                ) continue;
                if (a.day !== b.day || !this.timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) continue;
                if (!this.sameTerm(a.term, b.term)) continue;
                if (same(a.teacherName, b.teacherName)) conflicts.push({ type: 'teacher', a, b });
                if (same(a.room, b.room)) conflicts.push({ type: 'room', a, b });
                if (a.courseYear && b.courseYear && same(a.courseYear, b.courseYear)) conflicts.push({ type: 'section', a, b });
            }
        }
        return conflicts;
    }

    async deleteSchedule(id) {
        const schedule = this.schedules.find(item => String(item.id) === String(id));
        if (!schedule) return;
        const isCombined = Boolean(schedule.combinedClassId);
        const group = isCombined ? this.schedules.filter(item => item.combinedClassId === schedule.combinedClassId) : [schedule];
        const sections = [...new Set(group.map(item => item.courseYear).filter(Boolean))].join(' + ');
        const label = isCombined ? `the combined class ${schedule.subject} (${sections})` : `${schedule.subject} for ${schedule.courseYear}`;
        const confirmed = await this.openActionModal({ mode: 'confirm', title: isCombined ? 'Delete combined class?' : 'Delete schedule?', message: `Are you sure you want to delete ${label}? This action cannot be undone.`, confirmLabel: isCombined ? 'Delete combined class' : 'Delete schedule' });
        if (!confirmed) return;
        if (this.remoteEnabled && this.currentUser) {
            let query = this.supabase.from('schedules').delete();
            query = isCombined ? query.eq('combined_class_id', schedule.combinedClassId) : query.eq('id', id);
            query = query.eq('owner_id', schedule.ownerId || this.ownerViewingUserId || this.currentUser.id);
            const { error } = await query;
            if (error) return this.showNotification(error.message || 'Unable to delete this schedule.', 'error');
        }
        const deletedIds = new Set(group.map(item => String(item.id)));
        this.schedules = this.schedules.filter(s => !deletedIds.has(String(s.id)));
        if (this.ownerViewingUserId) this.ownerAllSchedules = this.ownerAllSchedules.filter(s => !deletedIds.has(String(s.id)));
        this.saveSchedules();
        this.render();
        this.showNotification(isCombined ? 'Combined class deleted.' : 'Schedule deleted.', 'success');
        this.updateRoomOptions();
    }

    // ==================== PAGINATION ====================

    getPaginatedItems(items, pageKey) {
        const pageSize = pageKey === 'teacher'
            ? this.teacherSchedulesPerPage
            : this.itemsPerPage;
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

        // Keep the current page valid if items were deleted or filtered.
        this.pagination[pageKey] = Math.min(
            Math.max(1, this.pagination[pageKey] || 1),
            totalPages
        );

        const currentPage = this.pagination[pageKey];
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;

        return {
            items: items.slice(start, end),
            currentPage,
            totalPages,
            totalItems: items.length,
            startItem: items.length ? start + 1 : 0,
            endItem: Math.min(end, items.length)
        };
    }

    changePage(pageKey, page) {
        const targetPage = Number.parseInt(page, 10);

        if (!Number.isFinite(targetPage)) return;

        this.pagination[pageKey] = Math.max(1, targetPage);
        this.render();
    }

    resetPage(pageKey) {
        this.pagination[pageKey] = 1;
    }

    renderPagination(pageKey, totalItems) {
        const pageSize = pageKey === 'teacher'
            ? this.teacherSchedulesPerPage
            : this.itemsPerPage;
        if (totalItems <= pageSize) return '';

        const totalPages = Math.ceil(totalItems / pageSize);
        const currentPage = Math.min(
            Math.max(1, this.pagination[pageKey] || 1),
            totalPages
        );

        this.pagination[pageKey] = currentPage;

        const startItem = (currentPage - 1) * pageSize + 1;
        const endItem = Math.min(
            currentPage * pageSize,
            totalItems
        );

        return `
            <div class="pagination" data-pagination="${pageKey}">
                <div class="pagination-info">
                    Showing ${startItem}–${endItem} of ${totalItems}
                </div>

                <div class="pagination-controls">
                    <button
                        type="button"
                        class="pagination-btn"
                        ${currentPage === 1 ? 'disabled' : ''}
                        onclick="manager.changePage('${pageKey}', ${currentPage - 1})"
                    >
                        Previous
                    </button>

                    <span class="pagination-page">
                        Page ${currentPage} of ${totalPages}
                    </span>

                    <button
                        type="button"
                        class="pagination-btn"
                        ${currentPage === totalPages ? 'disabled' : ''}
                        onclick="manager.changePage('${pageKey}', ${currentPage + 1})"
                    >
                        Next
                    </button>
                </div>
            </div>
        `;
    }

    render() {
        this.renderDashboard();
        this.renderTeacherView();
        this.renderAllView();
        this.renderStudentsView();
        this.renderRoomAssignmentsView();
        this.renderManageView();
        this.renderOwnerView();
    }

    renderDashboard() {
        const unique = (field) => new Set(this.schedules.map(s => (s[field] || '').trim().toLowerCase()).filter(Boolean)).size;
        const allConflicts = this.getAllConflicts();
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        const setFraction = (id, numerator, denominator) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<span class="stat-ratio"><b>${numerator}</b><span>of ${denominator}</span></span>`;
        };
        setText('scheduleCount', this.schedules.length);
        setFraction('teacherCount', unique('teacherName'), this.teachers.length);
        setFraction('roomCount', unique('room'), this.rooms.length);
        const statCards = document.querySelectorAll('.dashboard .stat-card');
        if (this.isOwner) {
            const registeredUserCount = this.ownerProfiles.filter(
                profile =>
                    !['owner', 'school_admin'].includes(
                        String(profile.role || '').toLowerCase()
                    )
            ).length;
            const presentation =
                window.ScheduleStudioOwnerDashboard.getOwnerDashboardPresentation({
                    registeredUserCount
                });
            statCards.forEach((card, index) => {
                card.classList.toggle(
                    'owner-hidden-stat',
                    index > presentation.hideStatCardsAfterIndex
                );
                const label = card.querySelector('.stat-label');
                const note = card.querySelector('.stat-note');
                if (index === 0) {
                    if (label) label.textContent = presentation.scheduleLabel;
                    if (note) note.textContent = presentation.scheduleNote;
                }
            });
            setText('scheduleCount', presentation.scheduleCount);
        }
        setText('scheduleHealth', allConflicts.length ? 'Needs review' : 'Ready');
        setText('healthNote', allConflicts.length ? `${allConflicts.length} existing conflict${allConflicts.length === 1 ? '' : 's'} found` : 'No conflicts detected');
        const card = document.querySelector('.status-card');
        if (card) card.classList.toggle('has-conflict', allConflicts.length > 0);
    }

    renderTeacherView() {
        const teacherList = document.getElementById('teacherList');
        const teacherPagination = document.getElementById('teacherPagination');
        const uniqueTeachers = [...new Set(this.schedules.map(s => s.teacherName))]
            .filter(teacherName => teacherName.toLowerCase().includes(this.teacherViewSearch));
        if (this.schedules.length === 0) {
            teacherList.innerHTML = '<div class="welcome-state"><span class="welcome-kicker">WELCOME</span><h3>Your scheduling workspace is ready.</h3><p>Create your first class assignment using the scheduler, or open Manage Lists to set up your teachers, subjects, sections, buildings, and rooms.</p></div>';
            if (teacherPagination) teacherPagination.innerHTML = '';
            return;
        }
        if (uniqueTeachers.length === 0) {
            teacherList.innerHTML = '<p class="empty-message">No teachers match your search.</p>';
            if (teacherPagination) teacherPagination.innerHTML = '';
            return;
        }

        const teacherSchedules = uniqueTeachers.flatMap(teacherName => {
            const terms = [...new Set(this.getTeacherSchedules(teacherName).map(schedule => schedule.term || ''))]
                .sort((a, b) => this.compareTerms(a, b));

            return terms.flatMap(term =>
                this.getTeacherSchedules(teacherName, term).map(schedule => ({
                    teacherName,
                    term,
                    schedule
                }))
            );
        });

        const teacherPage = this.getPaginatedItems(teacherSchedules, 'teacher');
        const pageTeacherGroups = [];
        teacherPage.items.forEach(item => {
            let group = pageTeacherGroups.find(
                entry => entry.teacherName === item.teacherName && entry.term === item.term
            );
            if (!group) {
                group = { teacherName: item.teacherName, term: item.term, schedules: [] };
                pageTeacherGroups.push(group);
            }
            group.schedules.push(item.schedule);
        });

        teacherList.innerHTML = pageTeacherGroups.map(({ teacherName, term, schedules }) => {
            const conflicts = this.getTeacherConflicts(teacherName, term);
            const hasConflict = conflicts.length > 0;

            return `
                <div class="teacher-card ${hasConflict ? 'has-conflict' : ''}">
                    <div class="teacher-name">
                        ${teacherName}
                        ${hasConflict ? '<span class="conflict-badge">⚠️ CONFLICT</span>' : ''}
                    </div>

                    ${hasConflict ? `
                        <div class="conflict-notice">
                            ❌ This teacher has ${conflicts.length} scheduling conflict(s). Please fix before confirming.
                        </div>
                    ` : ''}

                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Subject</th>
                                <th>Course &amp; Year</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${schedules.map(schedule => {
                                const isConflicted = conflicts.some(
                                    c => c.schedule1.id === schedule.id || c.schedule2.id === schedule.id
                                );

                                return `
                                    <tr class="${isConflicted ? 'conflict-row' : ''}">
                                        <td>${schedule.subject}</td>
                                        <td>${schedule.courseYear}</td>
                                        <td>${schedule.day}</td>
                                        <td>${this.formatTime(schedule.startTime)} - ${this.formatTime(schedule.endTime)}</td>
                                        <td>${schedule.room}</td>
                                        <td>
                                            <!-- <button type="button" class="edit-btn" onclick="manager.openScheduleEdit('${String(schedule.id).replace(/'/g, "\\'")}')">Edit</button> -->
                                            <button
                                                type="button"
                                                class="delete-btn"
                                                onclick="manager.deleteSchedule('${String(schedule.id).replace(/'/g, "\\'")}')"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }).join('');

        if (teacherPagination) {
            teacherPagination.innerHTML = this.renderPagination(
                'teacher',
                teacherPage.totalItems
            );
        }
    }

    renderAllView() {
        const allSchedules = document.getElementById('allSchedules');
        if (!allSchedules) return;

        const grouped = new Map();
        this.teachers.forEach(teacherName => {
            const name = String(teacherName || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (!grouped.has(key)) {
                grouped.set(key, { teacherName: name, schedules: [] });
            }
        });

        this.schedules.forEach(s => {
            const name = String(s.teacherName || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            if (!grouped.has(key)) {
                grouped.set(key, { teacherName: name, schedules: [] });
            }
            grouped.get(key).schedules.push(s);
        });

        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        grouped.forEach(group => {
            group.schedules.sort((a, b) => {
                const dayCompare = (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
                if (dayCompare !== 0) return dayCompare;
                const courseCompare = String(a.courseYear || '').localeCompare(String(b.courseYear || ''));
                if (courseCompare !== 0) return courseCompare;
                return String(a.startTime || '').localeCompare(String(b.startTime || ''));
            });
        });

        const groupsSorted = [...grouped.values()].sort((a, b) => a.teacherName.localeCompare(b.teacherName));
        const filteredGroups = groupsSorted.filter(group => group.teacherName.toLowerCase().includes(this.teacherScheduleSearch));
        if (!filteredGroups.length) {
            allSchedules.innerHTML = this.teacherScheduleSearch
                ? `<p class="empty-message">No teachers match "${this.escapeHtml(this.teacherScheduleSearch)}".</p>`
                : '<p class="empty-message">No teachers have been added yet.</p>';
            return;
        }

        const allPage = this.getPaginatedItems(filteredGroups, 'all');

        allSchedules.innerHTML = allPage.items.map(group => {
            const { teacherName, schedules: teacherSchedules } = group;
            const terms = [...new Set(teacherSchedules.map(schedule => schedule.term || ''))];
            const term = this.activeSchedulePeriod?.term ||
                (terms.length === 1 ? terms[0] : this.term || null);
            const summary = this.getTeacherScheduleSummary(teacherSchedules);
            const conflicts = this.getTeacherConflicts(teacherName, term);
            const hasConflict = conflicts.length > 0;
            const safeTeacherName = teacherName
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'");
            const safeTerm = String(term || '')
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'");
            const termArgument = term === null ? 'null' : `'${safeTerm}'`;
            const weekdays = [
                ['Monday', 'MON'],
                ['Tuesday', 'TUE'],
                ['Wednesday', 'WED'],
                ['Thursday', 'THU'],
                ['Friday', 'FRI']
            ];
            return `
                <article class="teacher-card teacher-directory-card ${hasConflict ? 'has-conflict' : ''}">
                    <header class="teacher-directory-header">
                        <div class="teacher-directory-identity">
                            <h3 class="teacher-name">${this.escapeHtml(teacherName)}</h3>
                            ${hasConflict ? '<span class="conflict-badge">⚠️ CONFLICT</span>' : ''}
                        </div>
                        <span class="teacher-class-count">${summary.classCount} scheduled ${summary.classCount === 1 ? 'class' : 'classes'}</span>
                    </header>
                    <p class="teacher-directory-summary">
                        ${summary.classCount
                            ? `${summary.subjectCount} ${summary.subjectCount === 1 ? 'subject' : 'subjects'} · ${summary.roomCount} ${summary.roomCount === 1 ? 'room' : 'rooms'}`
                            : 'No scheduled classes'}
                    </p>
                    <div class="teacher-directory-footer">
                        <div class="teacher-weekdays" aria-label="Scheduled weekdays">
                            ${weekdays.map(([day, label]) => `
                                <span class="teacher-weekday ${summary.teachingDays.includes(day) ? 'is-active' : ''}" ${summary.teachingDays.includes(day) ? `title="Classes on ${day}"` : ''}>
                                    <span class="teacher-weekday-label">${label}</span>
                                    ${summary.teachingDays.includes(day) ? '<span class="teacher-weekday-dot" aria-hidden="true"></span>' : ''}
                                </span>
                            `).join('')}
                        </div>
                        <button
                            type="button"
                            class="btn-view teacher-directory-action"
                            onclick="manager.showTeacherSchedule('${safeTeacherName}', ${termArgument})"
                        >
                            View Timetable <span aria-hidden="true">→</span>
                        </button>
                    </div>
                    ${hasConflict ? `
                        <div class="conflict-notice">
                            ❌ This teacher has ${conflicts.length} scheduling conflict(s).
                        </div>
                    ` : ''}
                </article>
            `;
        }).join('');

        allSchedules.insertAdjacentHTML(
            'beforeend',
            this.renderPagination('all', allPage.totalItems)
        );  
    }

    getTeacherScheduleSummary(schedules) {
        const logicalSchedules = this.getLogicalScheduleRows(schedules);
        const uniqueValues = values => new Set(
            values
                .map(value => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        ).size;
        const teachingDays = new Set(
            logicalSchedules.map(schedule => schedule.day)
        );
        const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        return {
            classCount: logicalSchedules.length,
            subjectCount: uniqueValues(logicalSchedules.map(schedule => schedule.subject)),
            roomCount: uniqueValues(logicalSchedules.map(schedule => schedule.room)),
            teachingDays: weekdays.filter(day => teachingDays.has(day))
        };
    }

    clearScheduleForm() {
        const form = document.getElementById('scheduleForm');
        if (!form) return;
        form.reset();
        this.term = this.activeSchedulePeriod?.term || '';
        this.selectedClassSections = [];
        this.classSectionSearchQuery = '';
        document.getElementById('classSectionOptions')?.setAttribute('hidden', '');
        document.getElementById('classSectionSelect')?.setAttribute('aria-expanded', 'false');
        this.closeSubjectOptions();
        this.hideTeacherSchedule();
        this.resetScheduleSlots();
        this.renderTeacherOptions();
        this.renderCourseOptions();
        this.renderClassSectionOptions();
        this.renderSubjectOptions();
        this.renderRoomOptions();
        const hint = document.getElementById('roomHint');
        if (hint) hint.textContent = 'Pick a day and time to see available rooms.';
        document.getElementById('notification')?.replaceChildren();
    }

    addScheduleSlot() {
        const container = document.getElementById('scheduleSlots');
        if (!container) return;
        const index = container.querySelectorAll('.schedule-slot').length;
        const days = [
            ['Monday', 'M'],
            ['Tuesday', 'T'],
            ['Wednesday', 'W'],
            ['Thursday', 'Th'],
            ['Friday', 'F'],
            ['Saturday', 'Sat']
        ];
        const buildings = this.buildings.slice().sort((a, b) => a.localeCompare(b));
        const slot = document.createElement('div');
        slot.className = 'schedule-slot';
        slot.dataset.slotIndex = index;
        slot.innerHTML = `
            <div class="schedule-slot-heading"><strong>Class meeting ${index + 1}</strong><button type="button" class="remove-schedule-slot" aria-label="Remove meeting">Remove</button></div>
            <div class="time-row">
                <div class="form-group"><label>Start Time:</label><input type="time" data-field="startTime" required></div>
                <div class="form-group"><label>End Time:</label><input type="time" data-field="endTime" required></div>
            </div>
            <div class="form-group"><span class="field-label">Days:</span><div class="day-options" role="group" aria-label="Days for class meeting ${index + 1}">${days.map(([day, shortDay]) => `<label><span>${shortDay}</span><input type="checkbox" name="days" value="${day}"></label>`).join('')}</div></div>
            <div class="selector-row">
                <div class="form-group"><label>Campus Building:</label><select data-field="building" required><option value="">-- Select Building --</option>${buildings.map(building => `<option value="${building}">${building}</option>`).join('')}</select></div>
                <div class="form-group"><label>Room:</label><select data-field="room" required><option value="">-- Select Room --</option></select></div>
            </div>
            `;
        container.appendChild(slot);
        slot.querySelector('.remove-schedule-slot').addEventListener('click', () => {
            slot.remove();
            [...container.querySelectorAll('.schedule-slot')].forEach((item, itemIndex) => {
                item.querySelector('.schedule-slot-heading strong').textContent = `Class meeting ${itemIndex + 1}`;
            });
        });
        this.updateRoomOptions(slot);
    }

    resetScheduleSlots() {
        const container = document.getElementById('scheduleSlots');
        if (!container) return;
        container.querySelectorAll('.schedule-slot:not(:first-child)').forEach(slot => slot.remove());
        const firstSlot = container.querySelector('.schedule-slot');
        firstSlot?.querySelectorAll('input, select').forEach(field => {
            if (field.type === 'checkbox') field.checked = false;
            else field.value = '';
        });
        this.updateRoomOptions(firstSlot);
    }

    renderStudentsView() {
        const list = document.getElementById('studentSectionList');
        if (!list) return;
        const grouped = {};
        this.schedules.forEach(schedule => {
            const section = this.getCourseYear(schedule).trim();
            if (!section) return;
            const key = `${section}|||${schedule.term || ''}`;
            if (!grouped[key]) grouped[key] = { section, term: schedule.term || '', schedules: [] };
            grouped[key].schedules.push(schedule);
        });
        const groups = Object.values(grouped).sort((a, b) => a.section.localeCompare(b.section) || this.compareTerms(a.term, b.term));
        if (!groups.length) {
            list.innerHTML = '<p class="empty-message">No student schedules yet. Add a class to get started!</p>';
            return;
        }
        const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        groups.forEach(group => group.schedules.sort((a, b) => (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0) || a.startTime.localeCompare(b.startTime)));
        const filteredGroups = groups.filter(group => group.section.toLowerCase().includes(this.studentSectionSearch));
        if (!filteredGroups.length) {
            list.innerHTML = `<p class="empty-message">No sections match "${this.escapeHtml(this.studentSectionSearch)}".</p>`;
            return;
        }
        const studentPage = this.getPaginatedItems(filteredGroups, 'students');

        list.innerHTML = studentPage.items.map(group => {
            const { section, term, schedules: rows } = group;
            const safeSection = section.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeTerm = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const summary = this.getStudentSectionSummary(rows);
            const weekdays = [
                ['Monday', 'MON'],
                ['Tuesday', 'TUE'],
                ['Wednesday', 'WED'],
                ['Thursday', 'THU'],
                ['Friday', 'FRI']
            ];
            return `
                <article class="teacher-card student-section-card student-section-overview">
                    <header class="student-overview-header">
                        <h3 class="teacher-name">${this.escapeHtml(section)}</h3>
                        <span class="teacher-class-count">${summary.classCount} scheduled ${summary.classCount === 1 ? 'class' : 'classes'}</span>
                    </header>
                    <p class="student-overview-summary">
                        ${summary.subjectCount} ${summary.subjectCount === 1 ? 'subject' : 'subjects'} ·
                        ${summary.teacherCount} ${summary.teacherCount === 1 ? 'teacher' : 'teachers'} ·
                        ${summary.roomCount} ${summary.roomCount === 1 ? 'room' : 'rooms'}
                    </p>
                    <div class="student-overview-footer">
                        <div class="teacher-weekdays" aria-label="Scheduled weekdays">
                            ${weekdays.map(([day, label]) => `
                                <span class="teacher-weekday ${summary.teachingDays.includes(day) ? 'is-active' : ''}" ${summary.teachingDays.includes(day) ? `title="Classes on ${day}"` : ''}>
                                    <span class="teacher-weekday-label">${label}</span>
                                    ${summary.teachingDays.includes(day) ? '<span class="teacher-weekday-dot" aria-hidden="true"></span>' : ''}
                                </span>
                            `).join('')}
                        </div>
                        <button
                            type="button"
                            class="btn-view teacher-directory-action student-overview-action"
                            onclick="manager.showSectionSchedule('${safeSection}', '${safeTerm}')"
                        >
                            View Timetable <span aria-hidden="true">→</span>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
        list.insertAdjacentHTML(
            'beforeend',
            this.renderPagination('students', studentPage.totalItems)
        );
    }

    getStudentSectionSummary(schedules) {
        const logicalSchedules = this.getLogicalScheduleRows(schedules);
        const uniqueValues = values => new Set(
            values
                .map(value => String(value || '').trim().toLowerCase())
                .filter(Boolean)
        ).size;
        const scheduledDays = new Set(
            logicalSchedules.map(schedule => schedule.day)
        );

        return {
            classCount: logicalSchedules.length,
            subjectCount: uniqueValues(logicalSchedules.map(schedule => schedule.subject)),
            teacherCount: uniqueValues(logicalSchedules.map(schedule => schedule.teacherName)),
            roomCount: uniqueValues(logicalSchedules.map(schedule => schedule.room)),
            teachingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                .filter(day => scheduledDays.has(day))
        };
    }

    renderRoomAssignmentsView() {
        const list = document.getElementById('roomAssignmentList');
        if (!list) return;
        const grouped = {};
        this.schedules.forEach(schedule => {
            const room = (schedule.room || '').trim();
            if (!room) return;
            const key = `${room}|||${schedule.term || ''}`;
            if (!grouped[key]) grouped[key] = { room, term: schedule.term || '', schedules: [] };
            grouped[key].schedules.push(schedule);
        });
        const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        const groups = Object.values(grouped).sort((a, b) => a.room.localeCompare(b.room) || this.compareTerms(a.term, b.term));
        groups.forEach(group => group.schedules.sort((a, b) => (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0) || a.startTime.localeCompare(b.startTime)));
        const buildingFilter = document.getElementById('roomsViewBuildingFilter');

        if (buildingFilter) {
            const buildings = [...new Set(
                this.schedules
                    .map(schedule => (schedule.building || '').trim())
                    .filter(Boolean)
            )].sort((a, b) => a.localeCompare(b));

            const currentValue = this.roomsViewBuildingFilter;

            buildingFilter.innerHTML =
                '<option value="">All Buildings</option>' +
                buildings.map(building =>
                    `<option value="${this.escapeHtml(building)}">${this.escapeHtml(building)}</option>`
                ).join('');

            if (buildings.includes(currentValue)) {
                buildingFilter.value = currentValue;
            } else {
                this.roomsViewBuildingFilter = '';
                buildingFilter.value = '';
            }
        }
        const filteredGroups = groups.filter(group =>
            group.room.toLowerCase().includes(this.roomAssignmentSearch) &&
            (!this.roomsViewBuildingFilter ||
                group.schedules.some(schedule =>
                    (schedule.building || '').trim() === this.roomsViewBuildingFilter
                )
            )
        );
        if (!filteredGroups.length) {
            const message = this.schedules.length ? `No room assignments match "${this.escapeHtml(this.roomAssignmentSearch)}".` : 'No room assignments yet. Add a class to get started!';
            list.innerHTML = `<p class="empty-message">${message}</p>`;
            return;
        }
        const roomPage = this.getPaginatedItems(filteredGroups, 'rooms');

        list.innerHTML = roomPage.items.map(group => {
            const safeRoom = group.room.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeTerm = group.term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const summary = this.getRoomAssignmentSummary(group.schedules);
            const weekdays = [
                ['Monday', 'MON'],
                ['Tuesday', 'TUE'],
                ['Wednesday', 'WED'],
                ['Thursday', 'THU'],
                ['Friday', 'FRI']
            ];
            return `<article class="teacher-card room-assignment-card room-assignment-overview">
                <header class="room-overview-header">
                    <h3 class="teacher-name">${this.escapeHtml(group.room)}</h3>
                    <span class="teacher-class-count">${summary.classCount} scheduled ${summary.classCount === 1 ? 'class' : 'classes'}</span>
                </header>
                <div class="room-overview-details">
                    <p class="room-overview-summary">${summary.subjectCount} ${summary.subjectCount === 1 ? 'subject' : 'subjects'}</p>
                    <div class="teacher-weekdays" aria-label="Room scheduled weekdays">
                        ${weekdays.map(([day, label]) => `
                            <span class="teacher-weekday ${summary.teachingDays.includes(day) ? 'is-active' : ''}" ${summary.teachingDays.includes(day) ? `title="Room is scheduled on ${day}"` : ''}>
                                <span class="teacher-weekday-label">${label}</span>
                                ${summary.teachingDays.includes(day) ? '<span class="teacher-weekday-dot" aria-hidden="true"></span>' : ''}
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="room-overview-footer">
                    <button
                        type="button"
                        class="btn-view teacher-directory-action"
                        onclick="manager.showRoomSchedule('${safeRoom}', '${safeTerm}')"
                    >
                        View Timetable <span aria-hidden="true">→</span>
                    </button>
                </div>
            </article>`;
        }).join('');
        list.insertAdjacentHTML(
            'beforeend',
            this.renderPagination('rooms', roomPage.totalItems)
        );
    }

    getRoomAssignmentSummary(schedules) {
        const logicalSchedules = this.getLogicalScheduleRows(schedules);
        const subjectCount = new Set(
            logicalSchedules
                .map(schedule => String(schedule.subject || '').trim().toLowerCase())
                .filter(Boolean)
        ).size;
        const scheduledDays = new Set(
            logicalSchedules.map(schedule => schedule.day)
        );

        return {
            classCount: logicalSchedules.length,
            subjectCount,
            teachingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                .filter(day => scheduledDays.has(day))
        };
    }

    renderManageView() {
        const teacherListManage = document.getElementById('teacherListManage');
        const roomListManage = document.getElementById('roomListManage');
        const buildingListManage = document.getElementById('buildingListManage');
        const subjectListManage = document.getElementById('subjectListManage');
        const courseListManage = document.getElementById('courseListManage');
        const term = this.activeSchedulePeriod?.term || this.term || null;
        if (this.teachers.length === 0) {
            teacherListManage.innerHTML = '<p class="empty-message">No teachers added yet.</p>';
        } else {
            const teacherItems = this.teachers.slice().sort((a, b) => a.localeCompare(b));
            const teacherPage = this.getPaginatedItems(teacherItems, 'manageTeachers');

            teacherListManage.innerHTML = teacherPage.items.map(teacherName => {
                const count = this.schedules.filter(s => s.teacherName === teacherName).length;
                return `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${teacherName}</div>
                            <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="manage-actions">
                            <button type="button" class="edit-btn" onclick="manager.handleEditTeacher('${teacherName.replace(/'/g, "\\'")}')">Edit</button>
                            <button type="button" class="delete-btn" onclick="manager.handleDeleteTeacher('${teacherName.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
            teacherListManage.insertAdjacentHTML(
                'beforeend',
                this.renderPagination('manageTeachers', teacherPage.totalItems)
            );
        }

        if (this.rooms.length === 0) {
            roomListManage.innerHTML = '<p class="empty-message">No rooms added yet.</p>';
        } else {
            const roomItems = this.rooms.slice().sort((a, b) => a.localeCompare(b));
            const roomPage = this.getPaginatedItems(roomItems, 'manageRooms');

            roomListManage.innerHTML = roomPage.items.map(roomName => {
                const count = this.schedules.filter(s => s.room === roomName).length;
                const building = (this.roomDetails[roomName] || {}).building;
                return `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${roomName}</div>
                            <div class="manage-item-subtext">${building ? `${building} · ` : ''}${count} schedule${count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="manage-actions">
                            <button type="button" class="edit-btn" onclick="manager.handleEditRoom('${roomName.replace(/'/g, "\\'")}')">Edit</button>
                            <button type="button" class="delete-btn" onclick="manager.handleDeleteRoom('${roomName.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
            roomListManage.insertAdjacentHTML(
                'beforeend',
                this.renderPagination('manageRooms', roomPage.totalItems)
            );
        }

        if (buildingListManage) {
            if (this.buildings.length === 0) {
                buildingListManage.innerHTML = '<p class="empty-message">No buildings added yet.</p>';
            } else {
                const buildingItems = this.buildings.slice().sort((a, b) => a.localeCompare(b));
                const buildingPage = this.getPaginatedItems(buildingItems, 'manageBuildings');

                buildingListManage.innerHTML = buildingPage.items.map(building => `
                    <div class="manage-item">
                        <div>
                            <div class="manage-item-title">${building}</div>
                            <div class="manage-item-subtext">${this.rooms.filter(r => (this.roomDetails[r] || {}).building === building).length} room(s)</div>
                        </div>
                        <div class="manage-actions">
                            <button type="button" class="edit-btn" onclick="manager.handleEditBuilding('${building.replace(/'/g, "\\'")}')">Edit</button>
                            <button type="button" class="delete-btn" onclick="manager.handleDeleteBuilding('${building.replace(/'/g, "\\'")}')">Delete</button>
                        </div>
                    </div>
                `).join('');

                buildingListManage.insertAdjacentHTML(
                    'beforeend',
                    this.renderPagination('manageBuildings', buildingPage.totalItems)
                );
            }
        }

        // Subjects
        if (subjectListManage) {
            if (this.subjects.length === 0) {
                subjectListManage.innerHTML = '<p class="empty-message">No subjects added yet.</p>';
            } else {
                const subjectItems = this.subjects.slice().sort((a, b) => a.localeCompare(b));
                const subjectPage = this.getPaginatedItems(subjectItems, 'manageSubjects');

                subjectListManage.innerHTML = subjectPage.items.map(subjectName => {
                    const count = this.schedules.filter(s => s.subject === subjectName).length;
                    const details = this.subjectDetails[subjectName] || {};
                    const meta = [details.courseCode, Number.isFinite(Number.parseInt(details.units, 10)) ? `${details.units} unit${Number.parseInt(details.units, 10) === 1 ? '' : 's'}` : '3 units'].filter(Boolean).join(' · ');
                    return `
                        <div class="manage-item">
                            <div>
                                <div class="manage-item-title">${subjectName}</div>
                                <div class="manage-item-subtext">${meta ? `${meta} · ` : ''}${count} schedule${count === 1 ? '' : 's'}</div>
                            </div>
                            <div class="manage-actions">
                                <button type="button" class="edit-btn" onclick="manager.handleEditSubject('${subjectName.replace(/'/g, "\\'")}')">Edit</button>
                                <button type="button" class="delete-btn" onclick="manager.handleDeleteSubject('${subjectName.replace(/'/g, "\\'")}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
                subjectListManage.insertAdjacentHTML(
                    'beforeend',
                    this.renderPagination('manageSubjects', subjectPage.totalItems)
                );
            }
        }

        // Courses
        if (courseListManage) {
            if (this.courses.length === 0) {
                courseListManage.innerHTML = '<p class="empty-message">No courses added yet.</p>';
            } else {
                const courseItems = this.courses.slice().sort((a, b) => a.localeCompare(b));
                const coursePage = this.getPaginatedItems(courseItems, 'manageCourses');

                courseListManage.innerHTML = coursePage.items.map(courseName => {
                    const count = this.schedules.filter(s => s.courseYear === courseName).length;
                    return `
                        <div class="manage-item">
                            <div>
                                <div class="manage-item-title">${courseName}</div>
                                <div class="manage-item-subtext">${count} schedule${count === 1 ? '' : 's'}</div>
                            </div>
                            <div class="manage-actions">
                                <button type="button" class="edit-btn" onclick="manager.handleEditCourse('${courseName.replace(/'/g, "\\'")}')">Edit</button>
                                <button type="button" class="delete-btn" onclick="manager.handleDeleteCourse('${courseName.replace(/'/g, "\\'")}')">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('');
                courseListManage.insertAdjacentHTML(
                    'beforeend',
                    this.renderPagination('manageCourses', coursePage.totalItems)
                );
            }
        }
    }

    async handleEditTeacher(oldName) {
        const newNameRaw = await this.openActionModal({ title: 'Rename teacher', message: 'Enter a new name for this teacher.', value: oldName, confirmLabel: 'Save changes' });
        const newName = newNameRaw ? newNameRaw.trim().toUpperCase() : '';
        if (!newName) return;
        if (this.teachers.some(t => t.toLowerCase() === newName.toLowerCase() && t !== oldName)) {
            return this.showNotification('A teacher with that name already exists.', 'error');
        }
        const index = this.teachers.findIndex(t => t === oldName);
        if (index === -1) return;
        if (!(await this.updateRemoteListName('teachers', oldName, newName, 'teacher_name'))) return;
        this.teachers[index] = newName;
        this.schedules = this.schedules.map(s => s.teacherName === oldName ? { ...s, teacherName: newName } : s);
        this.saveTeachers();
        this.saveSchedules();
        this.render();
        this.showNotification('Teacher name updated.', 'success');
    }

    async handleDeleteTeacher(name) {
        const related = this.schedules.filter(s => s.teacherName === name).length;
        if (related > 0) {
            const cascade = await this.openActionModal({ mode: 'confirm', title: 'Delete teacher and schedules?', message: `${name} has ${related} schedule(s). They will also be removed.`, confirmLabel: 'Delete all' });
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete teacher.', 'error');
        } else {
            if (!await this.openActionModal({ mode: 'confirm', title: 'Delete teacher?', message: `This will remove ${name}.`, confirmLabel: 'Delete' })) return;
        }
        if (this.remoteEnabled && this.supabase) {
            const ownerScope = this.ownerViewingUserId || this.currentUser?.id;
            let scheduleDelete = this.supabase.from('schedules').delete().eq('teacher_name', name);
            let teacherDelete = this.supabase.from('teachers').delete().eq('name', name);
            if (ownerScope) {
                scheduleDelete = scheduleDelete.eq('owner_id', ownerScope);
                teacherDelete = teacherDelete.eq('owner_id', ownerScope);
            }
            const { error: scheduleError } = await scheduleDelete;
            const { error: teacherError } = await teacherDelete;
            if (scheduleError || teacherError) return this.showNotification((scheduleError || teacherError).message || 'Unable to delete the teacher.', 'error');
        }
        this.schedules = this.schedules.filter(s => s.teacherName !== name);
        this.teachers = this.teachers.filter(t => t !== name);
        this.saveTeachers();
        this.saveSchedules();
        this.render();
        this.showNotification('Teacher deleted.', 'success');
    }

    async handleEditRoom(oldName) {
        const newNameRaw = await this.openActionModal({ title: 'Rename room', message: 'Enter a new room name.', value: oldName, confirmLabel: 'Save changes' });
        const newName = newNameRaw ? newNameRaw.trim().toUpperCase() : '';
        if (!newName) return;
        if (this.rooms.some(r => r.toLowerCase() === newName.toLowerCase() && r !== oldName)) {
            return this.showNotification('A room with that name already exists.', 'error');
        }
        const index = this.rooms.findIndex(r => r === oldName);
        if (index === -1) return;
        if (!(await this.updateRemoteListName('rooms', oldName, newName, 'room'))) return;
        if (this.roomDetails[oldName]) {
            this.roomDetails[newName] = this.roomDetails[oldName];
            delete this.roomDetails[oldName];
            this.saveListDetails('roomDetails', this.roomDetails);
        }
        this.rooms[index] = newName;
        this.schedules = this.schedules.map(s => s.room === oldName ? { ...s, room: newName } : s);
        this.saveRooms();
        this.saveSchedules();
        this.render();
        this.showNotification('Room name updated.', 'success');
    }

    async handleDeleteRoom(name) {
        const related = this.schedules.filter(s => s.room === name).length;
        if (related > 0) {
            const cascade = await this.openActionModal({ mode: 'confirm', title: 'Delete room and schedules?', message: `${name} is used in ${related} schedule(s). They will also be removed.`, confirmLabel: 'Delete all' });
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete room.', 'error');
        } else {
            if (!await this.openActionModal({ mode: 'confirm', title: 'Delete room?', message: `This will remove ${name}.`, confirmLabel: 'Delete' })) return;
        }
        if (this.remoteEnabled && this.supabase) {
            const ownerScope = this.ownerViewingUserId || this.currentUser?.id;
            let scheduleDelete = this.supabase.from('schedules').delete().eq('room', name);
            let roomDelete = this.supabase.from('rooms').delete().eq('name', name);
            if (ownerScope) {
                scheduleDelete = scheduleDelete.eq('owner_id', ownerScope);
                roomDelete = roomDelete.eq('owner_id', ownerScope);
            }
            const { error: scheduleError } = await scheduleDelete;
            const { error: roomError } = await roomDelete;
            if (scheduleError || roomError) return this.showNotification((scheduleError || roomError).message || 'Unable to delete the room.', 'error');
        }
        this.schedules = this.schedules.filter(s => s.room !== name);
        this.rooms = this.rooms.filter(r => r !== name);
        this.saveRooms();
        this.saveSchedules();
        this.render();
        this.showNotification('Room deleted.', 'success');
    }

    // Subject / Course edit/delete handlers
    async handleEditSubject(oldName) {
        const newNameRaw = await this.openActionModal({ title: 'Rename subject', message: 'Enter a new subject name.', value: oldName, confirmLabel: 'Save changes' });
        const newName = newNameRaw ? newNameRaw.trim().toUpperCase() : '';
        if (!newName) return;
        if (this.subjects.some(s => s.toLowerCase() === newName.toLowerCase() && s !== oldName)) {
            return this.showNotification('A subject with that name already exists.', 'error');
        }
        const index = this.subjects.findIndex(s => s === oldName);
        if (index === -1) return;
        if (!(await this.updateRemoteListName('subjects', oldName, newName, 'subject'))) return;
        if (this.subjectDetails[oldName]) {
            this.subjectDetails[newName] = this.subjectDetails[oldName];
            delete this.subjectDetails[oldName];
            this.saveListDetails('subjectDetails', this.subjectDetails);
        }
        this.subjects[index] = newName;
        this.schedules = this.schedules.map(s => s.subject === oldName ? { ...s, subject: newName } : s);
        this.saveSubjects();
        this.saveSchedules();
        this.ensureUniqueSubjectColors();
        this.render();
        this.showNotification('Subject updated.', 'success');
    }

    async handleDeleteSubject(name) {
        const related = this.schedules.filter(s => s.subject === name).length;
        if (related > 0) {
            const cascade = await this.openActionModal({ mode: 'confirm', title: 'Delete subject and schedules?', message: `${name} is used in ${related} schedule(s). They will also be removed.`, confirmLabel: 'Delete all' });
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete subject.', 'error');
        } else {
            if (!await this.openActionModal({ mode: 'confirm', title: 'Delete subject?', message: `This will remove ${name}.`, confirmLabel: 'Delete' })) return;
        }
        if (this.remoteEnabled && this.supabase) {
            const ownerScope = this.ownerViewingUserId || this.currentUser?.id;
            let scheduleDelete = this.supabase.from('schedules').delete().eq('subject', name);
            let subjectDelete = this.supabase.from('subjects').delete().eq('name', name);
            if (ownerScope) {
                scheduleDelete = scheduleDelete.eq('owner_id', ownerScope);
                subjectDelete = subjectDelete.eq('owner_id', ownerScope);
            }
            const { error: scheduleError } = await scheduleDelete;
            const { error: subjectError } = await subjectDelete;
            if (scheduleError || subjectError) return this.showNotification((scheduleError || subjectError).message || 'Unable to delete the subject.', 'error');
        }
        this.schedules = this.schedules.filter(s => s.subject !== name);
        this.subjects = this.subjects.filter(s => s !== name);
        this.saveSubjects();
        this.saveSchedules();
        this.ensureUniqueSubjectColors();
        this.render();
        this.showNotification('Subject deleted.', 'success');
    }

    async handleEditCourse(oldName) {
        const newNameRaw = await this.openActionModal({ title: 'Rename section', message: 'Enter a new course and year name.', value: oldName, confirmLabel: 'Save changes' });
        const newName = newNameRaw ? newNameRaw.trim().toUpperCase() : '';
        if (!newName) return;
        if (this.courses.some(c => c.toLowerCase() === newName.toLowerCase() && c !== oldName)) {
            return this.showNotification('A course with that name already exists.', 'error');
        }
        const index = this.courses.findIndex(c => c === oldName);
        if (index === -1) return;
        if (!(await this.updateRemoteListName('courses', oldName, newName, 'course_year'))) return;
        this.courses[index] = newName;
        this.schedules = this.schedules.map(s => s.courseYear === oldName ? { ...s, courseYear: newName } : s);
        this.saveCourses();
        this.saveSchedules();
        this.render();
        this.showNotification('Course updated.', 'success');
    }

    async updateRemoteListName(table, oldName, newName, scheduleColumn) {
        if (!this.remoteEnabled || !this.currentUser) return true;
        const ownerScope = this.ownerViewingUserId || this.currentUser.id;
        const { data: updatedRows, error: listError } = await this.supabase
            .from(table)
            .update({ name: newName })
            .ilike('name', oldName)
            .eq('owner_id', ownerScope)
            .select('id');
        if (listError) {
            this.showNotification('Could not save the renamed item.', 'error');
            return false;
        }
        if (!updatedRows?.length) {
            this.showNotification('Could not save the renamed item for this account.', 'error');
            return false;
        }
        const scheduleUpdate = this.supabase
            .from('schedules')
            .update({ [scheduleColumn]: newName })
            .ilike(scheduleColumn, oldName)
            .eq('owner_id', ownerScope);
        const { error: scheduleError } = await scheduleUpdate;
        if (scheduleError) {
            this.showNotification('The list was updated, but related schedules could not be synchronized.', 'error');
        }
        return true;
    }

    async handleDeleteCourse(name) {
        const related = this.schedules.filter(s => s.courseYear === name).length;
        if (related > 0) {
            const cascade = await this.openActionModal({ mode: 'confirm', title: 'Delete section and schedules?', message: `${name} is used in ${related} schedule(s). They will also be removed.`, confirmLabel: 'Delete all' });
            if (!cascade) return this.showNotification('Deletion cancelled. Remove schedules first to delete course.', 'error');
        } else {
            if (!await this.openActionModal({ mode: 'confirm', title: 'Delete section?', message: `This will remove ${name}.`, confirmLabel: 'Delete' })) return;
        }
        if (this.remoteEnabled && this.supabase) {
            const ownerScope = this.ownerViewingUserId || this.currentUser?.id;
            let scheduleDelete = this.supabase.from('schedules').delete().eq('course_year', name);
            let courseDelete = this.supabase.from('courses').delete().eq('name', name);
            if (ownerScope) {
                scheduleDelete = scheduleDelete.eq('owner_id', ownerScope);
                courseDelete = courseDelete.eq('owner_id', ownerScope);
            }
            const { error: scheduleError } = await scheduleDelete;
            const { error: courseError } = await courseDelete;
            if (scheduleError || courseError) return this.showNotification((scheduleError || courseError).message || 'Unable to delete the section.', 'error');
        }
        this.schedules = this.schedules.filter(s => s.courseYear !== name);
        this.courses = this.courses.filter(c => c !== name);
        this.saveCourses();
        this.saveSchedules();
        this.render();
        this.showNotification('Course deleted.', 'success');
    }

    switchView(e) {
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const viewType = e.target.dataset.view;
        document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
        const viewId = viewType === 'teacher' ? 'teacherView'
            : viewType === 'all' ? 'allView'
            : viewType === 'students' ? 'studentsView'
            : viewType === 'rooms' ? 'roomsView'
            : viewType === 'owner' ? 'ownerView'
            : 'manageView';
        if (viewType === 'owner' && !this.isOwner) {
            const fallback = document.querySelector('.toggle-btn[data-view="teacher"]');
            if (fallback) this.switchView({ target: fallback });
            return;
        }
        document.getElementById(viewId).classList.add('active');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.toggle('all-view-active', viewType === 'all' || viewType === 'students' || viewType === 'rooms');
            mainContent.classList.toggle('manage-view-active', viewType === 'manage');
        }
    }

    resetToMemberStartView() {
        this.ownerViewingUserId = null;
        window.ScheduleStudioOwnerNavigation.clearOwnerMode();
        document.querySelectorAll('.view-content').forEach(panel => panel.classList.remove('active'));
        document.getElementById('teacherView')?.classList.add('active');
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'teacher'));
        const mainContent = document.querySelector('.main-content');
        mainContent?.classList.remove('all-view-active', 'manage-view-active');
    }

    renderOwnerView() {
        const view = document.getElementById('ownerView');
        if (!view) return;
        if (!this.isOwner) {
            if (!this.ownerViewingUserId) {
                window.ScheduleStudioOwnerNavigation.setBackButtonVisible(false);
            }
            view.classList.remove('active');
            return;
        }
        if (!this.ownerViewingUserId) {
            window.ScheduleStudioOwnerNavigation.showOwnerDirectory();
        }
        const list = document.getElementById('ownerUsersList');
        const count = document.getElementById('ownerUserCount');
        if (!list) return;
        const profiles = Array.isArray(this.ownerProfiles) ? this.ownerProfiles : [];
        const directory = window.ScheduleStudioOwnerDirectory.renderOwnerDirectory({
            profiles,
            schedules: this.schedules,
            escapeHtml: value => this.escapeHtml(value)
        });
        if (count) count.textContent = directory.countText;
        if (!directory.accountCount) {
            list.innerHTML = directory.html;
            return;
        }
        list.classList.remove('hidden');
        const selectedPanel = document.getElementById('ownerSelectedPanel');
        if (selectedPanel) selectedPanel.classList.add('hidden');
        list.innerHTML = directory.html;
        return;
        if (this.ownerSelectedUserId) {
            const profile = profiles.find(p => p.id === this.ownerSelectedUserId);
            if (!profile) { this.ownerSelectedUserId = null; return this.renderOwnerView(); }
            list.classList.add('hidden');
            selected.classList.remove('hidden');
            document.getElementById('ownerSelectedName').textContent = profile.full_name || profile.email || 'User schedule';
            document.getElementById('ownerSelectedEmail').textContent = `${profile.email || ''}${profile.department && profile.department !== 'Unassigned' ? ` · ${profile.department}` : ''}`;
            const rows = this.schedules.filter(s => s.ownerId === profile.id);
            const target = document.getElementById('ownerSelectedSchedules');
            target.innerHTML = rows.length ? `<div class="owner-schedule-card"><div class="owner-schedule-meta">${rows.length} scheduled class${rows.length === 1 ? '' : 'es'}</div><table class="schedule-table full-table"><thead><tr><th>Subject</th><th>Teacher</th><th>Section</th><th>Day</th><th>Time</th><th>Room</th><th>Action</th></tr></thead><tbody>${rows.map(s => `<tr><td>${this.escapeHtml(s.subject)}</td><td>${this.escapeHtml(s.teacherName)}</td><td>${this.escapeHtml(s.courseYear)}</td><td>${this.escapeHtml(s.day)}</td><td>${this.formatTime(s.startTime)} - ${this.formatTime(s.endTime)}</td><td>${this.escapeHtml(s.room)}</td><td><button type="button" class="btn-action owner-edit-btn" onclick="manager.openOwnerEdit('${String(s.id).replace(/'/g, "\\'")}')">Edit</button> <button type="button" class="delete-btn" onclick="manager.deleteSchedule('${String(s.id).replace(/'/g, "\\'")}')">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-message">This user has not created a schedule yet.</p>';
            return;
        }
        list.classList.remove('hidden');
        selected.classList.add('hidden');
        if (!profiles.length) { list.innerHTML = '<p class="empty-message">No registered users found.</p>'; return; }
        list.innerHTML = profiles.map(profile => {
            const classes = this.schedules.filter(s => s.ownerId === profile.id).length;
            const role = profile.role || 'member';
            return `<button type="button" class="owner-user-card" onclick="manager.selectOwnerUser('${String(profile.id).replace(/'/g, "\\'")}')"><span class="owner-avatar">${this.escapeHtml((profile.full_name || profile.email || '?').slice(0, 1).toUpperCase())}</span><span class="owner-user-info"><strong>${this.escapeHtml(profile.full_name || 'Unnamed user')}</strong><small>${this.escapeHtml(profile.email || '')}</small></span><span class="owner-user-role">${this.escapeHtml(role)}</span><span class="owner-user-classes">${classes} class${classes === 1 ? '' : 'es'} <span>›</span></span></button>`;
        }).join('');
    }

    async loadOwnerCatalog(ownerId) {
        if (this.remoteEnabled && this.supabase && ownerId) {
            const fresh = { teachers: [], subjects: [], rooms: [], courses: [] };
            for (const table of Object.keys(fresh)) {
                const { data, error } = await CatalogDataService.selectCatalogRows(this.supabase, table, ownerId);
                if (!error && Array.isArray(data)) fresh[table] = data;
            }
            this.ownerCatalog[ownerId] = fresh;
        }
        const catalog = this.ownerCatalog?.[ownerId];
        if (!catalog) return;
        if (this.isOwner && this.ownerViewingUserId && this.ownerViewingUserId !== ownerId) return;
        this.teachers = catalog.teachers.map(row => String(row.name || '').toUpperCase()).filter(Boolean);
        this.subjects = catalog.subjects.map(row => String(row.name || '').toUpperCase()).filter(Boolean);
        this.courses = catalog.courses.map(row => String(row.name || '').toUpperCase()).filter(Boolean);
        this.rooms = catalog.rooms.map(row => String(row.name || '').toUpperCase()).filter(Boolean);
        this.subjectDetails = {};
        catalog.subjects.forEach(row => {
            const name = String(row.name || '').toUpperCase();
            this.subjectDetails[name] = {
                courseCode: String(row.course_code || '').toUpperCase(),
                units: Number(row.units) || 0,
                lecHours: Number(row.lec_hours) || 0,
                labHours: Number(row.lab_hours) || 0,
                delivery: String(row.delivery || '').toLowerCase()
            };
        });
        this.roomDetails = {};
        catalog.rooms.forEach(row => { this.roomDetails[String(row.name || '').toUpperCase()] = { building: String(row.building || '').toUpperCase() }; });
        this.buildings = Array.from(new Set(catalog.rooms.map(row => String(row.building || '').toUpperCase()).filter(Boolean)));
        this.ensureUniqueSubjectColors();
        this.renderTeacherOptions(); this.renderSubjectOptions(); this.renderCourseOptions(); this.renderClassSectionOptions(); this.renderBuildingOptions(); this.renderRoomOptions(); this.renderRoomBuildingOptions(); this.renderSectionScheduleOptions();
    }

    async selectOwnerUser(id) {
        if (!this.isOwner) return;
        const requestId = ++this.ownerRequestId;
        this.ownerSelectedUserId = id;
        this.ownerViewingUserId = id;
        sessionStorage.setItem('scheduleStudioOwnerUser', id);
        // Clear immediately: a selected user's workspace must never briefly
        // render records belonging to the previously selected user.
        this.schedules = [];

        await this.loadOwnerCatalog(id);
        await this.loadSchedulePeriods(id);
        if (requestId !== this.ownerRequestId || this.ownerViewingUserId !== id) return;
        this.restoreSessionActiveSchedulePeriod(id);
        if (this.activeSchedulePeriod) {
            await this.refreshSchedulesForActivePeriod();
            if (requestId !== this.ownerRequestId || this.ownerViewingUserId !== id) return;
        }
        window.ScheduleStudioOwnerNavigation.showSelectedUserWorkspace({
            showBackButton: true
        });
        this.render();
        this.renderTeacherOptions(); this.renderSubjectOptions(); this.renderCourseOptions(); this.renderClassSectionOptions(); this.renderBuildingOptions(); this.renderRoomOptions();
    }

    exitOwnerUserView() {
        if (!this.isOwner) return;
        this.ownerRequestId++;
        this.schedules = [];
        this.ownerViewingUserId = null;
        this.ownerSelectedUserId = null;
        this.loadOwnerCatalog(this.currentUser?.id);
        sessionStorage.removeItem('scheduleStudioOwnerUser');
        window.ScheduleStudioOwnerNavigation.showOwnerDirectory({
            resetViews: true
        });
        this.render();
        // Rebuild the owner overview from the authoritative remote scope.
        this.syncFromRemote();
    }

    openOwnerEdit(id) {
        this.openScheduleEdit(id);
    }

    openScheduleEdit(id) {
        const schedule = this.schedules.find(s => String(s.id) === String(id));
        if (!schedule) return;
        this.editingCombinedClassId = schedule.combinedClassId || null;
        const set = (field, value) => { const el = document.getElementById(field); if (el) el.value = value || ''; };
        const teacherSelect = document.getElementById('ownerEditTeacher');
        const subjectSelect = document.getElementById('ownerEditSubject');
        if (teacherSelect) teacherSelect.innerHTML = '<option value="">-- Select Teacher --</option>' + this.teachers.slice().sort((a, b) => a.localeCompare(b)).map(teacher => `<option value="${this.escapeHtml(teacher)}">${this.escapeHtml(teacher)}</option>`).join('');
        if (subjectSelect) subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>' + this.subjects.slice().sort((a, b) => a.localeCompare(b)).map(subject => `<option value="${this.escapeHtml(subject)}">${this.escapeHtml(subject)}</option>`).join('');
        const parsed = this.parseCourseYear(schedule.courseYear);
        const section = schedule.section || parsed?.section || '';
        const buildingSelect = document.getElementById('ownerEditBuilding');
        if (buildingSelect) {
            const buildings = [...new Set([...this.buildings, schedule.building].filter(Boolean))].sort((a, b) => a.localeCompare(b));
            buildingSelect.innerHTML = '<option value="">-- Select Building --</option>' + buildings.map(building => `<option value="${this.escapeHtml(building)}">${this.escapeHtml(building)}</option>`).join('');
        }
        const sectionInput = document.getElementById('ownerEditSection');
        if (sectionInput) sectionInput.disabled = Boolean(this.editingCombinedClassId);
        set('ownerEditId', schedule.id); set('ownerEditTerm', schedule.term || '1st semester'); set('ownerEditTeacher', schedule.teacherName); set('ownerEditSubject', schedule.subject); set('ownerEditSection', section); set('ownerEditDay', schedule.day); set('ownerEditStart', schedule.startTime); set('ownerEditEnd', schedule.endTime); set('ownerEditBuilding', schedule.building); this.renderEditRoomOptions(schedule.room);
        this.showEditMessage(this.editingCombinedClassId ? 'This is a combined class. Shared details are updated for every participating section.' : '');
        const modal = document.getElementById('ownerEditModal');
        modal?.classList.remove('hidden');
        modal?.setAttribute('aria-hidden', 'false');
    }

    showEditMessage(message) {
        const element = document.getElementById('ownerEditMessage');
        if (!element) return;
        element.textContent = message;
        element.classList.toggle('visible', Boolean(message));
    }

    renderEditRoomOptions(selectedRoom = document.getElementById('ownerEditRoom')?.value || '') {
        const select = document.getElementById('ownerEditRoom');
        if (!select) return;
        const building = document.getElementById('ownerEditBuilding')?.value || '';
        const rooms = this.rooms.filter(room => !building || (this.roomDetails[room] || {}).building === building).sort((a, b) => a.localeCompare(b));
        select.innerHTML = '<option value="">-- Select Room --</option>' + rooms.map(room => `<option value="${this.escapeHtml(room)}">${this.escapeHtml(room)}</option>`).join('');
        if (rooms.includes(selectedRoom)) select.value = selectedRoom;
    }

    closeOwnerEdit() {
        this.editingCombinedClassId = null;
        document.getElementById('ownerEditSection')?.removeAttribute('disabled');
        const modal = document.getElementById('ownerEditModal');
        modal?.classList.add('hidden');
        modal?.setAttribute('aria-hidden', 'true');
    }

    async saveOwnerEdit(event) {
        event.preventDefault();
        const id = document.getElementById('ownerEditId').value;
        const existing = this.schedules.find(s => String(s.id) === String(id));
        if (!existing) return;
        const selectedSection = document.getElementById('ownerEditSection').value;
        const parsedCourse = this.parseCourseYear(existing.courseYear);
        const courseYear = parsedCourse ? `${parsedCourse.program} - ${parsedCourse.year}${selectedSection}` : existing.courseYear;
        const updated = { ...existing, term: document.getElementById('ownerEditTerm').value, teacherName: document.getElementById('ownerEditTeacher').value, subject: document.getElementById('ownerEditSubject').value, courseYear, program: parsedCourse?.program || existing.program, year: parsedCourse?.year || existing.year, section: selectedSection || existing.section, day: document.getElementById('ownerEditDay').value, startTime: document.getElementById('ownerEditStart').value, endTime: document.getElementById('ownerEditEnd').value, building: document.getElementById('ownerEditBuilding').value, room: document.getElementById('ownerEditRoom').value };
        const validation = this.validateSchedule(updated);
        if (validation) return this.showEditMessage(validation);
        const group = this.editingCombinedClassId
            ? this.schedules.filter(item =>
                item.combinedClassId === this.editingCombinedClassId &&
                this.getMeetingOccurrenceKey(item) ===
                    this.getMeetingOccurrenceKey(existing)
            )
            : [existing];
        const groupIds = group.map(item => item.id);
        const conflicts = group.flatMap(item => {
            const row = this.editingCombinedClassId
                ? { ...item, term: updated.term, teacherName: updated.teacherName, subject: updated.subject, day: updated.day, startTime: updated.startTime, endTime: updated.endTime, building: updated.building, room: updated.room }
                : updated;
            return this.checkConflicts(row, null, [], groupIds).conflicts;
        });
        if (conflicts.length) return this.showEditMessage(`The edited class conflicts with another schedule: ${conflicts.map(item => item.message).join(' ')}`);
        if (this.remoteEnabled) {
            const changes = { term: updated.term, teacher_name: updated.teacherName, subject: updated.subject, day: updated.day, start_time: updated.startTime, end_time: updated.endTime, building: updated.building || null, room: updated.room };
            if (!this.editingCombinedClassId) changes.course_year = updated.courseYear;
            let updateQuery = this.supabase.from('schedules').update(changes);
            updateQuery = this.editingCombinedClassId
                ? updateQuery.in('id', groupIds)
                : updateQuery.eq('id', existing.id);
            updateQuery = updateQuery.eq('owner_id', existing.ownerId || this.currentUser?.id);
            const { error } = await updateQuery;
            if (error) return this.showEditMessage(error.message || 'Unable to update schedule.');
        }
        group.forEach(item => Object.assign(item, this.editingCombinedClassId ? { term: updated.term, teacherName: updated.teacherName, subject: updated.subject, day: updated.day, startTime: updated.startTime, endTime: updated.endTime, building: updated.building, room: updated.room } : updated)); this.saveSchedules(); this.closeOwnerEdit(); this.render(); this.showNotification(this.editingCombinedClassId ? 'Combined class updated.' : 'Schedule updated.', 'success');
    }

    showTeacherSchedule(teacherName, term = null) {
        const teacherSchedules = this.getTeacherSchedules(teacherName, term);

        // mark modal with current teacher for use by print/export actions
        const modal = document.getElementById('teacherScheduleModal');
        if (modal) {
            modal.dataset.teacher = teacherName;
            modal.dataset.room = '';
            modal.dataset.term = term || '';
        }
        if (modal) modal.dataset.section = '';
        document.getElementById('viewLoadBtn')?.classList.remove('hidden');
        document.getElementById('viewSectionOfficialModalBtn')?.classList.add('hidden');

        // Determine days to display: default Mon-Fri, include Saturday only if teacher has classes there
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const teacherDays = new Set(teacherSchedules.map(s => s.day));
        const daysToShow = allDays.filter(d => d !== 'Saturday').filter(d => true);
        if (teacherDays.has('Saturday')) daysToShow.push('Saturday');

        // Determine display end time: show until 5pm unless teacher has classes after 5pm
        const latestEndMin = teacherSchedules.reduce((max, s) => Math.max(max, this.timeToMinutes(s.endTime)), 0);
        const defaultEnd = 17 * 60; // 5:00 PM
        const maxAllowedEnd = 21 * 60; // 9:00 PM
        let displayEnd = defaultEnd;
        if (latestEndMin > defaultEnd) displayEnd = Math.min(latestEndMin, maxAllowedEnd);

        const slots = this.generateTimeSlots().filter(slot => this.timeToMinutes(slot.start) < displayEnd);
        const grid = this.buildScheduleGrid(teacherSchedules, daysToShow, slots, 'teacher');

        document.getElementById('modalTeacherName').textContent = `${teacherName} — ${this.formatTerm(term)} — Plotted Schedule`;
        document.getElementById('scheduleGridContainer').innerHTML = grid;
        document.getElementById('teacherScheduleModal')?.classList.remove('hidden');
        document.getElementById('teacherScheduleModal')?.setAttribute('aria-hidden', 'false');
    }

    showSectionSchedule(sectionName, term = null) {
        const sectionSchedules = this.schedules.filter(s => (s.courseYear || '').toLowerCase() === sectionName.toLowerCase() && (term === null || (term ? this.sameTerm(s.term, term) : !s.term)));
        if (!sectionSchedules.length) return this.showNotification('No schedules found for this section.', 'error');
        const modal = document.getElementById('teacherScheduleModal');
        if (modal) { modal.dataset.teacher = ''; modal.dataset.room = ''; modal.dataset.section = sectionName; modal.dataset.term = term || ''; }
        document.getElementById('viewLoadBtn')?.classList.add('hidden');
        document.getElementById('viewSectionOfficialModalBtn')?.classList.remove('hidden');
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const daysToShow = allDays.filter(d => d !== 'Saturday' || sectionSchedules.some(s => s.day === d));
        const latestEndMin = sectionSchedules.reduce((max, s) => Math.max(max, this.timeToMinutes(s.endTime)), 0);
        const displayEnd = Math.min(Math.max(17 * 60, latestEndMin), 21 * 60);
        const slots = this.generateTimeSlots().filter(slot => this.timeToMinutes(slot.start) < displayEnd);
        const grid = this.buildScheduleGrid(sectionSchedules, daysToShow, slots, 'section');
        document.getElementById('modalTeacherName').textContent = `${sectionName} — Student Timetable`;
        document.getElementById('scheduleGridContainer').innerHTML = grid;
        document.getElementById('teacherScheduleModal')?.classList.remove('hidden');
        document.getElementById('teacherScheduleModal')?.setAttribute('aria-hidden', 'false');
    }

    showRoomSchedule(roomName, term = null) {
        const roomSchedules = this.schedules.filter(s => (s.room || '').toLowerCase() === roomName.toLowerCase() && (term === null || (term ? this.sameTerm(s.term, term) : !s.term)));
        if (!roomSchedules.length) return this.showNotification('No schedules found for this room.', 'error');
        const modal = document.getElementById('teacherScheduleModal');
        if (modal) { modal.dataset.teacher = ''; modal.dataset.section = ''; modal.dataset.room = roomName; modal.dataset.term = term || ''; }
        document.getElementById('viewLoadBtn')?.classList.add('hidden');
        document.getElementById('viewSectionOfficialModalBtn')?.classList.add('hidden');
        const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const daysToShow = allDays.filter(day => day !== 'Saturday' || roomSchedules.some(s => s.day === day));
        const latestEndMin = roomSchedules.reduce((max, s) => Math.max(max, this.timeToMinutes(s.endTime)), 0);
        const displayEnd = Math.min(Math.max(17 * 60, latestEndMin), 21 * 60);
        const slots = this.generateTimeSlots().filter(slot => this.timeToMinutes(slot.start) < displayEnd);
        document.getElementById('modalTeacherName').textContent = `${roomName} — Room Timetable`;
        document.getElementById('scheduleGridContainer').innerHTML = this.buildScheduleGrid(roomSchedules, daysToShow, slots, 'room');
        document.getElementById('teacherScheduleModal')?.classList.remove('hidden');
        document.getElementById('teacherScheduleModal')?.setAttribute('aria-hidden', 'false');
    }

    formatOfficialProgramSection(sectionName) {
        const original = String(sectionName || '').trim();
        const normalized = original.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const match = normalized.match(/^(BSCE|BSEE|BSME|BSCPE)(\d+)(IRREGULAR|[A-Z])?$/);
        if (!match) return original;
        const programs = {
            BSCE: 'BACHELOR OF SCIENCE IN CIVIL ENGINEERING',
            BSEE: 'BACHELOR OF SCIENCE IN ELECTRICAL ENGINEERING',
            BSME: 'BACHELOR OF SCIENCE IN MECHANICAL ENGINEERING',
            BSCPE: 'BACHELOR OF SCIENCE IN COMPUTER ENGINEERING'
        };
        const ordinals = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD', 4: 'FOURTH', 5: 'FIFTH', 6: 'SIXTH' };
        const year = Number.parseInt(match[2], 10);
        const yearName = ordinals[year] || `${year}TH`;
        const section = match[3] || 'A';
        return section === 'IRREGULAR'
            ? `${programs[match[1]]} ${yearName} YEAR - IRREGULAR`
            : `${programs[match[1]]} ${yearName} YEAR - SECTION ${section}`;
    }

    generateSectionOfficialElement(sectionName, term = null) {
        const schedules = this.schedules.filter(s => (s.courseYear || '').toLowerCase() === sectionName.toLowerCase() && (term === null || (term ? this.sameTerm(s.term, term) : !s.term)));
        const latestEndMin = schedules.reduce((max, s) => Math.max(max, this.timeToMinutes(s.endTime)), 0);
        const displayEnd = Math.min(Math.max(18 * 60, latestEndMin), 21 * 60);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const slots = this.generateTimeSlots().filter(slot => this.timeToMinutes(slot.start) < displayEnd);
        const grid = this.buildScheduleGrid(schedules, days, slots, 'section');
        const officialSectionName = this.formatOfficialProgramSection(sectionName);
        const container = document.createElement('div');
        container.className = 'section-official-pdf';
        container.style.fontFamily = '"Times New Roman", Times, serif';
        container.style.padding = '16px';
        container.style.color = '#111';
        container.style.background = '#fff';
        container.style.width = '1160px';
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; width:650px; max-width:100%; margin:0 auto 10px;">
                <img src="assets/CSAP-LOGO.png" style="width:70px; height:70px; object-fit:contain;">
                <div style="flex:1; text-align:center; font-size:12px; line-height:1.35;">
                    <div>COLEGIO DE SAN ANTONIO DE PADUA</div>
                    <div>SUPERVISED BY THE LASALLIAN SCHOOL SUPERVISION OFFICE</div>
                    <div>RAMON M. DURANO FOUNDATION COMPOUND</div>
                    <div>GUINSAY, DANAO CITY</div>
                </div>
                <img src="assets/logo.png" style="width:70px; height:70px; object-fit:contain;">
            </div>
            <div style="text-align:center; font-size:16px; font-weight:700; margin:4px 0 2px;">COLLEGE OF ENGINEERING</div>
            <div style="text-align:center; font-size:14px; margin-bottom:8px;">${this.formatTerm(term).toUpperCase()} ${this.escapeHtml(this.getCurrentSchoolYear())}</div>
            <div class="section-official-title-row">
                <div class="section-official-title">${this.escapeHtml(officialSectionName)}</div>
                <!-- Class Adviser temporarily omitted until adviser management is implemented. -->
            </div>
            <div class="section-official-grid">${grid}</div>
            <div style="display:flex; justify-content:space-between; margin-top:18px; font-size:11px;">
                <div><div>Prepared by:</div><strong>Engr. Shem Jay M. Tariao, MEng.Ed</strong><br>Program Chair, BSEE</div>
                <div><div>Noted By:</div><strong>Engr. Emmanuel M. Nadela, MEng.Ed</strong><br>DEAN, College of Engineering</div>
                <div><div>Approved By:</div><strong>Dr. Alberto A. Jumao-As Jr.</strong><br>VP, Academic Affairs &amp; Research</div>
            </div>
        `;
        return container;
    }

    viewSectionOfficialPdf(sectionName, term = null) {
        const schedules = this.schedules.filter(s => (s.courseYear || '').toLowerCase() === sectionName.toLowerCase() && (term === null || (term ? this.sameTerm(s.term, term) : !s.term)));
        if (!schedules.length) return this.showNotification('No schedules found for this section.', 'error');
        const element = this.generateSectionOfficialElement(sectionName, term);
        document.body.appendChild(element);
        this.createPdfFromElement(element, { orientation: 'landscape', format: 'a4' }).then(pdf => {
            const url = URL.createObjectURL(pdf.output('blob'));
            const win = window.open(url, '_blank');
            if (!win) this.showNotification('Popup blocked. Please allow popups.', 'error');
        }).catch(error => this.showNotification('Failed to generate official PDF: ' + error.message, 'error'))
          .finally(() => { if (element.parentNode) element.parentNode.removeChild(element); });
    }

    pdfFilename(value) {
        return String(value || 'schedule').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() + '.pdf';
    }

    downloadCurrentPdf() {
        const modal = document.getElementById('teacherScheduleModal');
        const section = modal?.dataset?.section || '';
        const teacher = modal?.dataset?.teacher || '';
        const room = modal?.dataset?.room || '';
        const term = modal?.dataset?.term || null;
        const element = section ? this.generateSectionOfficialElement(section, term) : document.getElementById('scheduleGridContainer')?.cloneNode(true);
        if (!element) return this.showNotification('Schedule not available to download.', 'error');
        if (!section) {
            element.style.background = '#fff';
            element.style.padding = '16px';
            const heading = document.createElement('div');
            heading.style.cssText = 'text-align:center; color:#111; font-family:Arial, Helvetica, sans-serif; font-size:18px; font-weight:700; margin-bottom:16px;';
            heading.textContent = room ? `${room} ASSIGNMENT`.toUpperCase() : teacher ? `${teacher} - ${this.formatTerm(term)} Schedule` : 'Teacher Schedule';
            element.prepend(heading);
        }
        document.body.appendChild(element);
        this.createPdfFromElement(element, section ? { orientation: 'landscape', format: 'a4' } : {}).then(pdf => {
            const schoolYear = this.getCurrentSchoolYear();
            const label = section ? `${section}-${this.formatTerm(term)}-${schoolYear}-student-schedule` : room ? `${room}-${this.formatTerm(term)}-${schoolYear}-assignment` : `${teacher}-${this.formatTerm(term)}-${schoolYear}-teacher-schedule`;
            pdf.save(this.pdfFilename(label));
            this.showNotification('PDF downloaded.', 'success');
        }).catch(error => this.showNotification('Failed to download PDF: ' + error.message, 'error'))
          .finally(() => { if (element.parentNode) element.parentNode.removeChild(element); });
    }

    hideTeacherSchedule() {
        const modal = document.getElementById('teacherScheduleModal');
        modal?.classList.add('hidden');
        modal?.setAttribute('aria-hidden', 'true');
    }

    generateTimeSlots() {
        const slots = [];
        let minutes = 7 * 60;
        // generate 30-min slots from 7:00 up to 21:00 (9:00 PM)
        while (minutes < 21 * 60) {
            const startH = Math.floor(minutes / 60);
            const startM = minutes % 60;
            const endMinutes = minutes + 30;
            const endH = Math.floor(endMinutes / 60);
            const endM = endMinutes % 60;
            const format = (h, m) => `${((h + 11) % 12) + 1}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
            const label = `${format(startH, startM)} - ${format(endH, endM)}`;
            slots.push({
                start: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
                end: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
                label
            });
            minutes += 30;
        }
        return slots;
    }

    buildScheduleGrid(schedules, days, slots, audience = 'teacher') {
        // Build a grid that merges consecutive slots into a single cell using rowspan
        // Prepare a map for each day with slot placeholders
        const slotCount = slots.length;
        const dayCells = {};
        days.forEach(day => {
            dayCells[day] = new Array(slotCount).fill(null);
        });

        // A combined class is stored as one row per section. Collapse those
        // sibling rows before placing cells so later rows cannot overwrite
        // the same time/day cell.
        const gridSchedules = audience === 'section'
            ? schedules
            : this.getLogicalScheduleRows(schedules);

        // For each logical schedule, compute start index and span (number of slots)
        gridSchedules.forEach(schedule => {
            const day = schedule.day;
            if (!dayCells[day]) return; // skip days not displayed
            const scheduleStart = this.timeToMinutes(schedule.startTime);
            const scheduleEnd = this.timeToMinutes(schedule.endTime);
            // find first slot index where slot.end > scheduleStart
            let startIdx = slots.findIndex(slot => this.timeToMinutes(slot.end) > scheduleStart);
            if (startIdx === -1) return;
            // find last slot index where slot.start < scheduleEnd
            let endIdx = -1;
            for (let i = startIdx; i < slots.length; i++) {
                if (this.timeToMinutes(slots[i].start) < scheduleEnd) endIdx = i;
                else break;
            }
            if (endIdx === -1) return;
            const span = endIdx - startIdx + 1;
            // compute colors now and bake into the cell to avoid later lookup issues
            const bg = this.getColorForSubject(schedule.subject);
            const fg = this.getTextColorForBg(bg);
            const building = schedule.building || ((this.roomDetails[schedule.room] || {}).building) || '';
            const delivery =
                String(schedule.delivery || '').trim().toLowerCase();
            const componentLabel =
                delivery === 'lec' ? 'LEC' :
                delivery === 'lab' ? 'LAB' :
                '';
            const content = `
                <div class="cell-content">
                    <div class="subject">${schedule.subject}${componentLabel ? ` — ${componentLabel}` : ''}</div>
                    <div class="section">${audience === 'section' ? schedule.teacherName : (schedule.displayCourseYear || schedule.courseYear)}</div>
                    ${building ? `<div class="building">${building}</div>` : ''}
                    <div class="room">${schedule.room}</div>
                </div>
            `;
            // Place content at startIdx and mark following indices as skipped
            dayCells[day][startIdx] = { content, span, id: schedule.id, styleAttr: ` style="background:${bg}; color:${fg};"` };
            for (let k = startIdx + 1; k <= endIdx; k++) {
                dayCells[day][k] = { skip: true };
            }
        });

        const headerRow = ['<tr><th>Time</th>' + days.map(day => `<th>${day}</th>`).join('') + '</tr>'];
        const rows = [];
        for (let rowIdx = 0; rowIdx < slots.length; rowIdx++) {
            const cols = days.map(day => {
                const cell = dayCells[day][rowIdx];
                if (!cell) return '<td></td>';
                if (cell.skip) return '';
                const rowspanAttr = cell.span && cell.span > 1 ? ` rowspan="${cell.span}"` : '';
                const styleAttr = cell.styleAttr || '';
                return `<td${rowspanAttr}${styleAttr}>${cell.content}</td>`;
            }).join('');
            rows.push(`<tr><td class="slot-label">${slots[rowIdx].label}</td>${cols}</tr>`);
        }

        return `
            <div class="schedule-grid-wrapper">
                <table class="schedule-grid">
                    ${headerRow.join('')}
                    ${rows.join('')}
                </table>
            </div>
        `;
    }

    // Create a jsPDF instance from the schedule HTML element
    createPdfFromElement(element, options = {}) {
        return new Promise((resolve, reject) => {
            if (!element) return reject(new Error('No element to render'));
            if (typeof html2canvas === 'undefined') return reject(new Error('html2canvas is not loaded'));

            let jsPDFClass = null;
            if (window.jspdf && window.jspdf.jsPDF) jsPDFClass = window.jspdf.jsPDF;
            else if (window.jspdf && window.jspdf.default && window.jspdf.default.jsPDF) jsPDFClass = window.jspdf.default.jsPDF;
            else if (window.jsPDF) jsPDFClass = window.jsPDF;

            if (!jsPDFClass) return reject(new Error('jsPDF is not loaded'));

            // Clone element and expand it so html2canvas renders the full content (not only the scrolled viewport)
            const clone = element.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = element.scrollWidth + 'px';
            clone.style.height = 'auto';
            clone.style.overflow = 'visible';
            document.body.appendChild(clone);
            html2canvas(clone, { scale: 2, scrollY: -window.scrollY }).then(canvas => {
                try {
                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDFClass({
                        orientation: options.orientation || 'portrait',
                        unit: 'pt',
                        // All generated PDFs use A4 paper; orientation is selected per document.
                        format: options.format || 'a4'
                    });
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();

                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = Math.min((pageWidth - 40) / imgWidth, (pageHeight - 40) / imgHeight);
                    const renderWidth = imgWidth * ratio;
                    const renderHeight = imgHeight * ratio;
                    const x = (pageWidth - renderWidth) / 2;
                    const y = 20;

                    pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
                    // cleanup
                    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                    resolve(pdf);
                } catch (err) {
                    if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                    reject(err);
                }
            }).catch(err => {
                if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
                reject(err);
            });
        });
    }

    // Open the plotted schedule as a PDF in a new tab/window
    viewSchedulePdf() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to export.', 'error');
        const modal = document.getElementById('teacherScheduleModal');
        const teacher = modal?.dataset?.teacher || '';
        const room = modal?.dataset?.room || '';
        const term = modal?.dataset?.term || null;
        const exportContainer = container.cloneNode(true);
        exportContainer.style.background = '#fff';
        exportContainer.style.padding = '16px';
        exportContainer.style.width = `${container.scrollWidth || 1000}px`;
        const heading = document.createElement('div');
        heading.style.cssText = 'text-align:center; color:#111; font-family:Arial, Helvetica, sans-serif; font-size:18px; font-weight:700; margin-bottom:16px;';
        heading.textContent = room ? `${room} ASSIGNMENT`.toUpperCase() : teacher ? `${teacher} - ${this.formatTerm(term)} Schedule` : 'Teacher Schedule';
        exportContainer.prepend(heading);
        document.body.appendChild(exportContainer);
        this.createPdfFromElement(exportContainer).then(pdf => {
            try {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (!win) {
                    this.showNotification('Popup blocked. Please allow popups or try printing instead.', 'error');
                }
            } catch (err) {
                this.showNotification('Failed to open PDF: ' + err.message, 'error');
            } finally {
                exportContainer.remove();
            }
        }).catch(err => {
            exportContainer.remove();
            this.showNotification('Failed to generate PDF: ' + err.message, 'error');
        });
    }

    // Generate PDF and trigger print dialog
    printSchedule() {
        const container = document.getElementById('scheduleGridContainer');
        if (!container) return this.showNotification('Schedule not available to print.', 'error');
        this.createPdfFromElement(container).then(pdf => {
            try {
                const url = pdf.output('bloburl');
                const w = window.open(url);
                if (!w) return this.showNotification('Unable to open print window (popup blocked).', 'error');
                // give the window time to load before printing
                setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 700);
            } catch (err) {
                this.showNotification('Failed to print PDF: ' + err.message, 'error');
            }
        }).catch(err => this.showNotification('Failed to generate PDF: ' + err.message, 'error'));
    }

    // Build a standalone element representing the teacher's load (landscape A4 style)
    generateTeacherLoadElement(teacherName, term = null) {
        const schedules = this.getTeacherSchedules(teacherName, term).slice().sort((a,b) => {
            const dayOrder = { 'Monday':1,'Tuesday':2,'Wednesday':3,'Thursday':4,'Friday':5,'Saturday':6 };
            const d = (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0);
            if (d !== 0) return d;
            if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
            return a.courseYear.localeCompare(b.courseYear);
        });
        const termLabel = term === '1st semester' ? '1<sup>st</sup> Semester'
            : term === '2nd semester' ? '2<sup>nd</sup> Semester'
                : term === 'summer' ? 'Summer'
                    : 'Term Not Specified';

        const container = document.createElement('div');
        container.className = 'teacher-load-pdf';
        container.style.fontFamily = 'Arial, Helvetica, sans-serif';
        container.style.padding = '18px';
        container.style.color = '#222';
        container.style.background = '#fff';
        container.style.width = '1000px';

        // Header styled to match the official instructor-load form.
        const header = `
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:0 auto 22px; width:500px; max-width:100%;">
                <div style="flex:0 0 72px; display:flex; justify-content:center; align-items:center;">
                    <img src="assets/CSAP-LOGO.png" style="width:68px; height:68px; object-fit:contain;">
                </div>
                <div style="flex:0 1 340px; min-width:0; text-align:center; padding:0 2px; color:#666; font-size:14px; line-height:1.18;">
                    <div>Colegio de San Antonio de Padua, Inc.</div>
                    <div>Supervised by Lasallian School Supervision Office</div>
                    <div>Ramon M. Durano, Foundation Compound</div>
                    <div>Guinsay, Danao City</div>
                </div>
                <div style="flex:0 0 72px; display:flex; justify-content:center; align-items:center;">
                    <img src="assets/logo.png" style="width:68px; height:68px; object-fit:contain;">
                </div>
            </div>

            <div style="text-align:center; margin-bottom:18px; color:#000; line-height:1.18;">
                <div style="font-size:14px; font-weight:700;">COLLEGE OF ENGINEERING</div>
                <div style="font-size:14px; font-weight:700;">INSTRUCTOR'S LOAD</div>
                <div style="font-size:12px; font-weight:700; margin-top:3px;">School Year: ${this.escapeHtml(this.getCurrentSchoolYear())} (${termLabel})</div>
            </div>
        `;

        const getUnits = (schedule) => {
        const parsed = Number.parseInt(schedule.units, 10);
        return Number.isFinite(parsed) ? parsed : 3;
    };

    const normalizeLoadKeyPart = (value) => String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();

    const getMeetingMinutes = (schedule) => {
        const start = this.timeToMinutes(schedule.startTime);
        const end = this.timeToMinutes(schedule.endTime);

        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return 0;
        }

        return end - start;
    };

    const isLaboratory = (schedule) => {

        const courseCode = normalizeLoadKeyPart(schedule.courseCode);
        const subjectName = normalizeLoadKeyPart(schedule.subject);

        if (/\bLAB(?:ORATORY)?\b/.test(courseCode)) {
            return true;
        }
        if (/\bLAB(?:ORATORY)?\b/.test(subjectName)) {
            return true;
        }
        const delivery = String(schedule.delivery || '')
            .trim()
            .toLowerCase();

        if (delivery === 'lab') {
            return true;
        }

        if (delivery === 'lec') {
            return false;
        }

        const labHours = Number(schedule.labHours) || 0;
        const lecHours = Number(schedule.lecHours) || 0;

        if (labHours > 0 && lecHours === 0) {
            return true;
        }

        if (lecHours > 0 && labHours === 0) {
            return false;
        }
        const units = getUnits(schedule);
        const meetingMinutes = getMeetingMinutes(schedule);

        if (units > 0 && meetingMinutes > 0) {
            const expectedLabMinutes = units * 3 * 60;

            if (meetingMinutes === expectedLabMinutes) {
                return true;
            }
        }

        // If none of the LAB rules matched, treat it as lecture.
        return false;
    };

    const getTeachingHours = (schedule) => {
        const units = getUnits(schedule);

        return isLaboratory(schedule)
            ? units * 3
            : units;
    };

        const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        
        const loadGroups = new Map();
        schedules.forEach(schedule => {
            const sectionIdentity = String(schedule.courseYear || '').trim().toLowerCase();
            // Keep lecture and laboratory variants separate even when their descriptive titles match.
            // Combined-class rows are section-level storage records for one
            // teaching assignment. They must contribute one load row and one
            // set of units, while standalone rows remain section-specific.
            const classIdentity = schedule.combinedClassId
                ? `combined:${schedule.combinedClassId}`
                : `section:${sectionIdentity}`;
            // combined_class_id is the full identity for a logical combined
            // assignment; program-specific course codes must not split it.
            const key = schedule.combinedClassId
                ? `${classIdentity}|||${isLaboratory(schedule) ? 'lab' : 'lec'}`
                : `${String(schedule.courseCode || schedule.subject || '').trim().toLowerCase()}|||${classIdentity}|||${isLaboratory(schedule) ? 'lab' : 'lec'}`;
            if (!loadGroups.has(key)) loadGroups.set(key, { schedule, meetings: [], sections: new Set() });
            const group = loadGroups.get(key);
            group.meetings.push(schedule);
            if (schedule.courseYear) group.sections.add(schedule.courseYear);
        });

        const loadEntries = [...loadGroups.values()].sort((a, b) => {
            const firstA = a.meetings.slice().sort((x, y) => (dayOrder[x.day] || 0) - (dayOrder[y.day] || 0) || x.startTime.localeCompare(y.startTime))[0];
            const firstB = b.meetings.slice().sort((x, y) => (dayOrder[x.day] || 0) - (dayOrder[y.day] || 0) || x.startTime.localeCompare(y.startTime))[0];
            return (dayOrder[firstA.day] || 0) - (dayOrder[firstB.day] || 0) || firstA.startTime.localeCompare(firstB.startTime) || firstA.courseYear.localeCompare(firstB.courseYear);
        });

        // Build one teaching-load row per subject/course-section, combining its weekly meetings.
        const rows = loadEntries.map(({ schedule, meetings, sections }) => {
            const units = getUnits(schedule);
            const teachingHours = getTeachingHours(schedule);
            const orderedMeetings = meetings.slice().sort((a, b) => (dayOrder[a.day] || 0) - (dayOrder[b.day] || 0) || a.startTime.localeCompare(b.startTime));
            const uniqueTimes = [];
            const seenTimes = new Set();

            orderedMeetings.forEach(item => {
                const time = `${this.formatTime(item.startTime)} - ${this.formatTime(item.endTime)}`;

                if (!seenTimes.has(time)) {
                    seenTimes.add(time);
                    uniqueTimes.push(time);
                }
            });

            const timeStr = uniqueTimes.join('<br>');
            const days = orderedMeetings.map(item => item.day).filter((day, index, values) => values.indexOf(day) === index).join(', ');
            const buildings = orderedMeetings.map(item => item.building || '').filter((value, index, values) => value && values.indexOf(value) === index).join('<br>');
            const rooms = orderedMeetings.map(item => item.room || '').filter((value, index, values) => value && values.indexOf(value) === index).join('<br>');
            const courseCode = schedule.combinedClassId
                ? meetings
                    .filter(item => String(item.courseCode || '').trim())
                    .slice()
                    .sort((a, b) =>
                        String(a.courseYear || '').localeCompare(String(b.courseYear || '')) ||
                        String(a.courseCode || '').localeCompare(String(b.courseCode || ''))
                    )[0]?.courseCode || ''
                : [...new Set(meetings.map(item => item.courseCode).filter(Boolean))].join(' / ');

            return `<tr>
                <td style="border:1px solid #000; padding:6px;">${this.escapeHtml(courseCode)}</td>
                <td style="border:1px solid #000; padding:6px;">${this.escapeHtml((this.formatDescriptiveTitle(schedule.subject)))}</td>
                <td style="border:1px solid #000; padding:6px;">${this.escapeHtml([...sections].sort((a, b) => a.localeCompare(b)).join(' + '))}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${units}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${teachingHours}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;"></td>
                <td style="border:1px solid #000; padding:6px;">${timeStr}</td>
                <td style="border:1px solid #000; padding:6px; text-align:center;">${this.escapeHtml(days)}</td>
                <td style="border:1px solid #000; padding:6px;">${this.escapeHtml(buildings).replace(/\n/g, '<br>')}</td>
                <td style="border:1px solid #000; padding:6px;">${this.escapeHtml(rooms).replace(/\n/g, '<br>')}</td>
            </tr>`;
        }).join('');

        // Totals count each course-section once, regardless of how many weekly meetings it has.
        const totalUnits = loadEntries.reduce((sum, entry) => sum + getUnits(entry.schedule), 0);
        const totalHours = loadEntries.reduce((sum, entry) => sum + getTeachingHours(entry.schedule), 0);
        const regularLoad = Math.min(totalUnits, 24);
        const overloadUnits = Math.max(totalUnits - 24, 0);

        const table = `
            <div style="margin-top:10px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                    <div style="flex:1;">
                        <div><strong>Name of Instructor</strong> &nbsp;&nbsp;&nbsp;&nbsp;: ${teacherName}</div>
                        <div style="margin-top:6px;"><strong>Effective Date</strong> &nbsp;&nbsp;&nbsp;&nbsp;: </div>
                    </div>
                    <div style="width:320px; text-align:right;">
                        <div><strong>Regular Teaching Load</strong> &nbsp;&nbsp;: ${regularLoad}</div>
                        <div style="margin-top:6px;"><strong>Overload</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${overloadUnits}</div>
                    </div>
                </div>

                <table style="border-collapse:collapse; width:100%; font-size:12px;">
                    <thead>
                        <tr>
                            <th style="border:1px solid #000; padding:6px;">Course Code</th>
                            <th style="border:1px solid #000; padding:6px;">Descriptive Title</th>
                            <th style="border:1px solid #000; padding:6px;">Section and Year</th>
                            <th style="border:1px solid #000; padding:6px;">Units</th>
                            <th style="border:1px solid #000; padding:6px;">No. of Hours</th>
                            <th style="border:1px solid #000; padding:6px;">Overload</th>
                            <th style="border:1px solid #000; padding:6px;">Time</th>
                            <th style="border:1px solid #000; padding:6px;">Days</th>
                            <th style="border:1px solid #000; padding:6px;">BLDG</th>
                            <th style="border:1px solid #000; padding:6px;">Room</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                        <tr>
                            <td colspan="3" style="border:1px solid #000; padding:6px; text-align:right;"><strong>TOTAL</strong></td>
                            <td style="border:1px solid #000; padding:6px; text-align:center;"><strong>${totalUnits}</strong></td>
                            <td style="border:1px solid #000; padding:6px; text-align:center;"><strong>${totalHours}</strong></td>
                            <td colspan="5" style="border:1px solid #000; padding:6px;"></td>
                        </tr>
                    </tbody>
                </table>

                <!-- Signature / footer block -->
                <div style="display:flex; justify-content:space-between; margin-top:28px; font-size:11px;">
                    <div style="width:28%; text-align:left;">
                        <div style="margin-bottom:24px;">Conformed by:</div>
                        <div style="margin-bottom:3px; display:inline-block; border-bottom:1px solid #000; width:64%; padding-bottom:3px;">&nbsp;</div>
                        <div style="margin-top:3px; font-style:italic;">Instructor</div>
                    </div>
                    <div style="width:28%; text-align:center;">
                        <div style="margin-bottom:24px;">Prepared by:</div>
                        <div style="margin-bottom:3px; display:inline-block; border-bottom:1px solid #000; width:68%; padding-bottom:3px;">ENGR. SHEM JAY M. TARIAO</div>
                        <div style="margin-top:3px; font-size:11px;">&nbsp;</div>
                    </div>
                    <div style="width:28%; text-align:center;">
                        <div style="margin-bottom:24px;">Recommending Approval</div>
                        <div style="margin-bottom:3px; display:inline-block; border-bottom:1px solid #000; width:68%; padding-bottom:3px;">DR. ALBERTO A. JUMAO-AS JR.</div>
                        <div style="margin-top:3px; font-size:11px;">VP Academics and Research</div>
                    </div>
                </div>

                <div style="display:flex; justify-content:center; gap:100px; margin-top:26px; font-size:11px;">
                    <div style="width:34%; min-width:240px; text-align:center;">
                        <div style="margin-bottom:24px;">Reviewed by:</div>
                        <div style="margin-bottom:3px; display:inline-block; border-bottom:1px solid #000; width:86%; padding-bottom:3px;">ENGR. EMMANUEL M. NADELA</div>
                        <div style="margin-top:3px; font-size:11px;">Department Dean</div>
                    </div>
                    <div style="width:34%; min-width:240px; text-align:center;">
                        <div style="margin-bottom:24px;">Approved by:</div>
                        <div style="margin-bottom:3px; display:inline-block; border-bottom:1px solid #000; width:86%; padding-bottom:3px;">DR. GENESA P. PARAGADOS</div>
                        <div style="margin-top:3px; font-size:11px;">President</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = header + table;
        return container;
    }

    // View the teacher load as PDF in a new tab
    viewTeacherLoadPdf() {
        const modal = document.getElementById('teacherScheduleModal');
        const teacher = modal && modal.dataset ? modal.dataset.teacher : null;
        const term = modal && modal.dataset ? modal.dataset.term || null : null;
        if (!teacher) return this.showNotification('No teacher selected to export.', 'error');
        const el = this.generateTeacherLoadElement(teacher, term);
        document.body.appendChild(el);
        this.createPdfFromElement(el, { orientation: 'landscape', format: 'a4' }).then(pdf => {
            try {
                const blob = pdf.output('blob');
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (!win) this.showNotification('Popup blocked. Please allow popups or try printing instead.', 'error');
            } catch (err) {
                this.showNotification('Failed to open PDF: ' + err.message, 'error');
            } finally {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }
        }).catch(err => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            this.showNotification('Failed to generate PDF: ' + err.message, 'error');
        });
    }

    // Generate PDF for teacher load and open print dialog
    printTeacherLoad() {
        const modal = document.getElementById('teacherScheduleModal');
        const teacher = modal && modal.dataset ? modal.dataset.teacher : null;
        const term = modal && modal.dataset ? modal.dataset.term || null : null;
        if (!teacher) return this.showNotification('No teacher selected to print.', 'error');
        const el = this.generateTeacherLoadElement(teacher, term);
        document.body.appendChild(el);
        this.createPdfFromElement(el, { orientation: 'landscape', format: 'a4' }).then(pdf => {
            try {
                const url = pdf.output('bloburl');
                const w = window.open(url);
                if (!w) return this.showNotification('Unable to open print window (popup blocked).', 'error');
                setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* ignore */ } }, 700);
            } catch (err) {
                this.showNotification('Failed to print PDF: ' + err.message, 'error');
            } finally {
                if (el && el.parentNode) el.parentNode.removeChild(el);
            }
        }).catch(err => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
            this.showNotification('Failed to generate PDF: ' + err.message, 'error');
        });
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(x => parseInt(x, 10));
        return hours * 60 + minutes;
    }

    createLocalScheduleId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        if (!notification) return;
        if (this.notificationTimer) window.clearTimeout(this.notificationTimer);
        notification.textContent = message;
        notification.className = `notification ${type}`;
        if (type === 'success') {
            this.notificationTimer = window.setTimeout(() => {
                notification.className = 'notification';
                notification.textContent = '';
                this.notificationTimer = null;
            }, 3500);
        }
    }

    storageKey(key) { return this.currentUser?.id ? `${key}:${this.currentUser.id}` : key; }
    loadUserLocalData() {
        this.schedules = this.loadSchedules();
        this.teachers = this.loadTeachers();
        this.rooms = this.loadRooms();
        this.subjects = this.loadSubjects();
        this.courses = this.loadCourses();
        this.buildings = this.loadBuildings();
        this.subjectDetails = this.loadListDetails('subjectDetails');
        this.roomDetails = this.loadListDetails('roomDetails');
        this.buildings = Array.from(new Set([...this.buildings, ...Object.values(this.roomDetails).map(info => info && info.building).filter(Boolean)]));
        this.subjectColors = this.loadSubjectColors();
        this.ensureUniqueSubjectColors();
    }
    saveSchedules() { localStorage.setItem(this.storageKey('schedules'), JSON.stringify(this.schedules)); }
    loadArray(key) {
        try {
            const value = JSON.parse(localStorage.getItem(this.storageKey(key)) || '[]');
            return Array.isArray(value) ? value : [];
        } catch (error) {
            console.warn(`Ignoring invalid saved ${key} data.`, error);
            return [];
        }
    }
    loadSchedules() { return this.loadArray('schedules'); }

    // Migrate older stored schedules using `sectionYear` to `courseYear`
    migrateSchedules() {
        let changed = false;
        this.schedules = this.schedules.map(s => {
            if (s && s.sectionYear && !s.courseYear) {
                s.courseYear = s.sectionYear;
                delete s.sectionYear;
                changed = true;
            }
            const parsed = this.parseCourseYear(s.courseYear);
            if (parsed && (!s.program || !s.year || !s.section)) {
                Object.assign(s, parsed);
                changed = true;
            }
            return s;
        });
        if (changed) this.saveSchedules();
    }

        normalizeProgram(program) {
        const normalized = String(program || '').trim().toUpperCase();

        const programMap = {
            BSCE: 'BSCE',
            BSEE: 'BSEE',
            BSME: 'BSME',
            BSCPE: 'BSCpE'
        };

        return programMap[normalized] || String(program || '').trim();
    }

    parseCourseYear(value) {
        const normalized = String(value || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');

        const match = normalized.match(
            /^(BSCE|BSEE|BSME|BSCPE)(\d+)(IRREGULAR|[A-Z])$/
        );

        if (!match) return null;

        return {
            program: this.normalizeProgram(match[1]),
            year: Number.parseInt(match[2], 10),
            section: match[3]
        };
    }

    getSubjectEquivalencyKey(subject, program = '') {
        const normalizedSubject = String(subject || '')
            .trim()
            .toUpperCase();

        const normalizedProgram = this.normalizeProgram(program);

        const equivalentSubjects = new Set([
            'ART APPRECIATION',
            'ETHICS',
            'READINGS IN PHILIPPINE HISTORY',
            'ENGINEERING DATA ANALYSIS',
            'PATHFIT 1',
            'PATHFIT 2',
            'PATHFIT 3',
            'PATHFIT 4',
            'NSTP 1',
            'NSTP 2',
            'TECHNICAL WRITING'
        ]);

        if (equivalentSubjects.has(normalizedSubject)) {
            return `COMMON:${normalizedSubject}`;
        }

        return `${normalizedProgram}:${normalizedSubject}`;
    }

    getCurriculumComponentKey(entry) {
        if (!entry) return '';

        return JSON.stringify([
            this.normalizeProgram(entry.program).toLowerCase(),
            String(entry.name || '').trim().toLowerCase(),
            String(entry.code || entry.courseCode || '').trim().toLowerCase(),
            String(entry.delivery || '').trim().toLowerCase()
        ]);
    }

    getCurriculumOptionKey(entry) {
        if (!entry) return '';

        return JSON.stringify([
            this.normalizeProgram(entry.program).toLowerCase(),
            String(entry.year ?? '').trim(),
            String(entry.term || '').trim().toLowerCase(),
            String(entry.name || '').trim().toLowerCase(),
            String(entry.code || entry.courseCode || '').trim().toLowerCase(),
            String(entry.delivery || '').trim().toLowerCase(),
            Number(entry.lecHours) || 0,
            Number(entry.labHours) || 0,
            Number(entry.units) || 0
        ]);
    }

    getCurriculumEntryForComponent(entry, candidates) {
        if (!entry || !Array.isArray(candidates)) return null;

        const normalizedName =
            String(entry.name || '').trim().toLowerCase();
        const normalizedCode =
            String(entry.code || entry.courseCode || '').trim().toLowerCase();
        const normalizedDelivery =
            String(entry.delivery || '').trim().toLowerCase();

        const sameName = candidates.filter(candidate =>
            String(candidate.name || '').trim().toLowerCase() === normalizedName
        );

        if (normalizedCode) {
            const exactMatches = sameName.filter(candidate =>
                String(candidate.code || candidate.courseCode || '')
                    .trim()
                    .toLowerCase() === normalizedCode &&
                (!normalizedDelivery ||
                    !String(candidate.delivery || '').trim() ||
                    String(candidate.delivery || '').trim().toLowerCase() ===
                        normalizedDelivery)
            );

            if (exactMatches.length) {
                const exactDeliveries = new Set(exactMatches.map(candidate =>
                    String(candidate.delivery || '').trim().toLowerCase()
                ));

                return exactDeliveries.size === 1
                    ? exactMatches[0]
                    : null;
            }
        }

        if (normalizedDelivery) {
            const deliveryMatches = sameName.filter(candidate =>
                String(candidate.delivery || '').trim().toLowerCase() ===
                    normalizedDelivery
            );
            const distinctCodes = new Set(deliveryMatches.map(candidate =>
                String(candidate.code || candidate.courseCode || '')
                    .trim()
                    .toLowerCase()
            ));

            return distinctCodes.size === 1
                ? deliveryMatches[0] || null
                : null;
        }

        return sameName.length === 1 ? sameName[0] : null;
    }

    getSubjectRequiredWeeklyMinutes(subject, program = '', component = null) {
        const normalizedSubject =
            String(subject || '').trim().toLowerCase();

        const normalizedProgram =
            this.normalizeProgram(program);

        const matchingEntries = this.curriculumCatalog.filter(item =>
            String(item.name || '').trim().toLowerCase() ===
                normalizedSubject &&
            (!normalizedProgram ||
                this.normalizeProgram(item.program) === normalizedProgram)
        );
        const entry = component
            ? matchingEntries.find(item =>
                this.getCurriculumOptionKey(item) ===
                    this.getCurriculumOptionKey(component)
            ) || this.getCurriculumEntryForComponent(
                component,
                matchingEntries
            )
            : matchingEntries[0];

        if (!entry) {
            return 0;
        }

        return this.getCurriculumEntryRequiredWeeklyMinutes(entry);
    }

    getCurriculumEntryRequiredWeeklyMinutes(entry) {
        if (!entry) return 0;
        const lecHours = Number(entry.lecHours) || 0;
        const labHours = Number(entry.labHours) || 0;
        // Lecture: 1 curriculum hour = 1 actual scheduled hour.
        // Laboratory: 1 lab unit/hour entry = 3 actual scheduled hours.
        return (lecHours * 60) + (labHours * 3 * 60);
    }

    isScheduleForCurriculumComponent(schedule, courseYear, entry) {
        if (!entry) return true;

        const scheduleCode =
            String(schedule.courseCode || '').trim().toLowerCase();
        const entryCode =
            String(entry.code || entry.courseCode || '').trim().toLowerCase();
        const entryDelivery =
            String(entry.delivery || '').trim().toLowerCase();
        const scheduleDelivery =
            String(schedule.delivery || '').trim().toLowerCase();

        if (scheduleCode && entryCode && scheduleCode === entryCode) {
            return !scheduleDelivery ||
                !entryDelivery ||
                scheduleDelivery === entryDelivery;
        }

        let inferredDelivery =
            scheduleDelivery === 'lec' || scheduleDelivery === 'lab'
                ? scheduleDelivery
                : '';

        if (!inferredDelivery && /\bLAB(?:ORATORY)?\b/i.test(scheduleCode)) {
            inferredDelivery = 'lab';
        } else if (!inferredDelivery && /\bLEC(?:TURE)?\b/i.test(scheduleCode)) {
            inferredDelivery = 'lec';
        }

        if (!inferredDelivery) {
            const labHours = Number(schedule.labHours) || 0;
            const lecHours = Number(schedule.lecHours) || 0;

            if (labHours > 0 && lecHours === 0) {
                inferredDelivery = 'lab';
            } else if (lecHours > 0 && labHours === 0) {
                inferredDelivery = 'lec';
            }
        }

        if (inferredDelivery && entryDelivery) {
            return inferredDelivery === entryDelivery;
        }

        const [program, yearWithSection] =
            String(courseYear).split(' - ');
        const yearMatch =
            String(yearWithSection || '').match(/^(\d+)/);
        const matchingEntries = this.curriculumCatalog.filter(item =>
            String(item.name || '').trim().toLowerCase() ===
                String(entry.name || '').trim().toLowerCase() &&
            this.normalizeProgram(item.program) ===
                this.normalizeProgram(program) &&
            (!yearMatch || String(item.year) === yearMatch[1])
        );
        const distinctComponents = new Set(matchingEntries.map(item =>
            JSON.stringify([
                String(item.code || item.courseCode || '').trim().toLowerCase(),
                String(item.delivery || '').trim().toLowerCase()
            ])
        ));

        return distinctComponents.size === 1;
    }

    getSectionSubjectScheduledMinutes(courseYear, subject, component = null) {
        if (!courseYear || !subject || !this.activeSchedulePeriod) {
            return 0;
        }

        const normalizedCourseYear =
            String(courseYear).trim().toLowerCase();

        const normalizedSubject =
            String(subject).trim().toLowerCase();

        return this.schedules
            .filter(schedule =>
                schedule.schedulePeriodId ===
                this.activeSchedulePeriod.id
            )
            .filter(schedule =>
                String(schedule.courseYear || '')
                    .trim()
                    .toLowerCase() === normalizedCourseYear
            )
            .filter(schedule =>
                String(schedule.subject || '')
                    .trim()
                    .toLowerCase() === normalizedSubject
            )
            .filter(schedule =>
                this.isScheduleForCurriculumComponent(
                    schedule,
                    courseYear,
                    component
                )
            )
            .reduce((total, schedule) => {
                const start =
                    this.timeToMinutes(schedule.startTime);

                const end =
                    this.timeToMinutes(schedule.endTime);

                if (
                    !Number.isFinite(start) ||
                    !Number.isFinite(end) ||
                    end <= start
                ) {
                    return total;
                }

                return total + (end - start);
            }, 0);
    }

    getTeacherDistinctSubjects(teacherName) {
        const normalizedTeacher = String(teacherName || '')
            .trim()
            .toUpperCase();

        if (!normalizedTeacher || !this.activeSchedulePeriod) {
            return [];
        }

        const subjectKeys = new Set();
        const processedCombinedClasses = new Set();

        this.schedules
            .filter(schedule =>
                String(schedule.teacherName || '')
                    .trim()
                    .toUpperCase() === normalizedTeacher
            )
            .filter(schedule =>
                schedule.schedulePeriodId ===
                this.activeSchedulePeriod.id
            )
            .forEach(schedule => {
                if (schedule.combinedClassId) {
                    if (processedCombinedClasses.has(schedule.combinedClassId)) return;
                    processedCombinedClasses.add(schedule.combinedClassId);
                    subjectKeys.add(
                        `COMBINED:${String(schedule.subject || '')
                            .trim()
                            .toUpperCase()}`
                    );
                    return;
                }
                const key = this.getSubjectEquivalencyKey(
                    schedule.subject,
                    schedule.program
                );

                subjectKeys.add(key);
            });

        return Array.from(subjectKeys);
    }

    canTeacherTakeSubject(teacherName, subject, program = '') {
        const existingSubjectKeys =
            this.getTeacherDistinctSubjects(teacherName);

        const newSubjectKey =
            this.getSubjectEquivalencyKey(subject, program);

        const combinedSubjectKey =
            `COMBINED:${String(subject).trim().toUpperCase()}`;

        if (existingSubjectKeys.includes(newSubjectKey) ||
            existingSubjectKeys.includes(combinedSubjectKey)) {
            return {
                allowed: true,
                isNewSubject: false,
                subjectCount: existingSubjectKeys.length
            };
        }

        // A new distinct subject would be added.
        if (existingSubjectKeys.length >= 6) {
            return {
                allowed: false,
                isNewSubject: true,
                subjectCount: existingSubjectKeys.length
            };
        }

        return {
            allowed: true,
            isNewSubject: true,
            subjectCount: existingSubjectKeys.length + 1
        };
    }

    normalizeCourseYear(value) {
        const parsed = this.parseCourseYear(value);

        if (parsed) {
            return `${parsed.program} - ${parsed.year}${parsed.section}`;
        }

        return String(value || '').trim();
    }

    getCourseYear(schedule) {
        if (schedule.program && schedule.year && schedule.section) {
            return `${this.normalizeProgram(schedule.program)} - ${schedule.year}${schedule.section}`;
        }

        return this.normalizeCourseYear(schedule.courseYear);
    }

    // teachers & rooms
    saveTeachers() { localStorage.setItem(this.storageKey('teachers'), JSON.stringify(this.teachers)); }
    loadTeachers() { return this.loadArray('teachers'); }
    saveRooms() { localStorage.setItem(this.storageKey('rooms'), JSON.stringify(this.rooms)); }
    loadRooms() { return this.loadArray('rooms'); }
    saveBuildings() { localStorage.setItem(this.storageKey('buildings'), JSON.stringify(this.buildings || [])); }
    loadBuildings() { return this.loadArray('buildings'); }

    // subjects & courses
    saveSubjects() { localStorage.setItem(this.storageKey('subjects'), JSON.stringify(this.subjects)); }
    loadSubjects() { return this.loadArray('subjects'); }
    saveCourses() { localStorage.setItem(this.storageKey('courses'), JSON.stringify(this.courses)); }
    loadCourses() { return this.loadArray('courses'); }
    saveListDetails(key, details) { localStorage.setItem(this.storageKey(key), JSON.stringify(details || {})); }
    loadListDetails(key) {
        try { return JSON.parse(localStorage.getItem(this.storageKey(key))) || {}; }
        catch (e) { return {}; }
    }
    getSchedulePeriodStorageKey(ownerId) {
        return `activeSchedulePeriod:${ownerId || 'unknown'}`;
    }
    getActivePeriodSessionKey(ownerId) {
        return `activeSchedulePeriodSession:${ownerId || 'unknown'}`;
    }
    loadSchoolYear() { return localStorage.getItem(this.storageKey('schoolYear')) || '2026 – 2027'; }
    saveSubjectColors() { localStorage.setItem(this.storageKey('subjectColors'), JSON.stringify(this.subjectColors || {})); }
    loadSubjectColors() {
        const d = localStorage.getItem(this.storageKey('subjectColors'));
        if (!d) return {};
        try {
            const parsed = JSON.parse(d) || {};
            const normalized = {};
            Object.keys(parsed).forEach(k => {
                const nk = k ? k.trim() : k;
                if (!(nk in normalized)) normalized[nk] = parsed[k];
            });
            return normalized;
        } catch (e) {
            return {};
        }
    }

    // color palette and assignment
    getColorForSubject(name) {
        if (!name) return null;
        const key = name.trim();
        if (!this.subjectColors) this.subjectColors = {};
        if (this.subjectColors[key]) return this.subjectColors[key];
        const palette = [
            '#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff','#ffadad','#bde0fe','#d0f4de'
        ];
        // deterministic assignment: hash name to palette index, but avoid duplicates
        let hash = 0;
        for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i);
        const preferredIdx = Math.abs(hash) % palette.length;
        const usedColors = Object.values(this.subjectColors || {});
        // prefer the hashed color if not used yet
        let color = palette[preferredIdx];
        if (usedColors.includes(color)) {
            // find first palette color that's not used
            const available = palette.find(c => !usedColors.includes(c));
            if (available) color = available;
            else {
                // palette exhausted; generate a distinct HSL-based color
                const hue = Math.abs(hash) % 360;
                color = (function(h,s,l){
                    s /= 100; l /= 100;
                    const k = n => (n + h/30) % 12;
                    const a = s * Math.min(l, 1 - l);
                    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
                    const r = Math.round(255 * f(0));
                    const g = Math.round(255 * f(8));
                    const b = Math.round(255 * f(4));
                    const toHex = v => v.toString(16).padStart(2, '0');
                    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                })(hue, 65, 75);
            }
        }
        this.subjectColors[key] = color;
        this.saveSubjectColors();
        return color;
    }

    // choose readable text color based on background
    getTextColorForBg(bg) {
        if (!bg) return '#000';
        // compute luminance
        const c = bg.replace('#','');
        const r = parseInt(c.substring(0,2),16);
        const g = parseInt(c.substring(2,4),16);
        const b = parseInt(c.substring(4,6),16);
        const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
        return luminance > 0.6 ? '#000' : '#fff';
    }

    // Ensure each distinct subject has a unique color assignment
    ensureUniqueSubjectColors() {
        if (!this.subjects) this.subjects = [];
        if (!this.subjectColors) this.subjectColors = this.loadSubjectColors() || {};
        const palette = [
            '#ffd6a5','#fdffb6','#caffbf','#9bf6ff','#a0c4ff','#bdb2ff','#ffc6ff','#ffadad','#bde0fe','#d0f4de'
        ];
        const used = new Set();
        // First pass: keep any existing mapping for subjects present, but mark used colors
        this.subjects.forEach(s => {
            const key = s ? s.trim() : s;
            const col = this.subjectColors[key];
            if (col && !used.has(col)) used.add(col);
        });
        // Second pass: assign colors to subjects missing a mapping or colliding
        // Iterate subjects in alphabetical order for determinism
        this.subjects.slice().sort((a,b)=>a.localeCompare(b)).forEach(s => {
            const key = s ? s.trim() : s;
            let col = this.subjectColors[key];
            if (!col || (col && Array.from(used).filter(c => c === col).length > 1)) {
                // find first palette color not yet used
                const avail = palette.find(c => !used.has(c));
                if (avail) {
                    col = avail;
                } else {
                    // generate HSL-based color using golden angle to spread hues
                    const hue = (used.size * 137.508) % 360;
                    const s_v = 65;
                    const l_v = 70;
                    const h = Math.round(hue);
                    // convert hsl to hex
                    const hex = (function(h,s,l){
                        s /= 100; l /= 100;
                        const c = (1 - Math.abs(2*l - 1)) * s;
                        const x = c * (1 - Math.abs((h/60)%2 - 1));
                        const m = l - c/2;
                        let r=0,g=0,b=0;
                        if (0<=h && h<60){ r=c; g=x; b=0; }
                        else if (60<=h && h<120){ r=x; g=c; b=0; }
                        else if (120<=h && h<180){ r=0; g=c; b=x; }
                        else if (180<=h && h<240){ r=0; g=x; b=c; }
                        else if (240<=h && h<300){ r=x; g=0; b=c; }
                        else { r=c; g=0; b=x; }
                        const toHex = v => Math.round((v + m)*255).toString(16).padStart(2,'0');
                        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                    })(h, s_v, l_v);
                    col = hex;
                }
                this.subjectColors[key] = col;
                used.add(col);
            } else {
                // existing mapping and unique — ensure marked used
                used.add(col);
            }
        });
        this.saveSubjectColors();
    }

    renderTeacherOptions() {
        const sel = document.getElementById('teacherSelect');
        if (!sel) return;
        sel.disabled = !this.term;
        sel.innerHTML = '<option value="">-- Select Teacher --</option>' + this.teachers.slice().sort((a,b)=>a.localeCompare(b)).map(t => `<option value="${t}">${t}</option>`).join('');
    }

    getSelectedClassSectionParts() {
        return this.selectedClassSections
            .map(value => {
                const match = String(value || '')
                    .trim()
                    .match(/^(.+ - \d+)([A-Z]+|IRREGULAR)$/i);

                if (!match) {
                    return null;
                }

                return {
                    courseYear: match[1].trim(),
                    section: match[2].toUpperCase()
                };
            })
            .filter(Boolean);
    }

    getCurriculumEntryForProgramSubject(
        subject,
        program,
        preferredYear = '',
        component = null
    ) {
        const normalizedSubject = String(subject || '').trim().toLowerCase();
        const normalizedProgram = this.normalizeProgram(program);
        const activeTerm = String(this.term || '').trim().toLowerCase();

        let entries = this.curriculumCatalog
            .filter(entry =>
                String(entry.name || '').trim().toLowerCase() === normalizedSubject &&
                this.normalizeProgram(entry.program) === normalizedProgram
            );

        if (component) {
            const componentCode =
                String(component.code || component.courseCode || '')
                    .trim()
                    .toLowerCase();
            const componentDelivery =
                String(component.delivery || '').trim().toLowerCase();
            let exactMatches = entries.filter(entry =>
                componentCode &&
                String(entry.code || entry.courseCode || '')
                    .trim()
                    .toLowerCase() === componentCode &&
                (!componentDelivery ||
                    !String(entry.delivery || '').trim() ||
                    String(entry.delivery || '').trim().toLowerCase() ===
                        componentDelivery)
            );
            const exactDeliveryTypes = new Set(exactMatches.map(entry =>
                String(entry.delivery || '').trim().toLowerCase()
            ));
            if (!componentDelivery && exactDeliveryTypes.size > 1) {
                exactMatches = [];
            }

            const exactYearMatches = exactMatches.filter(entry =>
                String(entry.year) === String(preferredYear)
            );
            const deliveryMatches = componentDelivery
                ? entries.filter(entry =>
                    String(entry.delivery || '').trim().toLowerCase() ===
                        componentDelivery
                )
                : [];
            const deliveryYearMatches = deliveryMatches.filter(entry =>
                String(entry.year) === String(preferredYear)
            );

            if (exactYearMatches.length) {
                entries = exactYearMatches;
            } else if (deliveryYearMatches.length) {
                entries = deliveryYearMatches;
            } else if (exactMatches.length) {
                entries = exactMatches;
            } else if (deliveryMatches.length) {
                entries = deliveryMatches;
            } else if (componentDelivery) {
                entries = [];
            } else {
                const distinctComponents = new Set(entries.map(entry =>
                    JSON.stringify([
                        String(entry.code || entry.courseCode || '')
                            .trim()
                            .toLowerCase(),
                        String(entry.delivery || '').trim().toLowerCase()
                    ])
                ));

                entries = distinctComponents.size === 1
                    ? entries
                    : [];
            }
        }

        return entries.sort((a, b) => {
            const score = entry =>
                (String(entry.year) === String(preferredYear) ? 2 : 0) +
                (String(entry.term || '').trim().toLowerCase() === activeTerm ? 1 : 0);
            const scoreDifference = score(b) - score(a);
            if (scoreDifference) return scoreDifference;

            return Number(a.year) - Number(b.year) ||
                String(a.term || '').localeCompare(String(b.term || '')) ||
                String(a.code || a.courseCode || '').localeCompare(
                    String(b.code || b.courseCode || '')
                );
        })[0] || null;
    }

    getCrossTermSubjectsForSelectedClassSections(query = '') {
        const selectedSections =
            this.getSelectedClassSectionParts();

        if (!selectedSections.length || !query.trim()) {
            return [];
        }

        const normalizedQuery =
            query
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');

        const matchingSubjects = new Map();

        this.curriculumCatalog.forEach(entry => {
            const subjectName =
                String(entry.name || '')
                    .trim();

            if (!subjectName) {
                return;
            }

            const normalizedName =
                subjectName.toLowerCase();

            const normalizedSearchName =
                `${subjectName} ${entry.code || ''}`
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '');

            if (!normalizedSearchName.includes(normalizedQuery)) {
                return;
            }

            if (!matchingSubjects.has(normalizedName)) {
                matchingSubjects.set(normalizedName, []);
            }

            matchingSubjects.get(normalizedName).push(entry);
        });

        const normalComponentKeys = new Set(
            this.getSubjectsForSelectedClassSections()
                .map(entry => this.getCurriculumComponentKey(entry))
        );
        const [firstProgram, firstYear] =
            selectedSections[0].courseYear.split(' - ');
        const normalizedFirstProgram =
            this.normalizeProgram(firstProgram);

        return [...matchingSubjects.entries()]
            .flatMap(([subjectName, matchingEntries]) => {
                const firstProgramEntries = this.curriculumCatalog.filter(entry =>
                    String(entry.name || '').trim().toLowerCase() === subjectName &&
                    this.normalizeProgram(entry.program) === normalizedFirstProgram
                );
                const componentKeys = new Set(firstProgramEntries.map(entry =>
                    this.getCurriculumComponentKey(entry)
                ));

                return [...componentKeys].map(componentKey => {
                    const template = firstProgramEntries.find(entry =>
                        this.getCurriculumComponentKey(entry) === componentKey
                    );
                    const entry = this.getCurriculumEntryForProgramSubject(
                        subjectName,
                        normalizedFirstProgram,
                        firstYear,
                        template
                    );

                    if (!entry || normalComponentKeys.has(componentKey)) {
                        return null;
                    }

                    const queryMatchesComponent = matchingEntries.some(match => {
                        if (
                            String(match.delivery || '').trim().toLowerCase() !==
                            String(entry.delivery || '').trim().toLowerCase()
                        ) {
                            return false;
                        }

                        return String(match.code || match.courseCode || '')
                            .trim()
                            .toLowerCase() ===
                                String(entry.code || entry.courseCode || '')
                                    .trim()
                                    .toLowerCase() ||
                            Boolean(this.getCurriculumEntryForProgramSubject(
                                subjectName,
                                match.program,
                                firstYear,
                                entry
                            ));
                    });

                    if (!queryMatchesComponent) {
                        return null;
                    }

                    const compatibleAcrossSections = selectedSections.every(section => {
                        const [program, year] =
                            section.courseYear.split(' - ');

                        return Boolean(this.getCurriculumEntryForProgramSubject(
                            subjectName,
                            program,
                            year,
                            entry
                        ));
                    });

                    return compatibleAcrossSections ? entry : null;
                });
            })
            .filter(Boolean)
            .sort((a, b) =>
                a.name.localeCompare(b.name)
            );
    }

    getSubjectsForSelectedClassSections() {
        const selectedSections =
            this.getSelectedClassSectionParts();

        if (!selectedSections.length) {
            return [];
        }

        const sectionPrograms = selectedSections
            .map(item => {
                const [program, year] =
                    item.courseYear.split(' - ');

                return {
                    program: this.normalizeProgram(program),
                    year: String(year).trim()
                };
            });

        const activeTerm =
            String(this.term || '')
                .trim()
                .toLowerCase();

        const firstSection = sectionPrograms[0];
        const optionKeys = [
            ...new Set(
                this.curriculumCatalog
                    .filter(entry =>
                        !activeTerm ||
                        String(entry.term || '')
                            .trim()
                            .toLowerCase() === activeTerm
                    )
                    .filter(entry =>
                        this.normalizeProgram(entry.program) ===
                            firstSection.program &&
                        String(entry.year) === firstSection.year
                    )
                    .map(entry => this.getCurriculumOptionKey(entry))
            )
        ];

        return optionKeys
            .map(optionKey => {
                const candidate = this.curriculumCatalog.find(entry =>
                    this.getCurriculumOptionKey(entry) === optionKey &&
                    (
                        !activeTerm ||
                        String(entry.term || '').trim().toLowerCase() === activeTerm
                    )
                );

                if (!candidate) return null;

                const entriesForAllSections =
                    sectionPrograms.map(section =>
                        this.curriculumCatalog.filter(entry =>
                            (
                                !activeTerm ||
                                String(entry.term || '')
                                    .trim()
                                    .toLowerCase() === activeTerm
                            ) &&
                            String(entry.name || '').trim().toLowerCase() ===
                                String(candidate.name || '').trim().toLowerCase() &&
                            this.normalizeProgram(entry.program) ===
                                section.program &&
                            String(entry.year) === section.year
                        )
                    );

                const existsForEverySection =
                    entriesForAllSections.every(
                        entries => entries.length > 0
                    );

                if (!existsForEverySection) {
                    return null;
                }

                const matchingEntries = entriesForAllSections.map(entries =>
                    this.getCurriculumEntryForComponent(candidate, entries)
                );

                if (matchingEntries.some(entry => !entry)) {
                    return null;
                }

                return matchingEntries[0];
            })
            .filter(Boolean)
            .sort((a, b) =>
                a.name.localeCompare(b.name)
            );
    }

    renderSubjectOptions(query = '') {
        const input =
            document.getElementById('subjectSelect');

        const list =
            document.getElementById('subjectOptions');

        if (!input || !list) return;

        const hasSelectedSections =
            Array.isArray(this.selectedClassSections) &&
            this.selectedClassSections.length > 0;

        input.disabled =
            !this.term ||
            !hasSelectedSections;

        if (!hasSelectedSections) {
            list.innerHTML =
                '<div class="subject-options-empty">' +
                'Select at least one class section first' +
                '</div>';

            this.updateSelectedSubjectDetails();
            return;
        }

        const normalizedQuery =
            query.trim().toLowerCase();

        const availableEntries =
            this.getSubjectsForSelectedClassSections();

        const visibleEntries =
            availableEntries.filter(entry =>
                (!normalizedQuery ||
                    `${entry.name} ${entry.code}`
                        .toLowerCase()
                        .includes(normalizedQuery)) &&
                !this.isSubjectFullyScheduledForSelectedSections(entry)
            );

        const crossTermEntries =
            this.getCrossTermSubjectsForSelectedClassSections(
                query
            ).filter(entry =>
                !this.isSubjectFullyScheduledForSelectedSections(entry)
            );

        const options =
            visibleEntries.map(entry => `
                <button
                    type="button"
                    class="subject-option"
                    role="option"
                    data-subject-value="${this.escapeHtml(entry.name)}"
                    data-curriculum-key="${this.escapeHtml(this.getCurriculumOptionKey(entry))}">

                    <strong>
                        ${this.escapeHtml(entry.name)}
                    </strong>

                    <span>
                        ${this.escapeHtml(entry.code)}
                        ·
                        ${this.escapeHtml(entry.delivery || 'Class')}
                    </span>
                </button>
            `).join('');

        const crossTermOptions =
            crossTermEntries.map(entry => `
                <button
                    type="button"
                    class="subject-option subject-option-exception"
                    role="option"
                    data-subject-value="${this.escapeHtml(entry.name)}"
                    data-curriculum-key="${this.escapeHtml(this.getCurriculumOptionKey(entry))}">

                    <strong>
                        ${this.escapeHtml(entry.name)}
                    </strong>

                    <span>
                        ${this.escapeHtml(entry.code)}
                        ·
                        Prospectus exception
                    </span>
                </button>
            `).join('');

        list.innerHTML =
            options + crossTermOptions ||
            '<div class="subject-options-empty">' +
            'No matching subjects' +
            '</div>';

        if (document.activeElement === input) {
            this.openSubjectOptions();
        }

        this.updateSelectedSubjectDetails();
    }

    openSubjectOptions() {
        const input = document.getElementById('subjectSelect');
        const list = document.getElementById('subjectOptions');
        if (!input || !list || input.disabled) return;
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    }

    closeSubjectOptions() {
        const input = document.getElementById('subjectSelect');
        const list = document.getElementById('subjectOptions');
        if (!input || !list) return;
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
    }

    isSubjectFullyScheduledForSelectedSections(entry) {
        const selectedSections = this.getSelectedClassSectionParts();
        if (!entry || !selectedSections.length) return false;

        return selectedSections.some(({ courseYear, section }) => {
            const [program, yearText] = courseYear.split(' - ');
            const normalizedProgram = this.normalizeProgram(program);
            const normalizedName = String(entry.name || '').trim().toLowerCase();
            const curriculumEntry =
                this.getCurriculumEntryForProgramSubject(
                    normalizedName,
                    normalizedProgram,
                    yearText,
                    entry
                );
            if (!curriculumEntry) return false;
            const required = this.getCurriculumEntryRequiredWeeklyMinutes(curriculumEntry);
            return required > 0 && this.getSectionSubjectScheduledMinutes(
                `${courseYear}${section}`,
                curriculumEntry.name,
                curriculumEntry
            ) >= required;
        });
    }

    getAvailableClassSections() {
        const sectionValues = ['A', 'B', 'C', 'IRREGULAR'];

        const courseYears = [
            ...new Set(
                this.curriculumCatalog
                    .filter(entry =>
                        !this.term ||
                        entry.term === this.term
                    )
                    .map(entry =>
                        `${entry.program} - ${entry.year}`
                    )
            )
        ].sort((a, b) => a.localeCompare(b));

        return courseYears.flatMap(courseYear =>
            sectionValues.map(section => ({
                value: `${courseYear}${section}`,
                courseYear,
                section
            }))
        );
    }

    renderClassSectionOptions() {
        const list =
            document.getElementById('classSectionOptions');

        const button =
            document.getElementById('classSectionSelect');

        const buttonText =
            document.getElementById('classSectionSelectText');

        if (!list || !button || !buttonText) return;

        const options = this.getAvailableClassSections();

        if (!options.length) {
            list.innerHTML = `
                <div class="subject-options-empty">
                    No class sections available
                </div>
            `;

            button.disabled = true;
            buttonText.textContent =
                '-- No Class Sections Available --';

            return;
        }

        button.disabled =
            !this.term ||
            !document.getElementById('teacherSelect')?.value;

        const searchQuery =
            String(this.classSectionSearchQuery || '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');

        const filteredOptions =
            options.filter(option => {
                const searchableText =
                    `${option.courseYear}${option.section}`
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '');

                return !searchQuery ||
                    searchableText.includes(searchQuery);
            });

        const groups = new Map();

        filteredOptions.forEach(option => {
            if (!groups.has(option.courseYear)) {
                groups.set(option.courseYear, []);
            }

            groups.get(option.courseYear).push(option);
        });

        const groupHtml = [...groups.entries()]
            .map(([courseYear, sections]) => `
                <div class="class-section-group">
                    <div class="class-section-group-title">
                        ${this.escapeHtml(courseYear)}
                    </div>

                    <div class="class-section-group-sections">
                        ${sections.map(option => `
                            <label class="class-section-option">
                                <input
                                    type="checkbox"
                                    value="${this.escapeHtml(option.value)}"
                                    data-course-year="${this.escapeHtml(option.courseYear)}"
                                    data-section="${this.escapeHtml(option.section)}"
                                    ${this.selectedClassSections.includes(option.value) ? 'checked' : ''}>
                                <span>
                                    ${this.escapeHtml(option.section)}
                                </span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `)
            .join('');

        list.innerHTML = `
            <div class="class-section-search">
                <input
                    type="text"
                    id="classSectionSearchInput"
                    placeholder="Search course, year, or section..."
                    value="${this.escapeHtml(this.classSectionSearchQuery || '')}"
                    autocomplete="off">
            </div>

            <div class="class-section-results">
                ${
                    groupHtml ||
                    `<div class="subject-options-empty">
                        No matching class sections
                    </div>`
                }
            </div>
        `;

        const searchInput =
            document.getElementById('classSectionSearchInput');

        searchInput?.addEventListener('input', event => {
            this.classSectionSearchQuery =
                event.target.value;

            this.renderClassSectionOptions();

            const newSearchInput =
                document.getElementById(
                    'classSectionSearchInput'
                );

            if (newSearchInput) {
                newSearchInput.focus();

                newSearchInput.setSelectionRange(
                    newSearchInput.value.length,
                    newSearchInput.value.length
                );
            }
        });

        list.querySelectorAll(
            '.class-section-option input[type="checkbox"]'
        ).forEach(input => {
            input.addEventListener('change', () => {
                this.handleClassSectionSelectionChange();
            });
        });

        this.updateClassSectionSelectionDisplay();
    }

    handleClassSectionSelectionChange() {
        const list =
            document.getElementById('classSectionOptions');

        if (!list) return;

        this.selectedClassSections = [
            ...list.querySelectorAll(
                'input[type="checkbox"]:checked'
            )
        ].map(input => input.value);

        this.updateClassSectionSelectionDisplay();

        this.renderSubjectOptions();

        this.checkPrereqs();
    }

    updateClassSectionSelectionDisplay() {
        const buttonText =
            document.getElementById('classSectionSelectText');

        const summary =
            document.getElementById('selectedClassSectionSummary');

        if (!buttonText || !summary) return;

        const selected = this.selectedClassSections;

        if (!selected.length) {
            buttonText.textContent =
                '-- Select Class Section(s) --';

            summary.textContent = '';
            return;
        }

        if (selected.length <= 2) {
            buttonText.textContent =
                selected.join(', ');
        } else {
            buttonText.textContent =
                `${selected.length} sections selected`;
        }

        summary.textContent =
            selected.length === 1
                ? '1 class section selected.'
                : `${selected.length} class sections will be combined into one class.`;
    }

    renderCourseOptions() {
        const sel = document.getElementById('courseSelect');
        if (!sel) return;
        const previous = sel.value;
        const courses = [...new Set(this.curriculumCatalog
            .filter(entry => !this.term || entry.term === this.term)
            .map(entry => `${entry.program} - ${entry.year}`))].sort((a, b) => a.localeCompare(b));
        const options = courses.length ? courses : this.courses.slice().sort((a,b)=>a.localeCompare(b));
        sel.disabled = !this.term || !document.getElementById('teacherSelect')?.value;
        sel.innerHTML = '<option value="">-- Select Course & Year --</option>' + options.map(c => `<option value="${this.escapeHtml(c)}">${this.escapeHtml(c)}</option>`).join('');
        if (options.includes(previous)) sel.value = previous;
    }

    getCurriculumEntries() {
        const course = document.getElementById('courseSelect')?.value || '';
        const [program, year] = course.split(' - ');
        return this.curriculumCatalog
            .filter(entry => (!this.term || entry.term === this.term) && (!program || entry.program === program) && (!year || String(entry.year) === year))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getSelectedCurriculumEntry() {
        const subject =
            document.getElementById('subjectSelect')?.value.trim() || '';

        if (!subject) {
            return null;
        }

        const selectedSections =
            this.getSelectedClassSectionParts();

        if (!selectedSections.length) {
            return null;
        }

        const normalizedSubject =
            subject.toLowerCase();
        const [firstProgram, firstYear] =
            selectedSections[0].courseYear.split(' - ');
        const normalizedFirstProgram =
            this.normalizeProgram(firstProgram);
        const componentKey =
            this.selectedCurriculumOptionKey;

        if (componentKey) {
            const selectedEntry = this.curriculumCatalog.find(entry =>
                this.getCurriculumOptionKey(entry) === componentKey &&
                String(entry.name || '').trim().toLowerCase() ===
                    normalizedSubject
            );

            if (!selectedEntry) {
                return null;
            }

            const compatibleAcrossSections = selectedSections.every(section => {
                const [program, year] =
                    section.courseYear.split(' - ');

                return Boolean(this.getCurriculumEntryForProgramSubject(
                    normalizedSubject,
                    program,
                    year,
                    selectedEntry
                ));
            });

            return compatibleAcrossSections ? selectedEntry : null;
        }

        const candidateEntries = this.curriculumCatalog.filter(entry =>
            String(entry.name || '').trim().toLowerCase() ===
                normalizedSubject &&
            this.normalizeProgram(entry.program) === normalizedFirstProgram
        );
        const componentKeys = new Set(candidateEntries.map(entry =>
            this.getCurriculumComponentKey(entry)
        ));

        if (componentKeys.size !== 1) {
            return null;
        }

        const candidate = candidateEntries[0];
        const compatibleAcrossSections = selectedSections.every(section => {
            const [program, year] =
                section.courseYear.split(' - ');

            return Boolean(this.getCurriculumEntryForProgramSubject(
                normalizedSubject,
                program,
                year,
                candidate
            ));
        });

        return compatibleAcrossSections
            ? this.getCurriculumEntryForProgramSubject(
                normalizedSubject,
                normalizedFirstProgram,
                firstYear,
                candidate
            )
            : null;
    }

    updateSelectedSubjectDetails() {
        const entry = this.getSelectedCurriculumEntry();
        this.selectedCurriculumEntry = entry;
        const hint = document.getElementById('subjectDetailsHint');
        if (!hint) return;
        if (!entry) {
            hint.textContent = '';
            return;
        }
        const remaining = this.getSelectedSubjectRemainingHours(entry);
        hint.textContent = `${entry.code} · ${entry.delivery || 'Class'} · ${entry.units} unit${entry.units === 1 ? '' : 's'} · ${entry.lecHours} lec / ${entry.labHours} lab hour${entry.labHours === 1 ? '' : 's'}${remaining.length ? ` · ${remaining.join('; ')}` : ''}`;
    }

    getSelectedSubjectRemainingHours(entry) {
        if (!entry) return [];
        return this.getSelectedClassSectionParts().map(({ courseYear, section }) => {
            const [program, yearText] = courseYear.split(' - ');
            const normalizedName = String(entry.name || '').trim().toLowerCase();
            const subjectEntry =
                this.getCurriculumEntryForProgramSubject(
                    normalizedName,
                    program,
                    yearText,
                    entry
                );
            if (!subjectEntry) return '';
            const requiredMinutes = this.getCurriculumEntryRequiredWeeklyMinutes(subjectEntry);
            if (!requiredMinutes) return '';
            const scheduledMinutes = this.getSectionSubjectScheduledMinutes(
                `${courseYear}${section}`,
                subjectEntry.name,
                subjectEntry
            );
            return `${courseYear}${section}: ${Math.max(0, requiredMinutes - scheduledMinutes) / 60}h remaining`;
        }).filter(Boolean);
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    renderSectionScheduleOptions() {
        const sel = document.getElementById('sectionScheduleSelect');
        if (sel) {
            const previous = sel.value;
            sel.innerHTML = '<option value="">-- Select Section --</option>' + this.courses.slice().sort((a,b)=>a.localeCompare(b)).map(c => `<option value="${c}">${c}</option>`).join('');
            if (this.courses.includes(previous)) sel.value = previous;
        }
        const list = document.getElementById('studentSectionList');
        if (!list) return;
        const sections = this.courses.slice().sort((a,b)=>a.localeCompare(b));
        if (!sections.length) {
            list.innerHTML = '<p class="empty-message">No student schedules yet. Add a class to get started!</p>';
            return;
        }
        list.innerHTML = sections.map(section => `
            <article class="student-section-card">
                <div><p class="eyebrow">SECTION TIMETABLE</p><h3>${section}</h3><span>View this section's weekly classes, teachers, and rooms.</span></div>
                <button type="button" class="btn-view" data-section-timetable="${section}">View Timetable</button>
            </article>
        `).join('');
        list.querySelectorAll('[data-section-timetable]').forEach(btn => btn.addEventListener('click', () => this.showSectionSchedule(btn.dataset.sectionTimetable)));
    }

    renderRoomOptions(slot = document.querySelector('#scheduleSlots .schedule-slot')) {
        if (!slot) return;
        const sel = slot.querySelector('[data-field="room"]') || document.getElementById('roomSelect');
        if (!sel) return;
        const legacyIds = { building: 'buildingSelect', room: 'roomSelect' };
        const value = field => slot.querySelector(`[data-field="${field}"]`)?.value || document.getElementById(legacyIds[field] || field)?.value || '';
        const building = value('building');
        const rooms = this.rooms.filter(r => !building || (this.roomDetails[r] || {}).building === building);
        sel.innerHTML = '<option value="">-- Select Room --</option>' + rooms.slice().sort((a,b)=>a.localeCompare(b)).map(r => `<option value="${r}">${r}</option>`).join('');
    }

    renderBuildingOptions() {
        const sel = document.getElementById('buildingSelect');
        if (!sel) return;
        const previous = sel.value;
        sel.innerHTML = '<option value="">-- Select Building --</option>' + this.buildings.slice().sort((a,b)=>a.localeCompare(b)).map(b => `<option value="${b}">${b}</option>`).join('');
        if (this.buildings.includes(previous)) sel.value = previous;
    }

    renderRoomBuildingOptions() {
        const sel = document.getElementById('newRoomBuilding');
        if (!sel) return;
        const previous = sel.value;
        sel.innerHTML = '<option value="">-- Select building first --</option>' + this.buildings.slice().sort((a,b)=>a.localeCompare(b)).map(b => `<option value="${b}">${b}</option>`).join('');
        if (this.buildings.includes(previous)) sel.value = previous;
    }

    // remove rooms that conflict with selected time/day
    updateRoomOptions(slot = document.querySelector('#scheduleSlots .schedule-slot')) {
        if (!slot) return;
        const legacyIds = { building: 'buildingSelect', room: 'roomSelect' };
        const value = field => slot.querySelector(`[data-field="${field}"]`)?.value || document.getElementById(legacyIds[field] || field)?.value || '';
        const days = [...slot.querySelectorAll('input[name="days"]:checked')].map(input => input.value);
        const startTime = value('startTime');
        const endTime = value('endTime');
        const sel = slot.querySelector('[data-field="room"]') || document.getElementById('roomSelect');
        if (!sel) return;
        const previousValue = sel.value;
        const building = value('building');

        // if no time/day selected, show all
        if (!days.length || !startTime || !endTime) {
            this.renderRoomOptions(slot);
            return;
        }

        const available = this.rooms.filter(r => {
            // if any existing schedule uses room r at overlapping time on same day, exclude
            return (!building || (this.roomDetails[r] || {}).building === building) && !this.schedules.some(s => s.room.toLowerCase() === r.toLowerCase() && days.includes(s.day) && this.timesOverlap(s.startTime, s.endTime, startTime, endTime));
        });

        // sort available rooms
        const sortedAvailable = available.slice().sort((a,b)=>a.localeCompare(b));
        sel.innerHTML = '<option value="">-- Select Room --</option>' + sortedAvailable.map(r => `<option value="${r}">${r}</option>`).join('');
        if (sortedAvailable.includes(previousValue)) sel.value = previousValue;
        const hint = slot.querySelector('.room-hint') || document.getElementById('roomHint');
        if (hint) {
            hint.textContent = available.length === 0 ? 'No rooms are available for this time.' : `${available.length} room${available.length === 1 ? '' : 's'} available for this time.`;
        }
    }

    showIntroIfNeeded() {
        try {
            const seen = localStorage.getItem('seenIntro');
            if (seen === 'true') return;
            const modal = document.getElementById('introModal');
            if (!modal) return;
            modal.style.display = 'flex';
            const btn = document.getElementById('introDismissBtn');
            const closeBtn = document.getElementById('introCloseBtn');
            const chk = document.getElementById('introDontShow');
            const closeFn = () => {
                if (chk && chk.checked) localStorage.setItem('seenIntro', 'true');
                modal.style.display = 'none';
            };
            if (btn) btn.addEventListener('click', closeFn, { once: true });
            if (closeBtn) closeBtn.addEventListener('click', closeFn, { once: true });
            const manageBtn = document.getElementById('introManageBtn');
            if (manageBtn) manageBtn.addEventListener('click', () => {
                closeFn();
                // open Manage Lists view
                const toggle = document.querySelector('[data-view="manage"]');
                if (toggle) toggle.click();
            });
        } catch (e) {
            // ignore
        }
    }

    // Enable or disable the schedule form submit depending on whether prerequisite lists exist
    checkPrereqs() {
        const btn = document.querySelector('#scheduleForm .btn-add');
        const selected =
            !!this.term &&
            Boolean(document.getElementById('teacherSelect')?.value) &&
            this.selectedClassSections.length > 0 &&
            Boolean(document.getElementById('subjectSelect')?.value.trim());
        const ok = this.teachers.length > 0 && this.rooms.length > 0 && selected;
        if (btn) {
            btn.disabled = !ok;
            btn.title = ok ? '' : 'Select a teacher, course, subject, day, time, and room before plotting a schedule.';
        }
    }

    // --- Account access ---
    initializeAuth() {
        this.authMode = 'signin';
        this.authEventReceived = false;
        this.recoveryMode = window.location.hash.includes('type=recovery') || window.location.hash.includes('reset-password') || new URLSearchParams(window.location.search).has('code');
        if (!this.supabase) {
            this.setAuthMessage('Supabase is not configured yet. Add a project URL and publishable key.', 'error');
            return;
        }
        this.supabase.auth.onAuthStateChange((event, session) => {
            this.authEventReceived = true;

            console.debug(
                'Supabase auth event:',
                event,
                session ? 'session present' : 'no session'
            );

            // Password recovery must still work normally.
            if (event === 'PASSWORD_RECOVERY') {
                this.showPasswordRecovery();
                this.applySession(session);
                return;
            }

            // Supabase can refresh the token silently when the tab becomes active.
            // Do NOT reload the application or sync all data again.
            if (event === 'TOKEN_REFRESHED') {
                this.currentUser = session ? session.user : null;
                return;
            }

            // Supabase may emit SIGNED_IN again when an already-signed-in
            // user returns to the browser tab.
            //
            // If this is the same user we are already displaying, do nothing.
            if (
                event === 'SIGNED_IN' &&
                session &&
                this.currentUser &&
                this.currentUser.id === session.user.id
            ) {
                console.debug('Already signed in; skipping unnecessary resync.');
                return;
            }

            // Actual sign-in, sign-out, or initial authentication
            // continues through the normal session handling.
            this.applySession(session);
        });
        this.supabase.auth.getSession().then(({ data, error }) => {
            if (error) this.setAuthMessage(error.message, 'error');
            if (this.recoveryMode) this.showPasswordRecovery();
            // onAuthStateChange emits INITIAL_SESSION. Do not let this slower
            // request overwrite a newer sign-in event with an old null result.
            if (!this.authEventReceived) this.applySession(data && data.session);
        });
    }

    showPasswordRecovery() {
        this.recoveryMode = true;
        document.getElementById('authForm')?.classList.add('hidden');
        document.getElementById('resetPasswordForm')?.classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Set a new password';
        document.getElementById('authSubtitle').textContent = 'Choose a new password for your Schedule Studio account.';
        document.getElementById('authModeToggle')?.classList.add('hidden');
        document.getElementById('forgotPasswordBtn')?.classList.add('hidden');
    }

    async handleSetNewPassword(event) {
        event.preventDefault();
        const { data: sessionData } = await this.supabase.auth.getSession();
        if (!sessionData?.session) {
            return this.setAuthMessage('The reset link did not create a recovery session. Request a new link and open it on this exact website address.', 'error');
        }
        const password = document.getElementById('resetPassword').value;
        const confirmation = document.getElementById('resetPasswordConfirm').value;
        if (password !== confirmation) return this.setAuthMessage('Passwords do not match.', 'error');
        const { error } = await this.supabase.auth.updateUser({ password });
        if (error) {
            const message = /session missing|invalid.*token|expired/i.test(error.message || '')
                ? 'This password-reset link is expired or incomplete. Request a new reset email and open the newest link directly.'
                : error.message;
            return this.setAuthMessage(message, 'error');
        }
        this.setAuthMessage('Password updated. You can now sign in normally.', 'success');
        this.recoveryMode = false;
        window.history.replaceState({}, document.title, window.location.pathname);
        document.getElementById('resetPasswordForm').classList.add('hidden');
        document.getElementById('authForm').classList.remove('hidden');
        document.getElementById('authTitle').textContent = 'Welcome to Schedule Studio';
        document.getElementById('authSubtitle').textContent = 'Sign in to access your private scheduling workspace.';
        document.getElementById('authModeToggle')?.classList.remove('hidden');
    }

    applySession(session) {
        const authScreen = document.getElementById('authScreen');
        const appShell = document.getElementById('appShell');
        const identity = document.getElementById('userIdentity');
        const signOutBtn = document.getElementById('signOutBtn');
        const previousUserId = this.currentUser?.id || null;
        this.syncRequestId++;
        this.currentUser = session ? session.user : null;

        // Never carry an administrator's selected user (or any period request)
        // into a different authenticated account.
        if (previousUserId && previousUserId !== this.currentUser?.id) {
            this.ownerRequestId++;
            this.ownerViewingUserId = null;
            this.ownerSelectedUserId = null;
            this.activeSchedulePeriod = null;
            this.periodRequestId++;
            sessionStorage.removeItem('scheduleStudioOwnerUser');
        }

        if (!session || this.recoveryMode) {
            if (authScreen) authScreen.classList.remove('hidden');
            if (appShell) appShell.classList.add('hidden');
            this.showWorkspaceScreen(false);
            if (identity) identity.classList.add('hidden');
            if (signOutBtn) signOutBtn.classList.add('hidden');
            return;
        }
        if (!this.remoteEnabled && authScreen) {
            authScreen.classList.add('hidden');
        }
        if (appShell) appShell.classList.add('hidden');
        this.showWorkspaceScreen(false);
        this.loadUserLocalData();

        if (this.remoteEnabled) {
            this.schedulePeriods = [];
            this.activeSchedulePeriod = null;
            const periodHeader =
                document.getElementById('activeSchedulePeriodHeader');

            if (periodHeader) {
                periodHeader.textContent = '';
                periodHeader.classList.add('hidden');
            }
            this.schedules = [];
            this.teachers = [];
            this.rooms = [];
            this.subjects = [];
            this.courses = [];
            this.buildings = [];
            this.subjectDetails = {};
            this.roomDetails = {};
            this.render();
        }
        this.render();
        if (identity) {
            const fullName =
                this.currentProfile?.full_name ||
                session.user.user_metadata?.full_name ||
                session.user.email ||
                'Signed in';

            const firstName =
                String(fullName).trim().split(/\s+/)[0] || 'Signed in';

            identity.textContent = firstName;
            identity.classList.remove('hidden');
        }
        if (signOutBtn) signOutBtn.classList.remove('hidden');
        if (!this.ownerViewingUserId) {
            window.ScheduleStudioOwnerNavigation.setBackButtonVisible(false);
        }
        this.syncFromRemote();
    }

    toggleAuthMode() {
        this.authMode = this.authMode === 'signin' ? 'signup' : 'signin';
        const signingUp = this.authMode === 'signup';
        document.getElementById('authTitle').textContent = signingUp ? 'Create your account' : 'Welcome to Schedule Studio';
        document.getElementById('authSubtitle').textContent = signingUp ? 'Your schedules stay private to your account.' : 'Sign in to access your private scheduling workspace.';
        document.getElementById('authSubmit').innerHTML = signingUp ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
        document.getElementById('authModeToggle').textContent = signingUp ? 'Already have an account? Sign in' : 'Need an account? Create one';
        document.getElementById('forgotPasswordBtn').classList.toggle('hidden', signingUp);
        document.getElementById('authName').classList.toggle('hidden', !signingUp);
        document.getElementById('authNameLabel').classList.toggle('hidden', !signingUp);
        document.getElementById('authPassword').autocomplete = signingUp ? 'new-password' : 'current-password';
        this.setAuthMessage('');
    }

    setAuthMessage(message, type = '') {
        const el = document.getElementById('authMessage');
        if (!el) return;
        el.textContent = message;
        el.className = `auth-message ${type === 'success' ? 'success' : ''}`;
    }

    clearAuthFields() {
        ['authEmail', 'authPassword', 'authName', 'resetPassword', 'resetPasswordConfirm'].forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });
    }

    returnToSignIn(message = '') {
        if (this.authMode === 'signup') this.toggleAuthMode();
        this.clearAuthFields();
        this.setAuthMessage(message, message ? 'success' : '');
    }

    async handleAuthSubmit(event) {
        event.preventDefault();
        if (!this.supabase) return this.setAuthMessage('Supabase is not configured yet.', 'error');
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const fullName = document.getElementById('authName').value.trim();
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!validEmail) return this.setAuthMessage('Please enter a valid email address.', 'error');
        const button = document.getElementById('authSubmit');
        button.disabled = true;
        this.setAuthMessage('');
        try {
            let result;
            if (this.authMode === 'signup') {
                result = await this.supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin }
                });
            } else {
                result = await this.supabase.auth.signInWithPassword({ email, password });
            }
            if (result.error) throw result.error;
            if (this.authMode === 'signup' && !result.data.session) {
                this.returnToSignIn('Account created. Check your email to confirm your account, then sign in.');
            } else if (this.authMode === 'signup') {
                // Supabase may create a session immediately when email
                // confirmation is disabled. Keep that session active instead
                // of signing the new user out after the dashboard appears.
                this.applySession(result.data.session);
                this.setAuthMessage('Account created. You are now signed in.', 'success');
            } else {
                this.setAuthMessage('Signed in successfully.', 'success');
            }
        } catch (error) {
            const message = this.authMode === 'signin'
                ? 'Email or password is incorrect.'
                : (error.message || 'Unable to create the account. Please try again.');
            this.setAuthMessage(message, 'error');
        } finally {
            button.disabled = false;
        }
    }

    async handlePasswordReset() {
        const email = document.getElementById('authEmail').value.trim();
        if (!email) return this.setAuthMessage('Enter your email address first, then choose Forgot password.', 'error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.setAuthMessage('Please enter the email address used for your account.', 'error');
        const { error } = await this.supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${window.location.pathname}#reset-password` });
        const resetMessage = error && /rate limit/i.test(error.message || '')
            ? 'Too many reset emails were requested. Please wait before trying again.'
            : (error ? 'We could not send the reset email. Please try again later.' : 'Password reset instructions have been sent.');
        this.setAuthMessage(resetMessage, error ? 'error' : 'success');
    }

    async signOut() {
        this.syncRequestId++;
        const ownerId = this.currentUser?.id || null;
        const { error } = await this.supabase.auth.signOut();
        if (error) this.showNotification(error.message, 'error');
        if (ownerId) {
            sessionStorage.removeItem(
                this.getActivePeriodSessionKey(ownerId)
            );
        }

        this.clearAuthFields();
        this.authMode = 'signin';
        this.recoveryMode = false;
        sessionStorage.removeItem('scheduleStudioOwnerUser');
    }

    initSupabase() {
        try {
            const cfg = window.SUPABASE_CONFIG || null;
            this.supabase = null;
            this.remoteEnabled = false;
            const statusEl = document.getElementById('remoteStatus');
            if (!cfg || !cfg.url || !cfg.anonKey || cfg.url.includes('YOUR-PROJECT') || cfg.anonKey.includes('goes-here')) {
                if (statusEl) statusEl.textContent = 'Remote: not configured';
                return;
            }
            if (!window.supabase || !window.supabase.createClient) {
                if (statusEl) statusEl.textContent = 'Remote: client missing';
                return;
            }
            this.supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
            this.remoteEnabled = true;
            if (statusEl) statusEl.textContent = 'Remote: ready to sign in';
        } catch (e) {
            const statusEl = document.getElementById('remoteStatus');
            if (statusEl) statusEl.textContent = 'Remote: init error';
            console.warn('Supabase init failed', e);
        }
    }

    async loadSchedulePeriods(ownerId = this.currentUser?.id) {
        if (!this.remoteEnabled || !this.supabase || !ownerId) {
            this.schedulePeriods = [];
            return [];
        }

        const { data, error } =
            await SchedulePeriodDataService.fetchPeriods(
                this.supabase,
                ownerId
            );

        if (error) {
            console.warn(
                'Supabase schedule period read error:',
                error.message || error
            );
            this.schedulePeriods = [];
            return [];
        }

        const activeScopeId = this.ownerViewingUserId || (!this.isOwner ? this.currentUser?.id : null);
        if (activeScopeId && activeScopeId !== ownerId) return [];
        this.schedulePeriods = Array.isArray(data) ? data : [];

        return this.schedulePeriods;
    }

    async refreshSchedulesForActivePeriod() {
        if (
            !this.remoteEnabled ||
            !this.supabase ||
            !this.currentUser ||
            !this.activeSchedulePeriod
        ) {
            return false;
        }

        const activePeriodId = this.activeSchedulePeriod.id;
        const requestId = ++this.periodRequestId;
        const ownerId = this.ownerViewingUserId || this.currentUser.id;

        try {
            let scheduleQuery = this.supabase
                .from('schedules')
                .select(
                    'id,owner_id,schedule_period_id,combined_class_id,term,program,year,section,teacher_name,subject,course_year,course_code,units,lec_hours,lab_hours,delivery,building,overload,day,start_time,end_time,room'
                )
                .eq('schedule_period_id', activePeriodId)
                .order('created_at', { ascending: true });

            // Regular users can only see their own schedules.
            if (!this.isOwner) {
                scheduleQuery = scheduleQuery.eq(
                    'owner_id',
                    this.currentUser.id
                );
            }
            // Owner/admin viewing a specific user.
            else if (this.ownerViewingUserId) {
                scheduleQuery = scheduleQuery.eq(
                    'owner_id',
                    this.ownerViewingUserId
                );
            }

            const { data, error } = await scheduleQuery;

            if (error) {
                console.warn(
                    'Supabase schedule period refresh error:',
                    error.message || error
                );

                this.showNotification(
                    'Could not refresh schedules for this period.',
                    'error'
                );

                return false;
            }

            // Do not allow a slower request from an old user/period to replace
            // the screen after navigation has moved elsewhere.
            if (
                requestId !== this.periodRequestId ||
                !this.activeSchedulePeriod ||
                this.activeSchedulePeriod.id !== activePeriodId ||
                (this.ownerViewingUserId || this.currentUser?.id) !== ownerId
            ) {
                return false;
            }

            const scheduleRows = Array.isArray(data) ? data : [];

            const mappedSchedules = scheduleRows.map(row => {
                const parsed = this.parseCourseYear(row.course_year);

                return {
                    id: row.id,
                    ownerId: row.owner_id || this.currentUser.id,
                    schedulePeriodId: row.schedule_period_id || null,
                    combinedClassId: row.combined_class_id || null,
                    term: String(row.term || '').toLowerCase(),
                    program:
                        typeof this.normalizeProgram === 'function'
                            ? this.normalizeProgram(
                                row.program ||
                                parsed?.program ||
                                ''
                            )
                            : (
                                row.program ||
                                parsed?.program ||
                                ''
                            ),
                    year: row.year || parsed?.year || null,
                    section: row.section || parsed?.section || '',
                    teacherName: String(
                        row.teacher_name || ''
                    ).toUpperCase(),
                    subject: String(
                        row.subject || ''
                    ).toUpperCase(),
                    courseYear:
                        typeof this.normalizeCourseYear === 'function'
                            ? this.normalizeCourseYear(
                                row.course_year
                            )
                            : String(
                                row.course_year || ''
                            ).trim(),
                    courseCode: String(
                        row.course_code || ''
                    ).toUpperCase(),
                    units: row.units,
                    lecHours: row.lec_hours,
                    labHours: row.lab_hours,
                    delivery: String(
                        row.delivery || ''
                    ),
                    building: String(
                        row.building || ''
                    ).toUpperCase(),
                    overload: row.overload || '',
                    day: row.day,
                    startTime: row.start_time
                        ? row.start_time.slice(0, 5)
                        : '',
                    endTime: row.end_time
                        ? row.end_time.slice(0, 5)
                        : '',
                    room: String(
                        row.room || ''
                    ).toUpperCase()
                };
            });

            // The query is already scoped to the active period and owner.
            this.ownerAllSchedules = [...mappedSchedules];
            this.schedules = mappedSchedules;

            return true;
        } catch (error) {
            console.warn(
                'Unexpected schedule period refresh error:',
                error
            );

            this.showNotification(
                'Could not refresh schedules for this period.',
                'error'
            );

            return false;
        }
    }

    restoreActiveSchedulePeriod(ownerId) {
        if (!ownerId || !Array.isArray(this.schedulePeriods)) {
            this.activeSchedulePeriod = null;
            return null;
        }

        const storageKey = this.getSchedulePeriodStorageKey(ownerId);
        const rememberedId = localStorage.getItem(storageKey);

        const rememberedPeriod = this.schedulePeriods.find(
            period => period.id === rememberedId
        );

        if (rememberedPeriod) {
            this.activeSchedulePeriod = rememberedPeriod;
            return rememberedPeriod;
        }

        this.activeSchedulePeriod = null;
        return null;
    }

    restoreSessionActiveSchedulePeriod(ownerId) {
        if (!ownerId || !Array.isArray(this.schedulePeriods)) {
            this.activeSchedulePeriod = null;
            return null;
        }

        const sessionKey =
            this.getActivePeriodSessionKey(ownerId);

        const activePeriodId =
            sessionStorage.getItem(sessionKey);

        const activePeriod =
            this.schedulePeriods.find(
                period => period.id === activePeriodId
            );

        if (activePeriod) {
            this.activeSchedulePeriod = activePeriod;
            this.schoolYear = activePeriod.school_year;
            const periodHeader =
                document.getElementById('activeSchedulePeriodHeader');

            if (periodHeader) {
                periodHeader.textContent =
                    `${activePeriod.school_year} • ${this.formatTermLabel(activePeriod.term)}`;

                periodHeader.classList.remove('hidden');
            }

            this.term = activePeriod.term;

            return activePeriod;
        }

        this.activeSchedulePeriod = null;
        return null;
    }

    setActiveSchedulePeriod(period) {
        if (!period) {
            this.activeSchedulePeriod = null;
            return false;
        }

        const exists = this.schedulePeriods.some(
            item => item.id === period.id
        );

        if (!exists) {
            return false;
        }

        if (this.activeSchedulePeriod?.id !== period.id) {
            this.periodRequestId++;
            this.schedules = [];
            this.ownerAllSchedules = [];
        }
        if (this.pagination) this.resetPage('teacher');

        this.activeSchedulePeriod = period;
        this.term = period.term;
        this.schoolYear = period.school_year;
        const periodHeader =
            document.getElementById('activeSchedulePeriodHeader');

        if (periodHeader) {
            periodHeader.textContent =
                `${period.school_year} • ${this.formatTermLabel(period.term)}`;

            periodHeader.classList.remove('hidden');
        }

        const ownerId =
            period.owner_id ||
            this.ownerViewingUserId ||
            this.currentUser?.id;

        if (ownerId) {
            localStorage.setItem(
                this.getSchedulePeriodStorageKey(ownerId),
                period.id
            );

            sessionStorage.setItem(
                this.getActivePeriodSessionKey(ownerId),
                period.id
            );
        }

        return true;
    }

    formatTermLabel(term) {
        const labels = {
            '1st semester': '1st Semester',
            '2nd semester': '2nd Semester',
            'summer': 'Summer'
        };

        return labels[term] || term;
    }

    getCurrentSchoolYear() {
        return this.activeSchedulePeriod?.school_year || this.schoolYear || '';
    }

    renderWorkspacePeriods() {
        const list =
            document.getElementById('workspacePeriodList');

        if (!list) return;

        if (!Array.isArray(this.schedulePeriods) ||
            this.schedulePeriods.length === 0) {

            list.innerHTML = `
                <p class="empty-message">
                    No scheduling periods yet.
                </p>
            `;

            return;
        }

        list.innerHTML = this.schedulePeriods.map(period => `
            <div class="workspace-period-card">
                <div class="workspace-period-info">
                    <p class="workspace-period-school-year">
                        ${period.school_year}
                    </p>

                    <p class="workspace-period-term">
                        ${this.formatTermLabel(period.term)}
                    </p>
                </div>

                <button
                    type="button"
                    class="btn-add workspace-period-open-btn"
                    data-period-id="${period.id}">
                    Open
                </button>
            </div>
        `).join('');

        list.querySelectorAll('.workspace-period-open-btn')
            .forEach(button => {
                button.addEventListener('click', async () => {
                    const periodId = button.dataset.periodId;

                    const period =
                        this.schedulePeriods.find(
                            item => item.id === periodId
                        );

                    if (!period) return;

                    this.setActiveSchedulePeriod(period);
                    this.schoolYear = period.school_year;

                    localStorage.setItem(
                        this.storageKey('schoolYear'),
                        period.school_year
                    );

                    this.clearScheduleForm();
                    this.showScheduleStudio();
                    this.render();

                    if (await this.refreshSchedulesForActivePeriod()) this.render();
                });
            });
    }

    async handleCreateSchedulePeriod(event) {
        event.preventDefault();

        const schoolYearInput =
            document.getElementById('schedulePeriodSchoolYear');

        const termInput =
            document.getElementById('schedulePeriodTerm');

        const message =
            document.getElementById('schedulePeriodMessage');

        const schoolYear =
            schoolYearInput?.value.trim() || '';

        const term =
            termInput?.value || '';

        if (!schoolYear) {
            if (message) {
                message.textContent = 'Enter a school year.';
            }

            schoolYearInput?.focus();
            return;
        }

        if (!term) {
            if (message) {
                message.textContent = 'Select a semester.';
            }

            termInput?.focus();
            return;
        }

        const ownerId =
            this.ownerViewingUserId ||
            this.currentUser?.id;

        if (!ownerId) {
            if (message) {
                message.textContent =
                    'No signed-in user was found.';
            }

            return;
        }

        if (!this.remoteEnabled || !this.supabase) {
            if (message) {
                message.textContent =
                    'Scheduling periods require a Supabase connection.';
            }

            return;
        }

        const existingPeriod =
            this.schedulePeriods.find(period =>
                period.owner_id === ownerId &&
                period.school_year === schoolYear &&
                period.term === term
            );

        if (existingPeriod) {
            if (message) {
                message.textContent =
                    'This scheduling period already exists.';
            }

            return;
        }

        const { data, error } =
            await SchedulePeriodDataService.createPeriod(
                this.supabase,
                {
                    ownerId,
                    schoolYear,
                    term
                }
            );

        if (error) {
            console.error(
                'Schedule period creation error:',
                error.message || error
            );

            if (message) {
                message.textContent =
                    error.message ||
                    'Unable to create scheduling period.';
            }

            return;
        }

        if (!data) {
            if (message) {
                message.textContent =
                    'The scheduling period was not returned after creation.';
            }

            return;
        }

        this.schedulePeriods.push(data);
        this.renderWorkspacePeriods();
        this.setActiveSchedulePeriod(data);
        this.clearScheduleForm();

        this.schoolYear = data.school_year;

        localStorage.setItem(
            this.storageKey('schoolYear'),
            data.school_year
        );

        const schedulePeriodModal =
            document.getElementById('schedulePeriodModal');

        if (schedulePeriodModal) {
            schedulePeriodModal.classList.add('hidden');
            schedulePeriodModal.setAttribute(
                'aria-hidden',
                'true'
            );
        }

        this.showScheduleStudio();

        this.render();
        if (await this.refreshSchedulesForActivePeriod()) this.render();

        this.showNotification(
            `${data.school_year} • ${this.formatTermLabel(data.term)} is now active.`,
            'success'
        );
    }


    showWorkspaceScreen(show = true) {
        const authScreen = document.getElementById('authScreen');
        const workspaceScreen = document.getElementById('workspaceScreen');
        const appShell = document.getElementById('appShell');

        if (!workspaceScreen || !appShell) return;

        this.workspaceScreenVisible = show;

        if (show) {
            if (!appShell.classList.contains('hidden')) {
                if (
                    workspaceScreen.classList.contains('screen-enter-left') &&
                    appShell.classList.contains('screen-exit-right')
                ) return;

                this.transitionWorkspaceScreens(
                    appShell,
                    workspaceScreen,
                    'right',
                    'left'
                );
                return;
            }

            workspaceScreen.classList.remove('hidden');
            appShell.classList.add('hidden');
            const transitionFromAuth =
                authScreen && !authScreen.classList.contains('hidden');

            if (transitionFromAuth) {
                authScreen.classList.add('workspace-transition-out');
                workspaceScreen.classList.add('workspace-transition-in');

                requestAnimationFrame(() => {
                    authScreen.classList.add('workspace-transition-active');
                    workspaceScreen.classList.add('workspace-transition-active');
                });

                window.setTimeout(() => {
                    authScreen.classList.add('hidden');
                    authScreen.classList.remove(
                        'workspace-transition-out',
                        'workspace-transition-active'
                    );
                    workspaceScreen.classList.remove(
                        'workspace-transition-in',
                        'workspace-transition-active'
                    );
                }, 700);
            }
        } else {
            this.cancelWorkspaceScreenTransition();
            workspaceScreen.classList.add('hidden');
            workspaceScreen.classList.remove(
                'workspace-transition-in',
                'workspace-transition-active'
            );
            authScreen?.classList.remove(
                'workspace-transition-out',
                'workspace-transition-active'
            );
        }
    }

    cancelWorkspaceScreenTransition() {
        if (this.screenTransitionTimeout) {
            window.clearTimeout(this.screenTransitionTimeout);
            this.screenTransitionTimeout = null;
        }

        ['workspaceScreen', 'appShell'].forEach(id => {
            document.getElementById(id)?.classList.remove(
                'screen-transition-layer',
                'screen-exit-left',
                'screen-exit-right',
                'screen-enter-left',
                'screen-enter-right',
                'screen-transition-active'
            );
        });
    }

    transitionWorkspaceScreens(fromScreen, toScreen, exitDirection, enterDirection) {
        this.cancelWorkspaceScreenTransition();

        fromScreen.classList.remove('hidden');
        toScreen.classList.remove('hidden');
        fromScreen.classList.add(
            'screen-transition-layer',
            `screen-exit-${exitDirection}`
        );
        toScreen.classList.add(
            'screen-transition-layer',
            `screen-enter-${enterDirection}`
        );

        void toScreen.offsetWidth;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                fromScreen.classList.add('screen-transition-active');
                toScreen.classList.add('screen-transition-active');
            });
        });

        this.screenTransitionTimeout = window.setTimeout(() => {
            fromScreen.classList.add('hidden');
            fromScreen.classList.remove(
                'screen-transition-layer',
                `screen-exit-${exitDirection}`,
                'screen-transition-active'
            );
            toScreen.classList.remove(
                'screen-transition-layer',
                `screen-enter-${enterDirection}`,
                'screen-transition-active'
            );
            this.screenTransitionTimeout = null;
        }, 450);
    }

    changeSchedulePeriod() {
        const ownerId =
            this.ownerViewingUserId ||
            this.currentUser?.id;

        if (ownerId) {
            sessionStorage.removeItem(
                this.getActivePeriodSessionKey(ownerId)
            );
        }

        this.activeSchedulePeriod = null;
        this.term = '';
        this.periodRequestId++;
        this.schedules = [];
        this.ownerAllSchedules = [];
        this.clearScheduleForm();

        this.showWorkspaceScreen(true);
        this.renderWorkspacePeriods();
    }

    showScheduleStudio() {
        const authScreen =
            document.getElementById('authScreen');

        const workspaceScreen =
            document.getElementById('workspaceScreen');

        const appShell =
            document.getElementById('appShell');

        if (!appShell) return;

        this.workspaceScreenVisible = false;

        if (authScreen) {
            authScreen.classList.add('hidden');
        }

        if (workspaceScreen && !workspaceScreen.classList.contains('hidden')) {
            if (
                appShell.classList.contains('screen-enter-right') &&
                workspaceScreen.classList.contains('screen-exit-left')
            ) return;

            this.transitionWorkspaceScreens(
                workspaceScreen,
                appShell,
                'left',
                'right'
            );
            return;
        }

        this.cancelWorkspaceScreenTransition();
        workspaceScreen?.classList.add('hidden');
        appShell.classList.remove('hidden');
    }

    async syncFromRemote() {
        if (!this.remoteEnabled || !this.supabase || !this.currentUser) return;

        const syncId = this.syncRequestId;
        const syncPeriodRequestId = this.periodRequestId;
        const syncOwnerRequestId = this.ownerRequestId;
        const syncUserId = this.currentUser.id;
        let syncOwnerViewingUserId = this.ownerViewingUserId || null;
        let restoredRememberedUserId = null;

        try {
        this.showNotification('Syncing from remote...', 'success');

        const { data: profiles, error: profileError } =
            await ProfileDataService.fetchProfiles(this.supabase);

        if (profileError) {
            console.warn('Supabase profile read error:', profileError.message || profileError);
        }

        if (
            syncId !== this.syncRequestId ||
            !this.currentUser ||
            this.currentUser.id !== syncUserId
        ) {
            console.debug('Ignoring stale profile sync.');
            return;
        }

        this.ownerProfiles = Array.isArray(profiles) ? profiles : [];

        const ownProfile = this.ownerProfiles.find(
            profile => profile.id === syncUserId
        );

        this.currentProfile = ownProfile || null;

        this.isOwner = ['owner', 'school_admin'].includes(
            String(ownProfile?.role || '').toLowerCase()
        );

        if (
            this.isOwner &&
            !this.ownerViewingUserId &&
            this.pendingOwnerViewingUserId &&
            syncOwnerRequestId === this.ownerRequestId &&
            this.ownerViewingUserId === syncOwnerViewingUserId
        ) {
            const pendingUserId = this.pendingOwnerViewingUserId;
            const rememberedProfile = this.ownerProfiles.find(
                profile =>
                    profile.id === pendingUserId &&
                    !['owner', 'school_admin'].includes(
                        String(profile.role || '').toLowerCase()
                    )
            );

            if (
                rememberedProfile &&
                sessionStorage.getItem('scheduleStudioOwnerUser') === pendingUserId
            ) {
                restoredRememberedUserId = pendingUserId;
                this.pendingOwnerViewingUserId = null;
                this.ownerViewingUserId = pendingUserId;
                this.ownerSelectedUserId = pendingUserId;
                syncOwnerViewingUserId = pendingUserId;
                this.schedules = [];
                this.ownerAllSchedules = [];
                this.schedulePeriods = [];
                this.activeSchedulePeriod = null;
            } else {
                this.pendingOwnerViewingUserId = null;
                this.ownerViewingUserId = null;
                this.ownerSelectedUserId = null;
                this.schedules = [];
                this.ownerAllSchedules = [];
                this.schedulePeriods = [];
                this.activeSchedulePeriod = null;
                sessionStorage.removeItem('scheduleStudioOwnerUser');
            }
        }

        this.ownerCatalog = {};

        const activePeriodOwnerId =
            this.ownerViewingUserId || (this.isOwner ? null : syncUserId);

        if (activePeriodOwnerId) {
            await this.loadSchedulePeriods(activePeriodOwnerId);

            if (
                syncPeriodRequestId !== this.periodRequestId ||
                syncOwnerRequestId !== this.ownerRequestId
            ) {
                console.debug('Ignoring sync because schedule period changed.');
                return;
            }

            this.restoreSessionActiveSchedulePeriod(activePeriodOwnerId);
            console.log(
            'RESTORED ACTIVE PERIOD:',
            this.activeSchedulePeriod
        );
        } else {
            this.schedulePeriods = [];
            this.activeSchedulePeriod = null;
        }

        const syncActivePeriodId = this.activeSchedulePeriod?.id || null;
        const ownerScope = this.isOwner ? null : syncUserId;

        // Older deployments may not yet have optional subject metadata. The
        // helper retries with a backward-compatible column list instead of
        // making the entire workspace fail to load.
        const catalogQueries = [
            CatalogDataService.selectCatalogRows(this.supabase, 'teachers', ownerScope),
            CatalogDataService.selectCatalogRows(this.supabase, 'subjects', ownerScope),
            CatalogDataService.selectCatalogRows(this.supabase, 'rooms', ownerScope),
            CatalogDataService.selectCatalogRows(this.supabase, 'courses', ownerScope)
        ];

        let scheduleQuery = this.supabase
            .from('schedules')
            .select(
                'id,owner_id,schedule_period_id,combined_class_id,term,program,year,section,teacher_name,subject,course_year,course_code,units,lec_hours,lab_hours,delivery,building,overload,day,start_time,end_time,room'
            )
            .order('created_at', { ascending: true });

        if (!this.isOwner) {
            scheduleQuery = scheduleQuery.eq('owner_id', syncUserId);
        } else if (this.ownerViewingUserId) {
            scheduleQuery = scheduleQuery.eq('owner_id', this.ownerViewingUserId);
        }

        const isPeriodScopedScheduleView =
            !this.isOwner || !!this.ownerViewingUserId;

        if (isPeriodScopedScheduleView && syncActivePeriodId) {
            scheduleQuery = scheduleQuery.eq(
                'schedule_period_id',
                syncActivePeriodId
            );
        }

        const isSelectedOwnerView =
            this.isOwner && !!this.ownerViewingUserId;

        const scheduleRequest =
            (!this.isOwner || isSelectedOwnerView) && !syncActivePeriodId
                ? Promise.resolve({ data: [], error: null })
                : scheduleQuery;

        const [teachersResult, subjectsResult, roomsResult, coursesResult, schedulesResult] =
            await Promise.all([
                ...catalogQueries,
                scheduleRequest
            ]);

        if (
            syncId !== this.syncRequestId ||
            !this.currentUser ||
            this.currentUser.id !== syncUserId ||
            syncOwnerRequestId !== this.ownerRequestId
        ) {
            console.debug('Ignoring stale remote sync.');
            return;
        }

        if ((this.ownerViewingUserId || null) !== syncOwnerViewingUserId) {
            console.debug('Ignoring sync because owner view changed.');
            return;
        }

        if (
            syncPeriodRequestId !== this.periodRequestId ||
            (this.activeSchedulePeriod?.id || null) !== syncActivePeriodId
        ) {
            console.debug('Ignoring sync because schedule period changed.');
            return;
        }

        const catalogResults = {
            teachers: teachersResult,
            subjects: subjectsResult,
            rooms: roomsResult,
            courses: coursesResult
        };

        Object.entries(catalogResults).forEach(([table, result]) => {
            if (result.error) {
                console.warn(
                    `Supabase read error for ${table}:`,
                    result.error.message || result.error
                );
                return;
            }

            if (!Array.isArray(result.data)) return;

            result.data.forEach(row => {
                if (!row.owner_id) return;

                if (!this.ownerCatalog[row.owner_id]) {
                    this.ownerCatalog[row.owner_id] = {
                        teachers: [],
                        subjects: [],
                        rooms: [],
                        courses: []
                    };
                }

                this.ownerCatalog[row.owner_id][table].push(row);
            });
        });

        const teachersData = Array.isArray(teachersResult.data)
            ? teachersResult.data
            : [];

        const subjectsData = Array.isArray(subjectsResult.data)
            ? subjectsResult.data
            : [];

        const roomsData = Array.isArray(roomsResult.data)
            ? roomsResult.data
            : [];

        const coursesData = Array.isArray(coursesResult.data)
            ? coursesResult.data
            : [];

        const activeCatalogOwnerId =
            this.isOwner && this.ownerViewingUserId
                ? this.ownerViewingUserId
                : syncUserId;

        const activeCatalog =
            this.ownerCatalog[activeCatalogOwnerId] || {
                teachers: this.isOwner ? teachersData : [],
                subjects: this.isOwner ? subjectsData : [],
                rooms: this.isOwner ? roomsData : [],
                courses: this.isOwner ? coursesData : []
            };

        this.teachers = activeCatalog.teachers
            .map(row => String(row.name || '').toUpperCase())
            .filter(Boolean);

        this.subjects = activeCatalog.subjects
            .map(row => String(row.name || '').toUpperCase())
            .filter(Boolean);

        this.rooms = activeCatalog.rooms
            .map(row => String(row.name || '').toUpperCase())
            .filter(Boolean);

        this.courses = activeCatalog.courses
            .map(row => String(row.name || '').toUpperCase())
            .filter(Boolean);

        this.subjectDetails = {};

        activeCatalog.subjects.forEach(row => {
            const name = String(row.name || '').toUpperCase();

            this.subjectDetails[name] = {
                courseCode: String(row.course_code || '').toUpperCase(),
                units: Number(row.units) || 0,
                lecHours: Number(row.lec_hours) || 0,
                labHours: Number(row.lab_hours) || 0,
                delivery: String(row.delivery || '').toLowerCase()
            };
        });

        this.roomDetails = {};

        activeCatalog.rooms.forEach(row => {
            const name = String(row.name || '').toUpperCase();

            this.roomDetails[name] = {
                building: String(row.building || '').toUpperCase()
            };
        });

        this.buildings = Array.from(
            new Set(
                activeCatalog.rooms
                    .map(row => String(row.building || '').toUpperCase())
                    .filter(Boolean)
            )
        );

        if (schedulesResult.error) {
            throw schedulesResult.error;
        }

        const scheduleRows = Array.isArray(schedulesResult.data)
            ? schedulesResult.data
            : [];

        this.schedules = scheduleRows.map(row => {
            const parsed = this.parseCourseYear(row.course_year);

            return {
                id: row.id,
                ownerId: row.owner_id || syncUserId,
                schedulePeriodId: row.schedule_period_id || null,
                combinedClassId: row.combined_class_id || null,
                term: String(row.term || '').toLowerCase(),
                program: typeof this.normalizeProgram === 'function'
                    ? this.normalizeProgram(row.program || parsed?.program || '')
                    : (row.program || parsed?.program || ''),

                year: row.year || parsed?.year || null,
                section: row.section || parsed?.section || '',
                teacherName: String(row.teacher_name || '').toUpperCase(),
                subject: String(row.subject || '').toUpperCase(),
                courseYear: typeof this.normalizeCourseYear === 'function'
                    ? this.normalizeCourseYear(row.course_year)
                    : String(row.course_year || '').trim(),
                courseCode: String(row.course_code || '').toUpperCase(),
                units: row.units,
                lecHours: row.lec_hours,
                labHours: row.lab_hours,
                delivery: String(row.delivery || ''),
                building: String(row.building || '').toUpperCase(),
                overload: row.overload || '',
                day: row.day,
                startTime: row.start_time ? row.start_time.slice(0, 5) : '',
                endTime: row.end_time ? row.end_time.slice(0, 5) : '',
                room: String(row.room || '').toUpperCase()
            };
        });

        this.ownerAllSchedules = [...this.schedules];

        if (this.isOwner && this.ownerViewingUserId) {
            this.schedules = this.ownerAllSchedules.filter(
                schedule => schedule.ownerId === this.ownerViewingUserId
            );
        }

        if (this.activeSchedulePeriod && (!this.isOwner || this.ownerViewingUserId)) {
            this.schedules = this.schedules.filter(
                schedule =>
                    schedule.schedulePeriodId ===
                    this.activeSchedulePeriod.id
            );
        }

        window.ScheduleStudioOwnerNavigation.setWorkspaceModes({
            ownerMode: this.isOwner,
            ownerUserMode: this.isOwner && !!this.ownerViewingUserId
        });

        if (this.isOwner) {
            window.ScheduleStudioOwnerNavigation.showInitialOwnerView({
                isViewingUser: !!this.ownerViewingUserId
            });
        } else {
            this.resetToMemberStartView();
        }

        if (restoredRememberedUserId) {
            await this.loadOwnerCatalog(restoredRememberedUserId);

            if (
                syncId !== this.syncRequestId ||
                !this.currentUser ||
                this.currentUser.id !== syncUserId ||
                syncOwnerRequestId !== this.ownerRequestId ||
                this.ownerViewingUserId !== restoredRememberedUserId
            ) {
                return;
            }

            window.ScheduleStudioOwnerNavigation.showSelectedUserWorkspace();
        }
        this.ensureUniqueSubjectColors();

        this.renderSubjectOptions();
        this.renderTeacherOptions();
        this.renderRoomOptions();
        this.renderBuildingOptions();
        this.renderRoomBuildingOptions();
        this.renderCourseOptions();
        this.renderClassSectionOptions();
        this.renderSectionScheduleOptions();
        this.checkPrereqs();
        this.render();
        if (!this.isOwner) {
            this.renderWorkspacePeriods();

            if (this.activeSchedulePeriod) {
                this.showScheduleStudio();
            } else {
                this.showWorkspaceScreen(true);
            }
        } else {
            this.showScheduleStudio();
        }
        this.showNotification('Remote sync complete.', 'success');

        } catch (err) {
            if (syncId !== this.syncRequestId) {
                console.debug('Ignoring error from stale sync.');
                return;
            }

            console.error('Sync failed', err);
            document.getElementById('authScreen')?.classList.add('hidden');
            this.showNotification(
                'Remote sync failed. See console.',
                'error'
            );
        }
    }

    async addSubjectToRemote(name) {
        if (!this.remoteEnabled || !this.supabase) return;
        try {
            await this.supabase.from('subjects').insert({ name }).select();
        } catch (e) {
            console.warn('Failed to insert subject remotely', e);
        }
    }

    async addListItemToRemote(table, item) {
        if (!this.remoteEnabled) return true;

        if (!this.currentUser) {
            this.showNotification('Please sign in before adding items.', 'error');
            return false;
        }

        const payload = typeof item === 'string' ? { name: item } : item;

        if (
            this.ownerViewingUserId &&
            ['teachers', 'subjects', 'rooms', 'courses'].includes(table)
        ) {
            payload.owner_id = this.ownerViewingUserId;
        }

        const { error } = await this.supabase.from(table).insert(payload);

        if (!error) return true;

        // The item may already exist in Supabase even though
        // the local list is missing it.
        if (
            table === 'courses' &&
            error.code === '23505' &&
            String(error.message || '').includes('courses_owner_id_name_key')
        ) {
            console.warn(
                `Course "${payload.name}" already exists remotely. Continuing.`
            );
            return true;
        }

        this.showNotification(
            error.message || `Unable to save ${payload.name}.`,
            'error'
        );

        return false;
    }

    promptForRemoteConfig() {
        // simple prompt to let user paste a Supabase URL and anon key (quick way to connect locally)
        const url = prompt('Supabase URL (example: https://xyz.supabase.co)');
        if (!url) return;
        const key = prompt('Supabase anon key (service role not required)');
        if (!key) return;
        window.SUPABASE_CONFIG = { url: url.trim(), anonKey: key.trim() };
        this.initSupabase();
    }
}

// Initialize the application
let manager;
document.addEventListener('DOMContentLoaded', async () => {
    if (window.supabaseConfigReady) await window.supabaseConfigReady;
    manager = new ScheduleManager();
    const scrollToTopButton = document.getElementById('scrollToTopBtn');
    const updateScrollToTopVisibility = () => {
        scrollToTopButton?.classList.toggle('is-visible', window.scrollY > 280);
    };
    window.addEventListener('scroll', updateScrollToTopVisibility, { passive: true });
    updateScrollToTopVisibility();
    scrollToTopButton?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});

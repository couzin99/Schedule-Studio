/*
 * Non-destructive regression checks for scheduling-domain logic.
 * Run with: node qa-scheduler-logic.js
 */
const fs = require('fs');

global.window = {};
global.document = {
    addEventListener() {},
    createElement() {
        return {
            style: {},
            className: '',
            innerHTML: '',
            appendChild() {},
            remove() {}
        };
    }
};

eval(`${fs.readFileSync('script.js', 'utf8')}; globalThis.ScheduleManagerForQa = ScheduleManager;`);

const manager = Object.create(globalThis.ScheduleManagerForQa.prototype);
manager.activeSchedulePeriod = { id: 'period-1', term: '1st semester' };
manager.term = '1st semester';
manager.schoolYear = '2026–2027';
manager.curriculumCatalog = [];

const row = (overrides = {}) => ({
    id: crypto.randomUUID(),
    schedulePeriodId: 'period-1',
    term: '1st semester',
    teacherName: 'TEACHER A',
    subject: 'MATHEMATICS',
    courseCode: 'MATH 101',
    program: 'BSEE',
    courseYear: 'BSEE - 1A',
    units: 3,
    day: 'Monday',
    startTime: '08:00',
    endTime: '09:00',
    room: 'R101',
    ...overrides
});

const combinedId = 'combined-1';
manager.schedules = [
    row({ combinedClassId: combinedId, courseYear: 'BSEE - 1A' }),
    row({ combinedClassId: combinedId, courseYear: 'BSME - 1A', program: 'BSME' }),
    row({ combinedClassId: combinedId, courseYear: 'BSME - 1B', program: 'BSME' })
];

if (manager.getAllConflicts().length !== 0) throw new Error('Combined-class siblings were flagged as conflicts.');
if (manager.checkConflicts(manager.schedules[1]).hasConflict) throw new Error('Combined-class conflict exemption failed.');
if (manager.getTeacherConflicts('TEACHER A', '1st semester').length !== 0) throw new Error('Teacher conflict banner flags combined-class siblings.');

manager.schedules.push(row({ courseYear: 'BSME - 2A', startTime: '08:30', endTime: '09:30', room: 'R102', subject: 'PHYSICS' }));
if (!manager.checkConflicts(manager.schedules[0]).hasConflict) throw new Error('Unrelated teacher overlap was not detected.');

manager.schedules = [
    row({ courseYear: 'BSEE - 1A', subject: 'MATHEMATICS', startTime: '08:00', endTime: '09:00' })
];
if (manager.getSectionSubjectScheduledMinutes('BSEE - 1A', 'MATHEMATICS') !== 60) throw new Error('Per-section scheduled minutes are incorrect.');
if (manager.getSectionSubjectScheduledMinutes('BSME - 1A', 'MATHEMATICS') !== 0) throw new Error('Weekly minutes leaked between sections.');
if (manager.getCurriculumEntryRequiredWeeklyMinutes({ lecHours: 3, labHours: 0 }) !== 180) throw new Error('Lecture weekly-hour conversion failed.');
if (manager.getCurriculumEntryRequiredWeeklyMinutes({ lecHours: 0, labHours: 1 }) !== 180) throw new Error('Laboratory weekly-hour conversion failed.');

manager.selectedClassSections = ['BSEE - 1A', 'BSME - 1A'];
manager.curriculumCatalog = [
    { name: 'MATHEMATICS', code: 'MATH 101', program: 'BSEE', year: 1, term: '1st semester', lecHours: 3, labHours: 0 },
    { name: 'MATHEMATICS', code: 'MATH 101', program: 'BSME', year: 1, term: '1st semester', lecHours: 3, labHours: 0 },
    { name: 'THERMODYNAMICS', code: 'THERMO 101', program: 'BSEE', year: 1, term: '2nd semester', lecHours: 3, labHours: 0 },
    { name: 'THERMODYNAMICS', code: 'THERMO 101', program: 'BSME', year: 1, term: '2nd semester', lecHours: 3, labHours: 0 },
    { name: 'BSEE ONLY', code: 'EE 101', program: 'BSEE', year: 1, term: '2nd semester', lecHours: 3, labHours: 0 }
];
const normalSubjects = manager.getSubjectsForSelectedClassSections().map(item => item.name);
const crossTermSubjects = manager.getCrossTermSubjectsForSelectedClassSections('thermo').map(item => item.name);
if (normalSubjects.length !== 1 || normalSubjects[0] !== 'MATHEMATICS') throw new Error('Normal curriculum filtering is not an intersection across selected sections.');
if (crossTermSubjects.length !== 1 || crossTermSubjects[0] !== 'THERMODYNAMICS') throw new Error('Cross-term filtering accepted an unrelated program or omitted a valid exception.');

manager.term = '1st semester';
manager.curriculumCatalog = [
    { name: 'CALCULUS 1', code: 'CALC 1', program: 'BSEE', year: 1, term: '1st semester', units: 3 },
    { name: 'CURRENT YEAR SUBJECT', code: 'BSEE 401', program: 'BSEE', year: 4, term: '1st semester', units: 3 },
    { name: 'OTHER TERM SUBJECT', code: 'BSEE 402', program: 'BSEE', year: 4, term: '2nd semester', units: 3 },
    { name: 'OTHER YEAR AND TERM SUBJECT', code: 'BSEE 202', program: 'BSEE', year: 2, term: '2nd semester', units: 3 },
    { name: 'IRREGULAR NORMAL SUBJECT', code: 'BSEE 201', program: 'BSEE', year: 2, term: '1st semester', units: 3 },
    { name: 'BSEE ONLY SUBJECT', code: 'BSEE 303', program: 'BSEE', year: 3, term: '1st semester', units: 3 },
    { name: 'BSME ONLY SUBJECT', code: 'BSME 303', program: 'BSME', year: 3, term: '1st semester', units: 3 },
    { name: 'SHARED PROSPECTUS SUBJECT', code: 'SHARED 1', program: 'BSEE', year: 1, term: '1st semester', units: 3 },
    { name: 'SHARED PROSPECTUS SUBJECT', code: 'SHARED 2', program: 'BSME', year: 3, term: '2nd semester', units: 3 }
];
manager.selectedClassSections = ['BSEE - 4A'];
const regularNormalNames = manager.getSubjectsForSelectedClassSections().map(item => item.name);
const calculusSearch = manager.getCrossTermSubjectsForSelectedClassSections('calculus').map(item => item.name);
const otherTermSearch = manager.getCrossTermSubjectsForSelectedClassSections('other term').map(item => item.name);
const otherYearTermSearch = manager.getCrossTermSubjectsForSelectedClassSections('other year and term').map(item => item.name);
if (!calculusSearch.includes('CALCULUS 1')) throw new Error('Regular fourth-year search could not find a first-year subject.');
if (!otherTermSearch.includes('OTHER TERM SUBJECT')) throw new Error('Regular student search could not find a subject from another term.');
if (!otherYearTermSearch.includes('OTHER YEAR AND TERM SUBJECT')) throw new Error('Regular student search could not find a subject from another year and term.');
if (regularNormalNames.length !== 1 || regularNormalNames[0] !== 'CURRENT YEAR SUBJECT') throw new Error('Normal subject list no longer uses selected year and term.');
if (regularNormalNames.includes('CALCULUS 1')) throw new Error('Normal subject list includes a subject outside selected year and term.');
if (manager.getCurriculumEntryForProgramSubject('CALCULUS 1', 'BSEE', 4)?.year !== 1) throw new Error('Regular retake cannot resolve its prospectus entry during scheduling.');
manager.schedules = [];
if (manager.isSubjectFullyScheduledForSelectedSections(manager.curriculumCatalog.find(item => item.name === 'CALCULUS 1'))) throw new Error('A prospectus subject from another year was hidden as already fully scheduled.');

manager.selectedClassSections = ['BSEE - 2IRREGULAR'];
const irregularAnyYearSearch = manager.getCrossTermSubjectsForSelectedClassSections('other year and term').map(item => item.name);
const irregularOutsideProgramSearch = manager.getCrossTermSubjectsForSelectedClassSections('bsme only').map(item => item.name);
if (!irregularAnyYearSearch.includes('OTHER YEAR AND TERM SUBJECT')) throw new Error('Irregular section search was restricted by year or term.');
if (irregularOutsideProgramSearch.includes('BSME ONLY SUBJECT')) throw new Error('Irregular section search offered a subject outside its program prospectus.');
if (!manager.getSubjectsForSelectedClassSections().some(item => item.name === 'IRREGULAR NORMAL SUBJECT')) throw new Error('Irregular selection changed the normal selected-year/current-term subjects.');

manager.selectedClassSections = ['BSEE - 2IRREGULAR', 'BSME - 2IRREGULAR'];
const combinedSharedSearch = manager.getCrossTermSubjectsForSelectedClassSections('shared prospectus').map(item => item.name);
const combinedBseeOnlySearch = manager.getCrossTermSubjectsForSelectedClassSections('bsee only').map(item => item.name);
if (!combinedSharedSearch.includes('SHARED PROSPECTUS SUBJECT')) throw new Error('Combined multi-program search omitted a subject present in every prospectus.');
if (combinedBseeOnlySearch.includes('BSEE ONLY SUBJECT')) throw new Error('Combined multi-program search offered a subject missing from one selected program prospectus.');
global.document.getElementById = id => id === 'subjectSelect' ? { value: 'SHARED PROSPECTUS SUBJECT' } : null;
if (!manager.getSelectedCurriculumEntry()) throw new Error('Combined selected curriculum entry rejected a subject present in every selected program prospectus.');
global.document.getElementById = id => id === 'subjectSelect' ? { value: 'BSEE ONLY SUBJECT' } : null;
if (manager.getSelectedCurriculumEntry() !== null) throw new Error('Selected curriculum entry accepted a subject missing from one selected program prospectus.');

manager.selectedClassSections = ['BSEE - 1A', 'BSME - 1A'];
manager.curriculumCatalog = [
    { name: 'MATHEMATICS', code: 'MATH 101', program: 'BSEE', year: 1, term: '1st semester', lecHours: 3, labHours: 0 },
    { name: 'MATHEMATICS', code: 'MATH 101', program: 'BSME', year: 1, term: '1st semester', lecHours: 3, labHours: 0 },
    { name: 'THERMODYNAMICS', code: 'THERMO 101', program: 'BSEE', year: 1, term: '2nd semester', lecHours: 3, labHours: 0 },
    { name: 'THERMODYNAMICS', code: 'THERMO 101', program: 'BSME', year: 1, term: '2nd semester', lecHours: 3, labHours: 0 },
    { name: 'BSEE ONLY', code: 'EE 101', program: 'BSEE', year: 1, term: '2nd semester', lecHours: 3, labHours: 0 }
];

manager.schedules = [
    row({ courseYear: 'BSEE - 1A', subject: 'MATHEMATICS', startTime: '08:00', endTime: '09:00' }),
    row({ courseYear: 'BSME - 1A', subject: 'MATHEMATICS', startTime: '08:00', endTime: '09:00' })
];
if (manager.isSubjectFullyScheduledForSelectedSections(manager.curriculumCatalog[0])) throw new Error('Partially scheduled subjects were hidden too early.');
manager.schedules.push(
    row({ courseYear: 'BSEE - 1A', subject: 'MATHEMATICS', startTime: '09:00', endTime: '11:00' })
);
if (!manager.isSubjectFullyScheduledForSelectedSections(manager.curriculumCatalog[0])) throw new Error('A fully scheduled selected section did not block an additional combined assignment.');

manager.schedules = [
    row({ combinedClassId: combinedId, courseYear: 'BSEE - 1A' }),
    row({ combinedClassId: combinedId, courseYear: 'BSME - 1A', program: 'BSME' }),
    row({ combinedClassId: combinedId, courseYear: 'BSME - 1B', program: 'BSME' }),
    row({ subject: 'PHYSICS', courseCode: 'PHY 101' }),
    row({ subject: 'CHEMISTRY', courseCode: 'CHEM 101' }),
    row({ subject: 'ENGLISH', courseCode: 'ENG 101' }),
    row({ subject: 'PROGRAMMING', courseCode: 'CS 101' }),
    row({ subject: 'STATICS', courseCode: 'ME 101' })
];
if (manager.getTeacherDistinctSubjects('TEACHER A').length !== 6) throw new Error('Combined class was counted as multiple teacher subjects.');
if (manager.canTeacherTakeSubject('TEACHER A', 'SEVENTH SUBJECT', 'BSEE').allowed) throw new Error('Teacher seven-subject limit was not enforced.');
if (manager.getSubjectEquivalencyKey('ETHICS', 'BSEE') !== manager.getSubjectEquivalencyKey('ETHICS', 'BSME')) throw new Error('Common-subject equivalency regressed.');

manager.schedules = [
    row({ combinedClassId: combinedId, courseYear: 'BSEE - 1A', courseCode: 'GE AA' }),
    row({ combinedClassId: combinedId, courseYear: 'BSME - 1A', program: 'BSME', courseCode: 'GEAA' }),
    row({ combinedClassId: combinedId, courseYear: 'BSME - 1B', program: 'BSME', courseCode: 'GEAA' })
];
const logicalRows = manager.getLogicalScheduleRows(manager.schedules);
if (logicalRows.length !== 1 || logicalRows[0].displayCourseYear !== 'BSEE - 1A + BSME - 1A + BSME - 1B') throw new Error('Combined rows were not grouped for room reporting.');
const load = manager.generateTeacherLoadElement('TEACHER A', '1st semester').innerHTML;
if (!load.includes('BSEE - 1A + BSME - 1A + BSME - 1B')) throw new Error('Teacher load did not combine sections for display.');
if (!load.includes('Regular Teaching Load</strong> &nbsp;&nbsp;: 3')) throw new Error('Teacher load multiplied a combined class.');
if (!load.includes('GE AA') || load.includes('GE AA / GEAA')) throw new Error('Teacher load did not choose one representative combined-class course code.');
const firstMeetingRows = [...manager.schedules];
const secondMeetingRows = firstMeetingRows.map((schedule, index) => ({
    ...schedule,
    id: `second-meeting-${index}`,
    day: 'Thursday'
}));
manager.schedules = [...firstMeetingRows, ...secondMeetingRows];
const multipleMeetingRows = manager.getLogicalScheduleRows(manager.schedules);
if (multipleMeetingRows.length !== 2) throw new Error('Different meetings under one combined ID were collapsed.');
if (multipleMeetingRows.some(schedule => schedule.displayCourseYear !== 'BSEE - 1A + BSME - 1A + BSME - 1B')) throw new Error('A combined meeting did not retain all sections.');
if (manager.getAllConflicts().length) throw new Error('Sibling section rows across meetings were reported as conflicts.');
manager.schedules.push(row({
    combinedClassId: combinedId,
    day: 'Monday',
    startTime: '08:30',
    endTime: '09:30',
    room: 'R101'
}));
if (!manager.checkConflicts(manager.schedules[0]).hasConflict) throw new Error('Overlapping meetings under one combined ID were not detected during validation.');
if (!manager.getTeacherConflicts('TEACHER A', '1st semester').length) throw new Error('Teacher conflict report missed overlapping meetings under one combined ID.');
if (!manager.getAllConflicts().length) throw new Error('Dashboard conflict report missed overlapping meetings under one combined ID.');
manager.schedules = [...firstMeetingRows, ...secondMeetingRows];
manager.roomDetails = {};
manager.getColorForSubject = () => '#ffffff';
manager.getTextColorForBg = () => '#000000';
const grid = manager.buildScheduleGrid(manager.schedules, ['Monday', 'Thursday'], [{ start: '08:00', end: '08:30', label: '8:00 AM - 8:30 AM' }, { start: '08:30', end: '09:00', label: '8:30 AM - 9:00 AM' }], 'teacher');
if ((grid.split('BSEE - 1A + BSME - 1A + BSME - 1B').length - 1) !== 2) throw new Error('Teacher timetable did not render every meeting with all sibling sections.');

const prerequisitesButton = { disabled: true, title: '' };
const prerequisiteElements = {
    teacherSelect: { value: 'TEACHER A' },
    subjectSelect: { value: 'MATHEMATICS' }
};
global.document.getElementById = id => prerequisiteElements[id] || null;
global.document.querySelector = selector => selector === '#scheduleForm .btn-add' ? prerequisitesButton : null;
manager.selectedClassSections = ['BSEE - 1A'];
manager.teachers = ['TEACHER A'];
manager.rooms = ['R101'];
manager.checkPrereqs();
if (prerequisitesButton.disabled) throw new Error('Multi-section schedule prerequisite check still depends on removed single-section controls.');

const editFields = {
    ownerEditId: { value: firstMeetingRows[0].id },
    ownerEditSection: { value: 'A' },
    ownerEditTerm: { value: '1st semester' },
    ownerEditTeacher: { value: 'TEACHER A' },
    ownerEditSubject: { value: 'ART APPRECIATION' },
    ownerEditDay: { value: 'Monday' },
    ownerEditStart: { value: '07:30' },
    ownerEditEnd: { value: '09:00' },
    ownerEditBuilding: { value: 'MAIN' },
    ownerEditRoom: { value: 'R101' }
};
global.document.getElementById = id => editFields[id] || null;
manager.editingCombinedClassId = combinedId;
manager.remoteEnabled = false;
manager.saveSchedules = () => {};
manager.closeOwnerEdit = () => { manager.editingCombinedClassId = null; };
manager.render = () => {};
manager.showNotification = () => {};
manager.showEditMessage = message => { throw new Error(message); };

manager.saveOwnerEdit({ preventDefault() {} }).then(() => {
    if (manager.schedules.filter(schedule => schedule.day === 'Monday').some(schedule => schedule.startTime !== '07:30')) {
        throw new Error('Combined meeting edit did not update all section sibling rows.');
    }
    if (manager.schedules.filter(schedule => schedule.day === 'Thursday').some(schedule => schedule.startTime !== '08:00')) {
        throw new Error('Combined meeting edit overwrote a different meeting.');
    }
    console.log('Scheduling logic QA passed.');
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});

/*
 * Non-destructive regression checks for scheduling-domain logic.
 * Run with: node qa-scheduler-logic.js
 */
const fs = require('fs');
require('./js/owner/owner-dashboard.js');

const ownerDashboardPresentation =
    globalThis.ScheduleStudioOwnerDashboard.getOwnerDashboardPresentation({
        registeredUserCount: 4
    });
if (
    ownerDashboardPresentation.scheduleCount !== 4 ||
    ownerDashboardPresentation.scheduleLabel !== 'Registered users' ||
    ownerDashboardPresentation.scheduleNote !== '' ||
    ownerDashboardPresentation.hideStatCardsAfterIndex !== 0
) {
    throw new Error('Owner dashboard presentation instructions are incorrect.');
}

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

eval(fs.readFileSync('curriculum-catalog.js', 'utf8'));
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

const periodTwo = { id: 'period-2', owner_id: 'owner-1', school_year: '2027–2028', term: '1st semester' };
manager.schedulePeriods = [periodTwo];
manager.activeSchedulePeriod = { id: 'period-1', term: '2nd semester' };
manager.getSchedulePeriodStorageKey = () => 'active-period';
manager.getActivePeriodSessionKey = () => 'session-period';
global.localStorage = { setItem() {} };
global.sessionStorage = { setItem() {} };
global.document.getElementById = () => null;
manager.schedules = [row({ schedulePeriodId: 'period-1' })];
manager.ownerAllSchedules = [...manager.schedules];
manager.periodRequestId = 10;
if (!manager.setActiveSchedulePeriod(periodTwo)) throw new Error('Could not activate a valid schedule period.');
if (manager.schedules.length || manager.ownerAllSchedules.length) throw new Error('Changing schedule periods retained stale schedule rows.');
if (manager.periodRequestId !== 11) throw new Error('Changing schedule periods did not invalidate an older period request.');
if (manager.getCurrentSchoolYear() !== periodTwo.school_year) throw new Error('Active schedule period is not the source of truth for the school year.');
manager.activeSchedulePeriod = { id: 'period-1', term: '1st semester' };
manager.term = '1st semester';
manager.periodRequestId = 0;

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
const reviewEntries = global.window.CURRICULUM_CATALOG.filter(entry =>
    /(?:^|\s)review [12]$/i.test(String(entry.name || '').trim()) &&
    ['BSCE', 'BSEE', 'BSME'].includes(entry.program) &&
    Number(entry.year) === 4 &&
    ['1st semester', '2nd semester'].includes(entry.term)
);
if (reviewEntries.length !== 6) throw new Error('Expected all six fourth-year engineering Review 1/2 curriculum entries.');
for (const entry of reviewEntries) {
    if (
        manager.getCurriculumEntryRequiredWeeklyMinutes(entry) !== 360 ||
        entry.units !== 3 ||
        entry.lecHours !== 3 ||
        entry.labHours !== 0
    ) {
        throw new Error(`${entry.name} should have six scheduling hours while retaining three curriculum units/hours.`);
    }
}
const standardThreeHourEntry = {
    name: 'STANDARD THREE-HOUR SUBJECT',
    program: 'BSCE',
    year: 4,
    term: '1st semester',
    units: 3,
    lecHours: 3,
    labHours: 0,
    delivery: 'lec'
};
if (
    manager.getCurriculumEntryRequiredWeeklyMinutes(standardThreeHourEntry) !== 180 ||
    manager.getCurriculumEntryRequiredWeeklyMinutes({
        ...standardThreeHourEntry,
        name: 'CE Review 1',
        year: 3
    }) !== 180 ||
    manager.getCurriculumEntryRequiredWeeklyMinutes({
        ...standardThreeHourEntry,
        name: 'CE Review 2',
        term: 'summer'
    }) !== 180 ||
    manager.getCurriculumEntryRequiredWeeklyMinutes({
        ...standardThreeHourEntry,
        name: 'CE Review 3'
    }) !== 180
) {
    throw new Error('The Review capacity exception affected an ineligible or normal subject.');
}
const reviewEntry = reviewEntries.find(entry =>
    entry.program === 'BSCE' && entry.name === 'CE Review 1'
);
const reviewManager = Object.create(globalThis.ScheduleManagerForQa.prototype);
reviewManager.activeSchedulePeriod = { id: 'period-1', term: '1st semester' };
reviewManager.curriculumCatalog = [reviewEntry];
reviewManager.selectedClassSections = ['BSCE - 4A'];
reviewManager.schedules = [
    row({
        subject: reviewEntry.name,
        courseCode: reviewEntry.code,
        program: reviewEntry.program,
        courseYear: 'BSCE - 4A',
        units: reviewEntry.units,
        lecHours: reviewEntry.lecHours,
        labHours: reviewEntry.labHours,
        delivery: reviewEntry.delivery,
        startTime: '08:00',
        endTime: '11:00'
    })
];
if (
    reviewManager.isSubjectFullyScheduledForSelectedSections(reviewEntry) ||
    !reviewManager.getSelectedSubjectRemainingHours(reviewEntry).join('; ').includes('3h remaining')
) {
    throw new Error('A three-hour Review schedule should leave three of its six scheduling hours available.');
}
reviewManager.schedules.push(
    row({
        id: 'review-second-meeting',
        subject: reviewEntry.name,
        courseCode: reviewEntry.code,
        program: reviewEntry.program,
        courseYear: 'BSCE - 4A',
        units: reviewEntry.units,
        lecHours: reviewEntry.lecHours,
        labHours: reviewEntry.labHours,
        delivery: reviewEntry.delivery,
        startTime: '11:00',
        endTime: '14:00'
    })
);
if (!reviewManager.isSubjectFullyScheduledForSelectedSections(reviewEntry)) {
    throw new Error('Review should be fully scheduled after six actual weekly hours.');
}
const reviewLoad = reviewManager.generateTeacherLoadElement('TEACHER A', '1st semester').innerHTML;
const reviewLoadRow = reviewLoad
    .split('</tr>')
    .find(rowHtml => rowHtml.includes('CE REV 1'));
const reviewLoadCells = reviewLoadRow?.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
const reviewCredits = reviewLoadCells
    .slice(3, 5)
    .map(cell => cell.replace(/<[^>]*>/g, '').trim());
if (
    reviewCredits[0] !== '3' ||
    reviewCredits[1] !== '6' ||
    !reviewLoad.includes('CE REV 1') ||
    !reviewLoad.includes('8:00 AM') ||
    !reviewLoad.includes('11:00 AM') ||
    !reviewLoad.includes('2:00 PM')
) {
    throw new Error('Review teacher load should retain three units, show six scheduled hours, and display both actual meeting times.');
}

const reviewSchedule = (overrides = {}) => row({
    subject: reviewEntry.name,
    courseCode: reviewEntry.code,
    program: reviewEntry.program,
    year: 4,
    courseYear: 'BSCE - 4A',
    units: reviewEntry.units,
    lecHours: reviewEntry.lecHours,
    labHours: reviewEntry.labHours,
    delivery: reviewEntry.delivery,
    ...overrides
});
const getLoadRowValues = (loadHtml, subjectName) => {
    const loadRow = loadHtml
        .split('</tr>')
        .find(rowHtml =>
            rowHtml.toLowerCase().includes(subjectName.toLowerCase())
        );
    const cells = loadRow?.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    return cells.map(cell => cell.replace(/<[^>]*>/g, '').trim());
};
const getTotalLoadValues = loadHtml => {
    const totalRow = loadHtml
        .split('</tr>')
        .find(rowHtml => rowHtml.includes('<strong>TOTAL</strong>'));
    const cells = totalRow?.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    return cells.map(cell => cell.replace(/<[^>]*>/g, '').trim());
};
const getLoadSummaryValues = loadHtml => {
    const summary = loadHtml.match(
        /<strong>Regular Teaching Load<\/strong>[^<]*: ([^<]+)<\/div>[\s\S]*?<strong>Overload<\/strong>[^<]*: ([^<]+)<\/div>/
    );
    return summary ? summary.slice(1).map(value => value.trim()) : [];
};
const reviewHourCases = [
    { hours: 4, startTime: '08:00', endTime: '10:00' },
    { hours: 6, startTime: '08:00', endTime: '11:00' },
    { hours: 8, startTime: '08:00', endTime: '12:00' }
];
for (const { hours, startTime, endTime } of reviewHourCases) {
    reviewManager.schedules = [
        reviewSchedule({ day: 'Monday', startTime, endTime }),
        reviewSchedule({ day: 'Wednesday', startTime, endTime })
    ];
    const reviewLoadHtml = reviewManager.generateTeacherLoadElement(
        'TEACHER A',
        '1st semester'
    ).innerHTML;
    const loadValues = getLoadRowValues(
        reviewLoadHtml,
        'CE REV 1'
    );
    const totalLoadValues = getTotalLoadValues(reviewLoadHtml);
    if (
        loadValues[3] !== '3' ||
        loadValues[4] !== String(hours) ||
        totalLoadValues[1] !== '3' ||
        totalLoadValues[2] !== String(hours) ||
        !loadValues[6].includes(`${reviewManager.formatTime(startTime)} - ${reviewManager.formatTime(endTime)}`) ||
        loadValues[7] !== 'Monday, Wednesday'
    ) {
        throw new Error(`A ${hours}-hour Review schedule should report three units and ${hours} actual hours across both meeting days.`);
    }
}

reviewManager.schedules = [
    row({
        subject: 'STANDARD THREE-HOUR SUBJECT',
        courseCode: 'STD 101',
        program: 'BSCE',
        year: 4,
        courseYear: 'BSCE - 4A',
        units: 3,
        lecHours: 3,
        labHours: 0,
        delivery: 'lec',
        day: 'Monday',
        startTime: '08:00',
        endTime: '10:00'
    }),
    row({
        subject: 'STANDARD THREE-HOUR SUBJECT',
        courseCode: 'STD 101',
        program: 'BSCE',
        year: 4,
        courseYear: 'BSCE - 4A',
        units: 3,
        lecHours: 3,
        labHours: 0,
        delivery: 'lec',
        day: 'Wednesday',
        startTime: '08:00',
        endTime: '10:00'
    })
];
const standardLoadValues = getLoadRowValues(
    reviewManager.generateTeacherLoadElement('TEACHER A', '1st semester').innerHTML,
    'STANDARD THREE-HOUR SUBJECT'
);
if (standardLoadValues[3] !== '3' || standardLoadValues[4] !== '3') {
    throw new Error('Non-Review teacher-load hours should retain the curriculum calculation.');
}

const teachingLoadSchedules = (courseCount, mixedCourseCount = 0) =>
    Array.from({ length: courseCount }, (_, index) => {
        const isMixed = index < mixedCourseCount;
        return row({
            subject: `LOAD TEST SUBJECT ${index + 1}`,
            courseCode: `LOAD ${index + 1}`,
            units: 3,
            lecHours: isMixed ? 2 : 3,
            labHours: isMixed ? 1 : 0,
            delivery: isMixed ? 'lec/lab' : 'lec'
        });
    });

const loadComponentCases = [
    {
        name: 'lecture-only',
        schedule: { units: 3, lecHours: 3, labHours: 0, delivery: 'lec' },
        expectedUnits: '3',
        expectedHours: '3'
    },
    {
        name: 'laboratory-only',
        schedule: { units: 1, lecHours: 0, labHours: 1, delivery: 'lab' },
        expectedUnits: '1',
        expectedHours: '3'
    },
    {
        name: 'mixed lecture/laboratory',
        schedule: { units: 3, lecHours: 2, labHours: 1, delivery: 'lec/lab' },
        expectedUnits: '3',
        expectedHours: '5'
    }
];
for (const testCase of loadComponentCases) {
    reviewManager.schedules = [
        row({
            subject: `LOAD ${testCase.name.toUpperCase()}`,
            courseCode: `LOAD ${testCase.name}`,
            ...testCase.schedule
        })
    ];
    const loadHtml = reviewManager.generateTeacherLoadElement(
        'TEACHER A',
        '1st semester'
    ).innerHTML;
    const rowValues = getLoadRowValues(loadHtml, `LOAD ${testCase.name}`);
    const totalValues = getTotalLoadValues(loadHtml);
    if (
        rowValues[3] !== testCase.expectedUnits ||
        rowValues[4] !== testCase.expectedHours ||
        totalValues[1] !== testCase.expectedUnits ||
        totalValues[2] !== testCase.expectedHours
    ) {
        throw new Error(
            `${testCase.name} teaching load should report ${testCase.expectedUnits} units and ${testCase.expectedHours} teaching hours.`
        );
    }
}

const teachingLoadCases = [
    {
        name: 'below the regular-load limit',
        schedules: teachingLoadSchedules(4),
        expectedUnits: '12',
        expectedHours: '12',
        expectedRegular: '12',
        expectedOverload: '0'
    },
    {
        name: 'at the regular-load limit',
        schedules: teachingLoadSchedules(8),
        expectedUnits: '24',
        expectedHours: '24',
        expectedRegular: '24',
        expectedOverload: '0'
    },
    {
        name: 'above the regular-load limit',
        schedules: teachingLoadSchedules(8, 2),
        expectedUnits: '24',
        expectedHours: '28',
        expectedRegular: '24',
        expectedOverload: '4'
    }
];
for (const testCase of teachingLoadCases) {
    reviewManager.schedules = testCase.schedules;
    const loadHtml = reviewManager.generateTeacherLoadElement(
        'TEACHER A',
        '1st semester'
    ).innerHTML;
    const totalValues = getTotalLoadValues(loadHtml);
    const summaryValues = getLoadSummaryValues(loadHtml);
    if (
        totalValues[1] !== testCase.expectedUnits ||
        totalValues[2] !== testCase.expectedHours ||
        summaryValues[0] !== testCase.expectedRegular ||
        summaryValues[1] !== testCase.expectedOverload
    ) {
        throw new Error(
            `${testCase.name} should report ${testCase.expectedUnits} units, ${testCase.expectedHours} teaching hours, ${testCase.expectedRegular} regular hours, and ${testCase.expectedOverload} overload hours.`
        );
    }
}

reviewManager.schedules = [
    row({
        subject: 'CE REVIEW 1',
        courseCode: 'CE REV 1',
        program: 'BSCE',
        year: 3,
        courseYear: 'BSCE - 3A',
        units: 3,
        lecHours: 3,
        labHours: 0,
        delivery: 'lec',
        day: 'Monday',
        startTime: '08:00',
        endTime: '10:00'
    }),
    row({
        subject: 'CE REVIEW 1',
        courseCode: 'CE REV 1',
        program: 'BSCE',
        year: 3,
        courseYear: 'BSCE - 3A',
        units: 3,
        lecHours: 3,
        labHours: 0,
        delivery: 'lec',
        day: 'Wednesday',
        startTime: '08:00',
        endTime: '10:00'
    })
];
const ineligibleReviewValues = getLoadRowValues(
    reviewManager.generateTeacherLoadElement('TEACHER A', '1st semester').innerHTML,
    'CE REV 1'
);
if (ineligibleReviewValues[3] !== '3' || ineligibleReviewValues[4] !== '3') {
    throw new Error('Ineligible Review subjects should retain their existing teaching-load calculation.');
}

const combinedReviewId = 'combined-review-load';
reviewManager.schedules = [
    reviewSchedule({
        combinedClassId: combinedReviewId,
        day: 'Monday',
        startTime: '08:00',
        endTime: '12:00'
    }),
    reviewSchedule({
        combinedClassId: combinedReviewId,
        program: 'BSEE',
        courseYear: 'BSEE - 4A',
        day: 'Monday',
        startTime: '08:00',
        endTime: '12:00'
    })
];
const combinedReviewLoad = reviewManager.generateTeacherLoadElement(
    'TEACHER A',
    '1st semester'
).innerHTML;
const combinedReviewRows = combinedReviewLoad
    .split('</tr>')
    .filter(rowHtml => rowHtml.includes('CE REV 1'));
const combinedReviewValues = getLoadRowValues(combinedReviewLoad, 'CE REV 1');
const combinedReviewTotals = getTotalLoadValues(combinedReviewLoad);
if (
    combinedReviewRows.length !== 1 ||
    combinedReviewValues[3] !== '3' ||
    combinedReviewValues[4] !== '4' ||
    combinedReviewTotals[2] !== '4'
) {
    throw new Error('Combined Review schedule records should appear once and count their shared meeting once.');
}

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
const teacherSubjectRows = count =>
    Array.from({ length: count }, (_, index) =>
        row({ subject: `TEST SUBJECT ${index + 1}` })
    );
manager.schedules = teacherSubjectRows(5);
const sixthSubject = manager.canTeacherTakeSubject('TEACHER A', 'TEST SUBJECT 6', 'BSEE');
if (!sixthSubject.allowed || sixthSubject.subjectCount !== 6) throw new Error('Teacher six-subject boundary was not allowed.');
manager.schedules = teacherSubjectRows(6);
if (manager.getTeacherDistinctSubjects('TEACHER A').length !== 6) throw new Error('Distinct-subject counting changed at six subjects.');
const seventhSubject = manager.canTeacherTakeSubject('TEACHER A', 'TEST SUBJECT 7', 'BSEE');
if (!seventhSubject.allowed || seventhSubject.subjectCount !== 7) throw new Error('Teacher seven-subject boundary was not allowed.');
manager.schedules = teacherSubjectRows(24);
const twentyFifthSubject = manager.canTeacherTakeSubject('TEACHER A', 'TEST SUBJECT 25', 'BSEE');
if (!twentyFifthSubject.allowed || twentyFifthSubject.subjectCount !== 25) throw new Error('Teacher twenty-five-subject boundary was not allowed.');
manager.schedules = teacherSubjectRows(25);
if (manager.getTeacherDistinctSubjects('TEACHER A').length !== 25) throw new Error('Distinct-subject counting changed at twenty-five subjects.');
if (manager.canTeacherTakeSubject('TEACHER A', 'TEST SUBJECT 26', 'BSEE').allowed) throw new Error('Teacher twenty-six-subject limit was not enforced.');
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
const schedulesBeforeRoomPdfTest = manager.schedules;
manager.schedules = [
    row({
        courseCode: 'ROOM TEST 101',
        subject: 'ROOM TEST',
        building: 'BUILDING A',
        room: '205',
        startTime: '08:00',
        endTime: '09:00'
    }),
    row({
        id: 'room-test-second-meeting',
        courseCode: 'ROOM TEST 101',
        subject: 'ROOM TEST',
        building: 'BUILDING B',
        room: '204',
        startTime: '09:00',
        endTime: '10:00'
    })
];
const multilineRoomLoad =
    manager.generateTeacherLoadElement('TEACHER A', '1st semester').innerHTML;
if (
    !multilineRoomLoad.includes('205<br>204') ||
    !multilineRoomLoad.includes('BUILDING A<br>BUILDING B') ||
    multilineRoomLoad.includes('205&lt;br&gt;204') ||
    multilineRoomLoad.includes('BUILDING A&lt;br&gt;BUILDING B')
) {
    throw new Error('Teacher load PDF did not render multiple room/building values as separate lines.');
}
manager.schedules = schedulesBeforeRoomPdfTest;
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

async function verifyCurriculumComponentOptions() {
    const componentManager =
        Object.create(globalThis.ScheduleManagerForQa.prototype);
    const projectEntries = global.window.CURRICULUM_CATALOG.filter(entry =>
        entry.program === 'BSCE' &&
        Number(entry.year) === 4 &&
        String(entry.term).toLowerCase() === '2nd semester' &&
        String(entry.name).toLowerCase() === 'ce project 2'
    );
    const lec = projectEntries.find(entry => entry.delivery === 'lec');
    const lab = projectEntries.find(entry => entry.delivery === 'lab');
    if (!lec || !lab) {
        throw new Error('Curriculum catalog is missing the audited CE Project 2 components.');
    }
    const subjectInput = { value: '', disabled: false };
    const subjectList = { innerHTML: '', hidden: true };
    const originalGetElementById = global.document.getElementById;

    componentManager.term = '2nd semester';
    componentManager.activeSchedulePeriod = { id: 'period-1', term: '2nd semester' };
    componentManager.selectedClassSections = ['BSCE - 4A'];
    componentManager.curriculumCatalog = [lec, lab, {
        program: 'BSCE', year: 4, term: '1st semester',
        code: 'CE-18', name: 'Current Term Subject',
        lecHours: 3, labHours: 0, units: 3, delivery: 'lec'
    }];
    componentManager.selectedCurriculumOptionKey = null;
    componentManager.schedules = [];
    componentManager.updateSelectedSubjectDetails = () => {};
    global.document.getElementById = id =>
        id === 'subjectSelect' ? subjectInput :
        id === 'subjectOptions' ? subjectList :
        null;

    const normalComponents =
        componentManager.getSubjectsForSelectedClassSections();
    if (
        normalComponents.length !== 2 ||
        !normalComponents.some(entry => entry.code === lec.code) ||
        !normalComponents.some(entry => entry.code === lab.code)
    ) {
        throw new Error('Normal subject options collapsed CE Project 2 LEC/LAB components.');
    }
    global.document.activeElement = null;
    componentManager.renderSubjectOptions('CE pro');
    if (
        !subjectList.innerHTML.includes('CE-19 LEC') ||
        !subjectList.innerHTML.includes('CE-19 LAB') ||
        !subjectList.innerHTML.includes('lec') ||
        !subjectList.innerHTML.includes('lab') ||
        !subjectList.innerHTML.includes('data-curriculum-key')
    ) {
        throw new Error('Subject dropdown did not display both CE Project 2 components.');
    }

    for (const entry of [lec, lab]) {
        subjectInput.value = entry.name;
        componentManager.selectedCurriculumOptionKey =
            componentManager.getCurriculumOptionKey(entry);
        const resolved = componentManager.getSelectedCurriculumEntry();
        if (!resolved || resolved.code !== entry.code) {
            throw new Error(`Selection did not resolve ${entry.code}.`);
        }
    }

    componentManager.schedules = [
        row({
            subject: lec.name, courseCode: lec.code, delivery: lec.delivery,
            lecHours: lec.lecHours, labHours: lec.labHours,
            courseYear: 'BSCE - 4A', schedulePeriodId: 'period-1',
            startTime: '08:00', endTime: '09:00'
        }),
        row({
            subject: lab.name, courseCode: lab.code, delivery: lab.delivery,
            lecHours: lab.lecHours, labHours: lab.labHours,
            courseYear: 'BSCE - 4A', schedulePeriodId: 'period-1',
            startTime: '09:00', endTime: '12:00'
        })
    ];
    if (
        componentManager.getSectionSubjectScheduledMinutes('BSCE - 4A', lec.name, lec) !== 60 ||
        componentManager.getSectionSubjectScheduledMinutes('BSCE - 4A', lab.name, lab) !== 180 ||
        componentManager.getSubjectRequiredWeeklyMinutes(lec.name, 'BSCE', lec) !== 60 ||
        componentManager.getSubjectRequiredWeeklyMinutes(lab.name, 'BSCE', lab) !== 180
    ) {
        throw new Error('Scheduled minutes were not separated by curriculum component.');
    }
    componentManager.schedules = [
        row({
            subject: lec.name, courseCode: lec.code, delivery: lec.delivery,
            lecHours: lec.lecHours, labHours: lec.labHours,
            courseYear: 'BSCE - 4A', schedulePeriodId: 'period-1',
            startTime: '08:00', endTime: '09:00'
        })
    ];
    if (componentManager.isSubjectFullyScheduledForSelectedSections(lab)) {
        throw new Error('Completing LEC incorrectly marked LAB fully scheduled.');
    }
    const lecRemaining =
        componentManager.getSelectedSubjectRemainingHours(lec).join('; ');
    const labRemaining =
        componentManager.getSelectedSubjectRemainingHours(lab).join('; ');
    if (
        !lecRemaining.includes('0h remaining') ||
        !labRemaining.includes('3h remaining')
    ) {
        throw new Error('Remaining hours did not use the selected curriculum component.');
    }
    componentManager.schedules.push(
        row({
            subject: lab.name, courseCode: lab.code, delivery: lab.delivery,
            lecHours: lab.lecHours, labHours: lab.labHours,
            courseYear: 'BSCE - 4A', schedulePeriodId: 'period-1',
            startTime: '09:00', endTime: '12:00'
        })
    );
    if (
        !componentManager.isSubjectFullyScheduledForSelectedSections(lec) ||
        !componentManager.isSubjectFullyScheduledForSelectedSections(lab)
    ) {
        throw new Error('LEC/LAB fully-scheduled checks did not remain independent.');
    }
    componentManager.schedules = [componentManager.schedules[1]];
    if (componentManager.isSubjectFullyScheduledForSelectedSections(lec)) {
        throw new Error('Completing LAB incorrectly marked LEC fully scheduled.');
    }

    componentManager.schedules = [
        row({
            subject: lec.name,
            courseYear: 'BSCE - 4A',
            schedulePeriodId: 'period-1',
            startTime: '08:00',
            endTime: '09:00'
        })
    ];
    if (
        componentManager.getSectionSubjectScheduledMinutes(
            'BSCE - 4A',
            lec.name,
            lec
        ) !== 0 ||
        componentManager.getSectionSubjectScheduledMinutes(
            'BSCE - 4A',
            lab.name,
            lab
        ) !== 0
    ) {
        throw new Error('Ambiguous legacy schedule data was assigned to a LEC/LAB component.');
    }

    componentManager.term = '1st semester';
    const exceptionComponents =
        componentManager.getCrossTermSubjectsForSelectedClassSections('CE pro');
    if (
        exceptionComponents.length !== 2 ||
        !exceptionComponents.some(entry => entry.code === lec.code) ||
        !exceptionComponents.some(entry => entry.code === lab.code)
    ) {
        throw new Error('Prospectus exception search collapsed CE Project 2 LEC/LAB.');
    }

    componentManager.term = '1st semester';
    componentManager.selectedClassSections = ['BSEE - 1A', 'BSME - 1A'];
    componentManager.curriculumCatalog = [
        {
            program: 'BSEE', year: 1, term: '1st semester',
            code: 'SHARED-LEC', name: 'Shared Component Subject',
            lecHours: 3, labHours: 0, units: 3, delivery: 'lec'
        },
        {
            program: 'BSEE', year: 1, term: '1st semester',
            code: 'SHARED-LAB', name: 'Shared Component Subject',
            lecHours: 0, labHours: 1, units: 1, delivery: 'lab'
        },
        {
            program: 'BSME', year: 1, term: '1st semester',
            code: 'SHARED-LEC', name: 'Shared Component Subject',
            lecHours: 3, labHours: 0, units: 3, delivery: 'lec'
        },
        {
            program: 'BSEE', year: 1, term: '1st semester',
            code: 'UNIQUE-101', name: 'Single Component Subject',
            lecHours: 3, labHours: 0, units: 3, delivery: 'lec'
        },
        {
            program: 'BSME', year: 1, term: '1st semester',
            code: 'UNIQUE-101', name: 'Single Component Subject',
            lecHours: 3, labHours: 0, units: 3, delivery: 'lec'
        }
    ];
    const combinedOptions =
        componentManager.getSubjectsForSelectedClassSections();
    if (
        combinedOptions.filter(entry =>
            entry.name === 'Shared Component Subject'
        ).length !== 1 ||
        combinedOptions.some(entry =>
            entry.name === 'Shared Component Subject' &&
            entry.delivery !== 'lec'
        )
    ) {
        throw new Error('Multi-program options included a component missing from one program.');
    }
    if (
        combinedOptions.filter(entry =>
            entry.name === 'Single Component Subject'
        ).length !== 1
    ) {
        throw new Error('Ordinary single-component subject behavior changed.');
    }
    subjectInput.value = 'Shared Component Subject';
    componentManager.selectedCurriculumOptionKey =
        componentManager.getCurriculumOptionKey(
            componentManager.curriculumCatalog[0]
        );
    if (!componentManager.getSelectedCurriculumEntry()) {
        throw new Error('Compatible component did not resolve across selected programs.');
    }
    componentManager.selectedCurriculumOptionKey =
        componentManager.getCurriculumOptionKey(
            componentManager.curriculumCatalog[1]
        );
    if (componentManager.getSelectedCurriculumEntry() !== null) {
        throw new Error('Selection accepted a component missing from one selected program.');
    }

    componentManager.term = '2nd semester';
    componentManager.activeSchedulePeriod.term = '2nd semester';
    componentManager.selectedClassSections = ['BSCE - 4A'];
    componentManager.curriculumCatalog = [lec, lab];
    componentManager.schedules = [];
    componentManager.remoteEnabled = false;
    componentManager.ownerViewingUserId = null;
    componentManager.currentUser = { id: 'user-1' };
    componentManager.roomDetails = {};
    componentManager.getTeacherDistinctSubjects = () => [];
    componentManager.getSubjectEquivalencyKey = (subject, program) =>
        `${program}:${subject}`;
    componentManager.saveSchedules = () => {};
    componentManager.showNotification = (message, type) => {
        if (type === 'error') throw new Error(message);
    };
    componentManager.validateSchedule =
        globalThis.ScheduleManagerForQa.prototype.validateSchedule;
    componentManager.checkConflicts = () => ({
        hasConflict: false,
        conflicts: []
    });
    componentManager.renderTeacherOptions = () => {};
    componentManager.renderCourseOptions = () => {};
    componentManager.renderClassSectionOptions = () => {};
    componentManager.renderSubjectOptions = () => {};
    componentManager.render = () => {};
    componentManager.resetScheduleSlots = () => {};
    componentManager.updateRoomOptions = () => {};
    componentManager.createLocalScheduleId = (() => {
        let id = 0;
        return () => `component-schedule-${++id}`;
    })();

    const slotValues = { room: 'R101', startTime: '08:00', endTime: '09:00' };
    const scheduleSlot = {
        querySelector(selector) {
            if (selector === 'input[name="days"]:checked') {
                return { value: 'Monday' };
            }
            const match = selector.match(/\[data-field="([^"]+)"\]/);
            return match ? { value: slotValues[match[1]] || '' } : null;
        },
        querySelectorAll(selector) {
            return selector === 'input[name="days"]:checked'
                ? [{ value: 'Monday' }]
                : [];
        }
    };
    global.document.getElementById = id =>
        id === 'subjectSelect' ? subjectInput :
        id === 'teacherSelect' ? { value: 'TEACHER A' } :
        id === 'scheduleForm' ? { reset() {} } :
        null;
    global.document.querySelectorAll = selector =>
        selector === '#scheduleSlots .schedule-slot' ? [scheduleSlot] : [];

    for (const entry of [lec, lab]) {
        componentManager.selectedClassSections = ['BSCE - 4A'];
        subjectInput.value = entry.name;
        componentManager.selectedCurriculumOptionKey =
            componentManager.getCurriculumOptionKey(entry);
        await componentManager.handleAddSchedule({
            preventDefault() {}
        });
        const created = componentManager.schedules.at(-1);
        if (
            !created ||
            created.courseCode !== entry.code ||
            created.delivery !== entry.delivery ||
            created.lecHours !== entry.lecHours ||
            created.labHours !== entry.labHours
        ) {
            throw new Error(`Schedule creation did not preserve ${entry.code} component data.`);
        }
    }

    componentManager.schedules = [
        row({
            subject: 'CE Project 2',
            courseCode: 'CE-19 LEC',
            delivery: 'lec',
            courseYear: 'BSCE - 4A',
            day: 'Monday',
            startTime: '08:00',
            endTime: '09:00',
            room: 'MPY 205'
        }),
        row({
            subject: 'CE Project 2',
            courseCode: 'CE-19 LAB',
            delivery: 'lab',
            courseYear: 'BSCE - 4A',
            day: 'Monday',
            startTime: '13:00',
            endTime: '16:00',
            room: 'MPY 204'
        }),
        row({
            subject: 'MATHEMATICS',
            courseCode: 'MATH 101',
            delivery: '',
            courseYear: 'BSCE - 4A',
            day: 'Monday',
            startTime: '16:00',
            endTime: '17:00',
            room: 'MPY 203'
        })
    ];
    componentManager.getColorForSubject = () => '#ffffff';
    componentManager.getTextColorForBg = () => '#000000';
    componentManager.getLogicalScheduleRows = schedules => schedules;
    componentManager.roomDetails = {};
    const displaySlots = [
        { start: '08:00', end: '08:30', label: '8:00 AM - 8:30 AM' },
        { start: '13:00', end: '13:30', label: '1:00 PM - 1:30 PM' },
        { start: '16:00', end: '16:30', label: '4:00 PM - 4:30 PM' }
    ];
    for (const audience of ['teacher', 'section', 'room']) {
        const timetable = componentManager.buildScheduleGrid(
            componentManager.schedules,
            ['Monday'],
            displaySlots,
            audience
        );
        if (
            !timetable.includes('CE Project 2 — LEC') ||
            !timetable.includes('CE Project 2 — LAB')
        ) {
            throw new Error(`The ${audience} timetable did not distinguish LEC and LAB.`);
        }
        if (timetable.includes('MATHEMATICS —')) {
            throw new Error(`The ${audience} timetable guessed a missing component label.`);
        }
    }

    global.document.getElementById = originalGetElementById;
}

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

verifyCurriculumComponentOptions()
    .then(() => manager.saveOwnerEdit({ preventDefault() {} }))
    .then(() => {
        if (manager.schedules.filter(schedule => schedule.day === 'Monday').some(schedule => schedule.startTime !== '07:30')) {
            throw new Error('Combined meeting edit did not update all section sibling rows.');
        }
        if (manager.schedules.filter(schedule => schedule.day === 'Thursday').some(schedule => schedule.startTime !== '08:00')) {
            throw new Error('Combined meeting edit overwrote a different meeting.');
        }
        console.log('Scheduling logic QA passed.');
    })
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });

let globalData = {};
let studentsListParam = "getStudentsList";

function getCookie(tabs) {
  return browser.cookies.getAll({
    domain: "www.khanacademy.org",
  });
}

var getActive = () =>
  browser.tabs.query({
    active: true,
    currentWindow: true,
  });

/*

ATTACH INFORMATION FROM THE ASSIGNMENTS TAB


DATE AND TIME DUE
STATUS
COMPLETE OR NOT COMPLETE

 */

// https://www.khanacademy.org/api/internal/graphql/StandaloneUserAssignments?lang=en&_=200418-1435-3ee46bbedab7_1587315535476

const getParamRegex = /_=([0-9a-f-]+)_/;
const pathRegex = /graphql\/([a-zA-Z]+)/;
const classIdRegex = /\/coach\/class\/([0-9]+)\/students/;

function getStudentAssignmentSummary({
  student,
  cookie,
  sessionParam,
  startDate,
  endDate,
  classId,
}) {
  const body = JSON.stringify({
    operationName: "StandaloneUserAssignments",
    variables: {
      kaid: student.kaid,
      studentListId: classId,
      orderBy: "DUE_DATE_DESC",
      pageSize: 600,
    },
    query:
      "query StandaloneUserAssignments($after: ID, $pageSize: Int, $kaid: String!, $studentListId: String!, $orderBy: AssignmentOrder!) {\n  student: user(kaid: $kaid) {\n    id\n    assignmentsPage(after: $after, pageSize: $pageSize, studentListId: $studentListId, orderBy: $orderBy) {\n      assignments {\n        id\n        contents {\n          ...TranslatedContentFields\n          __typename\n        }\n        assignedDate\n        dueDate\n        itemCompletionStates {\n          studentKaid\n          state\n          completedOn\n          bestScore {\n            numCorrect\n            numAttempted\n            __typename\n          }\n          exerciseAttempts {\n            id\n            isCompleted\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      pageInfo {\n        nextCursor\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment TranslatedContentFields on LearnableContent {\n  id\n  kind\n  translatedTitle\n  defaultUrlPath\n  __typename\n}\n",
  });
  const urlQueryPath = "StandaloneUserAssignments";

  return fetchInternalApiHelper({
    student,
    cookie,
    sessionParam,
    startDate,
    endDate,
    body,
    classId,
    urlQueryPath,
  }).then(
    (jsonResponse) => jsonResponse.data.student.assignmentsPage.assignments
  );
}

function getStudentActivitySummary({
  student,
  cookie,
  sessionParam,
  startDate,
  endDate,
  classId,
}) {
  const body = JSON.stringify({
    operationName: "ActivitySessionsReportQuery",
    variables: {
      studentKaid: student.kaid,
      endDate,
      startDate,
      courseType: null,
      activityKind: null,
      pageSize: 600,
      after: null,
    },
    query:
      "query ActivitySessionsReportQuery($studentKaid: String!, $endDate: Date, $startDate: Date, $courseType: String, $activityKind: String, $after: ID, $pageSize: Int) {\n  user(kaid: $studentKaid) {\n    id\n    activityLog(endDate: $endDate, startDate: $startDate, courseType: $courseType, activityKind: $activityKind) {\n      time {\n        exerciseMinutes\n        totalMinutes\n        __typename\n      }\n      activitySessionsPage(pageSize: $pageSize, after: $after) {\n        sessions {\n          id\n          activityKind {\n            id\n            translatedTitle\n            __typename\n          }\n          content {\n            id\n            translatedTitle\n            __typename\n          }\n          courseChallenge {\n            title\n            fullTitle\n            __typename\n          }\n          masteryChallenge {\n            title\n            fullTitle\n            __typename\n          }\n          course {\n            id\n            translatedTitle\n            __typename\n          }\n          durationMinutes\n          eventTimestamp\n          ... on ExerciseActivitySession {\n            correctCount\n            problemCount\n            skillLevelChanges {\n              id\n              exercise {\n                id\n                translatedTitle\n                __typename\n              }\n              before\n              after\n              __typename\n            }\n            __typename\n          }\n          __typename\n        }\n        pageInfo {\n          nextCursor\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
  });

  const urlQueryPath = "ActivitySessionsReportQuery";
  return fetchInternalApiHelper({
    student,
    cookie,
    sessionParam,
    startDate,
    endDate,
    body,
    classId,
    urlQueryPath,
  }).then(
    (jsonResponse) =>
      jsonResponse.data.user.activityLog.activitySessionsPage.sessions
  );
}

/**
 *
 * @param student
 * @param cookie
 * @param sessionParam
 * @param startDate
 * @param endDate
 * @param body
 * @param classId
 * @param urlQueryPath
 * @returns {Promise<any>}
 */
function fetchInternalApiHelper({
  student,
  referrer,
  cookie,
  sessionParam,
  body,
  classId,
  urlQueryPath,
}) {
  let tsNow = Date.now();
  return fetch(
    `https://www.khanacademy.org/api/internal/graphql/${urlQueryPath}?lang=en&_=${sessionParam}_${tsNow}`,
    {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "same-origin", // no-cors, *cors, same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, *same-origin, omit
      referrer:
        referrer ||
        `https://www.khanacademy.org/coach/class/${classId}/students/student/${student.kaid}`,
      headers: {
        "Content-Type": "application/json",
        "X-KA-FKey": cookie.value,
        // "TE": "trailers"
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      // redirect: "follow", // manual, *follow, error
      // referrerPolicy: "client", // no-referrer, *client
      body,
    }
  ).then((result) => result.json());
}

function normalizeActivitySessions(student, activitySessions) {
  return activitySessions.map((session) => ({
    student: student.coachNickname,
    studentEmail: student.email,
    activityType: session.activityKind.translatedTitle,
    activityTitle: session.content.translatedTitle,
    course: session.course ? session.course.translatedTitle : "",
    durationMinutes: session.durationMinutes,
    timestamp: session.eventTimestamp,
    problemCount:
      session.problemCount !== undefined && session.problemCount !== null
        ? session.problemCount
        : "",
    correctCount:
      session.correctCount !== undefined && session.correctCount !== null
        ? session.correctCount
        : "",
  }));
}

function normalizeAssigmentSummaries(student, assignmentSummaries) {


  return assignmentSummaries.map((assignment) => {
    const itemCompletionState = assignment.itemCompletionStates[0]
    //console.log("assignment", assignment)

    return ({
      student: student.coachNickname,
      studentEmail: student.email,
      activityType: assignment.contents[0].kind,
      activityTitle: assignment.contents[0].translatedTitle,
      assignedDate: assignment.assignedDate,
      dueDate: assignment.dueDate,
      status: assignment.itemCompletionStates[0].state,
      completedOn: assignment.itemCompletionStates[0].completedOn,
      bestScore: assignment.itemCompletionStates[0].bestScore
                 ? assignment.itemCompletionStates[0].bestScore.numCorrect
                 : null,
      pointsPossible: assignment.itemCompletionStates[0].bestScore
                      ? assignment.itemCompletionStates[0].bestScore.numAttempted
                      : null,
      exerciseAttempts:
        assignment.itemCompletionStates[0].exerciseAttempts &&
        assignment.itemCompletionStates[0].exerciseAttempts.length > 0
        ? assignment.itemCompletionStates[0].exerciseAttempts.length
        : null,
    })
  });
}

function activitiesToCsv(normalizedActivites) {
  // console.log("normalized activities:", normalizedActivites);
  const array = [
    {
      activities: "activities",
      student: "student",
      studentEmail: "studentEmail",
      activityType: "activityType",
      activityTitle: "activityTitle",
      course: "course",
      durationMinutes: "durationMinutes",
      timestamp: "timestamp",
      problemCount: "problemCount",
      correctCount: "correctCount",
    },
  ].concat(normalizedActivites);
  return array
    .map(
      (jsRow) =>
        `${jsRow.student},${jsRow.studentEmail},${jsRow.activityType},${jsRow.activityTitle},${jsRow.course},${jsRow.durationMinutes},${jsRow.timestamp},${jsRow.problemCount},${jsRow.correctCount}`
    )
    .join("\r\n");
}

function assigmentsToCSV(normalizedAssigments) {
  // console.log("normalized assignments:", normalizedAssigments);
  const array = [
    {
      student: "student",
      studentEmail: "studentEmail",
      activityType: "activityType",
      activityTitle: "activityTitle",
      assignedDate: "assignedDate",
      dueDate: "dueDate",
      status: "status",
      completedOn: "completedOn",
      bestScore: "bestScore",
      pointsPossible: "pointsPossible",
      exerciseAttempts: "exerciseAttempts",
    },
  ].concat(normalizedAssigments);
  return array
    .map(
      (jsRow) =>
        `${jsRow.student},${jsRow.studentEmail},${jsRow.activityType},${jsRow.activityTitle},${jsRow.assignedDate},${jsRow.dueDate},${jsRow.status},${jsRow.completedOn},${jsRow.bestScore},${jsRow.pointsPossible},${jsRow.exerciseAttempts}`
    )
    .join("\r\n");
}

async function fetchStudentActivityData(startDate, endDate) {
  return fetchDataHelper(
    startDate,
    endDate,
    getStudentActivitySummary,
    normalizeActivitySessions
  ).then((data2d) => data2d.flat());
}

async function fetchStudentAssigmentData(startDate, endDate) {
  return fetchDataHelper(
    startDate,
    endDate,
    getStudentAssignmentSummary,
    normalizeAssigmentSummaries
  ).then((data2d) => data2d.flat());
}

async function fetchDataHelper(
  startDate,
  endDate,
  fetchFunction,
  normalizeFunction
) {
  let cookies = await getActive().then(getCookie);
  let cookie = cookies.filter((c) => c.name === "fkey")[0];
  let classId = (await getActive())[0].url.match(classIdRegex)[1];


  return Promise.all(
    globalData[
      studentsListParam
    ].response.data.coach.studentList.studentsPage.students.map(
      async (student) => {
        console.log(`Student: ${student.coachNickname}, kaid: ${student.kaid}`);
        const studentRequest = {
          student,
          cookie,
          sessionParam: globalData.sessionParam,
          startDate,
          endDate,
          classId,
        };
        const activitySessions = await fetchFunction(studentRequest);
        // console.log("activitySessions: ", activitySessions)
        // console.log("assigmentSummaries: ", assignmentSummaries)
        return normalizeFunction(student, activitySessions);
      }
    )
  );
}

/**
 * creates a string version of IIF that will initiate a download of the CSV data
 * @param filenameStr
 * @param text
 * @returns {string}
 */
const downloadStringFunction = (filenameStr, text) => `(function download() {
  let filename = "${filenameStr}";
  let data = \`${text}\`;
  console.log("HEY WE'RE DOWNLOADIN HERE!!");
  var blob = new Blob([data], {type: 'text/csv'});
    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    }
    else{
        var elem = window.document.createElement('a');
        var href = window.URL.createObjectURL(blob);
        elem.href = href
        elem.download = filename;        
        document.body.appendChild(elem);
        elem.click();        
        document.body.removeChild(elem);
        URL.revokeObjectURL(href)
    }
})()
`;

/**
 * main function that listens for
 * @param details
 */
function studentListListener(details) {
  console.log("Loading: " + details.url);
  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();
  globalData.sessionParam = details.url.match(getParamRegex)[1];
  let path = details.url.match(pathRegex)[1];
  globalData[path] = {};
  globalData[path]["request"] = decoder.decode(details.requestBody.raw.bytes);
  let data = [];
  filter.ondata = (event) => {
    // console.log("ondata callback");
    data.push(event.data);
  };

  filter.onstop = (event) => {
    // console.log("onstop callback");
    let str = "";
    for (let buffer of data) {
      str += decoder.decode(buffer, { stream: true });
    }
    str += decoder.decode(); // end-of-stream

    // Just change any instance of WebExtension Example in the HTTP response
    // to WebExtension WebExtension Example.
    // str = str.replace(/WebExtension Example/g, 'WebExtension $&')
    // console.log("str = " + str.substr(0, 80) + "...");
    globalData[path]["response"] = JSON.parse(str);
    filter.write(encoder.encode(str));
    filter.close();
    if (path === studentsListParam) {
      globalData.isReady = true;
    }
  };
}

// console.log("loading add on...")

browser.webRequest.onBeforeRequest.addListener(
  studentListListener,
  {
    urls: [
      `https://www.khanacademy.org/api/internal/graphql/${studentsListParam}*`,
      // "https://www.khanacademy.org/api/internal/graphql/ActivitySessionsReportQuery*",
    ],
  },
  ["blocking", "requestBody"]
);

function downloadClickListener(data, sender, sendResponse) {
  // console.log("click listener: ", data.command);
  switch (data.command) {
    case "ready-query":
      sendResponse({ isReady: globalData.isReady });
      break;
    case "activities":
      fetchStudentActivityData(data.startDate, data.endDate)
        .then((activities) => activitiesToCsv(activities))
        .then((activities) =>
          browser.tabs.executeScript({
            code: `
            ${downloadStringFunction(
              `activities_${data.startDate}_${data.endDate}.csv`,
              activities
            )}`,
          })
        )
        .catch((e) => {
          console.error(e);
        });
      break;
    case "assignments":
      fetchStudentAssigmentData(data.startDate, data.endDate)
        .then((assigments) => assigmentsToCSV(assigments))
        .then((assignments) =>
          browser.tabs.executeScript({
            code: `
            ${downloadStringFunction(
              `assignments_${data.startDate}_${data.endDate}.csv`,
              assignments
            )}`,
          })
        )
        .catch((e) => {
          console.error(e);
        });
      break;
  }
}

browser.runtime.onMessage.addListener(downloadClickListener);

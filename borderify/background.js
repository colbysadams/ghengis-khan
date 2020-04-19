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

  return getStudentSummary({
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
  return getStudentSummary({
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
function getStudentSummary({
  student,
  cookie,
  sessionParam,
  startDate,
  endDate,
  body,
  classId,
  urlQueryPath = "ActivitySessionsReportQuery",
}) {
  let tsNow = Date.now();
  return fetch(
    `https://www.khanacademy.org/api/internal/graphql/${urlQueryPath}?lang=en&_=${sessionParam}_${tsNow}`,
    {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "same-origin", // no-cors, *cors, same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, *same-origin, omit
      referrer: `https://www.khanacademy.org/coach/class/${classId}/students/student/${student.kaid}`,
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

function resultsToRowsForDownload(results) {
  const jsRows = results.reduce(
    (
      { activities, assignments },
      { student, activitySessions, assignmentSummaries }
    ) => {
      return {
        activities: activities.concat(
          activitySessions.map((session) => ({
            student: student.coachNickname,
            studentEmail: student.email,
            activityType: session.activityKind.translatedTitle,
            activityTitle: session.content.translatedTitle,
            course: session.course ? session.course.translatedTitle : "",
            durationMinutes: session.durationMinutes,
            timestamp: session.eventTimestamp,
            problemCount:
              session.problemCount !== undefined &&
              session.problemCount !== null
                ? session.problemCount
                : "",
            correctCount:
              session.correctCount !== undefined &&
              session.correctCount !== null
                ? session.correctCount
                : "",
          }))
        ),
        assignments: assignments.concat(
          assignmentSummaries.map((assignment) => ({
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
            excerciseAttempts:
              assignment.itemCompletionStates[0].excerciseAttempts ? assignment.itemCompletionStates[0].excerciseAttempts.length : null,
          }))
        ),
      };
    },
    {
      activities: [
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
      ],
      assignments: [
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
          excerciseAttempts: "excerciseAttempts",
        },
      ],
    }
  );
  return {
    activities: jsRows.activities
      .map(
        (jsRow, idx) =>
          `${jsRow.student},${jsRow.studentEmail},${jsRow.activityType},${jsRow.activityTitle},${jsRow.course},${jsRow.durationMinutes},${jsRow.timestamp},${jsRow.problemCount},${jsRow.correctCount},`
      )
      .join("\r\n"),
    assignments: jsRows.assignments
      .map(
        (jsRow, idx) =>
          `${jsRow.student},${jsRow.studentEmail},${jsRow.activityType},${jsRow.activityTitle},${jsRow.assignedDate},${jsRow.dueDate},${jsRow.status},${jsRow.completedOn},${jsRow.bestScore},${jsRow.pointsPossible},${jsRow.excerciseAttempts},`
      )
      .join("\r\n"),
  };
}

async function fetchStudentActivityData(details, startDate, endDate) {
  let cookies = await getActive().then(getCookie);
  let cookie = cookies.filter((c) => c.name === "fkey")[0];
  let sessionParam = details.url.match(getParamRegex)[1];
  let classId = (await getActive())[0].url.match(classIdRegex)[1];
  console.log("cookies: ", cookie);

  return Promise.all(
    globalData[
      studentsListParam
    ].response.data.coach.studentList.studentsPage.students.map(
      async (student) => {
        console.log(`Student: ${student.coachNickname}, kaid: ${student.kaid}`);
        const studentRequest = {
          student,
          cookie,
          sessionParam,
          startDate,
          endDate,
          classId,
        };
        const activitySessions = await getStudentActivitySummary(
          studentRequest
        );
        const assignmentSummaries = await getStudentAssignmentSummary(
          studentRequest
        );
        // console.log("activitySessions: ", activitySessions)
        // console.log("assigmentSummaries: ", assignmentSummaries)
        return {
          student,
          activitySessions,
          assignmentSummaries,
        };
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
function listener(details) {
  console.log("Loading: " + details.url);
  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();
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
    console.log("str = " + str.substr(0, 80) + "...");
    globalData[path]["response"] = JSON.parse(str);
    filter.write(encoder.encode(str));
    filter.close();
    if (path === studentsListParam) {
      fetchStudentActivityData(details, "2020-01-01", "2020-04-20")
        .then((obj) => resultsToRowsForDownload(obj))
        .then(({ activities, assignments }) => {
          // console.log("assignments: ", assignments)
          browser.tabs.executeScript({
            code: `
            ${downloadStringFunction("assignments.csv", assignments)}`
            ,
          });
        });
    }
  };
}

// console.log("loading add on...")

browser.webRequest.onBeforeRequest.addListener(
  listener,
  {
    urls: [
      `https://www.khanacademy.org/api/internal/graphql/${studentsListParam}*`,
      // "https://www.khanacademy.org/api/internal/graphql/ActivitySessionsReportQuery*",
    ],
  },
  ["blocking", "requestBody"]
);

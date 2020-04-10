let globalData = {};
let studentsListParam = "getStudentsList";

function getCookie(tabs) {
  return browser.cookies.getAll({
    domain: "www.khanacademy.org",
  });
}

var getActive = browser.tabs.query({
  active: true,
  currentWindow: true,
});

function getStudentActivitySummary(student, cookie) {
  let tsNow = Date.now();
  return fetch(
    `https://www.khanacademy.org/api/internal/graphql/ActivitySessionsReportQuery?lang=en&_=200410-0950-a19c6ebec006_${tsNow}`,
    {
      method: "POST", // *GET, POST, PUT, DELETE, etc.
      mode: "same-origin", // no-cors, *cors, same-origin
      cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
      credentials: "same-origin", // include, *same-origin, omit
      referrer: `https://www.khanacademy.org/coach/class/5546486784606208/students/student/${student.kaid}`,
      headers: {
        "Content-Type": "application/json",
        "X-KA-FKey": cookie.value,
        // "TE": "trailers"
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      // redirect: "follow", // manual, *follow, error
      // referrerPolicy: "client", // no-referrer, *client
      body: JSON.stringify({
        operationName: "ActivitySessionsReportQuery",
        variables: {
          studentKaid: student.kaid,
          endDate: "2020-04-10", //todo - accept start/end date as input
          startDate: "2020-04-03", //todo - accept start/end date as input
          courseType: null,
          activityKind: null,
          pageSize: 600,
          after: null,
        },
        query:
          "query ActivitySessionsReportQuery($studentKaid: String!, $endDate: Date, $startDate: Date, $courseType: String, $activityKind: String, $after: ID, $pageSize: Int) {\n  user(kaid: $studentKaid) {\n    id\n    activityLog(endDate: $endDate, startDate: $startDate, courseType: $courseType, activityKind: $activityKind) {\n      time {\n        exerciseMinutes\n        totalMinutes\n        __typename\n      }\n      activitySessionsPage(pageSize: $pageSize, after: $after) {\n        sessions {\n          id\n          activityKind {\n            id\n            translatedTitle\n            __typename\n          }\n          content {\n            id\n            translatedTitle\n            __typename\n          }\n          courseChallenge {\n            title\n            fullTitle\n            __typename\n          }\n          masteryChallenge {\n            title\n            fullTitle\n            __typename\n          }\n          course {\n            id\n            translatedTitle\n            __typename\n          }\n          durationMinutes\n          eventTimestamp\n          ... on ExerciseActivitySession {\n            correctCount\n            problemCount\n            skillLevelChanges {\n              id\n              exercise {\n                id\n                translatedTitle\n                __typename\n              }\n              before\n              after\n              __typename\n            }\n            __typename\n          }\n          __typename\n        }\n        pageInfo {\n          nextCursor\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n",
      }),
    }
  ).then((result) =>
    result.json().then((jsonResponse) => {
      return {
        student,
        activitySessions:
          jsonResponse.data.user.activityLog.activitySessionsPage.sessions,
      };
    })
  );
}

function resultsToRowsForDownload(results) {
  return results
    .reduce(
      (rows, { student, activitySessions }) => {
        return rows.concat(
          activitySessions.map((session) => ({
            student: student.coachNickname,
            studentEmail: student.email,
            activityType: session.activityKind.translatedTitle,
            activityTitle: session.content.translatedTitle,
            course: session.course ? session.course.translatedTitle : "",
            durationMinutes: session.durationMinutes,
            timestamp: session.eventTimestamp,
            problemCount:
              session.problemCount !== undefined ? session.problemCount : "",
            correctCount:
              session.correctCount !== undefined ? session.correctCount : "",
          }))
        );
      },
      [
        "student,studentEmail,activityType,activityTitle,course,durationMinutes,timestamp,problemCount,correctCount",
      ]
    )
    .map(
      (jsRow, idx) => {
        if (idx === 0) {
          return jsRow
        } else {
          return `${jsRow.student},${jsRow.studentEmail},${jsRow.activityType},${jsRow.activityTitle},${jsRow.course},${jsRow.durationMinutes},${jsRow.timestamp},${jsRow.problemCount},${jsRow.correctCount},`
        }
      }

    )
    .join("\r\n");
}

async function onStudentListFound(details) {
  let cookies = await getActive.then(getCookie);
  let cookie = cookies.filter((c) => c.name === "fkey")[0];

  console.log("cookies: ", cookie);

  return Promise.all(
    globalData[
      studentsListParam
    ].response.data.coach.studentList.studentsPage.students.map(
      async (student) => {
        console.log(`Student: ${student.coachNickname}, kaid: ${student.kaid}`);

        return getStudentActivitySummary(student, cookie);
      }
    )
  );
}

async function download2(filename, data) {
  const window = await browser.windows.getCurrent();
  var blob = new Blob([data], { type: "text/csv" });

  const url = URL.createObjectURL(blob);

  browser.downloads.download({
    url,
    filename: "burts-download.csv",
  });
}
const downloadStringFunction = (filenamev, text) => `(function download() {
  let filename = "${filenamev}";
  let data = \`${text}\`;
  console.log("HEY WE'RE DOWNLOADIN HERE!!");
  var blob = new Blob([data], {type: 'text/csv'});
    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    }
    else{
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = filename;        
        document.body.appendChild(elem);
        elem.click();        
        document.body.removeChild(elem);
    }
})()`;

function listener(details) {
  console.log("Loading: " + details.url);
  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();
  let pathRegex = /graphql\/([a-zA-Z]+)/;
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
      onStudentListFound(details)
        .then((obj) => resultsToRowsForDownload(obj))
        .then((csvData) =>
          browser.tabs.executeScript({
            code: downloadStringFunction("burt.csv", csvData),
          })
        );
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

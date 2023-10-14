/* eslint-disable prefer-template */
/* eslint-disable no-console */
/* eslint-disable no-undef */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  const requestUrlClokify = `https://api.clockify.me/api/v1/workspaces/${request.data.configurations.workspaceId}/time-entries/`;
  const requestUrlJira = `https://surgeglobal.atlassian.net/rest/api/3/issue/${request.data.configurations.jiraTaskId}/worklog`;

  const jiraTimeLogInSeconds = (request.data.endTime - request.data.startTime) / 1000;

  const requestBodyClokify = {
    start: request.data.startTime,
    end: request.data.endTime,
    description: request.data.meetingName,
    projectId: request.data.configurations.projectId,
    billable: true,
  };

  const requestBodyJira = {
    comment: {
      content: [
        {
          content: [
            {
              text: request.data.meetingName,
              type: "text",
            },
          ],
          type: "paragraph",
        },
      ],
      type: "doc",
      version: 1,
    },
    started: request.data.startTime,
    timeSpentSeconds: jiraTimeLogInSeconds,
  };

  const requestHeadersClokify = {
    "X-Api-Key": request.data.configurations.PAT,
    "Content-Type": "application/json",
  };

  const requestHeadersJira = {
    "Content-Type": "application/json",
    Authorization: `Basic ${btoa(request.data.configurations.jiraEmail + ":" + request.data.configurations.jiraPAT)}`,
  };

  console.log(requestHeadersJira, requestBodyJira);

  const responseFromClokify = await fetch(requestUrlClokify, {
    method: "POST",
    body: JSON.stringify(requestBodyClokify),
    headers: requestHeadersClokify,
  });

  const responseFromJira = await fetch(requestUrlJira, {
    method: "POST",
    body: JSON.stringify(requestBodyJira),
    headers: requestHeadersJira,
  });

  Promise.allSettled([responseFromClokify, responseFromJira]).then((results) => {
    if (results[0].status === "fulfilled" && results[1].status === "fulfilled") {
      sendResponse({ status: 201 });
    } else {
      sendResponse({ status: 500 });
    }
  });
});

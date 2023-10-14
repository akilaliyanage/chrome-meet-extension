/* eslint-disable prefer-template */
/* eslint-disable no-console */
/* eslint-disable no-undef */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  const requestUrl = `https://api.clockify.me/api/v1/workspaces/${request.data.configurations.workspaceId}/time-entries/`;

  const requestBody = {
    start: request.data.startTime,
    end: request.data.endTime,
    description: request.data.meetingName,
    projectId: request.data.configurations.projectId,
    billable: true,
  };

  const requestHeaders = {
    "X-Api-Key": request.data.configurations.PAT,
    "Content-Type": "application/json",
  };

  const res = await fetch(requestUrl, {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: requestHeaders,
  });

  sendResponse(res.status);
});

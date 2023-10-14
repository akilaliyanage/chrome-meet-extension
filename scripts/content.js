/* eslint-disable no-alert */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */

const meetingName = window.location.href.split("/").pop().split("?")[0];

// `document.querySelector` may return null if the selector doesn't match anything.
if (meetingName) {
  const startTime = new Date(); // get the start time of the meeting

  // eslint-disable-next-line no-console
  window.addEventListener("beforeunload", async () => {
    const endTime = new Date(); // get the end time of the meeting
    const configurations = await chrome.storage.sync.get([
      "workspaceId",
      "projectId",
      "PAT",
      "jiraEmail",
      "jiraPAT",
      "jiraTaskId",
    ]);

    // send the data to the background script
    chrome.runtime.sendMessage({
      data: { meetingName, startTime, endTime, configurations },
      function(response) {
        if (response.status === 201) {
          alert("Meeting saved!");
        } else {
          alert("Something went wrong!");
        }
      },
    });
  });
}

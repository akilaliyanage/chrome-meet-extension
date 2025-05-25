// Meeting tracking configuration
let meetingConfig = {
  meetings: [],
  isTracking: false,
  currentMeeting: null,
};

// Initialize meeting tracker
document.addEventListener("DOMContentLoaded", () => {
  console.log("Meeting tracker UI initialized");
  updateMeetingHistory();

  // Set up periodic refresh
  setInterval(updateMeetingHistory, 5000);
});

// Update meeting history UI
function updateMeetingHistory() {
  console.log("Updating meeting history UI");
  const historyContainer = document.getElementById("meetingHistory");
  if (!historyContainer) {
    console.error("Meeting history container not found");
    return;
  }

  // Get current meeting config from storage
  chrome.storage.local.get(["meetingConfig"], (result) => {
    const meetingConfig = result.meetingConfig || {
      meetings: [],
      isTracking: false,
      currentMeeting: null,
    };

    historyContainer.innerHTML = "";
    console.log("Current meeting state:", {
      isTracking: meetingConfig.isTracking,
      currentMeeting: meetingConfig.currentMeeting,
      pastMeetings: meetingConfig.meetings,
    });

    // Show current meeting if tracking
    if (meetingConfig.isTracking && meetingConfig.currentMeeting) {
      console.log("Adding current meeting to UI");
      const currentMeetingElement = createMeetingElement(meetingConfig.currentMeeting, -1, true);
      historyContainer.appendChild(currentMeetingElement);
    }

    // Show past meetings
    meetingConfig.meetings.forEach((meeting, index) => {
      console.log("Adding past meeting to UI:", meeting);
      const meetingElement = createMeetingElement(meeting, index);
      historyContainer.appendChild(meetingElement);
    });

    // Show message if no meetings
    if (!meetingConfig.isTracking && meetingConfig.meetings.length === 0) {
      console.log("No meetings to display");
      historyContainer.innerHTML = '<div class="text-center text-muted">No meetings recorded yet</div>';
    }
  });
}

// Create meeting element
function createMeetingElement(meeting, index, isCurrent = false) {
  const div = document.createElement("div");
  div.className = "meeting-item";
  if (isCurrent) {
    div.classList.add("current-meeting");
  }

  const startTime = new Date(meeting.startTime);
  const endTime = meeting.endTime ? new Date(meeting.endTime) : null;
  const duration = meeting.duration || "In progress...";

  div.innerHTML = `
        <div class="meeting-name">${meeting.name}</div>
        <div class="meeting-time">
            ${startTime.toLocaleString()} - ${endTime ? endTime.toLocaleString() : "Ongoing"}
        </div>
        <div class="meeting-duration">Duration: ${duration} minutes</div>
        ${
          !meeting.logged && !isCurrent
            ? `
            <button class="btn btn-primary btn-sm log-time-btn" data-index="${index}">
                Log Time to Jira
            </button>
        `
            : isCurrent
              ? `
            <span class="text-info">Current Meeting</span>
        `
              : `
            <span class="text-success">✓ Time logged</span>
        `
        }
    `;

  // Add click handler for log time button
  const logButton = div.querySelector(".log-time-btn");
  if (logButton) {
    logButton.addEventListener("click", () => logMeetingTime(index));
  }

  return div;
}

// Log meeting time to Jira
async function logMeetingTime(index) {
  // First get the Jira configuration
  chrome.storage.local.get(["jiraConfig", "meetingConfig"], async (result) => {
    const jiraConfig = result.jiraConfig;
    const meetingConfig = result.meetingConfig;
    
    // Validate Jira configuration
    if (!jiraConfig || !jiraConfig.domain || !jiraConfig.email || !jiraConfig.apiToken) {
      alert("Please configure your Jira settings first. Go to the Settings tab and set up your Jira connection.");
      return;
    }

    // Validate default issue
    if (!jiraConfig.defaultIssue || !jiraConfig.defaultIssue.key) {
      alert("Please select a default issue in the Settings tab before logging time.");
      return;
    }

    const meeting = meetingConfig.meetings[index];
    if (!meeting || meeting.logged) return;

    const startTime = new Date(meeting.startTime);
    const endTime = new Date(meeting.endTime);
    const comment = `${startTime.toLocaleString()} - ${endTime.toLocaleString()} - ${meeting.name}`;

    try {
      // Format the date exactly as Jira expects: yyyy-MM-dd'T'HH:mm:ss.SSSZ
      const formattedStartTime = startTime.toISOString().replace('Z', '+0000');
      
      console.log("Logging time to Jira:", {
        domain: jiraConfig.domain,
        issueKey: jiraConfig.defaultIssue.key,
        duration: meeting.duration,
        comment: comment,
        started: formattedStartTime
      });

      const response = await fetch(
        `https://${jiraConfig.domain}.atlassian.net/rest/api/3/issue/${jiraConfig.defaultIssue.key}/worklog`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`)}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeSpentSeconds: meeting.duration * 60, // Convert minutes to seconds
            comment: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: comment
                    }
                  ]
                }
              ]
            },
            started: formattedStartTime
          }),
        },
      );

      if (response.ok) {
        meeting.logged = true;
        chrome.storage.local.set({ meetingConfig }, () => {
          updateMeetingHistory();
        });
      } else {
        const errorData = await response.json();
        console.error("Jira API error:", JSON.stringify(errorData));
        throw new Error(errorData.message || "Failed to log time");
      }
    } catch (error) {
      console.error("Error logging meeting time:", error);
      alert(`Failed to log meeting time: ${error.message}`);
    }
  });
}

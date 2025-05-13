// Meeting tracking configuration
let meetingConfig = {
  meetings: [],
  isTracking: false,
  currentMeeting: null,
};

// Initialize meeting tracker
document.addEventListener("DOMContentLoaded", () => {
  console.log("Meeting tracker initialized");

  // Load saved meetings
  chrome.storage.local.get(["meetingConfig"], (result) => {
    console.log("Loaded meeting config:", result.meetingConfig);
    if (result.meetingConfig) {
      meetingConfig = result.meetingConfig;
      // Ensure dates are properly parsed
      if (meetingConfig.currentMeeting) {
        meetingConfig.currentMeeting.startTime = new Date(meetingConfig.currentMeeting.startTime).toISOString();
        if (meetingConfig.currentMeeting.endTime) {
          meetingConfig.currentMeeting.endTime = new Date(meetingConfig.currentMeeting.endTime).toISOString();
        }
      }
      meetingConfig.meetings = meetingConfig.meetings.map((meeting) => ({
        ...meeting,
        startTime: new Date(meeting.startTime).toISOString(),
        endTime: meeting.endTime ? new Date(meeting.endTime).toISOString() : null,
      }));
      console.log("Parsed meeting config:", meetingConfig);
      updateMeetingHistory();
    } else {
      console.log("No saved meeting config found, initializing new config");
      meetingConfig = {
        meetings: [],
        isTracking: false,
        currentMeeting: null,
      };
      saveMeetingConfig();
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message from content script:", message);
    console.log("Current meeting config before update:", meetingConfig);

    try {
      if (message.type === "MEETING_STARTED") {
        console.log("Handling meeting started:", message.meetingName);
        handleMeetingStarted(message.meetingName);
        console.log("Meeting config after start:", meetingConfig);
        sendResponse({ status: "success" });
      } else if (message.type === "MEETING_ENDED") {
        console.log("Handling meeting ended");
        handleMeetingEnded();
        console.log("Meeting config after end:", meetingConfig);
        sendResponse({ status: "success" });
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({ status: "error", error: error.message });
    }
    return true; // Keep the message channel open for async response
  });
});

// Handle meeting started
function handleMeetingStarted(meetingName) {
  console.log("Starting meeting:", meetingName);
  const now = new Date();
  meetingConfig.currentMeeting = {
    name: meetingName,
    startTime: now.toISOString(),
    endTime: null,
    duration: null,
    logged: false,
  };
  meetingConfig.isTracking = true;
  console.log("Updated meeting config:", meetingConfig);
  saveMeetingConfig();
  updateMeetingHistory();
}

// Handle meeting ended
function handleMeetingEnded() {
  console.log("Ending meeting:", meetingConfig.currentMeeting);
  if (meetingConfig.currentMeeting) {
    const now = new Date();
    const startTime = new Date(meetingConfig.currentMeeting.startTime);
    const duration = Math.round((now - startTime) / 1000 / 60); // Duration in minutes

    meetingConfig.currentMeeting.endTime = now.toISOString();
    meetingConfig.currentMeeting.duration = duration;
    meetingConfig.meetings.unshift(meetingConfig.currentMeeting);
    meetingConfig.currentMeeting = null;
    meetingConfig.isTracking = false;
    console.log("Updated meeting config after ending:", meetingConfig);
    saveMeetingConfig();
    updateMeetingHistory();
  } else {
    console.log("No current meeting to end");
  }
}

// Save meeting configuration
function saveMeetingConfig() {
  console.log("Saving meeting config:", meetingConfig);
  chrome.storage.local.set({ meetingConfig }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving meeting config:", chrome.runtime.lastError);
    } else {
      console.log("Meeting config saved successfully");
    }
  });
}

// Update meeting history UI
function updateMeetingHistory() {
  console.log("Updating meeting history UI");
  const historyContainer = document.getElementById("meetingHistory");
  if (!historyContainer) {
    console.error("Meeting history container not found");
    return;
  }

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
  const meeting = meetingConfig.meetings[index];
  if (!meeting || meeting.logged) return;

  const startTime = new Date(meeting.startTime);
  const endTime = new Date(meeting.endTime);
  const comment = `${startTime.toLocaleString()} - ${endTime.toLocaleString()} - ${meeting.name}`;

  try {
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
          timeSpent: `${meeting.duration}m`,
          comment: comment,
        }),
      },
    );

    if (response.ok) {
      meeting.logged = true;
      saveMeetingConfig();
      updateMeetingHistory();
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to log time");
    }
  } catch (error) {
    console.error("Error logging meeting time:", error);
    alert(`Failed to log meeting time: ${error.message}`);
  }
}

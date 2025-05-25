// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  // Set up tab switching
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove active class from all buttons and contents
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Add active class to clicked button and corresponding content
      btn.classList.add("active");
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add("active");
    });
  });

  // Load saved settings
  const result = await chrome.storage.local.get(["jiraConfig", "clockifyConfig"]);
  const jiraConfig = result.jiraConfig || {};
  const clockifyConfig = result.clockifyConfig || {};

  // Load Jira settings
  document.getElementById("jiraDomain").value = jiraConfig.domain || "";
  document.getElementById("jiraEmail").value = jiraConfig.email || "";
  document.getElementById("jiraApiToken").value = jiraConfig.apiToken || "";
  document.getElementById("defaultIssue").value = jiraConfig.defaultIssue ? jiraConfig.defaultIssue.key : "";

  // Load Clockify settings
  document.getElementById("clockifyApiKey").value = clockifyConfig.apiKey || "";
  document.getElementById("clockifyWorkspace").value = clockifyConfig.workspaceId || "";

  // Set up event listeners
  setupEventListeners();

  // Update meeting history
  updateMeetingHistory();
});

// Set up event listeners
function setupEventListeners() {
  // Jira issue search
  const issueInput = document.getElementById("defaultIssue");
  let searchTimeout;
  issueInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchJiraIssues(e.target.value), 500);
  });

  // Save settings
  document.getElementById("saveSettings").addEventListener("click", saveSettings);
}

// Search Jira issues
async function searchJiraIssues(query) {
  if (!query) return;

  const jiraConfig = await chrome.storage.local.get(["jiraConfig"]);
  if (!jiraConfig.domain || !jiraConfig.email || !jiraConfig.apiToken) {
    alert("Please configure Jira settings first");
    return;
  }

  try {
    const response = await fetch(
      `https://${jiraConfig.domain}.atlassian.net/rest/api/3/issue/picker?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`)}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) throw new Error("Failed to search issues");

    const data = await response.json();
    const resultsDiv = document.getElementById("issueResults");
    resultsDiv.innerHTML = "";

    data.sections.forEach((section) => {
      section.issues.forEach((issue) => {
        const div = document.createElement("div");
        div.className = "issue-item";
        div.textContent = `${issue.key}: ${issue.summaryText}`;
        div.addEventListener("click", () => selectIssue(issue));
        resultsDiv.appendChild(div);
      });
    });
  } catch (error) {
    console.error("Error searching issues:", error);
  }
}

// Select Jira issue
function selectIssue(issue) {
  document.getElementById("defaultIssue").value = issue.key;
  document.getElementById("issueResults").innerHTML = "";
}

// Save settings
async function saveSettings() {
  const jiraConfig = {
    domain: document.getElementById("jiraDomain").value,
    email: document.getElementById("jiraEmail").value,
    apiToken: document.getElementById("jiraApiToken").value,
    defaultIssue: {
      key: document.getElementById("defaultIssue").value,
    },
  };

  const clockifyConfig = {
    apiKey: document.getElementById("clockifyApiKey").value,
    workspaceId: document.getElementById("clockifyWorkspace").value,
  };

  // Validate Clockify settings
  if (clockifyConfig.apiKey && !clockifyConfig.workspaceId) {
    alert("Please enter your Clockify workspace ID");
    return;
  }

  if (clockifyConfig.workspaceId && !clockifyConfig.apiKey) {
    alert("Please enter your Clockify API key");
    return;
  }

  await chrome.storage.local.set({ jiraConfig, clockifyConfig });
  alert("Settings saved successfully!");
}

// Update meeting history
function updateMeetingHistory() {
  const historyContainer = document.getElementById("meetingHistory");
  if (!historyContainer) return;

  chrome.storage.local.get(["meetingConfig"], (result) => {
    const meetingConfig = result.meetingConfig || {
      meetings: [],
      isTracking: false,
      currentMeeting: null,
    };

    historyContainer.innerHTML = "";

    // Show current meeting if tracking
    if (meetingConfig.isTracking && meetingConfig.currentMeeting) {
      const currentMeetingElement = createMeetingElement(meetingConfig.currentMeeting, -1, true);
      historyContainer.appendChild(currentMeetingElement);
    }

    // Show past meetings
    meetingConfig.meetings.forEach((meeting, index) => {
      const meetingElement = createMeetingElement(meeting, index);
      historyContainer.appendChild(meetingElement);
    });

    // Show message if no meetings
    if (!meetingConfig.isTracking && meetingConfig.meetings.length === 0) {
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
          Log Time to Jira & Clockify
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
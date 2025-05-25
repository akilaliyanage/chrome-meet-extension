// Meeting tracking configuration
let meetingConfig = {
  meetings: [],
  isTracking: false,
  currentMeeting: null,
};

// Store all loaded projects for search
let allClockifyProjects = [];

// Initialize meeting tracker
document.addEventListener("DOMContentLoaded", () => {
  updateMeetingHistory();

  // Set up periodic refresh
  setInterval(updateMeetingHistory, 5000);
});

// Update meeting history UI
function updateMeetingHistory() {
  const historyContainer = document.getElementById("meetingHistory");
  if (!historyContainer) {
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

// Log meeting time to Jira and Clockify
async function logMeetingTime(index) {
  // First get the configurations
  chrome.storage.local.get(["jiraConfig", "meetingConfig", "clockifyConfig"], async (result) => {
    const jiraConfig = result.jiraConfig;
    const meetingConfig = result.meetingConfig;
    const clockifyConfig = result.clockifyConfig;
    
    // Validate Jira configuration
    if (!jiraConfig || !jiraConfig.domain || !jiraConfig.email || !jiraConfig.apiToken) {
      alert("Please configure your Jira settings first. Go to the Settings tab and set up your Jira connection.");
      return;
    }

    // Validate Clockify configuration
    if (!clockifyConfig || !clockifyConfig.apiKey || !clockifyConfig.workspaceId) {
      alert("Please configure your Clockify settings first. Go to the Settings tab and set up your Clockify connection.");
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
    const formattedStartTime = startTime.toISOString().replace('Z', '+0000');

    try {
      // Log time to Jira
      const jiraResponse = await fetch(
        `https://${jiraConfig.domain}.atlassian.net/rest/api/3/issue/${jiraConfig.defaultIssue.key}/worklog`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`)}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timeSpentSeconds: meeting.duration * 60,
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

      if (!jiraResponse.ok) {
        const errorData = await jiraResponse.json();
        throw new Error(errorData.message || "Failed to log time to Jira");
      }

      // Log time to Clockify
      const clockifyResponse = await fetch(
        `https://api.clockify.me/api/v1/workspaces/${clockifyConfig.workspaceId}/time-entries`,
        {
          method: "POST",
          headers: {
            "X-Api-Key": clockifyConfig.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            start: startTime.toISOString(),
            end: endTime.toISOString(),
            description: comment,
            projectId: clockifyConfig.projectId || null,
            taskId: clockifyConfig.taskId || null,
            billable: true,
            tagIds: clockifyConfig.tagIds || [],
            customFields: clockifyConfig.customFields || []
          }),
        },
      );

      if (!clockifyResponse.ok) {
        const errorData = await clockifyResponse.json();
        throw new Error(errorData.message || "Failed to log time to Clockify");
      }

      // If both API calls were successful, mark the meeting as logged
      meeting.logged = true;
      chrome.storage.local.set({ meetingConfig }, () => {
        updateMeetingHistory();
      });

    } catch (error) {
      alert(`Failed to log meeting time: ${error.message}`);
    }
  });
}

// === CLOCKIFY SETTINGS UI LOGIC ===
document.addEventListener('DOMContentLoaded', function () {
  // Load saved Clockify settings
  chrome.storage.local.get(['clockifyConfig'], function(result) {
    const config = result.clockifyConfig || {};
    if (config.apiKey) {
      const apiKeyInput = document.getElementById('clockifyApiKey');
      if (apiKeyInput) apiKeyInput.value = config.apiKey;
    }
    if (config.workspaceId) {
      if (config.apiKey) {
        loadClockifyWorkspaces(config.apiKey, config.workspaceId, config.projectId);
      }
    }
  });

  // Load workspaces when button is clicked
  const loadBtn = document.getElementById('loadClockifyWorkspacesBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', function() {
      const apiKeyInput = document.getElementById('clockifyApiKey');
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      if (!apiKey) {
        alert('Please enter your Clockify API key first.');
        return;
      }
      loadClockifyWorkspaces(apiKey);
    });
  }

  // Save Clockify settings
  const saveBtn = document.getElementById('saveClockifyBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const apiKeyInput = document.getElementById('clockifyApiKey');
      const workspaceDropdown = document.getElementById('clockifyWorkspaceId');
      const projectDropdown = document.getElementById('clockifyProjectId');
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      const workspaceId = workspaceDropdown ? workspaceDropdown.value : '';
      const projectId = projectDropdown ? projectDropdown.value : '';
      if (!apiKey || !workspaceId || !projectId) {
        alert('Please enter your API key, select a workspace, and select a project.');
        return;
      }
      chrome.storage.local.set({ clockifyConfig: { apiKey, workspaceId, projectId } }, function() {
        alert('Clockify settings saved!');
      });
    });
  }

  // Automatically load projects when a workspace is selected
  const workspaceDropdown = document.getElementById('clockifyWorkspaceId');
  if (workspaceDropdown) {
    workspaceDropdown.addEventListener('change', function() {
      const apiKeyInput = document.getElementById('clockifyApiKey');
      const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
      const workspaceId = workspaceDropdown.value;
      if (apiKey && workspaceId) {
        loadClockifyProjects(apiKey, workspaceId);
      } else {
        // Clear project dropdown
        const projectDropdown = document.getElementById('clockifyProjectId');
        if (projectDropdown) {
          projectDropdown.innerHTML = '<option value="">Select a project</option>';
        }
      }
    });
  }
});

// Helper to fetch and populate workspaces
function loadClockifyWorkspaces(apiKey, selectedId, selectedProjectId) {
  const dropdown = document.getElementById('clockifyWorkspaceId');
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="">Loading...</option>';
  fetch('https://api.clockify.me/api/v1/workspaces', {
    headers: { 'X-Api-Key': apiKey }
  })
    .then(res => {
      if (!res.ok) throw new Error('Invalid API key or network error');
      return res.json();
    })
    .then(data => {
      dropdown.innerHTML = '<option value="">Select a workspace</option>';
      data.forEach(ws => {
        const opt = document.createElement('option');
        opt.value = ws.id;
        opt.textContent = ws.name;
        if (selectedId && ws.id === selectedId) opt.selected = true;
        dropdown.appendChild(opt);
      });
      // If a workspace is selected, load its projects
      if (selectedId) {
        loadClockifyProjects(apiKey, selectedId, selectedProjectId);
      }
    })
    .catch(err => {
      dropdown.innerHTML = '<option value="">Failed to load workspaces</option>';
      alert('Could not load workspaces: ' + err.message);
    });
}

// Helper to fetch and populate projects for a workspace (dropdown style)
function loadClockifyProjects(apiKey, workspaceId, selectedProjectId) {
  const projectDropdown = document.getElementById('clockifyProjectId');
  if (!projectDropdown) return;
  projectDropdown.innerHTML = '<option value="">Loading...</option>';
  fetch(`https://api.clockify.me/api/v1/workspaces/${workspaceId}/projects?page-size=500`, {
    headers: { 'X-Api-Key': apiKey }
  })
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    })
    .then(data => {
      const allProjects = data.filter(proj => !proj.archived);
      projectDropdown.innerHTML = '<option value="">Select a project</option>';
      allProjects.forEach(proj => {
        const opt = document.createElement('option');
        opt.value = proj.id;
        opt.textContent = proj.name;
        if (selectedProjectId && proj.id === selectedProjectId) opt.selected = true;
        projectDropdown.appendChild(opt);
      });
    })
    .catch(err => {
      projectDropdown.innerHTML = '<option value="">Failed to load projects</option>';
      alert('Could not load projects: ' + err.message);
    });
}

// Instantly update meeting history UI when meetingConfig changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.meetingConfig) {
    updateMeetingHistory();
  }
});

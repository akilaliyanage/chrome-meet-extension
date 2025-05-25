/* eslint-disable prefer-template */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// Meeting tracking configuration
let meetingConfig = {
  meetings: [],
  isTracking: false,
  currentMeeting: null,
};

// Initialize meeting tracker

// Load saved meetings
chrome.storage.local.get(["meetingConfig"], (result) => {
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
  } else {
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
  try {
    if (message.type === "MEETING_STARTED") {
      handleMeetingStarted(message.meetingName);
      sendResponse({ status: "success" });
    } else if (message.type === "MEETING_ENDED") {
      handleMeetingEnded();
      sendResponse({ status: "success" });
    }
  } catch (error) {
    sendResponse({ status: "error", error: error.message });
  }
  return true; // Keep the message channel open for async response
});

// Handle meeting started
function handleMeetingStarted(meetingName) {
  const now = new Date();
  meetingConfig.currentMeeting = {
    name: meetingName,
    startTime: now.toISOString(),
    endTime: null,
    duration: null,
    logged: false,
  };
  meetingConfig.isTracking = true;
  saveMeetingConfig();
}

// Handle meeting ended
function handleMeetingEnded() {
  if (meetingConfig.currentMeeting) {
    const now = new Date();
    const startTime = new Date(meetingConfig.currentMeeting.startTime);
    const duration = Math.round((now - startTime) / 1000 / 60); // Duration in minutes

    meetingConfig.currentMeeting.endTime = now.toISOString();
    meetingConfig.currentMeeting.duration = duration;
    meetingConfig.meetings.unshift(meetingConfig.currentMeeting);
    meetingConfig.currentMeeting = null;
    meetingConfig.isTracking = false;
    saveMeetingConfig();
  }
}

// Save meeting configuration
function saveMeetingConfig() {
  chrome.storage.local.set({ meetingConfig }, () => {
  });
}

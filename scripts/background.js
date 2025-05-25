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
console.log("Background script initialized");

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
      // Verify storage after update
      chrome.storage.local.get(['meetingConfig'], (result) => {
        console.log("Storage after meeting start:", result.meetingConfig);
      });
      sendResponse({ status: "success" });
    } else if (message.type === "MEETING_ENDED") {
      console.log("Handling meeting ended");
      handleMeetingEnded();
      console.log("Meeting config after end:", meetingConfig);
      // Verify storage after update
      chrome.storage.local.get(['meetingConfig'], (result) => {
        console.log("Storage after meeting end:", result.meetingConfig);
      });
      sendResponse({ status: "success" });
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse({ status: "error", error: error.message });
  }
  return true; // Keep the message channel open for async response
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
      // Verify the save was successful
      chrome.storage.local.get(['meetingConfig'], (result) => {
        console.log("Verified saved meeting config:", result.meetingConfig);
      });
    }
  });
}

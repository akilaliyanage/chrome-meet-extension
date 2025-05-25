/* eslint-disable no-alert */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// Track meeting state
let isInCall = false;
let isCallEnded = false;
let isInMeeting = false;
let lastMeetingName = "";
let lastCheckTime = Date.now();

// Function to get meeting name
function getMeetingName() {
  console.log("Attempting to get meeting name...");
  // Try different selectors for meeting name
  const selectors = [
    '[data-allocation-index="0"]', // Main meeting name
    '[data-meeting-title]', // Alternative meeting title
    '[data-self-name]', // Self name (fallback)
    'div[role="heading"]', // Generic heading
    'div[aria-label*="meeting"]', // Aria label with meeting
    'div[aria-label*="call"]', // Aria label with call
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    console.log(`Found ${elements.length} elements for selector ${selector}`);
    for (const element of elements) {
      const name = element.textContent.trim();
      if (name) {
        console.log("Found meeting name using selector", selector, ":", name);
        return name;
      }
    }
  }

  // If no name found, use URL as fallback
  const url = window.location.href;
  console.log("No meeting name found, using URL:", url);
  return url;
}

// Function to check meeting state
function checkMeetingState() {
  console.log("Checking meeting state...");
  const now = Date.now();
  
  // More aggressive meeting detection
  const hasMeetingControls = 
    document.querySelector('[role="toolbar"]') !== null ||
    document.querySelector('[data-allocation-index]') !== null ||
    document.querySelector('[data-participant-id]') !== null ||
    document.querySelector('[role="button"][aria-label*="Leave call"]') !== null ||
    document.querySelector('[role="button"][aria-label*="End call"]') !== null;
    
  const hasParticipantList = 
    document.querySelector('[role="list"]') !== null ||
    document.querySelector('[data-participant-id]') !== null ||
    document.querySelector('[role="listbox"]') !== null;
    
  const hasCallButton = 
    document.querySelector('[aria-label*="Leave call"]') !== null ||
    document.querySelector('[aria-label*="End call"]') !== null ||
    document.querySelector('[role="button"][aria-label*="Leave call"]') !== null ||
    document.querySelector('[role="button"][aria-label*="End call"]') !== null;
    
  // More comprehensive call ended detection
  const hasEndedCallButton = 
    document.querySelector('[aria-label*="Rejoin"]') !== null ||
    document.querySelector('[aria-label*="Join now"]') !== null ||
    document.querySelector('[role="button"][aria-label*="Rejoin"]') !== null ||
    document.querySelector('[role="button"][aria-label*="Join now"]') !== null ||
    document.querySelector('[data-is-call-ended-dialog="true"]') !== null ||
    document.querySelector('[data-meeting-ended="true"]') !== null ||
    document.querySelector('[data-meeting-left="true"]') !== null ||
    document.querySelector('[data-call-ended="true"]') !== null ||
    // Check if we're back at the main meet page
    (window.location.href === "https://meet.google.com/" && isInMeeting) ||
    // Check if we're redirected to the main page
    (window.location.href === "https://meet.google.com" && isInMeeting) ||
    // Check if we're on a different page
    (!window.location.href.includes("meet.google.com") && isInMeeting);
    
  const hasMeetingInfo = 
    document.querySelector('[data-allocation-index="0"]') !== null ||
    document.querySelector('[data-meeting-title]') !== null ||
    document.querySelector('div[role="heading"]') !== null ||
    document.querySelector('div[aria-label*="meeting"]') !== null;

  // Log all found elements for debugging
  console.log("Found elements:", {
    toolbar: document.querySelector('[role="toolbar"]'),
    allocationIndex: document.querySelector('[data-allocation-index]'),
    participantId: document.querySelector('[data-participant-id]'),
    leaveCall: document.querySelector('[aria-label*="Leave call"]'),
    endCall: document.querySelector('[aria-label*="End call"]'),
    rejoin: document.querySelector('[aria-label*="Rejoin"]'),
    joinNow: document.querySelector('[aria-label*="Join now"]'),
    meetingTitle: document.querySelector('[data-meeting-title]'),
    heading: document.querySelector('div[role="heading"]'),
    meetingLabel: document.querySelector('div[aria-label*="meeting"]'),
    callEndedDialog: document.querySelector('[data-is-call-ended-dialog="true"]'),
    meetingEnded: document.querySelector('[data-meeting-ended="true"]'),
    meetingLeft: document.querySelector('[data-meeting-left="true"]'),
    callEnded: document.querySelector('[data-call-ended="true"]')
  });

  console.log("Meeting state indicators:", {
    hasMeetingControls,
    hasParticipantList,
    hasCallButton,
    hasEndedCallButton,
    hasMeetingInfo,
    url: window.location.href,
    isInMeeting
  });

  // Check if we're in a meeting - more lenient conditions
  const wasInCall = isInCall;
  isInCall = (hasMeetingControls || hasParticipantList || hasCallButton) && 
             (window.location.href.includes("/meet/") || hasCallButton);
  isCallEnded = hasEndedCallButton;
  isInMeeting = hasMeetingInfo || window.location.href.includes("/meet/");

  console.log("Meeting state:", {
    wasInCall,
    isInCall,
    isCallEnded,
    isInMeeting,
    url: window.location.href
  });

  // Get meeting name if we're in a meeting
  if (isInCall && !wasInCall) {
    const meetingName = getMeetingName();
    console.log("Meeting started:", meetingName);
    chrome.runtime.sendMessage({ type: "MEETING_STARTED", meetingName }, () => {
      // Set a flag in storage to indicate a meeting is in progress
      chrome.storage.local.set({ meetingInProgress: true });
    });
  } else if (wasInCall && (isCallEnded || !isInCall)) {
    console.log("Meeting ended");
    chrome.runtime.sendMessage({ type: "MEETING_ENDED" }, () => {
      // Clear the flag in storage
      chrome.storage.local.remove('meetingInProgress');
    });
  }

  lastCheckTime = now;
}

// Set up periodic check with more frequent checks initially
let checkCount = 0;
const checkInterval = setInterval(() => {
  checkMeetingState();
  checkCount++;
  if (checkCount >= 6) { // After 30 seconds, switch to normal interval
    clearInterval(checkInterval);
    setInterval(checkMeetingState, 2000); // Check every 2 seconds instead of 5
  }
}, 2000); // Start with 2-second intervals

// Initial check
checkMeetingState();

// Set up observer for DOM changes with debouncing
let observerTimeout;
const observer = new MutationObserver((mutations) => {
  // Clear any existing timeout
  if (observerTimeout) {
    clearTimeout(observerTimeout);
  }
  
  // Set a new timeout to check meeting state
  observerTimeout = setTimeout(() => {
    const now = Date.now();
    // Only check if it's been at least 500ms since last check
    if (now - lastCheckTime >= 500) {
      checkMeetingState();
    }
  }, 500);
});

// Wait for document to be ready before starting observation
document.addEventListener('DOMContentLoaded', () => {
  // Start observing with more aggressive settings
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'role', 'data-allocation-index', 'data-meeting-title', 'data-participant-id']
  });
});

// Add visibility change listener for immediate detection when tab is closed/backgrounded
// Always send MEETING_ENDED if in call
// Use sync storage update to maximize reliability
function sendMeetingEndedIfNeeded() {
  if (isInCall) {
    chrome.runtime.sendMessage({ type: "MEETING_ENDED" }, () => {
      chrome.storage.local.remove('meetingInProgress');
    });
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sendMeetingEndedIfNeeded();
  }
});
window.addEventListener('beforeunload', () => {
  sendMeetingEndedIfNeeded();
});

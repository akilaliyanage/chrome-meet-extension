/* eslint-disable no-alert */
/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// Track meeting state
let isInCall = false;
let isCallEnded = false;
let isInMeeting = false;
let lastMeetingName = "";

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
    chrome.runtime.sendMessage({ type: "MEETING_STARTED", meetingName }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending meeting started message:", chrome.runtime.lastError);
      } else {
        console.log("Meeting started message sent successfully:", response);
      }
    });
  } else if (wasInCall && (isCallEnded || !isInCall)) {
    console.log("Meeting ended");
    chrome.runtime.sendMessage({ type: "MEETING_ENDED" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending meeting ended message:", chrome.runtime.lastError);
      } else {
        console.log("Meeting ended message sent successfully:", response);
      }
    });
  }
}

// Set up periodic check with more frequent checks initially
let checkCount = 0;
const checkInterval = setInterval(() => {
  checkMeetingState();
  checkCount++;
  if (checkCount >= 6) { // After 30 seconds, switch to normal interval
    clearInterval(checkInterval);
    setInterval(checkMeetingState, 5000);
  }
}, 5000);

// Initial check
checkMeetingState();

// Set up observer for DOM changes
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList" || mutation.type === "attributes") {
      checkMeetingState();
      break;
    }
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

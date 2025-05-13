// Jira API Configuration
let jiraConfig = {
  domain: "",
  email: "",
  apiToken: "",
  defaultProject: "",
  defaultIssue: null, // Add default issue to config
};

let selectedIssue = null;
let searchTimeout = null;

// Initialize the extension
document.addEventListener("DOMContentLoaded", () => {
  // Load saved configuration
  chrome.storage.local.get(["jiraConfig"], (result) => {
    if (result.jiraConfig) {
      jiraConfig = result.jiraConfig;
      document.getElementById("jiraDomain").value = jiraConfig.domain;
      document.getElementById("jiraEmail").value = jiraConfig.email;
      document.getElementById("jiraApiToken").value = jiraConfig.apiToken;
      showIssueForm();
      loadProjects().then(() => {
        // Set default project if exists
        if (jiraConfig.defaultProject) {
          document.getElementById("jiraProject").value = jiraConfig.defaultProject;
          // If we have a default issue, restore it
          if (jiraConfig.defaultIssue) {
            selectedIssue = jiraConfig.defaultIssue;
            document.getElementById("jiraIssueSearch").value =
              `${jiraConfig.defaultIssue.key} - ${jiraConfig.defaultIssue.fields.summary}`;
          }
        }
      });
    }
  });

  // Test connection button
  document.getElementById("testConnectionBtn").addEventListener("click", testJiraConnection);

  // Save configuration button
  document.getElementById("saveConfigBtn").addEventListener("click", saveJiraConfig);

  // Project selection change
  document.getElementById("jiraProject").addEventListener("change", handleProjectChange);

  // Issue search input
  const issueSearchInput = document.getElementById("jiraIssueSearch");
  issueSearchInput.addEventListener("input", handleIssueSearch);
  issueSearchInput.addEventListener("focus", () => {
    if (issueSearchInput.value.length >= 2) {
      searchIssues(issueSearchInput.value);
    }
  });

  // Close search results when clicking outside
  document.addEventListener("click", (e) => {
    const searchContainer = document.querySelector(".issue-search-container");
    if (!searchContainer.contains(e.target)) {
      document.getElementById("issueSearchResults").classList.remove("show");
    }
  });
});

// Test Jira connection
async function testJiraConnection() {
  const domain = document.getElementById("jiraDomain").value;
  const email = document.getElementById("jiraEmail").value;
  const apiToken = document.getElementById("jiraApiToken").value;

  if (!domain || !email || !apiToken) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const response = await fetch(`https://${domain}.atlassian.net/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${btoa(`${email}:${apiToken}`)}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const userData = await response.json();
      alert(`Connection successful! Welcome ${userData.displayName}`);
      document.getElementById("saveConfigBtn").style.display = "inline-block";
    } else {
      throw new Error("Connection failed");
    }
  } catch (error) {
    alert("Connection failed. Please check your credentials and try again.");
    console.error("Jira connection error:", error);
  }
}

// Save Jira configuration
async function saveJiraConfig() {
  jiraConfig = {
    domain: document.getElementById("jiraDomain").value,
    email: document.getElementById("jiraEmail").value,
    apiToken: document.getElementById("jiraApiToken").value,
    defaultProject: jiraConfig.defaultProject, // Preserve default project
    defaultIssue: jiraConfig.defaultIssue, // Preserve default issue
  };

  await chrome.storage.local.set({ jiraConfig });
  showIssueForm();
  loadProjects().then(() => {
    // Restore default project selection
    if (jiraConfig.defaultProject) {
      document.getElementById("jiraProject").value = jiraConfig.defaultProject;
      // Restore default issue if exists
      if (jiraConfig.defaultIssue) {
        selectedIssue = jiraConfig.defaultIssue;
        document.getElementById("jiraIssueSearch").value =
          `${jiraConfig.defaultIssue.key} - ${jiraConfig.defaultIssue.fields.summary}`;
      }
    }
  });
}

// Load Jira projects
async function loadProjects() {
  const projectSelect = document.getElementById("jiraProject");
  projectSelect.disabled = true;
  projectSelect.innerHTML = '<option value="">Loading projects...</option>';

  try {
    const response = await fetch(`https://${jiraConfig.domain}.atlassian.net/rest/api/3/project`, {
      headers: {
        Authorization: `Basic ${btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`)}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch projects");

    const projects = await response.json();

    projectSelect.innerHTML = '<option value="">Select a project</option>';
    projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.key;
      option.textContent = `${project.key} - ${project.name}`;
      projectSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading projects:", error);
    projectSelect.innerHTML = '<option value="">Error loading projects</option>';
  } finally {
    projectSelect.disabled = false;
  }
}

// Handle project selection change
function handleProjectChange() {
  const projectKey = document.getElementById("jiraProject").value;
  const issueSearchInput = document.getElementById("jiraIssueSearch");

  // Save selected project as default
  if (projectKey) {
    jiraConfig.defaultProject = projectKey;
    // Clear default issue when project changes
    jiraConfig.defaultIssue = null;
    chrome.storage.local.set({ jiraConfig });
  }

  // Clear issue search
  issueSearchInput.value = "";
  selectedIssue = null;
  document.getElementById("issueSearchResults").innerHTML = "";
  document.getElementById("issueSearchResults").classList.remove("show");
}

// Handle issue search input
function handleIssueSearch(e) {
  const searchTerm = e.target.value.trim();

  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Only search if we have at least 2 characters
  if (searchTerm.length >= 2) {
    searchTimeout = setTimeout(() => {
      searchIssues(searchTerm);
    }, 300); // Debounce for 300ms
  } else {
    document.getElementById("issueSearchResults").classList.remove("show");
  }
}

// Search issues
async function searchIssues(searchTerm) {
  const projectKey = document.getElementById("jiraProject").value;
  if (!projectKey) {
    alert("Please select a project first");
    return;
  }

  const resultsContainer = document.getElementById("issueSearchResults");
  resultsContainer.innerHTML = '<div class="issue-item">Searching...</div>';
  resultsContainer.classList.add("show");

  try {
    // Build JQL query
    let jqlQuery;
    if (searchTerm.includes("-")) {
      // If search term contains a hyphen, treat it as an issue key
      jqlQuery = `project = ${projectKey} AND key = "${searchTerm}"`;
    } else {
      // Otherwise search in both key and summary
      jqlQuery = `project = ${projectKey} AND (key ~ "${searchTerm}*" OR summary ~ "${searchTerm}*")`;
    }

    const response = await fetch(
      `https://${jiraConfig.domain}.atlassian.net/rest/api/3/search?jql=${encodeURIComponent(jqlQuery)}&maxResults=10`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${jiraConfig.email}:${jiraConfig.apiToken}`)}`,
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch issues");
    }

    const data = await response.json();

    if (data.issues.length === 0) {
      resultsContainer.innerHTML = '<div class="issue-item">No issues found</div>';
      return;
    }

    resultsContainer.innerHTML = "";
    data.issues.forEach((issue) => {
      const div = document.createElement("div");
      div.className = "issue-item";
      div.innerHTML = `
                <div class="issue-key">${issue.key}</div>
                <div class="issue-summary">${issue.fields.summary}</div>
            `;
      div.addEventListener("click", () => selectIssue(issue));
      resultsContainer.appendChild(div);
    });
  } catch (error) {
    console.error("Error searching issues:", error);
    resultsContainer.innerHTML = `<div class="issue-item">Error: ${error.message}</div>`;
  }
}

// Select an issue
function selectIssue(issue) {
  selectedIssue = issue;
  const searchInput = document.getElementById("jiraIssueSearch");
  searchInput.value = `${issue.key} - ${issue.fields.summary}`;
  document.getElementById("issueSearchResults").classList.remove("show");

  // Save selected issue as default
  jiraConfig.defaultIssue = issue;
  chrome.storage.local.set({ jiraConfig });
}

// Show issue form
function showIssueForm() {
  document.getElementById("configForm").style.display = "none";
  document.getElementById("issueForm").style.display = "block";
}

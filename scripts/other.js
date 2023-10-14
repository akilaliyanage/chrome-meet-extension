/* eslint-disable no-alert */
/* eslint-disable no-undef */
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */

const configFormButton = document.getElementById("configFormButton");
const workspaceIdInput = document.getElementById("clokifyWorkspaceIdInput");
const projectIdInput = document.getElementById("clokifyProjectIdInput");
const PATInput = document.getElementById("clokifyPATInput");
const jiraEmailInput = document.getElementById("jiraEmailInput");
const jiraPATInput = document.getElementById("jiraPATInput");
const jiraTaskIdInput = document.getElementById("jiraTaskIdInput");

configFormButton.addEventListener("click", (e) => {
  e.preventDefault();

  const configurations = {
    workspaceId: workspaceIdInput.value,
    projectId: projectIdInput.value,
    PAT: PATInput.value,
    jiraEmail: jiraEmailInput.value,
    jiraPAT: jiraPATInput.value,
    jiraTaskId: jiraTaskIdInput.value,
  };

  chrome.storage.sync.set(configurations, () => {
    console.log(configurations);
    alert("Configuration saved!");
  });
});

window.onload = () => {
  chrome.storage.sync.get(
    ["workspaceId", "projectId", "PAT", "jiraEmail", "jiraPAT", "jiraTaskId"],
    (configurations) => {
      workspaceIdInput.value = configurations.workspaceId;
      projectIdInput.value = configurations.projectId;
      PATInput.value = configurations.PAT;
      jiraEmailInput.value = configurations.jiraEmail;
      jiraPATInput.value = configurations.jiraPAT;
      jiraTaskIdInput.value = configurations.jiraTaskId;
    },
  );
};

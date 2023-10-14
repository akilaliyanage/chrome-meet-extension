/* eslint-disable no-alert */
/* eslint-disable no-undef */
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */

const configFormButton = document.getElementById("configFormButton");
const configForm = document.getElementById("configForm");
const workspaceIdInput = document.getElementById("clokifyWorkspaceIdInput");
const projectIdInput = document.getElementById("clokifyProjectIdInput");
const PATInput = document.getElementById("clokifyPATInput");

configFormButton.addEventListener("click", (e) => {
  e.preventDefault();

  const configurations = {
    workspaceId: workspaceIdInput.value,
    projectId: projectIdInput.value,
    PAT: PATInput.value,
  };

  chrome.storage.sync.set(configurations, () => {
    alert("Configuration saved!");
  });
});

window.onload = () => {
  chrome.storage.sync.get(["workspaceId", "projectId", "PAT"], (configurations) => {
    workspaceIdInput.value = configurations.workspaceId;
    projectIdInput.value = configurations.projectId;
    PATInput.value = configurations.PAT;
  });
};

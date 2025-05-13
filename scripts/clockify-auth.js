// Clockify OAuth Configuration
const CLOCKIFY_CLIENT_ID = 'YOUR_CLIENT_ID'; // Replace with your Clockify Client ID
const CLOCKIFY_REDIRECT_URI = chrome.identity.getRedirectURL();
const CLOCKIFY_AUTH_URL = 'https://app.clockify.me/oauth/authorize';
const CLOCKIFY_TOKEN_URL = 'https://app.clockify.me/oauth/token';
const CLOCKIFY_API_URL = 'https://api.clockify.me/api/v1';

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('clockifyLoginBtn');
    const configForm = document.getElementById('configForm');
    
    // Check if user is already authenticated
    chrome.storage.local.get(['clockifyToken'], (result) => {
        if (result.clockifyToken) {
            showConfigForm();
            loadWorkspaces();
        }
    });

    // Handle Clockify login
    loginBtn.addEventListener('click', initiateClockifyAuth);
});

// Initiate OAuth flow
function initiateClockifyAuth() {
    const authUrl = `${CLOCKIFY_AUTH_URL}?` + new URLSearchParams({
        client_id: CLOCKIFY_CLIENT_ID,
        redirect_uri: CLOCKIFY_REDIRECT_URI,
        response_type: 'code',
        scope: 'workspace:read project:read time-entry:write'
    });

    chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
    }, handleAuthResponse);
}

// Handle OAuth response
async function handleAuthResponse(redirectUrl) {
    if (chrome.runtime.lastError || !redirectUrl) {
        console.error('Auth failed:', chrome.runtime.lastError);
        return;
    }

    const url = new URL(redirectUrl);
    const code = url.searchParams.get('code');

    if (code) {
        try {
            const token = await exchangeCodeForToken(code);
            await chrome.storage.local.set({ clockifyToken: token });
            showConfigForm();
            loadWorkspaces();
        } catch (error) {
            console.error('Token exchange failed:', error);
        }
    }
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
    const response = await fetch(CLOCKIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: CLOCKIFY_CLIENT_ID,
            code: code,
            redirect_uri: CLOCKIFY_REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });

    if (!response.ok) {
        throw new Error('Token exchange failed');
    }

    const data = await response.json();
    return data.access_token;
}

// Load user's workspaces
async function loadWorkspaces() {
    const { clockifyToken } = await chrome.storage.local.get(['clockifyToken']);
    if (!clockifyToken) return;

    try {
        const response = await fetch(`${CLOCKIFY_API_URL}/workspaces`, {
            headers: {
                'X-Api-Key': clockifyToken
            }
        });

        if (!response.ok) throw new Error('Failed to fetch workspaces');

        const workspaces = await response.json();
        const workspaceSelect = document.getElementById('clokifyWorkspaceIdInput');
        
        workspaceSelect.innerHTML = '<option value="">Select a workspace</option>';
        workspaces.forEach(workspace => {
            const option = document.createElement('option');
            option.value = workspace.id;
            option.textContent = workspace.name;
            workspaceSelect.appendChild(option);
        });

        workspaceSelect.addEventListener('change', loadProjects);
    } catch (error) {
        console.error('Error loading workspaces:', error);
    }
}

// Load projects for selected workspace
async function loadProjects() {
    const workspaceId = document.getElementById('clokifyWorkspaceIdInput').value;
    if (!workspaceId) return;

    const { clockifyToken } = await chrome.storage.local.get(['clockifyToken']);
    if (!clockifyToken) return;

    try {
        const response = await fetch(`${CLOCKIFY_API_URL}/workspaces/${workspaceId}/projects`, {
            headers: {
                'X-Api-Key': clockifyToken
            }
        });

        if (!response.ok) throw new Error('Failed to fetch projects');

        const projects = await response.json();
        const projectSelect = document.getElementById('clokifyProjectIdInput');
        
        projectSelect.innerHTML = '<option value="">Select a project</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Show configuration form
function showConfigForm() {
    document.getElementById('clockifyLoginBtn').style.display = 'none';
    document.getElementById('configForm').style.display = 'block';
}

// Save configuration
document.getElementById('configFormButton').addEventListener('click', async () => {
    const workspaceId = document.getElementById('clokifyWorkspaceIdInput').value;
    const projectId = document.getElementById('clokifyProjectIdInput').value;

    if (!workspaceId || !projectId) {
        alert('Please select both a workspace and a project');
        return;
    }

    await chrome.storage.local.set({
        clockifyWorkspaceId: workspaceId,
        clockifyProjectId: projectId
    });

    alert('Configuration saved successfully!');
}); 
// Grab references to DOM elements we'll interact with
const chatWindow = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const modeLabel = document.getElementById('mode-label');
const modeToggleButton = document.getElementById('mode-toggle');
const agentSettings = document.getElementById('agent-settings');
const agentIdInput = document.getElementById('agent-id');
const sessionIdInput = document.getElementById('session-id');
const workflowIdInput = document.getElementById('workflow-id');

// Track which backend the user wants to use; default to the existing ChatKit flow.
let activeMode = 'chatkit';
if (agentSettings) {
  agentSettings.hidden = true;
}

// Toggle between ChatKit (responses endpoint) and AgentKit (agent endpoint) modes.
modeToggleButton.addEventListener('click', () => {
  activeMode = activeMode === 'chatkit' ? 'agentkit' : 'chatkit';

  const isAgentMode = activeMode === 'agentkit';
  modeLabel.textContent = isAgentMode ? 'AgentKit Mode' : 'ChatKit Mode';
  modeToggleButton.textContent = isAgentMode ? 'Switch to ChatKit' : 'Switch to AgentKit';
  modeToggleButton.setAttribute('aria-pressed', String(isAgentMode));
  if (agentSettings) {
    agentSettings.hidden = !isAgentMode;
  }
});

/**
 * Create and append a chat bubble to the window.
 * @param {string} text - Content to display in the bubble.
 * @param {'user' | 'bot'} sender - Who sent the message.
 * @returns {HTMLDivElement} The DOM node for further manipulation if needed.
 */
function addMessage(text, sender) {
  const message = document.createElement('div');
  message.classList.add('message', sender);
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return message;
}

/**
 * Display a friendly indicator while the AI composes a reply.
 * @returns {HTMLDivElement} The typing indicator element.
 */
function showTypingIndicator(text) {
  const indicator = addMessage(text, 'bot');
  indicator.classList.add('typing');
  return indicator;
}

/**
 * Request a fresh joke from the backend for the provided user message.
 * @param {string} message
 * @param {'chatkit' | 'agentkit'} mode
 */
async function fetchJoke(message, mode) {
  try {
    const endpoint = mode === 'agentkit' ? '/api/agentJoke' : '/api/joke';
    const payload =
      mode === 'agentkit'
        ? { message }
        : { topic: message };

    if (mode === 'agentkit') {
      // Include the Agent Builder identifiers so the backend can route the
      // request to the hosted agent and optionally reuse session memory.
      payload.agentId = agentIdInput ? agentIdInput.value.trim() : '';
      const session = sessionIdInput ? sessionIdInput.value.trim() : '';
      if (session) {
        payload.sessionId = session;
      }
      // Workflow IDs show up in the Agent SDK snippet the builder exports and
      // help correlate requests with traces when observability is enabled.
      const workflow = workflowIdInput ? workflowIdInput.value.trim() : '';
      if (workflow) {
        payload.workflowId = workflow;
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    if (!data || typeof data.joke !== 'string') {
      throw new Error('Invalid response shape from joke API');
    }

    return data.joke.trim();
  } catch (error) {
    console.error('Failed to fetch joke:', error);
    return "Sorry, I couldn't think of a joke right now. Please try again in a moment.";
  }
}

// Listen to form submission to handle user message and bot response
chatForm.addEventListener('submit', async event => {
  event.preventDefault();

  const message = userInput.value.trim();
  if (!message) {
    return;
  }

  if (activeMode === 'agentkit' && !(agentIdInput && agentIdInput.value.trim())) {
    addMessage(
      'Please enter your Agent ID (from the OpenAI Agent Builder) to use Agent mode.',
      'bot'
    );
    return;
  }

  // Display the user's message
  addMessage(message, 'user');

  // Show a typing indicator while we wait for the AI to respond
  const indicatorText = activeMode === 'agentkit' ? '🎭 ComedianBot is thinking…' : 'AI is thinking…';
  const typingIndicator = showTypingIndicator(indicatorText);

  // Clear the input for the next message
  userInput.value = '';
  userInput.focus();

  // Retrieve the AI-generated joke from the backend. Agent Builder keeps
  // conversational context server-side for a session, so reusing the same
  // session ID lets ComedianBot reference previous topics.
  const joke = await fetchJoke(message, activeMode);

  // Replace the typing indicator with the actual joke text
  typingIndicator.textContent = joke;
  typingIndicator.classList.remove('typing');
});

// Future extension idea: enable new tools for the hosted agent (voice synth,
// Supabase favorites, etc.) directly in the Agent Builder UI and they'll be
// available without changing this frontend fetch logic.

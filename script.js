// Grab references to DOM elements we'll interact with
const chatWindow = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const modeLabel = document.getElementById('mode-label');
const modeToggleButton = document.getElementById('mode-toggle');

// Track which backend the user wants to use; default to the existing ChatKit flow.
let activeMode = 'chatkit';

// Toggle between ChatKit (responses endpoint) and AgentKit (agent endpoint) modes.
modeToggleButton.addEventListener('click', () => {
  activeMode = activeMode === 'chatkit' ? 'agentkit' : 'chatkit';

  const isAgentMode = activeMode === 'agentkit';
  modeLabel.textContent = isAgentMode ? 'AgentKit Mode' : 'ChatKit Mode';
  modeToggleButton.textContent = isAgentMode ? 'Switch to ChatKit' : 'Switch to AgentKit';
  modeToggleButton.setAttribute('aria-pressed', String(isAgentMode));
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
 * Request a fresh joke from the backend for the provided topic.
 * @param {string} topic
 * @param {'chatkit' | 'agentkit'} mode
 */
async function fetchJoke(topic, mode) {
  try {
    const endpoint = mode === 'agentkit' ? '/api/agentJoke' : '/api/joke';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ topic })
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

  const topic = userInput.value.trim();
  if (!topic) {
    return;
  }

  // Display the user's message
  addMessage(topic, 'user');

  // Show a typing indicator while we wait for the AI to respond
  const indicatorText = activeMode === 'agentkit' ? '🎭 ComedianBot is thinking…' : 'AI is thinking…';
  const typingIndicator = showTypingIndicator(indicatorText);

  // Clear the input for the next message
  userInput.value = '';
  userInput.focus();

  // Retrieve the AI-generated joke from the backend
  // AgentKit maintains conversational context server-side, so repeated
  // requests in Agent mode build on earlier topics. ChatKit mode stays stateless.
  const joke = await fetchJoke(topic, activeMode);

  // Replace the typing indicator with the actual joke text
  typingIndicator.textContent = joke;
  typingIndicator.classList.remove('typing');
});

// Future extension idea: register new tools with AgentKit (e.g. voice synth or
// persisting "favorite" jokes in Supabase) and call them from the backend
// without changing this frontend fetch logic.

const chatkitRoot = document.getElementById('chatkit-root');
const chatkitForm = document.getElementById('chatkit-form');
const modelInput = document.getElementById('chat-model');
const instructionsInput = document.getElementById('instructions');
const sessionNameInput = document.getElementById('session-name');
const statusMessage = document.getElementById('status-message');

let chatkitInstance = null;
let chatkitModulePromise = null;
let cachedToken = null;

/**
 * Update the live region that keeps users informed about connection state.
 * @param {string} message - Human-friendly status description.
 * @param {'info' | 'success' | 'error'} [variant='info'] - Toggle semantic color states.
 */
function setStatus(message, variant = 'info') {
  statusMessage.textContent = message;
  statusMessage.classList.remove('success', 'error');
  if (variant !== 'info') {
    statusMessage.classList.add(variant);
  }
}

/**
 * Lazily import the ChatKit embed helper from the CDN referenced in the official docs.
 * The module is cached after first load so repeated mounts stay snappy.
 */
async function loadChatKitModule() {
  if (!chatkitModulePromise) {
    chatkitModulePromise = import('https://cdn.jsdelivr.net/npm/@openai/chatkit@latest/+esm').catch(error => {
      chatkitModulePromise = null;
      throw error;
    });
  }
  return chatkitModulePromise;
}

/**
 * Tear down a previous ChatKit instance if one exists. Different versions expose either
 * `destroy` or `unmount`, so we defensively attempt both.
 */
async function disposeChatKitInstance() {
  if (!chatkitInstance) {
    return;
  }

  try {
    if (typeof chatkitInstance.destroy === 'function') {
      await chatkitInstance.destroy();
    } else if (typeof chatkitInstance.unmount === 'function') {
      await chatkitInstance.unmount();
    }
  } catch (error) {
    console.warn('Failed to dispose ChatKit instance:', error);
  }

  chatkitInstance = null;
}

/**
 * Fetch a ChatKit token from our backend. The backend reads the API key from
 * environment variables so the browser never needs to collect it directly.
 */
async function fetchChatKitToken() {
  if (cachedToken) {
    return cachedToken;
  }

  const response = await fetch('/api/chatkit-token', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Token endpoint returned an error.');
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error('Token endpoint did not include a token.');
  }

  cachedToken = data.token;
  return cachedToken;
}

/**
 * Mount ChatKit inside our UI using the embed instructions from the platform docs.
 * Tokens are retrieved from the backend, which can later be updated to mint
 * short-lived credentials via the official token service.
 */
async function mountChatKit({ model, instructions, sessionName }) {
  const module = await loadChatKitModule();
  const initializer =
    module?.createChatKit ??
    module?.createChat ??
    module?.ChatKit ??
    module?.default;

  if (!initializer) {
    throw new Error('Unable to locate the ChatKit embed initializer. Check the documentation for updates.');
  }

  await disposeChatKitInstance();
  chatkitRoot.innerHTML = '';

  const token = await fetchChatKitToken();

  const options = {
    element: chatkitRoot,
    model,
    instructions,
    token,
    getToken: fetchChatKitToken,
    tokenProvider: fetchChatKitToken
  };

  if (sessionName) {
    options.sessionName = sessionName;
  }

  const instance = typeof initializer === 'function'
    ? await initializer(options)
    : await initializer.mount?.(options);

  if (!instance) {
    throw new Error('ChatKit did not return a running instance.');
  }

  chatkitInstance = instance;
  return instance;
}

chatkitForm.addEventListener('submit', async event => {
  event.preventDefault();

  const model = (modelInput.value || 'gpt-4o-mini').trim();
  const instructions = (instructionsInput.value || '').trim() ||
    'You are a friendly stand-up comedian who tells short, family-friendly jokes with witty timing. Keep responses under 3 sentences.';
  const sessionName = (sessionNameInput.value || '').trim();

  setStatus('Loading ChatKit…');

  try {
    cachedToken = null;
    await mountChatKit({ model, instructions, sessionName });
    setStatus('ChatKit is ready! Ask for a topic and start laughing.', 'success');
  } catch (error) {
    console.error('Failed to mount ChatKit:', error);
    setStatus('We could not load ChatKit. Confirm your deployment and model access.', 'error');
  }
});

// Provide guidance for keyboard users landing directly in the embed area.
chatkitRoot.addEventListener('keydown', event => {
  if (event.key === 'Escape' && chatkitInstance?.focusInput) {
    chatkitInstance.focusInput();
  }
});

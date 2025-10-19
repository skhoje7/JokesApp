const chatkitRoot = document.getElementById('chatkit-root');
const chatkitForm = document.getElementById('chatkit-form');
const apiKeyInput = document.getElementById('api-key');
const modelInput = document.getElementById('chat-model');
const instructionsInput = document.getElementById('instructions');
const sessionNameInput = document.getElementById('session-name');
const statusMessage = document.getElementById('status-message');

let chatkitInstance = null;
let chatkitModulePromise = null;

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
 * Mount ChatKit inside our UI using the embed instructions from the platform docs.
 * We accept a raw API key for local tinkering; production deployments should provide
 * an ephemeral session token from a secure backend instead.
 */
async function mountChatKit({ apiKey, model, instructions, sessionName }) {
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

  const options = {
    element: chatkitRoot,
    model,
    instructions,
    apiKey,
    token: apiKey,
    getToken: async () => apiKey,
    tokenProvider: async () => apiKey
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

  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    setStatus('Please paste an OpenAI API key to launch ChatKit.', 'error');
    return;
  }

  const model = (modelInput.value || 'gpt-4o-mini').trim();
  const instructions = (instructionsInput.value || '').trim() ||
    'You are a friendly stand-up comedian who tells short, family-friendly jokes with witty timing. Keep responses under 3 sentences.';
  const sessionName = (sessionNameInput.value || '').trim();

  setStatus('Loading ChatKit…');

  try {
    await mountChatKit({ apiKey, model, instructions, sessionName });
    setStatus('ChatKit is ready! Ask for a topic and start laughing.', 'success');
  } catch (error) {
    console.error('Failed to mount ChatKit:', error);
    setStatus('We could not load ChatKit. Confirm your key, model access, and internet connection.', 'error');
  }
});

// Provide guidance for keyboard users landing directly in the embed area.
chatkitRoot.addEventListener('keydown', event => {
  if (event.key === 'Escape' && chatkitInstance?.focusInput) {
    chatkitInstance.focusInput();
  }
});

import { ChatKit as ESMChatKit } from "@openai/chatkit";

// Prefer the ESM build; fall back to the global injected by the UMD bundle.
const ChatKitCtor = ESMChatKit ?? window.ChatKit;
if (!ChatKitCtor) {
  throw new Error("ChatKit SDK failed to load. Check the CDN include in index.html.");
}

const chatWindow = document.getElementById("chat");
const chatForm = document.getElementById("chat-form");
const inputField = document.getElementById("userInput");
const sendButton = document.getElementById("sendBtn");

// Replace this identifier with the workflow or agent you created in the OpenAI dashboard.
const WORKFLOW_ID = "workflow_ABC123xyz";

let chatClientPromise = null;

/**
 * Request a short-lived ChatKit token from the backend.
 * The backend in turn talks to OpenAI using the permanent API key.
 */
async function getClientToken() {
  const response = await fetch("/api/token", { method: "POST" });
  if (!response.ok) {
    throw new Error("Token endpoint returned an error");
  }

  const data = await response.json();
  if (!data?.client_secret) {
    throw new Error("Token endpoint did not include a client_secret");
  }

  return data.client_secret;
}

/**
 * Instantiate a ChatKit client once and reuse it for subsequent messages.
 */
async function setupChat() {
  if (!chatClientPromise) {
    chatClientPromise = (async () => {
      const token = await getClientToken();
      // ChatKit accepts the short-lived client secret returned from the backend.
      return new ChatKitCtor({ apiKey: token });
    })().catch(error => {
      chatClientPromise = null;
      throw error;
    });
  }

  return chatClientPromise;
}

/**
 * Create a new message bubble in the chat transcript.
 */
function addMessage(text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `message ${sender}`;
  bubble.textContent = text;
  chatWindow.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return bubble;
}

/**
 * Update an existing bot bubble (used while streaming partial responses).
 */
function updateMessage(element, text) {
  if (element) {
    element.textContent = text;
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

/**
 * Disable composer controls while a request is running to prevent duplicates.
 */
function setLoading(isLoading) {
  inputField.disabled = isLoading;
  sendButton.disabled = isLoading;
  if (isLoading) {
    sendButton.classList.add("loading");
  } else {
    sendButton.classList.remove("loading");
  }
}

/**
 * Send the topic to ChatKit, stream the response, and update the UI as chunks arrive.
 */
async function sendJokeRequest(topic) {
  setLoading(true);

  try {
    const chat = await setupChat();

    addMessage(topic, "user");
    const botMessage = addMessage("🎭 ComedianBot is typing…", "bot");

    const response = await chat.send({
      workflowId: WORKFLOW_ID,
      input: `Tell me a short family-friendly joke about ${topic}.`,
      stream: true,
    });

    let combinedText = "";

    // Stream chunks as they are produced and progressively update the bubble.
    for await (const chunk of response.stream) {
      const delta = chunk?.output?.[0]?.content?.[0]?.text ?? "";
      combinedText += delta;
      updateMessage(botMessage, combinedText || "🎭 ComedianBot is thinking…");
    }

    if (!combinedText) {
      updateMessage(botMessage, "Hmm… the punchline never arrived. Try again in a moment.");
    }
  } catch (error) {
    console.error("ChatKit request failed:", error);
    addMessage(
      "I couldn’t reach ChatKit right now. Double-check your workflow ID and deployment, then try again.",
      "bot"
    );
  } finally {
    setLoading(false);
  }
}

chatForm.addEventListener("submit", event => {
  event.preventDefault();
  const topic = inputField.value.trim();
  if (!topic) {
    return;
  }

  inputField.value = "";
  sendJokeRequest(topic);
});

// Support pressing Enter without submitting empty strings.
inputField.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

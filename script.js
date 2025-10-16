// Grab references to DOM elements we'll interact with
const chatWindow = document.getElementById('chat');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');

// Simple jokes database keyed by topic
const jokes = {
  animals: [
    'Why did the cow go to space? To see the moooon!',
    'What do you call an alligator in a vest? An investigator!'
  ],
  tech: [
    'Why did the developer go broke? Because he used up all his cache!',
    'Why do Java developers wear glasses? Because they don\'t C#!'
  ],
  food: [
    'What’s a skeleton’s least favorite room? The living room!',
    'Why did the tomato turn red? Because it saw the salad dressing!'
  ]
};

// Helper function to create and append a message bubble to the chat
function addMessage(text, sender) {
  const message = document.createElement('div');
  message.classList.add('message', sender);
  message.textContent = text;
  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Generate a joke based on the topic or provide fallback message
function getJoke(topic) {
  const normalizedTopic = topic.toLowerCase().trim();
  const topicJokes = jokes[normalizedTopic];

  if (!topicJokes) {
    return 'Hmm… I don’t know any jokes about that yet 😅';
  }

  const randomIndex = Math.floor(Math.random() * topicJokes.length);
  return topicJokes[randomIndex];
}

// Listen to form submission to handle user message and bot response
chatForm.addEventListener('submit', event => {
  event.preventDefault();

  const topic = userInput.value;
  if (!topic.trim()) {
    return;
  }

  // Display the user's message
  addMessage(topic, 'user');

  // Display the AI joke response
  const joke = getJoke(topic);
  addMessage(joke, 'bot');

  // Clear the input for the next message
  userInput.value = '';
  userInput.focus();
});

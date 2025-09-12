// sidepanel.js

// --- GLOBAL STATE & ELEMENTS ---
let conversationHistory = [];
let summaryTextContent = '';

// Mode switching elements
const summaryModeBtn = document.getElementById('summary-mode-btn');
const chatModeBtn = document.getElementById('chat-mode-btn');
const summaryContent = document.getElementById('summary-mode-content');
const chatContent = document.getElementById('chat-mode-content');
const summaryFooter = document.getElementById('summary-footer');
const chatFooter = document.getElementById('chat-footer');

// Summary view elements
const contentContainer = document.getElementById('content-container');
const summaryTitleEl = document.getElementById('summary-title');
const summaryTextEl = document.getElementById('summary-text');
const errorTitleEl = document.getElementById('error-title');
const errorMessageEl = document.getElementById('error-message');
const copyButton = document.getElementById('copy-button');
const copyButtonText = copyButton.querySelector('span');

// Chat view elements
const chatHistoryEl = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const typingIndicator = document.getElementById('chat-typing-indicator');

// Text size elements
const decreaseTextBtn = document.getElementById('decrease-text-size');
const increaseTextBtn = document.getElementById('increase-text-size');
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px'];
const DEFAULT_FONT_INDEX = 2;
let currentFontIndex = DEFAULT_FONT_INDEX;

// --- MODE SWITCHING ---
function switchMode(mode) {
    const isSummary = mode === 'summary';
    summaryModeBtn.classList.toggle('active', isSummary);
    chatModeBtn.classList.toggle('active', !isSummary);
    summaryContent.classList.toggle('active', isSummary);
    chatContent.classList.toggle('active', !isSummary);
    summaryFooter.classList.toggle('active', isSummary);
    chatFooter.classList.toggle('active', !isSummary);
}
summaryModeBtn.addEventListener('click', () => switchMode('summary'));
chatModeBtn.addEventListener('click', () => switchMode('chat'));

// --- CHAT LOGIC ---
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
    appendMessage('user', userInput);

    chatInput.value = '';
    chatSendBtn.disabled = true;
    showTypingIndicator(true);

    chrome.runtime.sendMessage({ action: 'chatWithPage', history: conversationHistory });
});

function appendMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    messageDiv.textContent = text;
    chatHistoryEl.appendChild(messageDiv);
    chatHistoryEl.parentElement.scrollTop = chatHistoryEl.parentElement.scrollHeight;
}

function showTypingIndicator(show) {
    typingIndicator.style.display = show ? 'inline-flex' : 'none';
    if (show) {
        chatHistoryEl.parentElement.scrollTop = chatHistoryEl.parentElement.scrollHeight;
    }
}

chatInput.addEventListener('input', () => {
    chatSendBtn.disabled = chatInput.value.trim().length === 0;
});

// --- SUMMARY & STATE LOGIC ---
function setState(state, data = {}) {
    contentContainer.className = state;
    switch (state) {
        case 'summary':
            summaryTitleEl.textContent = data.title;
            summaryTextEl.textContent = data.summary;
            summaryTextContent = data.summary;
            copyButton.disabled = false;
            break;
        case 'error':
            errorTitleEl.textContent = data.title || 'Oops!';
            errorMessageEl.textContent = data.message;
            copyButton.disabled = true;
            break;
        case 'loading':
        case 'welcome':
            copyButton.disabled = true;
            break;
    }
}

// --- MESSAGE LISTENER FROM BACKGROUND ---
chrome.runtime.onMessage.addListener((request) => {
    switch (request.action) {
        case 'displaySummary':
            setState('summary', { title: request.title, summary: request.summary });
            chatModeBtn.disabled = false;
            conversationHistory = [];
            chatHistoryEl.innerHTML = '';
            break;
        case 'displayError':
            setState('error', { title: request.title, message: request.message });
            chatModeBtn.disabled = true;
            break;
        case 'showLoading':
            setState('loading');
            switchMode('summary');
            chatModeBtn.disabled = true;
            break;
        case 'displayChatResponse':
            showTypingIndicator(false);
            chatSendBtn.disabled = false;
            conversationHistory.push({ role: 'model', parts: [{ text: request.message }] });
            appendMessage('assistant', request.message);
            break;
        case 'displayChatError':
            showTypingIndicator(false);
            chatSendBtn.disabled = false;
            appendMessage('assistant', `Error: ${request.message}`);
            break;
    }
});

// --- FOOTER CONTROLS (COPY & TEXT SIZE) ---
copyButton.addEventListener('click', () => {
    if (summaryTextContent) {
        navigator.clipboard.writeText(summaryTextContent).then(() => {
            copyButtonText.textContent = 'Copied!';
            setTimeout(() => { copyButtonText.textContent = 'Copy Summary'; }, 2000);
        });
    }
});

function applyTextSize(index) {
    const size = FONT_SIZES[index];
    summaryTextEl.style.fontSize = size;
    chatHistoryEl.style.fontSize = size; // Apply to chat as well

    currentFontIndex = index;
    decreaseTextBtn.disabled = (index === 0);
    increaseTextBtn.disabled = (index === FONT_SIZES.length - 1);
}

increaseTextBtn.addEventListener('click', () => {
    if (currentFontIndex < FONT_SIZES.length - 1) {
        const newIndex = currentFontIndex + 1;
        applyTextSize(newIndex);
        chrome.storage.local.set({ textSizeIndex: newIndex });
    }
});

decreaseTextBtn.addEventListener('click', () => {
    if (currentFontIndex > 0) {
        const newIndex = currentFontIndex - 1;
        applyTextSize(newIndex);
        chrome.storage.local.set({ textSizeIndex: newIndex });
    }
});

// --- INITIALIZATION ---
function initialize() {
    chrome.storage.local.get(['textSizeIndex'], (result) => {
        const savedIndex = result.textSizeIndex;
        applyTextSize(typeof savedIndex === 'number' ? savedIndex : DEFAULT_FONT_INDEX);
    });
    setState('welcome');
    chatSendBtn.disabled = true;
}

initialize();
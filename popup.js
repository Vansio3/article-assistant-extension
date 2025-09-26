// popup.js
import { config } from './config.js';
import { getGeneralFactCheckPrompt } from './prompts.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE & ELEMENTS ---
    let conversationHistory = [];
    let summaryTextContent = '';
    let summaryPlainText = '';
    let factCheckReportContent = '';
    let isFactCheckRunning = false;
    let isReading = false;
    let availableVoices = [];
    let speechQueue = [];
    let currentSpeechIndex = 0;
    let isInternetSearchEnabled = false;

    // --- ELEMENT SELECTORS ---
    const summaryModeBtn = document.getElementById('summary-mode-btn');
    const chatModeBtn = document.getElementById('chat-mode-btn');
    const factCheckModeBtn = document.getElementById('fact-check-mode-btn');
    const copyButton = document.getElementById('copy-button');
    const copyButtonIcon = document.getElementById('copy-button-icon');
    const summaryContent = document.getElementById('summary-mode-content');
    const chatContent = document.getElementById('chat-mode-content');
    const factCheckContent = document.getElementById('fact-check-mode-content');
    const summaryFooter = document.getElementById('summary-footer');
    const chatFooter = document.getElementById('chat-footer');
    const factCheckFooter = document.getElementById('fact-check-footer');
    const contentContainer = document.getElementById('content-container');
    const summaryTextEl = document.getElementById('summary-text');
    const errorTitleEl = document.getElementById('error-title');
    const errorMessageEl = document.getElementById('error-message');
    const chatHistoryEl = document.getElementById('chat-history');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const typingIndicator = document.getElementById('chat-typing-indicator');
    const conversationStartersEl = document.getElementById('conversation-starters');
    const starterBtns = document.querySelectorAll('#conversation-starters .starter-btn');
    const readAloudBtn = document.getElementById('read-aloud-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const modalOverlay = document.querySelector('.modal-overlay');
    const voiceSelect = document.getElementById('voice-select');
    const speedSlider = document.getElementById('speed-slider');
    const speedValueEl = document.getElementById('speed-value');
    const decreaseTextBtn = document.getElementById('decrease-text-size');
    const increaseTextBtn = document.getElementById('increase-text-size');
    const textSizeValueEl = document.getElementById('text-size-value');
    const internetToggleBtn = document.getElementById('internet-toggle-btn');
    const themeButtons = document.querySelectorAll('.theme-btn');
    const darkModeMatcher = window.matchMedia('(prefers-color-scheme: dark)');
    const factCheckContainer = document.getElementById('fact-check-container');
    const factCheckReportTextEl = document.getElementById('fact-check-report-text');
    const factCheckErrorTitleEl = document.getElementById('fact-check-error-title');
    const factCheckErrorMessageEl = document.getElementById('fact-check-error-message');
    const deepSearchBtn = document.getElementById('deep-search-btn');
    const deepSearchFeedbackEl = document.getElementById('deep-search-feedback');
    // NEW API Key elements
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const apiKeyFeedback = document.getElementById('api-key-feedback');

    const FONT_SETTINGS = [
        { size: '12px', name: 'Smallest' },
        { size: '13px', name: 'Small' },
        { size: '14px', name: 'Normal' },
        { size: '16px', name: 'Large' },
        { size: '18px', name: 'Largest' }
    ];
    const DEFAULT_FONT_INDEX = 2;
    let currentFontIndex = DEFAULT_FONT_INDEX;

    // --- THEME LOGIC ---
    function applyAndStoreTheme(theme) {
        let themeToApply = theme;
        if (theme === 'system') {
            themeToApply = darkModeMatcher.matches ? 'dark' : 'light';
        }
        document.body.dataset.theme = themeToApply;
        themeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themeValue === theme);
        });
        chrome.storage.local.set({ theme: theme });
    }
    themeButtons.forEach(button => {
        button.addEventListener('click', () => applyAndStoreTheme(button.dataset.themeValue));
    });
    darkModeMatcher.addEventListener('change', () => {
        chrome.storage.local.get(['theme'], (settings) => {
            if (!settings.theme || settings.theme === 'system') {
                applyAndStoreTheme('system');
            }
        });
    });

    // --- EVENT LISTENERS & LOGIC ---
    function updateConversationStartersVisibility() {
        const hasMessages = chatHistoryEl.children.length > 0;
        conversationStartersEl.classList.toggle('hidden', hasMessages);
    }

    copyButton.addEventListener('click', () => {
        if (summaryTextContent) {
            navigator.clipboard.writeText(summaryTextContent).then(() => {
                copyButtonIcon.src = 'icons/checkmark-icon.svg';
                copyButton.title = "Copied!";
                setTimeout(() => {
                    copyButtonIcon.src = 'icons/copy-icon.svg';
                    copyButton.title = "Copy summary to clipboard";
                }, 2000);
            });
        }
    });

    // --- MODIFIED: Settings Modal Logic ---
    function openSettingsModal() {
        // Load the current API key when the modal is opened
        chrome.storage.local.get(['geminiApiKey'], (result) => {
            if (result.geminiApiKey) {
                apiKeyInput.value = result.geminiApiKey;
            } else {
                apiKeyInput.value = '';
            }
            apiKeyFeedback.textContent = ''; // Clear any previous feedback
        });
        settingsModal.classList.add('visible');
    }

    function closeSettingsModal() { settingsModal.classList.remove('visible'); }
    settingsBtn.addEventListener('click', openSettingsModal);
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
    modalOverlay.addEventListener('click', closeSettingsModal);

    // NEW: Save API Key Logic
    saveApiKeyBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
                apiKeyFeedback.textContent = 'API Key saved successfully!';
                setTimeout(() => { apiKeyFeedback.textContent = ''; }, 3000);
            });
        } else {
            // If the user clears the input and saves, remove it from storage
            chrome.storage.local.remove('geminiApiKey', () => {
                 apiKeyFeedback.textContent = 'API Key removed.';
                 setTimeout(() => { apiKeyFeedback.textContent = ''; }, 3000);
            });
        }
    });


    function appendSystemMessage(text) {
        const systemMessageDiv = document.createElement('div');
        systemMessageDiv.classList.add('system-message');
        systemMessageDiv.textContent = text;
        chatHistoryEl.appendChild(systemMessageDiv);
        chatHistoryEl.parentElement.scrollTop = chatHistoryEl.parentElement.scrollHeight;
        updateConversationStartersVisibility();
    }

    internetToggleBtn.addEventListener('click', () => {
        isInternetSearchEnabled = !isInternetSearchEnabled;
        internetToggleBtn.classList.toggle('active', isInternetSearchEnabled);
        if (isInternetSearchEnabled) {
            internetToggleBtn.title = "Disable general knowledge.";
            chatInput.placeholder = "Ask anything (uses general knowledge)...";
            appendSystemMessage('General knowledge access enabled.');
        } else {
            internetToggleBtn.title = "Enable general knowledge.";
            chatInput.placeholder = "Ask a question about the page...";
            appendSystemMessage('Chat switched to article context only.');
        }
    });

    function populateVoiceList() {
        availableVoices = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en-'));
        const currentVoiceURI = voiceSelect.value;
        voiceSelect.innerHTML = '';
        if (availableVoices.length === 0) {
            voiceSelect.innerHTML = '<option>No English voices found</option>';
            return;
        }
        availableVoices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.value = voice.voiceURI;
            voiceSelect.appendChild(option);
        });
        if (currentVoiceURI) voiceSelect.value = currentVoiceURI;
    }
    window.speechSynthesis.onvoiceschanged = populateVoiceList;

    speedSlider.addEventListener('input', () => {
        const speed = parseFloat(speedSlider.value).toFixed(1);
        speedValueEl.textContent = `${speed}x`;
        chrome.storage.local.set({ speechSpeed: speed });
    });
    voiceSelect.addEventListener('change', () => {
        chrome.storage.local.set({ speechVoiceURI: voiceSelect.value });
    });

    function stopReading() {
        speechQueue = []; currentSpeechIndex = 0; window.speechSynthesis.cancel(); resetReadingState();
    }
    function resetReadingState() {
        isReading = false; readAloudBtn.classList.remove('reading');
    }
    function playNextChunk() {
        if (currentSpeechIndex >= speechQueue.length) { resetReadingState(); return; }
        const chunk = speechQueue[currentSpeechIndex];
        const utterance = new SpeechSynthesisUtterance(chunk);
        chrome.storage.local.get(['speechVoiceURI', 'speechSpeed'], (settings) => {
            const voiceURI = settings.speechVoiceURI, speed = settings.speechSpeed || 1;
            if (voiceURI) { const selectedVoice = availableVoices.find(v => v.voiceURI === voiceURI); if (selectedVoice) utterance.voice = selectedVoice; }
            utterance.rate = speed;
            utterance.onend = () => { currentSpeechIndex++; playNextChunk(); };
            utterance.onerror = (e) => { resetReadingState(); };
            window.speechSynthesis.speak(utterance);
        });
    }

    readAloudBtn.addEventListener('click', () => {
        if (isReading || window.speechSynthesis.speaking) {
            stopReading();
        } else if (summaryPlainText) {
            const regex = /[^.!?]+[.!?]+/g;
            speechQueue = (summaryPlainText.match(regex) || [summaryPlainText]).filter(chunk => chunk.trim().length > 0);
            currentSpeechIndex = 0;
            if (speechQueue.length > 0) { isReading = true; readAloudBtn.classList.add('reading'); playNextChunk(); }
        }
    });

    function switchMode(mode) {
        const isSummary = mode === 'summary';
        const isChat = mode === 'chat';
        const isFactCheck = mode === 'fact-check';

        summaryModeBtn.classList.toggle('active', isSummary);
        chatModeBtn.classList.toggle('active', isChat);
        factCheckModeBtn.classList.toggle('active', isFactCheck);

        summaryContent.classList.toggle('active', isSummary);
        chatContent.classList.toggle('active', isChat);
        factCheckContent.classList.toggle('active', isFactCheck);

        summaryFooter.classList.toggle('active', isSummary);
        chatFooter.classList.toggle('active', isChat);
        factCheckFooter.classList.toggle('active', isFactCheck);

        if (isFactCheck && !factCheckReportContent && !isFactCheckRunning) {
            isFactCheckRunning = true;
            factCheckContainer.className = 'loading';
            chrome.runtime.sendMessage({ action: 'factCheckArticle' });
        }
    }
    summaryModeBtn.addEventListener('click', () => switchMode('summary'));
    chatModeBtn.addEventListener('click', () => switchMode('chat'));
    factCheckModeBtn.addEventListener('click', () => switchMode('fact-check'));

    function handleChatSubmit(userInput) {
        if (!userInput) return;
        conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
        appendMessage('user', userInput);
        chatInput.value = '';
        chatSendBtn.disabled = true;
        showTypingIndicator(true);
        chrome.runtime.sendMessage({
            action: 'chatWithPage',
            history: conversationHistory,
            internetAccess: isInternetSearchEnabled
        });
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleChatSubmit(chatInput.value.trim());
    });

    starterBtns.forEach(button => {
        button.addEventListener('click', () => handleChatSubmit(button.textContent));
    });

    deepSearchBtn.addEventListener('click', async () => {
        deepSearchBtn.disabled = true;
        const { currentArticle } = await chrome.storage.session.get('currentArticle');
        if (!currentArticle || !currentArticle.url) {
            deepSearchFeedbackEl.textContent = 'Article content/URL not found.';
            deepSearchFeedbackEl.style.display = 'block';
            deepSearchBtn.disabled = false;
            return;
        }

        const fullPrompt = getGeneralFactCheckPrompt(currentArticle.title, currentArticle.content, currentArticle.url);
        
        try {
            await navigator.clipboard.writeText(fullPrompt);
            deepSearchFeedbackEl.textContent = 'Copied! Paste into the new tab.';
            deepSearchFeedbackEl.style.display = 'block';
            chrome.tabs.create({ url: config.GEMINI_WEB_URL });
        } catch (err) {
            console.error('Failed to copy text: ', err);
            deepSearchFeedbackEl.textContent = 'Error: Could not copy.';
            deepSearchFeedbackEl.style.display = 'block';
        } finally {
            setTimeout(() => {
                deepSearchFeedbackEl.style.display = 'none';
                deepSearchBtn.disabled = false;
            }, 3000);
        }
    });

    function appendMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        if (role === 'assistant') {
            messageDiv.innerHTML = marked.parse(text);
        } else {
            messageDiv.textContent = text;
        }
        chatHistoryEl.appendChild(messageDiv);
        chatHistoryEl.parentElement.scrollTop = chatHistoryEl.parentElement.scrollHeight;
        updateConversationStartersVisibility();
    }

    function showTypingIndicator(show) { typingIndicator.style.display = show ? 'inline-flex' : 'none'; if (show) chatHistoryEl.parentElement.scrollTop = chatHistoryEl.parentElement.scrollHeight; }
    chatInput.addEventListener('input', () => { chatSendBtn.disabled = chatInput.value.trim().length === 0; });

    function setSummaryState(state, data = {}) {
        contentContainer.className = state;
        switch (state) {
            case 'summary':
                summaryTextContent = data.summary;
                const parsedHtml = marked.parse(data.summary);
                summaryTextEl.innerHTML = parsedHtml;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = parsedHtml;
                summaryPlainText = tempDiv.textContent || tempDiv.innerText || '';
                copyButton.disabled = false;
                break;
            case 'error':
                errorTitleEl.textContent = data.title || 'Oops!';
                errorMessageEl.textContent = data.message;
                copyButton.disabled = true;
                summaryTextContent = '';
                summaryPlainText = '';
                break;
            case 'loading':
            case 'welcome':
                copyButton.disabled = true;
                summaryTextContent = '';
                summaryPlainText = '';
                break;
        }
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'displaySummary':
                stopReading();
                setSummaryState('summary', { summary: request.summary });
                chatModeBtn.disabled = false;
                factCheckModeBtn.disabled = false;
                readAloudBtn.disabled = false;
                // Reset other states
                conversationHistory = [];
                chatHistoryEl.innerHTML = '';
                updateConversationStartersVisibility();
                isInternetSearchEnabled = false;
                internetToggleBtn.classList.remove('active');
                internetToggleBtn.title = "Enable internet access (general knowledge)";
                chatInput.placeholder = "Ask a question about the page...";
                factCheckReportContent = '';
                isFactCheckRunning = false;
                factCheckContainer.className = 'welcome';
                break;
            case 'displayError':
                stopReading();
                setSummaryState('error', { title: request.title, message: request.message });
                chatModeBtn.disabled = true;
                factCheckModeBtn.disabled = true;
                readAloudBtn.disabled = true;
                break;
            case 'showLoading':
                stopReading();
                setSummaryState('loading');
                switchMode('summary');
                chatModeBtn.disabled = true;
                factCheckModeBtn.disabled = true;
                readAloudBtn.disabled = true;
                sendResponse({ received: true }); 
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
            case 'displayFactCheckReport':
                isFactCheckRunning = false;
                factCheckReportContent = request.report;
                factCheckReportTextEl.innerHTML = marked.parse(request.report);
                factCheckContainer.className = 'summary'; // Re-use summary view styles
                break;
            case 'displayFactCheckError':
                isFactCheckRunning = false;
                factCheckErrorTitleEl.textContent = "Fact-Check Failed";
                factCheckErrorMessageEl.textContent = request.message;
                factCheckContainer.className = 'error';
                break;
        }
    });

    function applyTextSize(index) {
        const setting = FONT_SETTINGS[index];
        summaryTextEl.style.fontSize = setting.size;
        chatHistoryEl.style.fontSize = setting.size;
        factCheckReportTextEl.style.fontSize = setting.size; // Apply to fact-check report too
        textSizeValueEl.textContent = setting.name;
        currentFontIndex = index;
        decreaseTextBtn.disabled = (index === 0);
        increaseTextBtn.disabled = (index === FONT_SETTINGS.length - 1);
    }

    increaseTextBtn.addEventListener('click', () => {
        if (currentFontIndex < FONT_SETTINGS.length - 1) {
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

    function initialize() {
        chrome.storage.local.get(['textSizeIndex', 'speechSpeed', 'speechVoiceURI', 'theme'], (settings) => {
            applyAndStoreTheme(settings.theme || 'system');
            const savedIndex = settings.textSizeIndex;
            applyTextSize(typeof savedIndex === 'number' ? savedIndex : DEFAULT_FONT_INDEX);
            const speed = settings.speechSpeed || 1;
            speedSlider.value = speed;
            speedValueEl.textContent = `${parseFloat(speed).toFixed(1)}x`;
            populateVoiceList();
            if (settings.speechVoiceURI) {
                setTimeout(() => { voiceSelect.value = settings.speechVoiceURI; }, 100);
            }
        });
        setSummaryState('welcome');
        factCheckContainer.className = 'welcome';
        chatSendBtn.disabled = true;
        readAloudBtn.disabled = true;
        chatModeBtn.disabled = true;
        factCheckModeBtn.disabled = true;
        updateConversationStartersVisibility();
    }

    initialize();
});
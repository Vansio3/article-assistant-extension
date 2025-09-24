// sidepanel.js

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL STATE & ELEMENTS ---
    let conversationHistory = [];
    let summaryTextContent = '';
    let summaryPlainText = '';
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
    const starterBtns = document.querySelectorAll('.starter-btn');
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
    const factCheckOnGeminiBtn = document.getElementById('fact-check-on-gemini-btn');
    const factCheckFeedbackEl = document.getElementById('fact-check-feedback');


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

    function openSettingsModal() { settingsModal.classList.add('visible'); }
    function closeSettingsModal() { settingsModal.classList.remove('visible'); }
    settingsBtn.addEventListener('click', openSettingsModal);
    closeSettingsBtn.addEventListener('click', closeSettingsModal);
    modalOverlay.addEventListener('click', closeSettingsModal);

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
            utterance.onerror = (e) => { console.error('SpeechSynthesis.onerror', e); resetReadingState(); };
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

    factCheckOnGeminiBtn.addEventListener('click', async () => {
        const { currentArticle } = await chrome.storage.session.get('currentArticle');
        if (!currentArticle) {
            factCheckFeedbackEl.textContent = 'Article content not found. Please summarize a page first.';
            factCheckFeedbackEl.style.display = 'block';
            return;
        }

        // --- UPDATED PROMPT ---
        // This new prompt explicitly instructs the model to use its live search tool.
        const fullPrompt = `
**TASK: REAL-TIME FACT-CHECK**

**Persona:** You are a meticulous, impartial fact-checker equipped with real-time internet access.

**Core Directive:** Your primary task is to **actively search the web** to find multiple high-quality, independent sources (e.g., major news outlets, scientific journals, reputable reports) to verify the factual claims made in the article provided below.

**Constraint:** You **must not** rely solely on your pre-existing knowledge. The goal is to verify the article against **current** information available online.

**Instructions for the Report:**
1.  **Overall Assessment:** Start with a brief, one-sentence summary of your findings (e.g., "The article's main claims are well-supported by recent reporting from reputable sources.").
2.  **Key Claims Analysis:** Create a bulleted list for each major factual claim. For each claim, provide:
    *   A verdict (e.g., "Accurate," "Inaccurate," "Lacks Context," "Unverifiable").
    *   A brief explanation for your verdict, referencing the information you found online.
3.  **Sources Found:** At the very end of your report, create a "### Sources Found" section and list the full URLs of the top 3-5 sources you consulted during your live search. This is mandatory.

--- START OF ARTICLE TO FACT-CHECK ---

**TITLE:** ${currentArticle.title}

**CONTENT:** ${currentArticle.content}

--- END OF ARTICLE ---
`;
        try {
            await navigator.clipboard.writeText(fullPrompt);
            factCheckOnGeminiBtn.textContent = 'Copied to Clipboard!';
            factCheckFeedbackEl.textContent = 'Just paste (Ctrl+V) into the new tab.';
            factCheckFeedbackEl.style.display = 'block';
            chrome.tabs.create({ url: "https://aistudio.google.com/prompts/new_chat?model=gemini-2.5-pro" });
            setTimeout(() => {
                factCheckOnGeminiBtn.textContent = 'Prepare Fact-Check & Open Gemini';
                factCheckFeedbackEl.style.display = 'none';
            }, 4000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            factCheckFeedbackEl.textContent = 'Error: Could not copy prompt to clipboard.';
            factCheckFeedbackEl.style.display = 'block';
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

    function setState(state, data = {}) {
        contentContainer.className = state;
        switch (state) {
            case 'summary':
                summaryTextContent = data.summary;
                summaryTextEl.innerHTML = marked.parse(data.summary);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = marked.parse(data.summary);
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
                setState('summary', { summary: request.summary });
                chatModeBtn.disabled = false;
                factCheckModeBtn.disabled = false;
                readAloudBtn.disabled = false;
                conversationHistory = [];
                chatHistoryEl.innerHTML = '';
                updateConversationStartersVisibility();
                isInternetSearchEnabled = false;
                internetToggleBtn.classList.remove('active');
                internetToggleBtn.title = "Enable internet access (general knowledge)";
                chatInput.placeholder = "Ask a question about the page...";
                break;
            case 'displayError':
                stopReading();
                setState('error', { title: request.title, message: request.message });
                chatModeBtn.disabled = true;
                factCheckModeBtn.disabled = true;
                readAloudBtn.disabled = true;
                break;
            case 'showLoading':
                stopReading();
                setState('loading');
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
        }
    });

    function applyTextSize(index) {
        const setting = FONT_SETTINGS[index];
        summaryTextEl.style.fontSize = setting.size;
        chatHistoryEl.style.fontSize = setting.size;
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
        setState('welcome');
        chatSendBtn.disabled = true;
        readAloudBtn.disabled = true;
        chatModeBtn.disabled = true;
        factCheckModeBtn.disabled = true;
        updateConversationStartersVisibility();
    }

    initialize();
});
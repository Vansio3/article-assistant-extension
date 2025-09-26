// background.js
import { config } from './config.js';
import { getSummarizePrompt, getChatSystemPrompt, getHybridChatSystemPrompt, getGeneralFactCheckPrompt } from './prompts.js';

let popupWindowId = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log("Background: Extension installed.");
});

chrome.windows.onRemoved.addListener((windowId) => {
    if (windowId === popupWindowId) {
        console.log("Background: Popup window closed.");
        popupWindowId = null;
    }
});

// Sends a message to the side panel, retrying if the panel is not yet ready.
function showLoadingScreen() {
  let retries = 0;
  const maxRetries = 10;
  const attempt = () => {
    if (retries >= maxRetries) {
      console.error("Could not connect to side panel to show loading screen.");
      return;
    }
    chrome.runtime.sendMessage({ action: "showLoading" }, (response) => {
      if (chrome.runtime.lastError) {
        retries++;
        setTimeout(attempt, 100); // Retry after 100ms
      }
    });
  };
  attempt();
}

// NEW: Helper function to determine which content script to use
function getContentScriptForUrl(url) {
  if (url.includes('youtube.com/watch')) {
    return {
      files: ['content_youtube.js'],
      reason: 'YouTube'
    };
  }
  if (url.endsWith('.pdf')) {
    return {
      files: ['content_pdf.js'], // pdf.js is imported inside the script
      reason: 'PDF'
    };
  }
  // Default for standard web articles
  return {
    files: ['lib/Readability.js', 'content.js'],
    reason: 'Article'
  };
}

function startSummarization(tab) {
  // Clear any previous article from session storage to start fresh.
  chrome.storage.session.set({ currentArticle: null });
  console.log(`Background: Starting summarization for tab ${tab.id}.`);

  const createOrFocusWindow = () => {
    if (popupWindowId !== null) {
      chrome.windows.get(popupWindowId, (existingWindow) => {
        if (chrome.runtime.lastError) {
          // Window was closed unexpectedly.
          createPopupWindow();
        } else {
          // Window exists, just focus it.
          chrome.windows.update(popupWindowId, { focused: true });
          showLoadingScreen();
        }
      });
    } else {
      createPopupWindow();
    }
  };

  const createPopupWindow = () => {
    chrome.windows.create({
      url: 'popup.html',
      type: 'popup',
      width: 600,
      height: 700
    }).then((newWindow) => {
      popupWindowId = newWindow.id;
      // showLoadingScreen needs to wait for the window to be ready.
      // A small timeout helps, or more robustly, a message from popup.js on load.
      setTimeout(showLoadingScreen, 200);
    });
  };

  createOrFocusWindow();

  // --- MODIFIED SCRIPT INJECTION LOGIC ---
  const scriptConfig = getContentScriptForUrl(tab.url);
  console.log(`Background: Detected content type: ${scriptConfig.reason}. Injecting scripts:`, scriptConfig.files);

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: scriptConfig.files
  }, () => {
    if (chrome.runtime.lastError) {
      // This error is expected if the user closes the tab before injection is complete.
      // We check for the message and ignore it to avoid cluttering the console.
      if (chrome.runtime.lastError.message.includes("Frame with ID 0 was removed") ||
          chrome.runtime.lastError.message.includes("No tab with id")) {
        console.log("Background: Script injection cancelled because target tab was closed.");
      } else {
        // For any other injection errors, we should show an error to the user.
        console.error("Background: Error injecting script:", chrome.runtime.lastError.message);
        chrome.runtime.sendMessage({
            action: "displayError",
            title: "Injection Failed",
            message: "Could not access page content. Please try reloading the page."
        });
      }
    }
  });
}

chrome.action.onClicked.addListener(startSummarization);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    // Store the article in session storage so it persists.
    chrome.storage.session.set({ currentArticle: request.article }, () => {
        summarizeWithGemini(request.article);
    });
    return true; // Indicates async response for the API call.
  } else if (request.action === "chatWithPage") {
    // The chat function will now get the article from storage itself.
    chatWithGemini(request.history, request.internetAccess);
    return true; // Indicates async response.
  } else if (request.action === "factCheckArticle") {
    factCheckWithGemini();
    return true;
  }
});

async function summarizeWithGemini(article) {
  // MODIFIED: Retrieve API key from storage
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // MODIFIED: Check if the key exists in storage
  if (!apiKey) {
     chrome.runtime.sendMessage({ action: "displayError", title: "Configuration Error", message: "API key not set. Please add it in the settings." });
     return;
  }

  try {
    const prompt = getSummarizePrompt(article.title, article.content);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] })
    });
    const data = await response.json();
    if (!response.ok || !data.candidates) {
        throw new Error(data?.error?.message || "Invalid API response.");
    }
    const summary = data.candidates[0].content.parts[0].text;
    chrome.runtime.sendMessage({ action: "displaySummary", summary: summary });
  } catch (error) {
    console.error("Background: Summarize API failed.", error);
    chrome.runtime.sendMessage({ action: "displayError", title: "API Error", message: error.message });
  }
}

async function chatWithGemini(history, internetAccessEnabled) {
  // MODIFIED: Retrieve API key from storage
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;

  // MODIFIED: Check if the key exists in storage
  if (!apiKey) {
    chrome.runtime.sendMessage({ action: "displayChatError", message: "API key not set. Please add it in the settings." });
    return;
  }
  
  // Retrieve the article from session storage at the time of the request.
  const data = await chrome.storage.session.get('currentArticle');
  const article = data.currentArticle;

  // Robustly check if the article context exists.
  if (!article) {
    chrome.runtime.sendMessage({ action: "displayChatError", message: "Article context not found. Please summarize a page first." });
    return;
  }
  
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  let systemPrompt;
  let initialModelResponse;

  if (internetAccessEnabled) {
    systemPrompt = getHybridChatSystemPrompt(article.title, article.content);
    // Updated to reflect real-time search capabilities
    initialModelResponse = "Okay, I have read the article. I can now answer questions about it or use real-time Google Search to find current information. How can I help you?";
  } else {
    systemPrompt = getChatSystemPrompt(article.title, article.content);
    initialModelResponse = "Okay, I have read the article. I will only use the provided text to answer and format my responses in Markdown. What would you like to know?";
  }

  const contents = [
    { "role": "user", "parts": [{ "text": systemPrompt }] },
    { "role": "model", "parts": [{ "text": initialModelResponse }] },
    ...history
  ];

  // Prepare the main request body
  const requestBody = { contents };

  // If internet access is enabled, add the grounding tool to the request
  if (internetAccessEnabled) {
    requestBody.tools = [{
      "googleSearch": {}
    }];
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody) // Use the updated request body
    });
    const data = await response.json();
    if (!response.ok || !data.candidates) {
        throw new Error(data?.error?.message || "Invalid API response.");
    }
    const chatResponse = data.candidates[0].content.parts[0].text;
    chrome.runtime.sendMessage({ action: "displayChatResponse", message: chatResponse });
  } catch (error) {
    console.error("Background: Chat API failed.", error);
    chrome.runtime.sendMessage({ action: "displayChatError", message: error.message });
  }
}

async function factCheckWithGemini() {
  // MODIFIED: Retrieve API key from storage
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;

  // MODIFIED: Check if the key exists in storage
  if (!apiKey) {
    chrome.runtime.sendMessage({ action: "displayFactCheckError", message: "API key not set. Please add it in the settings." });
    return;
  }

  const { currentArticle } = await chrome.storage.session.get('currentArticle');
  if (!currentArticle) {
    chrome.runtime.sendMessage({ action: "displayFactCheckError", message: "Article content not found." });
    return;
  }

  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const prompt = getGeneralFactCheckPrompt(currentArticle.title, currentArticle.content, currentArticle.url);
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ "googleSearch": {} }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok || !data.candidates) {
        throw new Error(data?.error?.message || "Invalid API response.");
    }
    
    const report = data.candidates[0].content.parts[0].text;
    chrome.runtime.sendMessage({ action: "displayFactCheckReport", report: report });

  } catch (error) {
    console.error("Background: Fact-check API failed.", error);
    chrome.runtime.sendMessage({ action: "displayFactCheckError", message: error.message });
  }
}
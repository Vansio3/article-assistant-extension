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

// MODIFIED: This function is now async to handle the API key check
async function startSummarization(tab) {
  // Clear any previous article from session storage to start fresh.
  chrome.storage.session.set({ currentArticle: null });
  console.log(`Background: Starting process for tab ${tab.id}.`);

  const createOrFocusWindow = () => {
    if (popupWindowId !== null) {
      chrome.windows.get(popupWindowId, (existingWindow) => {
        if (chrome.runtime.lastError) {
          createPopupWindow();
        } else {
          chrome.windows.update(popupWindowId, { focused: true });
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
    });
  };

  createOrFocusWindow();

  // --- NEW: API Key Check at the Start ---
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  if (!geminiApiKey) {
    console.log("Background: Gemini API key not found.");
    // Wait a moment for the popup window to be ready, then send the message.
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "apiKeyRequired" });
    }, 250);
    return; // Stop the function here
  }

  // If key exists, proceed with summarization.
  console.log(`Background: Starting summarization for tab ${tab.id}.`);
  showLoadingScreen(); // Show loading screen only if key exists

  const scriptConfig = getContentScriptForUrl(tab.url);
  console.log(`Background: Detected content type: ${scriptConfig.reason}. Injecting scripts:`, scriptConfig.files);

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: scriptConfig.files
  }, () => {
    if (chrome.runtime.lastError) {
      if (chrome.runtime.lastError.message.includes("Frame with ID 0 was removed") ||
          chrome.runtime.lastError.message.includes("No tab with id")) {
        console.log("Background: Script injection cancelled because target tab was closed.");
      } else {
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
    chrome.storage.session.set({ currentArticle: request.article }, () => {
        summarizeWithGemini(request.article);
    });
    return true;
  } else if (request.action === "chatWithPage") {
    chatWithGemini(request.history, request.internetAccess);
    return true;
  } else if (request.action === "factCheckArticle") {
    factCheckWithGemini();
    return true;
  }
});

async function summarizeWithGemini(article) {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;

  if (!apiKey) {
    chrome.runtime.sendMessage({ action: "displayChatError", message: "API key not set. Please add it in the settings." });
    return;
  }
  
  const data = await chrome.storage.session.get('currentArticle');
  const article = data.currentArticle;

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

  const requestBody = { contents };

  if (internetAccessEnabled) {
    requestBody.tools = [{
      "googleSearch": {}
    }];
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
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
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;

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
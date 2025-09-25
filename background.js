// background.js
import { config } from './config.js';
import { getSummarizePrompt, getChatSystemPrompt, getHybridChatSystemPrompt, getClaimExtractionPrompt } from './prompts.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log("Background: Extension installed.");
  chrome.contextMenus.create({
    id: "summarize-article",
    title: "Parse with Article Assistant",
    contexts: ["page"]
  });
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

function startSummarization(tab) {
  // Clear any previous article from session storage to start fresh.
  chrome.storage.session.set({ currentArticle: null });
  console.log(`Background: Starting summarization for tab ${tab.id}.`);

  chrome.sidePanel.open({ tabId: tab.id });
  showLoadingScreen();

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["lib/Readability.js", "content.js"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Background: Error injecting script:", chrome.runtime.lastError.message);
      chrome.runtime.sendMessage({
          action: "displayError",
          title: "Injection Failed",
          message: "Could not access page content. Please try reloading the page."
      });
    }
  });
}

chrome.action.onClicked.addListener(startSummarization);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "summarize-article") {
    startSummarization(tab);
  }
});

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
  } else if (request.action === "extractClaims") {
    extractClaimsWithGemini();
    return true;
  }
});

async function summarizeWithGemini(article) {
  const apiKey = config.GEMINI_API_KEY;
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  if (apiKey === "YOUR_GEMINI_API_KEY" || !apiKey) {
     chrome.runtime.sendMessage({ action: "displayError", title: "Configuration Error", message: "API key not set in config.js." });
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
  // Retrieve the article from session storage at the time of the request.
  const data = await chrome.storage.session.get('currentArticle');
  const article = data.currentArticle;

  // Robustly check if the article context exists.
  if (!article) {
    chrome.runtime.sendMessage({ action: "displayChatError", message: "Article context not found. Please summarize a page first." });
    return;
  }
  
  const apiKey = config.GEMINI_API_KEY;
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

async function extractClaimsWithGemini() {
  const { currentArticle } = await chrome.storage.session.get('currentArticle');
  if (!currentArticle) {
    chrome.runtime.sendMessage({ action: "displayClaimsError", message: "Article content not found." });
    return;
  }

  const apiKey = config.GEMINI_API_KEY;
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const prompt = getClaimExtractionPrompt(currentArticle.content);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] })
    });

    const data = await response.json();
    if (!response.ok || !data.candidates) {
        throw new Error(data?.error?.message || "Invalid API response.");
    }

    const responseText = data.candidates[0].content.parts[0].text;
    
    // Robustly parse the JSON from the response
    const startIndex = responseText.indexOf('[');
    const endIndex = responseText.lastIndexOf(']');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("AI response did not contain a valid JSON array.");
    }
    const jsonString = responseText.substring(startIndex, endIndex + 1);
    const claims = JSON.parse(jsonString);

    chrome.runtime.sendMessage({ action: "displayClaims", claims: claims });

  } catch (error) {
    console.error("Background: Claim extraction failed.", error);
    chrome.runtime.sendMessage({ action: "displayClaimsError", message: error.message });
  }
}
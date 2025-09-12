// background.js
import { config } from './config.js';

// Global variable to hold the context of the currently summarized article
let currentArticleContext = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log("Background: Extension installed.");
  chrome.contextMenus.create({
    id: "summarize-article",
    title: "Parse with Article Assistant",
    contexts: ["page"]
  });
});

function startSummarization(tab) {
  currentArticleContext = null; // Reset context on new summarization request
  console.log(`Background: Starting summarization for tab ${tab.id}.`);

  chrome.sidePanel.open({ tabId: tab.id }).then(() => {
    chrome.runtime.sendMessage({ action: "showLoading" }).catch(() => {});
  });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["Readability.js", "content.js"]
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
    currentArticleContext = request.article;
    summarizeWithGemini(request.article);
    return true; // Indicates async response
  } else if (request.action === "chatWithPage") {
    if (!currentArticleContext) {
      chrome.runtime.sendMessage({ action: "displayChatError", message: "Article context not found. Please summarize a page first." });
      return;
    }
    chatWithGemini(request.history, currentArticleContext);
    return true; // Indicates async response
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "contents": [{ "parts": [{ "text": `Provide a concise, easy-to-read summary of the following article in a few paragraphs:\n\nTitle: ${article.title}\n\n${article.content}` }] }] })
    });
    const data = await response.json();
    if (!response.ok || !data.candidates) {
        throw new Error(data?.error?.message || "Invalid API response.");
    }
    const summary = data.candidates[0].content.parts[0].text;
    chrome.runtime.sendMessage({ action: "displaySummary", title: article.title, summary: summary });
  } catch (error) {
    console.error("Background: Summarize API failed.", error);
    chrome.runtime.sendMessage({ action: "displayError", title: "API Error", message: error.message });
  }
}

async function chatWithGemini(history, article) {
  const apiKey = config.GEMINI_API_KEY;
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const contents = [
    { "role": "user", "parts": [{ "text": `You are a helpful assistant. I will provide you with an article, and you will answer my questions based *only* on the information within that article. Do not use external knowledge. Here is the article:\n\n---\n\nTITLE: ${article.title}\n\nCONTENT: ${article.content}\n\n---` }] },
    { "role": "model", "parts": [{ "text": "Okay, I have read the article. I will only use the provided text to answer. What would you like to know?" }] },
    ...history
  ];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
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
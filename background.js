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
        setTimeout(attempt, 100);
      }
    });
  };
  attempt();
}

function injectContentScripts(tab) {
    showLoadingScreen(); 

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

function getContentScriptForUrl(url) {
  if (url.includes('youtube.com/watch')) {
    return {
      files: ['content_youtube.js'],
      reason: 'YouTube'
    };
  }
  if (url.endsWith('.pdf')) {
    return {
      files: ['content_pdf.js'],
      reason: 'PDF'
    };
  }
  return {
    files: ['lib/Readability.js', 'content.js'],
    reason: 'Article'
  };
}

async function startSummarization(tab) {
  await chrome.storage.session.set({ activeUserTab: tab });

  chrome.storage.session.set({ currentArticle: null });
  console.log(`Background: Starting process for tab ${tab.id}.`);

  const createOrFocusWindow = async () => {
    const popupUrl = chrome.runtime.getURL('popup.html');
    
    const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
    const existingPopup = windows.find(w => w.tabs && w.tabs[0]?.url === popupUrl);

    if (existingPopup) {
        console.log(`Background: Found existing popup window with ID: ${existingPopup.id}. Focusing.`);
        popupWindowId = existingPopup.id;
        await chrome.windows.update(existingPopup.id, { focused: true });
    } else {
        console.log("Background: No active popup found. Creating a new window.");
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

  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');

  chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => window.getSelection().toString().trim(),
  }, async (injectionResults) => {
    let selectedText = '';
    if (injectionResults) {
        const resultWithText = injectionResults.find(frameResult => frameResult.result);
        if (resultWithText) {
            selectedText = resultWithText.result;
        }
    }

    if (!geminiApiKey) {
        console.log("Background: Gemini API key not found.");
        setTimeout(() => chrome.runtime.sendMessage({ action: "apiKeyRequired" }), 250);
        return;
    }

    if (selectedText) {
      console.log("Background: Detected selected text in a frame.");
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "showSelectionPrompt",
          article: {
            title: `Selection from: ${tab.title}`,
            content: selectedText,
            url: tab.url
          }
        });
      }, 250);
    } else {
      console.log("Background: No text selected in any frame. Proceeding with full page summarization.");
      injectContentScripts(tab);
    }
  });
}

chrome.action.onClicked.addListener(startSummarization);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarize") {
    chrome.storage.session.set({ currentArticle: request.article }, () => {
        summarizeWithGemini(request.article);
    });
  } else if (request.action === "summarizeFullPage") {
    console.log("Background: User chose to summarize the full page.");
    chrome.storage.session.get('activeUserTab', (result) => {
        const targetTab = result.activeUserTab;
        if (targetTab && targetTab.id) {
            injectContentScripts(targetTab);
        } else {
            console.error("Background: Could not find the target tab from session storage.");
             chrome.runtime.sendMessage({
                action: "displayError",
                title: "Tab Not Found",
                message: "Could not identify the correct page. Please close the popup and try again."
            });
        }
    });
  } else if (request.action === "chatWithPage") {
    chatWithGemini(request.history, request.internetAccess);
  } else if (request.action === "factCheckArticle") {
    factCheckWithGemini();
  }
});

async function summarizeWithGemini(article) {
  const { geminiApiKey } = await chrome.storage.local.get('geminiApiKey');
  const apiKey = geminiApiKey;
  const modelName = config.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  if (!apiKey) {
     chrome.runtime.sendMessage({ action: "displayError", title: "Configuration Error", message: "API key not set. Please add it in the settings." });
     return;
  }

  try {
    const prompt = getSummarizePrompt(article.title, article.content);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey 
      },
      body: JSON.stringify({ "contents": [{ "parts": [{ "text": prompt }] }] })
    });
    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || "An unknown API error occurred.");
    }
    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error("The summary was blocked due to safety settings. The content may be sensitive.");
        }
        throw new Error("Could not parse a valid summary from the API response.");
    }
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  
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
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey 
      },
      body: JSON.stringify(requestBody)
    });
    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || "An unknown API error occurred.");
    }
    
    const responsePart = data?.candidates?.[0]?.content?.parts?.find(p => p.text);
    const chatResponse = responsePart?.text;

    if (!chatResponse) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error("The response was blocked due to safety settings.");
        }
        const hasToolCall = data?.candidates?.[0]?.content?.parts?.some(p => p.googleSearch);
        if (hasToolCall) {
            throw new Error("The model used a tool but did not provide a text response.");
        }
        throw new Error("Could not parse a valid chat response from the API.");
    }
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

  const modelName = config.GEMINI_FACT_CHECK_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  try {
    const prompt = getGeneralFactCheckPrompt(currentArticle.title, currentArticle.content, currentArticle.url);
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ "googleSearch": {} }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || "An unknown API error occurred.");
    }
    
    const report = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!report) {
        const finishReason = data?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error("The report was blocked due to safety settings. The content may be sensitive.");
        }
        throw new Error("Could not parse a valid fact-check report from the API response.");
    }    
    chrome.runtime.sendMessage({ action: "displayFactCheckReport", report: report });

  } catch (error) {
    console.error("Background: Fact-check API failed.", error);
    chrome.runtime.sendMessage({ action: "displayFactCheckError", message: error.message });
  }
}
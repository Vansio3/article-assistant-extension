# Article Assistant Chrome Extension

Article Assistant is a powerful browser extension that uses the Google Gemini API to help you quickly understand and interact with web content. It can summarize articles, local PDFs, and YouTube video transcripts, allowing you to chat with the content and perform real-time fact-checks.

## Features

- **One-Click Summaries**: Generate concise, easy-to-read summaries of any web article.
- **YouTube Transcript Support**: Summarize educational videos, tutorials, or talks by automatically extracting the video's transcript.
- **PDF File Reading**: Open a local or web-based PDF in your browser and get a summary of its content.
- **Interactive Chat**: Ask questions directly about the content of the page, with the option to enable general knowledge for broader queries.
- **Real-Time Fact-Checking**: Analyze the article's main claims against independent sources on the internet.
- **Customizable Experience**: Includes adjustable text size, multiple themes (Light, Dark, Amber), and voice selection for the read-aloud feature.

---

## Setup & Installation

To run this extension locally, follow these steps.

### 1. Prerequisites

-   Google Chrome or a Chromium-based browser (e.g., Brave, Edge).

### 2. Get a Gemini API Key

This extension requires a Google Gemini API key to function.

1.  Visit **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2.  Click "**Create API key**" to get your free key.
3.  Copy the key to your clipboard. You will need it in a later step.

### 3. Load the Extension in Chrome

1.  Download or clone this repository to your local machine.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable "**Developer mode**" using the toggle switch in the top-right corner.
4.  Click the "**Load unpacked**" button.
5.  Select the folder where you saved the extension files. The "Article Assistant" should now appear in your list of extensions.

### 4. Configure the API Key

1.  Pin the Article Assistant extension to your toolbar for easy access.
2.  Click the extension icon. A welcome screen will appear.
3.  Click the **settings icon (⚙️)** in the bottom-right corner of the popup.
4.  Paste your Gemini API key into the input field and click "**Save**".
5.  The extension is now ready to use!

---

## How to Use

1.  **Summarize**: Navigate to a supported web page, PDF, or YouTube video. Click the Article Assistant icon (or press `Alt+S`) to generate a summary.
2.  **Chat**: Once a summary is generated, click the "Chat" tab to ask specific questions about the article's content.
3.  **Fact Check**: Click the "Fact Check" tab to initiate a real-time analysis of the article's claims.

## File Structure

-   `manifest.json`: Defines the extension's permissions, scripts, and core properties.
-   `background.js`: The service worker that handles API requests, script injection, and core logic.
-   `popup.html` / `popup.js` / `popup.css`: The UI and functionality for the extension's popup window.
-   `content.js`: Injected into standard web pages to extract article text using the `Readability.js` library.
-   `content_youtube.js`: Injected into YouTube pages to find and extract the video transcript.
-   `content_pdf.js`: Injected into the PDF viewer to extract text using `pdf.js`.
-   `prompts.js`: Contains the structured prompt templates sent to the Gemini API for various tasks.
-   `config.js`: Gemini model string and Google AI Studio url setup.
-   `icons/`: Contains all the icons used in the extension's UI.
-   `lib/`: Contains third-party libraries like `marked.js` (for Markdown rendering), `Readability.js`, and `pdf.js`.
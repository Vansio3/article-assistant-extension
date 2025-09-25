# Article Assistant Chrome Extension

Article Assistant is a powerful Chrome extension that uses the Google Gemini API to help you quickly understand and interact with content across the web. It can summarize articles, YouTube video transcripts, and PDF files, providing a chat interface to ask questions and a tool to help fact-check claims.

## Key Features

*   **Multi-Format Summarization**: Get concise summaries for:
    *   Standard web articles.
    *   YouTube videos (by automatically extracting and processing the transcript).
    *   Online PDF documents.
*   **Interactive Chat**:
    *   Ask follow-up questions about the page content.
    *   Toggle between using only the article's context for answers or enabling general knowledge with internet search capabilities via the Gemini API.
*   **Fact-Checking Hub**:
    *   Automatically extracts the main factual claims from an article.
    *   Generates pre-formatted prompts to verify the entire article or specific claims, ready to be pasted into the Gemini web UI for a comprehensive, real-time analysis.
*   **Text-to-Speech**:
    *   Listen to the generated summary aloud.
    *   Customize the voice and playback speed in the settings.
*   **Customizable User Experience**:
    *   **Multiple Themes**: Choose between System, Light, Dark, and Amber themes.
    *   **Adjustable Text Size**: Increase or decrease the text size for comfortable reading. 

## How It Works

1.  **Content Detection**: When activated, the extension first determines the type of content on the page (article, YouTube video, or PDF).
2.  **Script Injection**: It injects the appropriate content script to parse and extract the text.
    *   For articles, it uses the `Readability.js` library.
    *   For YouTube, it programmatically opens the transcript panel and scrapes the text.
    *   For PDFs, it uses `pdf.js` to extract text from the document.
3.  **API Communication**: The extracted text is sent to the Google Gemini API via the extension's background script.
4.  **Task Execution**: Based on the user's action (summarize, chat, or extract claims), a specific, carefully crafted prompt is sent to the API.
5.  **Display Results**: The API's response is then displayed in the extension's clean and intuitive user interface.

## Installation and Setup

To install and run this extension locally, follow these steps:

1.  **Clone or Download**: Clone this repository or download the source code as a ZIP file and extract it.

2.  **Rename Config File**: In the root directory of the project, rename the `config.js.example` file to `config.js`.

3.  **Add API Key**: Add your gemini API key in `config.js`. You can get one for free from [Google AI Studio](https://aistudio.google.com/app/apikey).

    ```javascript
    // config.js
    export const config = {
      // Replace with your actual Gemini API key
      GEMINI_API_KEY: "YOUR_GEMINI_API_KEY",

      // The model to use for API calls
      GEMINI_MODEL: "gemini-2.5-flash-lite",

      // The URL for the fact-checking feature
      GEMINI_WEB_URL: "https://aistudio.google.com/prompts/new_chat?model=gemini-2.5-pro"
    };
    ```

4.  **Load the Extension in Chrome**:
    *   Open Google Chrome and navigate to `chrome://extensions/`.
    *   Enable the **"Developer mode"** toggle in the top-right corner.
    *   Click the **"Load unpacked"** button.
    *   Select the folder where you cloned or extracted the project files.

The Article Assistant extension icon should now appear in your Chrome toolbar.

## How to Use

1.  **Navigate**: Go to a web article, a YouTube video page, or an online PDF file.
2.  **Activate**: Click the Article Assistant extension icon in your toolbar (or use the default shortcut `Alt+S`).
3.  **View Summary**: A popup will open and display the generated summary.
4.  **Chat with the Page**: Click the "Chat" tab to ask questions. You can toggle internet access for the chat model using the globe icon.
5.  **Fact Check**: Click the "Fact Check" tab. The extension will automatically identify key claims. You can then click a button to copy a detailed fact-checking prompt to your clipboard and open the Gemini web app in a new tab.

## File Structure

-   `manifest.json`: The core configuration file for the Chrome extension.
-   `background.js`: The service worker that handles API calls, script injection logic, and state management.
-   `popup.html`/`popup.css`/`popup.js`: Defines the structure, style, and functionality of the extension's user interface.
-   `prompts.js`: Contains all the prompt engineering templates sent to the Gemini API.
-   `content.js`: Injected into standard web pages to extract article text.
-   `content_youtube.js`: Injected into YouTube pages to extract video transcripts.
-   `content_pdf.js`: Injected to handle PDF files.
-   `/lib/`: Contains third-party libraries like `Readability.js`, `marked.js`, and `pdf.js`.
-   `/icons/`: Contains all the icons used in the extension UI.
# Article Assistant

Article Assistant is a powerful Chrome extension that leverages the Gemini API to provide users with instant summaries of web articles, PDFs, and YouTube video transcripts. It also features an interactive chat to discuss the content and a fact-checking tool to verify information.

## Features

-   **AI-Powered Summaries**: Get concise and coherent summaries of any web page, PDF document, or YouTube video transcript.
-   **Selective Text Analysis**: Summarize and analyze only the text you've highlighted on a page, perfect for quick fact-checks of social media posts or news snippets.
-   **Interactive Chat**: Engage in a conversation about the article's content to gain a deeper understanding or ask specific questions.
-   **Fact-Checking**: Verify the claims made in an article or a selected piece of text against other online sources.
-   **Customizable Experience**:
    -   Multiple themes (System, Light, Dark, Amber) to suit your preference.
    -   Adjustable text size for comfortable reading.
    -   Control the speech speed and choose from available voices for the read-aloud feature.
-   **Read Aloud**: Listen to the generated summary.
-   **API Key Support**: Easily configure the extension with your own Gemini API key.

## Installation

1.  Clone this repository or download the source code as a ZIP file.
2.  Open Google Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" in the top right corner.
4.  Click on "Load unpacked" and select the directory where you cloned or unzipped the source code.
5.  The Article Assistant extension will be added to your Chrome browser.

## Usage

1.  **Get Your Gemini API Key**:
    -   Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to create your free API key.
    -   Click the Article Assistant icon in your Chrome toolbar.
    -   Click the settings icon (⚙️) in the popup.
    -   Paste your API key into the "Gemini API Key" field and click "Save".

2.  **Summarize a Full Page**:
    -   Navigate to a web article, PDF, or YouTube video.
    -   Click the Article Assistant icon in your toolbar or press `Alt+S`.
    -   The extension will process the content and display a summary.

3.  **Summarize Selected Text (for Fact-Checking & Snippets)**:
    -   On any web page, highlight a piece of text you want to analyze. This is particularly useful for checking claims from social media posts, comments, or news snippets.
    -   With the text still selected, click the Article Assistant icon or press `Alt+S`.
    -   You will be prompted to choose between summarizing **"Just the Selected Text"** or **"The Entire Page"**.
    -   Choosing the selection allows for a quick, focused analysis and fact-check of specific claims without processing the full article.

4.  **Chat with the Page**:
    -   After a summary is generated, click on the "Chat" tab.
    -   Ask questions about the article, and the AI will answer based on the content.

5.  **Fact-Check the Article**:
    -   After a summary is generated, switch to the "Fact Check" tab.
    -   The extension will analyze the article's (or the selected text's) claims and provide a report with sources.

## File Structure

-   `manifest.json`: Defines the extension's properties, permissions, and scripts.
-   `background.js`: The service worker that handles API requests, manages state, and processes content.
-   `popup.html` & `popup.css` & `popup.js`: The UI and logic for the extension's popup window.
-   `content.js`, `content_pdf.js`, `content_youtube.js`: Scripts injected into web pages to extract readable content.
-   `prompts.js`: Contains the prompt templates for interacting with the Gemini API.
-   `config.js`: Configuration file for the Gemini model and other settings.
-   `lib/`: Contains third-party libraries like Readability.js and marked.js.
-   `icons/`: Contains the extension's icons.
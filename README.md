# Article Assistant Chrome Extension

Supercharge your reading experience with this powerful Chrome extension. It uses the Google Gemini API to provide one-click AI-powered summaries of any web article and allows you to have an interactive, context-aware conversation with the content.

***

## ✨ Features

*   **One-Click Summaries**: Instantly get a concise, easy-to-read summary of long articles directly in the Chrome side panel.
*   **💬 Chat with the Page**: Switch to an interactive chat mode to ask specific questions about the article's content. The AI's knowledge is limited to the article, ensuring contextually accurate answers.
*   **🔊 Read Aloud Functionality**: Listen to the article summary using the browser's built-in text-to-speech engine.
*   **⚙️ Personalization Settings**:
    *   **Voice Selection**: Choose from a list of available English voices for the "Read Aloud" feature.
    *   **Speech Speed**: Adjust the playback speed to your preferred listening pace.
    *   **Text Size**: Change the font size for both the summary and chat views for optimal readability.
*   **🎨 Modern UI & UX**:
    *   Clean, intuitive interface that appears in the Chrome Side Panel.
    *   Full dark mode support (adapts to your system's theme).
    *   Sleek, theme-aware SVG icons for all controls.
    *   Visual feedback for actions like copying text.
*   **🚀 Efficient Content Extraction**: Uses Mozilla's robust `Readability.js` library to cleanly parse and extract article text, ignoring ads and clutter.

## 🛠️ Tech Stack

*   **Platform**: Chrome Extension (Manifest V3)
*   **AI Engine**: Google Gemini API (`e.g. gemini-2.5-flash-lite`)
*   **Text-to-Speech**: Web Speech API (`window.speechSynthesis`)
*   **Content Parsing**: Mozilla's `Readability.js`
*   **Core Technologies**: HTML5, CSS3, JavaScript (ES Modules)
*   **APIs**: `chrome.sidePanel`, `chrome.scripting`, `chrome.storage`, `chrome.contextMenus`

## 🚀 Getting Started

To install and run this extension locally, follow these simple steps.

### 1. Clone the Repository

Clone this repository to your local machine:
```bash
git clone https://github.com/Vansio3/article-assistant-extension.git
cd article-assistant-extension
```

### 2. Set Up Configuration

This project requires a Google Gemini API key to function.

1.  In the project folder, you will find a file named `config.js.example`.
2.  **Rename this file to `config.js`**.
3.  Open the new `config.js` file. You will need to add your API key.

### 3. Obtain and Add Your API Key

1.  Go to [Google AI Studio](https://aistudio.google.com/) to generate your free API key.
2.  Copy the generated key.
3.  Paste the key into the `config.js` file:

    ```javascript
    // config.js
    export const config = {
      GEMINI_API_KEY: "PASTE_YOUR_GEMINI_API_KEY_HERE", // <-- Add your key
      GEMINI_MODEL: "gemini-2.5-flash-lite"
    };
    ```

### 4. Load the Extension in Chrome

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **"Developer mode"** using the toggle in the top-right corner.
3.  Click the **"Load unpacked"** button.
4.  Select the project folder you cloned earlier.

The "Article Assistant" extension should now appear in your extensions list and be ready to use!

## 📖 How to Use

1.  Navigate to any online article or blog post.
2.  Open the side panel in one of two ways:
    *   Click the **Article Assistant icon** in your Chrome toolbar.
    *   **Right-click** anywhere on the page and select "Parse with Article Assistant" from the context menu.
3.  The side panel will open and display the AI-generated summary.
4.  Click the **speaker icon** to have the summary read to you. Click it again to stop.
5.  Click the **gear icon** to open the Settings modal, where you can adjust the voice, speech speed, and text size. Your preferences are saved automatically.
6.  Click the **"Chat with Page"** tab to ask specific questions about the article.

## 📁 File Structure

```
/article-assistant-extension
|-- icons/
|   |-- checkmark-icon.svg
|   |-- copy-icon.svg
|   |-- send-icon.svg
|   |-- settings-icon.svg
|   |-- speaker-icon.svg
|   |-- stop-icon.svg
|-- manifest.json           # Core extension configuration, permissions, and scripts.
|-- background.js           # Service worker; handles API calls and background tasks.
|-- content.js              # Injected into pages to extract content via Readability.js.
|-- Readability.js          # The content parsing library from Mozilla.
|-- sidepanel.html          # The main HTML structure for the side panel UI.
|-- sidepanel.css           # All styles for the side panel, including dark mode.
|-- sidepanel.js            # Handles all UI logic, state, and user interactions.
|-- README.md               # You are here!
|-- config.js.example       # Example configuration file for users to copy.
```
# Article Assistant Chrome Extension

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)![Version](https://img.shields.io/badge/Version-1.2.0-blue)![Chrome](https://img.shields.io/badge/Platform-Chrome-brightgreen)

Supercharge your reading experience with this powerful Chrome extension. It uses the Google Gemini API to provide one-click AI-powered summaries of any web article and allows you to have an interactive conversation with the content.

***

## ✨ Features

*   **One-Click Summaries**: Instantly get a concise, easy-to-read summary of long articles directly in the Chrome side panel.
*   **💬 Chat with the Page**: Switch to an interactive chat mode to ask specific questions about the article's content. The AI's knowledge is limited to the article, ensuring contextually accurate answers.
*   **🎨 Modern UI & UX**:
    *   Clean, intuitive interface that appears in the Chrome Side Panel.
    *   Full dark mode support (adapts to your system's theme).
    *   Adjustable text size for improved readability.
    *   Easy "Copy to Clipboard" functionality.
*   **🚀 Efficient Content Extraction**: Uses Mozilla's robust `Readability.js` library to cleanly parse and extract article text, ignoring ads and clutter.
*   **🔐 Secure & Private**: Your Google Gemini API key is stored locally in the extension's configuration and is never shared.

## 🛠️ Tech Stack

*   **Platform**: Chrome Extension (Manifest V3)
*   **AI Engine**: Google Gemini API (`e.g. gemini-2.5-flash-lite`)
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
4.  **To ask questions**, click the **"Chat with Page"** button at the top of the side panel and use the input field at the bottom.
5.  Use the **A- / A+** buttons to adjust the text size to your preference. This setting is saved for future use.

## 📁 File Structure

```
/
|-- manifest.json         # Core extension configuration, permissions, and scripts.
|-- config.js             # Your private configuration (API key, model name).
|-- background.js         # Service worker; handles API calls and background tasks.
|-- content.js            # Injected into pages to extract content via Readability.js.
|-- Readability.js        # The content parsing library from Mozilla.
|-- sidepanel.html        # The main HTML structure for the side panel UI.
|-- sidepanel.css         # All styles for the side panel, including dark mode.
|-- sidepanel.js          # Handles all UI logic, state, and user interactions.
|-- send-icon.svg         # Icon for the chat "send" button.
|-- README.md             # You are here!
```

## 🤝 Contributing

Contributions are welcome! If you have ideas for improvements or find any bugs, feel free to open an issue or submit a pull request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📜 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
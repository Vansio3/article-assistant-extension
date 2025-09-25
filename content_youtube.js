// content_youtube.js
(async () => {

    // Helper to wait for an element to appear.
    function waitForElement(selector, baseElement = document.body, timeout = 7000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timed out after ${timeout}ms waiting for selector: ${selector}`));
            }, timeout);

            const element = baseElement.querySelector(selector);
            if (element) {
                clearTimeout(timeoutId);
                return resolve(element);
            }

            const observer = new MutationObserver(() => {
                const element = baseElement.querySelector(selector);
                if (element) {
                    clearTimeout(timeoutId);
                    resolve(element);
                    observer.disconnect();
                }
            });
            observer.observe(baseElement, { childList: true, subtree: true });
        });
    }

    // Shadow DOM-aware scraper to read the text.
    function scrapeSegmentsFromShadowDOM() {
        const segments = [];
        const segmentRenderers = document.querySelectorAll('ytd-transcript-segment-renderer');
        if (segmentRenderers.length === 0) return null;

        for (const renderer of segmentRenderers) {
            let textElement = renderer.shadowRoot ? renderer.shadowRoot.querySelector('.segment-text') : renderer.querySelector('.segment-text');
            if (textElement && textElement.textContent) {
                segments.push(textElement.textContent.trim());
            }
        }
        return segments.length > 0 ? segments.join(' ') : null;
    }

    // --- MAIN EXECUTION ---
    try {
        const videoTitle = document.querySelector('h1.style-scope.ytd-watch-metadata')?.textContent || 'YouTube Video';
        let transcriptOpened = false;

        // --- STRATEGY 1: Button in Description Box ---
        try {
            const descriptionButton = document.querySelector('ytd-video-description-transcript-section-renderer button');
            if (descriptionButton) {
                console.log("YouTube ContentScript: Strategy 1 - Found description button. Clicking.");
                descriptionButton.click();
                transcriptOpened = true;
            }
        } catch (e) {
            console.warn("YouTube ContentScript: Strategy 1 failed.", e);
        }

        // --- STRATEGY 2: Fallback to "..." Menu ---
        if (!transcriptOpened) {
            try {
                const moreActionsButton = await waitForElement('button[aria-label="More actions"], button[aria-label="more actions"]');
                moreActionsButton.click();
                
                const menuPopup = await waitForElement('ytd-menu-popup-renderer');
                // Use a less strict, case-insensitive check for the menu item
                const menuItems = menuPopup.querySelectorAll('tp-yt-paper-item, ytd-menu-service-item-renderer');
                const showTranscriptMenuItem = Array.from(menuItems).find(item => 
                    item.textContent && item.textContent.trim().toLowerCase().includes('transcript')
                );

                if (showTranscriptMenuItem) {
                    console.log("YouTube ContentScript: Strategy 2 - Found transcript option in menu. Clicking.");
                    showTranscriptMenuItem.click();
                    transcriptOpened = true;
                } else {
                    throw new Error("Could not find 'transcript' option in the '...' menu.");
                }
            } catch (e) {
                console.warn("YouTube ContentScript: Strategy 2 failed.", e);
            }
        }

        if (!transcriptOpened) {
            throw new Error("All strategies to open the transcript failed.");
        }

        // Wait for the transcript panel to be fully visible and populated.
        const transcriptPanel = await waitForElement('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
        await waitForElement("ytd-transcript-segment-renderer", transcriptPanel);
        await new Promise(resolve => setTimeout(resolve, 500)); // Final small delay for safety

        // Scrape the text using the Shadow DOM function
        const transcriptText = scrapeSegmentsFromShadowDOM();
        
        if (transcriptText && transcriptText.trim()) {
            chrome.runtime.sendMessage({
                action: "summarize",
                article: {
                    title: videoTitle,
                    content: transcriptText.trim(),
                    url: document.location.href
                }
            });
        } else {
            throw new Error("Transcript panel was opened, but no text could be extracted from it.");
        }
    } catch (e) {
        console.error("YouTube ContentScript Final Error:", e);
        chrome.runtime.sendMessage({
            action: "displayError",
            title: "Transcript Failed",
            message: e.message
        });
    }
})();
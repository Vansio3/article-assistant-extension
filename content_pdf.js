// content_pdf.js
(async () => {
  try {
    // Dynamically import the pdf.js library, which is made available via manifest.json
    const pdfjsLib = await import(chrome.runtime.getURL('lib/pdf.js'));

    // Set the workerSrc to load the worker script for performance
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.js');

    const url = document.location.href;
    const pdf = await pdfjsLib.getDocument(url).promise;
    let fullText = '';

    // Iterate through all pages of the PDF
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n'; // Add space between pages
    }
    
    // Extract a title from the URL (e.g., "my-document.pdf" -> "my-document")
    const pdfTitle = url.substring(url.lastIndexOf('/') + 1).replace('.pdf', '');

    if (fullText.trim()) {
      chrome.runtime.sendMessage({
        action: "summarize",
        article: {
          title: pdfTitle || "PDF Document",
          content: fullText.trim(),
          url: url
        }
      });
    } else {
      throw new Error("Could not extract any text from this PDF.");
    }
  } catch (e) {
    console.error("PDF ContentScript Error:", e);
    chrome.runtime.sendMessage({
      action: "displayError",
      title: "PDF Parsing Failed",
      message: e.message || "An error occurred while trying to read the PDF content. It may be corrupted or protected."
    });
  }
})();
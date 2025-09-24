// content.js
try {
  const article = new Readability(document.cloneNode(true)).parse();
  if (article && article.textContent) {
    chrome.runtime.sendMessage({
      action: "summarize",
      article: {
        title: article.title,
        content: article.textContent.trim(),
        url: document.location.href 
      }
    });
  } else {
    chrome.runtime.sendMessage({
      action: "displayError",
      title: "Parsing Failed",
      message: "Could not find a readable article on this page."
    });
  }
} catch (e) {
  console.error("ContentScript Error:", e);
  chrome.runtime.sendMessage({
    action: "displayError",
    title: "Script Error",
    message: "An error occurred while trying to read the page content."
  });
}
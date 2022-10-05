document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.create({ url: "dist/index.html" });
});

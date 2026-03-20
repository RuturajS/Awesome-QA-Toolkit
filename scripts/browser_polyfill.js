(function () {
    // Detect environment
    const isFirefox = typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
    const isChromium = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';

    const root = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : self);

    // Normalize 'browser' to the promise-supporting object
    if (isFirefox) {
        // In Firefox, 'browser' is promise-ready.
        root.chromeAPI = browser;
    } else if (isChromium) {
        // In Chrome (Chromium/Brave/Edge), 'chrome' is mostly promise-ready in MV3.
        root.chromeAPI = chrome;
    } else {
        root.chromeAPI = typeof browser !== 'undefined' ? browser : chrome;
    }

    // Ensure 'browser' is available in all environments and points to the promise-ready API
    if (!root.browser) root.browser = root.chromeAPI;
    if (!root.chrome) root.chrome = root.chromeAPI;

    // Flags
    root.isChromiumMode = isChromium;
    root.isBrave = !!(navigator.brave && navigator.brave.isBrave);
    root.isEdge = /Edg/.test(navigator.userAgent);
    root.isFirefox = isFirefox;
})();

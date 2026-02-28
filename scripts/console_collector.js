/**
 * QA Tools Kit - Console Error Collector
 * Content script (isolated world):
 *  - Catches unhandled window errors and promise rejections
 *  - Responds to popup messages for log retrieval and clearing
 *
 * The popup injects a MAIN-world script (via executeScript) that
 * intercepts console.error / console.warn and writes to window.__qaLogs.
 * This script reads those logs when the popup asks.
 */
(function () {
    if (window.__qaCollectorInjected) return;
    window.__qaCollectorInjected = true;

    // Local store for uncaught errors (caught by isolated-world handlers)
    const logs = [];

    function pushLog(type, msg, source) {
        logs.push({
            type,
            msg: String(msg).substring(0, 500),
            source: source || '',
            time: new Date().toISOString()
        });
    }

    // Capture uncaught JS errors (page context errors DO bubble here)
    window.addEventListener('error', (e) => {
        pushLog('error',
            e.message || 'Unknown error',
            `${e.filename ? e.filename.split('/').pop() : ''}:${e.lineno || ''}:${e.colno || ''}`
        );
    }, true);

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
        pushLog('error', `Unhandled Promise: ${reason}`, '');
    }, true);

    // Listen for postMessage from MAIN-world interceptor
    window.addEventListener('message', (e) => {
        if (e.source !== window) return;
        if (e.data && e.data.__qaLog) {
            logs.push(e.data.__qaLog);
        }
    });

    // Respond to popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getConsoleLogs') {
            sendResponse({ logs });
            return true;
        }
        if (request.action === 'clearConsoleLogs') {
            logs.length = 0;
            sendResponse({ ok: true });
            return true;
        }
    });
})();

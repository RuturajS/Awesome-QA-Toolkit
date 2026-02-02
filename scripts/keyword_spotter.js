(function () {
    // Prevent double injection
    if (window.hasKeywordSpotterRun) {
        return;
    }
    window.hasKeywordSpotterRun = true;

    let watchedKeywords = [];
    let watchInterval = null;
    let notifiedKeywords = new Set(); // Track keywords already notified on this page load

    // 1. Initial Load: Check if we are already watching anything
    try {
        chrome.storage.local.get(['trackedKeywords'], (res) => {
            if (res.trackedKeywords && res.trackedKeywords.length > 0) {
                watchedKeywords = res.trackedKeywords;
                startWatchingLoop();
            }
        });
    } catch (e) {
        console.log('Keyword Spotter: Storage access failed (likely context invalidated)');
    }

    // 2. Listen for dynamic changes from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
            if (request.action === 'findKeyword') {
                const results = findAndHighlight(request.keyword, request.useRegex);
                sendResponse(results);
            } else if (request.action === 'clearKeywordHighlights') {
                clearHighlights();
                sendResponse({ success: true });
            } else if (request.action === 'startWatching') {
                watchedKeywords = request.keywords;
                notifiedKeywords.clear(); // Clear so new words can be notified
                startWatchingLoop();
                sendResponse({ success: true });
            } else if (request.action === 'stopWatching') {
                watchedKeywords = [];
                stopWatchingLoop();
                clearHighlights();
                sendResponse({ success: true });
            }
        } catch (e) {
            console.log('Keyword Spotter: message listener failed');
        }
        return true;
    });

    function startWatchingLoop() {
        if (watchInterval) clearInterval(watchInterval);
        checkWatchedKeywords();
        watchInterval = setInterval(checkWatchedKeywords, 5000);
    }

    function stopWatchingLoop() {
        if (watchInterval) {
            clearInterval(watchInterval);
            watchInterval = null;
        }
    }

    function checkWatchedKeywords() {
        if (!watchedKeywords.length) return;

        // Safety: If runtime is disabled, stop the loop
        if (!chrome.runtime || !chrome.runtime.id) {
            stopWatchingLoop();
            return;
        }

        watchedKeywords.forEach(kw => {
            const escapedKw = kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedKw, 'gi');

            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            let foundInThisBatch = false;

            while (node = walker.nextNode()) {
                if (node.parentElement.tagName !== 'SCRIPT' &&
                    node.parentElement.tagName !== 'STYLE' &&
                    !node.parentElement.classList.contains('qa-keyword-highlight')) {

                    if (regex.test(node.nodeValue)) {
                        foundInThisBatch = true;
                        highlightNode(node, regex);
                    }
                }
            }

            // Only notify if we haven't notified for THIS specific keyword on THIS page yet
            if (foundInThisBatch && !notifiedKeywords.has(kw.keyword)) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'keywordMatchFound',
                        keyword: kw.keyword,
                        url: window.location.href,
                        count: 1
                    }, () => {
                        if (chrome.runtime.lastError) {
                            // Context invalidated, stop loop
                            stopWatchingLoop();
                        } else {
                            notifiedKeywords.add(kw.keyword);
                        }
                    });
                } catch (e) {
                    stopWatchingLoop();
                }
            }
        });
    }

    function findAndHighlight(keyword, useRegex) {
        clearHighlights();
        if (!keyword) return { count: 0 };

        let regex;
        try {
            if (useRegex) {
                regex = new RegExp(keyword, 'gi');
            } else {
                const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(escaped, 'gi');
            }
        } catch (e) {
            return { error: 'Invalid Regular Expression' };
        }

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        const nodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.parentElement.tagName !== 'SCRIPT' && node.parentElement.tagName !== 'STYLE') {
                nodes.push(node);
            }
        }

        let matchCount = 0;
        nodes.forEach(textNode => {
            const matches = textNode.nodeValue.match(regex);
            if (matches) {
                matchCount += matches.length;
                highlightNode(textNode, regex);
            }
        });

        return {
            count: matchCount,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
    }

    function highlightNode(textNode, regex) {
        const parent = textNode.parentElement;
        if (!parent) return;

        const text = textNode.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIdx = 0;
        let match;
        const searchRegex = new RegExp(regex.source, regex.flags);

        while ((match = searchRegex.exec(text)) !== null) {
            fragment.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
            const mark = document.createElement('mark');
            mark.className = 'qa-keyword-highlight';
            mark.style.backgroundColor = 'yellow';
            mark.style.color = 'black';
            mark.style.fontWeight = 'bold';
            mark.style.padding = '1px 2px';
            mark.style.borderRadius = '2px';
            mark.textContent = match[0];
            fragment.appendChild(mark);

            lastIdx = searchRegex.lastIndex;
            if (match.index === searchRegex.lastIndex) searchRegex.lastIndex++;
        }

        fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
        try {
            parent.replaceChild(fragment, textNode);
        } catch (e) { }
    }

    function clearHighlights() {
        const highlights = document.querySelectorAll('.qa-keyword-highlight');
        highlights.forEach(mark => {
            const parent = mark.parentElement;
            if (!parent) return;
            const textNode = document.createTextNode(mark.textContent);
            parent.replaceChild(textNode, mark);
            parent.normalize();
        });
    }

    console.log('Keyword Spotter content script active');
})();

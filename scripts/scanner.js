(function () {
    if (window.hasRun) {
        return;
    }
    window.hasRun = true;

    // Listen for messages from the popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "scan") {
            performScan().then(results => {
                sendResponse({ results: results });
            }).catch(err => {
                sendResponse({ error: err.message });
            });
            return true; // Keep the message channel open for async response
        }
    });

    async function performScan() {
        const results = [];

        // 1. Broken Link & Resource Checker
        // Collect ALL checkable URLs from the page
        const urlsToCheck = new Map(); // url -> { type, element }

        // <a href>
        document.querySelectorAll('a[href]').forEach(el => {
            const href = el.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
                href.startsWith('tel:') || href.startsWith('javascript:')) return;
            try {
                const abs = new URL(href, document.baseURI).href;
                if (!urlsToCheck.has(abs)) urlsToCheck.set(abs, { type: 'Link', el });
            } catch (_) { /* malformed */ }
        });

        // <img src>
        document.querySelectorAll('img[src]').forEach(el => {
            try {
                const abs = new URL(el.getAttribute('src'), document.baseURI).href;
                if (!urlsToCheck.has(abs)) urlsToCheck.set(abs, { type: 'Image', el });
            } catch (_) { }
        });

        // <script src>
        document.querySelectorAll('script[src]').forEach(el => {
            try {
                const abs = new URL(el.getAttribute('src'), document.baseURI).href;
                if (!urlsToCheck.has(abs)) urlsToCheck.set(abs, { type: 'Script', el });
            } catch (_) { }
        });

        // <link href> (stylesheets, fonts)
        document.querySelectorAll('link[href]').forEach(el => {
            try {
                const abs = new URL(el.getAttribute('href'), document.baseURI).href;
                if (!urlsToCheck.has(abs)) urlsToCheck.set(abs, { type: 'Resource', el });
            } catch (_) { }
        });

        // <iframe src>
        document.querySelectorAll('iframe[src]').forEach(el => {
            try {
                const abs = new URL(el.getAttribute('src'), document.baseURI).href;
                if (!urlsToCheck.has(abs)) urlsToCheck.set(abs, { type: 'IFrame', el });
            } catch (_) { }
        });

        // Only check http/https URLs
        const checkableEntries = [...urlsToCheck.entries()].filter(([url]) =>
            url.startsWith('http://') || url.startsWith('https://')
        );

        // Flag malformed URLs (spaces, bad chars in <a href>)
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.getAttribute('href') || '';
            if (href === '' || href.trim() === '') {
                results.push({
                    type: 'Link',
                    details: `Empty href on: "${link.textContent.trim().substring(0, 60) || '<no text>'}"`,
                    severity: 'Medium',
                    recommendation: 'Add a valid URL or use a <button> element.',
                    actual: 'href=""',
                    expected: 'Valid URL'
                });
            } else if (/\s/.test(href) && !href.startsWith('#') && !href.startsWith('javascript')) {
                results.push({
                    type: 'Link - Malformed',
                    details: `Spaces in URL: ${href.substring(0, 80)}`,
                    severity: 'High',
                    recommendation: 'Remove spaces from the URL or encode them as %20.',
                    actual: href,
                    expected: 'No unencoded spaces'
                });
            } else if (href.startsWith('javascript:void')) {
                results.push({
                    type: 'Link - Bad Practice',
                    details: `javascript:void(0) used as href`,
                    severity: 'Low',
                    recommendation: 'Use <button> or a real URL instead of javascript:void(0).',
                    actual: href.substring(0, 40),
                    expected: 'Valid URL or <button>'
                });
            }
        });

        // Fetch checker with timeout and HEAD→GET fallback
        async function checkUrl(url) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
            try {
                let resp = await fetch(url, {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-store',
                    redirect: 'follow'
                });
                // Some servers reject HEAD — fall back to GET with 0-byte body
                if (resp.status === 405 || resp.status === 501) {
                    resp = await fetch(url, {
                        method: 'GET',
                        signal: controller.signal,
                        cache: 'no-store',
                        redirect: 'follow',
                        headers: { Range: 'bytes=0-0' }
                    });
                }
                clearTimeout(timeoutId);
                return { status: resp.status, ok: resp.ok, redirected: resp.redirected, finalUrl: resp.url };
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') return { status: 0, ok: false, error: 'timeout' };
                // Network error or CORS — treat as unknown, not necessarily broken
                return { status: 0, ok: null, error: err.message };
            }
        }

        // Concurrency-limited batch runner (max 6 parallel requests)
        async function runConcurrent(items, concurrency, fn) {
            const results = [];
            let idx = 0;
            async function worker() {
                while (idx < items.length) {
                    const i = idx++;
                    results[i] = await fn(items[i]);
                }
            }
            const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
            await Promise.all(workers);
            return results;
        }

        // Cap at 80 URLs to avoid overloading
        const capped = checkableEntries.slice(0, 80);
        const checkResults = await runConcurrent(capped, 6, async ([url, meta]) => {
            const result = await checkUrl(url);
            return { url, meta, result };
        });

        checkResults.forEach(({ url, meta, result }) => {
            const shortUrl = url.length > 80 ? url.substring(0, 77) + '...' : url;

            if (result.error === 'timeout') {
                results.push({
                    type: `${meta.type} - Slow/Timeout`,
                    details: shortUrl,
                    severity: 'Medium',
                    recommendation: 'Resource took over 8 seconds to respond. Check server performance.',
                    actual: 'Timeout (>8s)',
                    expected: 'Response within 3s'
                });
            } else if (result.status >= 400 && result.status < 500) {
                results.push({
                    type: `${meta.type} - Broken`,
                    details: shortUrl,
                    severity: 'High',
                    recommendation: result.status === 404
                        ? 'Update or remove this broken link/resource.'
                        : `HTTP ${result.status} error — check authentication or permissions.`,
                    actual: `HTTP ${result.status}`,
                    expected: 'HTTP 200 OK'
                });
            } else if (result.status >= 500) {
                results.push({
                    type: `${meta.type} - Server Error`,
                    details: shortUrl,
                    severity: 'High',
                    recommendation: 'Server returned an error. Investigate server-side issues.',
                    actual: `HTTP ${result.status}`,
                    expected: 'HTTP 200 OK'
                });
            } else if (result.redirected && result.finalUrl && result.finalUrl !== url) {
                // Only flag permanent-looking redirects (can't reliably detect 301 vs 302 in fetch)
                // Leave 3xx as informational for now — include if needed
            }
        });

        // Summary: if too many links to check, mention it
        if (checkableEntries.length > 80) {
            results.push({
                type: 'Link Check - Info',
                details: `Page has ${checkableEntries.length} resources. Only first 80 were checked.`,
                severity: 'Low',
                recommendation: 'Run a dedicated link checker for full coverage.',
                actual: `${checkableEntries.length} resources`,
                expected: '≤ 80 for full scan'
            });
        }



        // 2. Image Analysis
        const images = document.querySelectorAll('img');
        const LARGE_IMG_THRESHOLD = 200 * 1024; // 200KB

        const resources = performance.getEntriesByType("resource");

        images.forEach(img => {
            // Missing Alt
            if (!img.hasAttribute('alt') || img.getAttribute('alt').trim() === '') {
                results.push({
                    type: 'Image',
                    details: `Missing alt text: ${img.src.substring(0, 50)}...`,
                    severity: 'Medium',
                    recommendation: 'Add descriptive alt text.',
                    actual: 'Missing alt',
                    expected: 'Descriptive alt text'
                });
            }

            // Unoptimized Format
            const src = img.src.toLowerCase();
            if (src.endsWith('.jpg') || src.endsWith('.png') || src.endsWith('.jpeg')) {
                results.push({
                    type: 'Image - Optimization',
                    details: `Legacy format (JPG/PNG): ${src.split('/').pop()}`,
                    severity: 'Low',
                    recommendation: 'Consider using WebP or AVIF.',
                    actual: src.split('.').pop().toUpperCase(),
                    expected: 'WebP / AVIF'
                });
            }

            // Check if broken
            if (img.complete && img.naturalWidth === 0) {
                results.push({
                    type: 'Image - Broken',
                    details: `Broken image: ${img.src}`,
                    severity: 'High',
                    recommendation: 'Fix image source or remove image.',
                    actual: '0px width',
                    expected: 'Visible image'
                });
            }
        });

        // 3. Performance & Asset Analysis
        resources.forEach(entry => {
            // Large images
            if (entry.initiatorType === 'img' && entry.encodedBodySize > LARGE_IMG_THRESHOLD) {
                results.push({
                    type: 'Performance - Large Image',
                    details: `${entry.name.split('/').pop()} is ${(entry.encodedBodySize / 1024).toFixed(2)}KB`,
                    severity: 'Medium',
                    recommendation: 'Compress image below 200KB.',
                    actual: `${(entry.encodedBodySize / 1024).toFixed(2)} KB`,
                    expected: '< 200 KB'
                });
            }

            // Slow loading assets
            if (entry.duration > 1000) {
                results.push({
                    type: 'Performance - Slow Asset',
                    details: `${entry.name.split('/').pop()} took ${(entry.duration).toFixed(0)}ms`,
                    severity: 'Medium',
                    recommendation: 'Optimize asset delivery.',
                    actual: `${(entry.duration).toFixed(0)} ms`,
                    expected: '< 1000 ms'
                });
            }
        });

        // Check for too many font files
        const fonts = resources.filter(r => r.initiatorType === 'font' || r.name.endsWith('.woff') || r.name.endsWith('.woff2'));
        if (fonts.length > 5) {
            results.push({
                type: 'Performance - Fonts',
                details: `Detected ${fonts.length} font files loaded.`,
                severity: 'Low',
                recommendation: 'Reduce number of custom fonts.',
                actual: `${fonts.length} fonts`,
                expected: '< 5 fonts'
            });
        }

        // 4. UI/Layout Issues
        if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
            results.push({
                type: 'UI - Overflow',
                details: 'Page has horizontal scroll (overflow-x)',
                severity: 'High',
                recommendation: 'Inspect elements causing overflow.',
                actual: `Scroll: ${document.documentElement.scrollWidth}px`,
                expected: `Client: ${document.documentElement.clientWidth}px`
            });
        }

        const viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            results.push({
                type: 'UI - Standard',
                details: 'Missing <meta name="viewport">',
                severity: 'High',
                recommendation: 'Add viewport meta tag.',
                actual: 'Missing',
                expected: 'Present'
            });
        }

        return results;
    }
})();

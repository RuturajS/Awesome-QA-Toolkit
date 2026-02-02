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

        // 1. Link Checking
        const links = document.querySelectorAll('a');
        const linkPromises = Array.from(links).map(async (link) => {
            const href = link.getAttribute('href');

            if (!href || href.trim() === '') {
                results.push({
                    type: 'Link',
                    details: 'Empty href attribute',
                    severity: 'Medium',
                    recommendation: 'Add a valid URL or remove the link.',
                    actual: 'href=""',
                    expected: 'Valid URL'
                });
                return;
            }

            if (href.startsWith('javascript:void')) {
                results.push({
                    type: 'Link',
                    details: `Unsafe link: ${href}`,
                    severity: 'Low',
                    recommendation: 'Avoid javascript:void(0), use buttons or valid URLs.',
                    actual: href,
                    expected: 'Safe URL or Button'
                });
                return;
            }

            // Check for broken links (active check)
            if (href.startsWith('http')) {
                try {
                    const response = await fetch(href, { method: 'HEAD' }).catch(err => null);
                    if (response && response.status >= 400) {
                        results.push({
                            type: 'Link - Broken',
                            details: `${response.status} Error: ${href}`,
                            severity: 'High',
                            recommendation: 'Fix broken link.',
                            actual: `Status ${response.status}`,
                            expected: 'Status 200 OK'
                        });
                    }
                } catch (e) {
                    // Ignore CORS errors
                }
            }
        });

        // Wait for all link checks to complete
        await Promise.all(linkPromises);

        // Basic Link checks (synchronous for speed/CORS safety)
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            // Check for spaces
            if (href.includes(' ') && !href.startsWith('javascript')) {
                results.push({
                    type: 'Link',
                    details: `Malformed URL (spaces): ${href}`,
                    severity: 'High',
                    recommendation: 'Remove spaces from the URL.',
                    actual: href,
                    expected: 'No spaces in URL'
                });
            }
        });


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

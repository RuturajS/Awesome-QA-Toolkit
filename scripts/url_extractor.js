(function () {
    if (window.hasUrlExtractorRun) return;
    window.hasUrlExtractorRun = true;

    console.log('URL Extractor: Starting extraction...');

    // Extract all URLs from the page
    const urls = extractUrls();

    console.log('URL Extractor: Found', urls.all.length, 'URLs');

    // Send to background for display
    chrome.runtime.sendMessage({
        action: 'showUrlExtractor',
        urls: urls,
        pageUrl: window.location.href,
        pageTitle: document.title
    }, (response) => {
        console.log('URL Extractor: Message sent successfully');
        window.hasUrlExtractorRun = false;
    });

    function extractUrls() {
        const urlSet = new Set();

        // Extract from <a> tags
        document.querySelectorAll('a[href]').forEach(link => {
            const href = link.href;
            if (href && isValidUrl(href)) {
                urlSet.add(href);
            }
        });

        // Extract from <link> tags (stylesheets, icons, etc.)
        document.querySelectorAll('link[href]').forEach(link => {
            const href = link.href;
            if (href && isValidUrl(href)) {
                urlSet.add(href);
            }
        });

        // Extract from <img> tags
        document.querySelectorAll('img[src]').forEach(img => {
            const src = img.src;
            if (src && isValidUrl(src)) {
                urlSet.add(src);
            }
        });

        // Extract from <script> tags
        document.querySelectorAll('script[src]').forEach(script => {
            const src = script.src;
            if (src && isValidUrl(src)) {
                urlSet.add(src);
            }
        });

        // Extract from <iframe> tags
        document.querySelectorAll('iframe[src]').forEach(iframe => {
            const src = iframe.src;
            if (src && isValidUrl(src)) {
                urlSet.add(src);
            }
        });

        // Extract from <video> and <audio> tags
        document.querySelectorAll('video[src], audio[src]').forEach(media => {
            const src = media.src;
            if (src && isValidUrl(src)) {
                urlSet.add(src);
            }
        });

        // Extract from <source> tags
        document.querySelectorAll('source[src]').forEach(source => {
            const src = source.src;
            if (src && isValidUrl(src)) {
                urlSet.add(src);
            }
        });

        // Extract from inline styles (background images, etc.)
        document.querySelectorAll('[style]').forEach(element => {
            const style = element.getAttribute('style');
            if (style) {
                const urlMatches = style.match(/url\(['"]?(.*?)['"]?\)/g);
                if (urlMatches) {
                    urlMatches.forEach(match => {
                        try {
                            const url = match.replace(/url\(['"]?/, '').replace(/['"]?\)/, '');
                            const absoluteUrl = new URL(url, window.location.href).href;
                            if (isValidUrl(absoluteUrl)) {
                                urlSet.add(absoluteUrl);
                            }
                        } catch (e) {
                            // Invalid URL, skip
                        }
                    });
                }
            }
        });

        // Categorize URLs
        const categorized = {
            all: Array.from(urlSet),
            internal: [],
            external: [],
            images: [],
            scripts: [],
            stylesheets: [],
            media: [],
            other: []
        };

        const currentDomain = new URL(window.location.href).hostname;

        categorized.all.forEach(url => {
            try {
                const urlObj = new URL(url);

                // Internal vs External
                if (urlObj.hostname === currentDomain) {
                    categorized.internal.push(url);
                } else {
                    categorized.external.push(url);
                }

                // By type
                const ext = urlObj.pathname.split('.').pop().toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
                    categorized.images.push(url);
                } else if (['js'].includes(ext)) {
                    categorized.scripts.push(url);
                } else if (['css'].includes(ext)) {
                    categorized.stylesheets.push(url);
                } else if (['mp4', 'webm', 'ogg', 'mp3', 'wav'].includes(ext)) {
                    categorized.media.push(url);
                } else {
                    categorized.other.push(url);
                }
            } catch (e) {
                categorized.other.push(url);
            }
        });

        return categorized;
    }

    function isValidUrl(url) {
        return url && (url.startsWith('http://') || url.startsWith('https://'));
    }

    // Reset flag will be done in callback
})();

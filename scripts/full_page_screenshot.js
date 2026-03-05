/**
 * QA Tools Kit - Full Page Screenshot (Scrolling)
 * Captures the entire scrolling page without prompting the user to select a tab.
 */
(function () {
    async function captureFullPage() {
        try {
            showToast("📸 Capturing full page... Please don't scroll.");

            const originalScrollPos = window.scrollY;
            const body = document.body;
            const html = document.documentElement;

            const height = Math.max(
                body.scrollHeight, body.offsetHeight,
                html.clientHeight, html.scrollHeight, html.offsetHeight
            );
            const width = Math.max(
                body.scrollWidth, body.offsetWidth,
                html.clientWidth, html.scrollWidth, html.offsetWidth
            );

            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const canvas = document.createElement('canvas');
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            const ctx = canvas.getContext('2d');

            let currentScroll = 0;

            // Hide scrollbars temporarily
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';

            while (currentScroll < height) {
                window.scrollTo(0, currentScroll);
                // Wait for any lazy-loading content or fixed position adjustments
                await new Promise(r => setTimeout(r, 300));

                const response = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: "captureVisibleTab" }, resolve);
                });

                if (response && response.dataUrl) {
                    const img = new Image();
                    await new Promise((resolve) => {
                        img.onload = resolve;
                        img.src = response.dataUrl;
                    });

                    const dpr = window.devicePixelRatio;
                    const yOffset = currentScroll * dpr;

                    // Only draw what fits in the final canvas (handle last frame)
                    const remainingHeight = (height - currentScroll);
                    const drawHeight = Math.min(viewportHeight, remainingHeight);

                    ctx.drawImage(
                        img,
                        0, 0, img.width, drawHeight * dpr,
                        0, yOffset, img.width, drawHeight * dpr
                    );
                }

                currentScroll += viewportHeight;
            }

            // Restore state
            document.body.style.overflow = originalOverflow;
            window.scrollTo(0, originalScrollPos);

            // Add timestamp if enabled
            if (window.screenshotAddTimestamp !== false) {
                const now = new Date();
                const timestamp = now.toLocaleString('en-US', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                });
                const scale = window.devicePixelRatio || 1;
                ctx.font = `${20 * scale}px monospace`;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(20 * scale, 20 * scale, 240 * scale, 35 * scale);
                ctx.fillStyle = '#fff';
                ctx.fillText(timestamp, 25 * scale, 45 * scale);
            }

            // Save the result
            const dataUrl = canvas.toDataURL('image/png');

            if (window.fullPageAutoCapture) {
                chrome.runtime.sendMessage({
                    action: "fullPageDataReady",
                    dataUrl: dataUrl
                });
            } else {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `full-page-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showToast("✅ Full page screenshot saved!");
            }

        } catch (err) {
            console.error("Full page capture failed:", err);
            showToast("❌ Failed: " + err.message);
        }
    }

    function showToast(msg) {
        let toast = document.getElementById('__qashot_toast__');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = '__qashot_toast__';
            Object.assign(toast.style, {
                position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
                background: '#1a1a2e', color: '#fff', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontFamily: 'system-ui, sans-serif',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)', border: '1px solid #444',
                transition: 'opacity 0.3s', opacity: '0', pointerEvents: 'none'
            });
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast.__timeout);
        toast.__timeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }

    captureFullPage();
})();

/**
 * QA Tools Kit - Visible Area Screenshot
 * Captures exactly what's visible in the current tab without any prompts.
 */
(function () {
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

    chrome.runtime.sendMessage({ action: "captureVisibleTab" }, (response) => {
        if (response && response.dataUrl) {
            // Add timestamp if enabled (shared windows variable)
            if (window.screenshotAddTimestamp !== false) {
                const canvas = document.createElement('canvas');
                const img = new Image();
                img.onload = () => {
                    const dpr = window.devicePixelRatio || 1;
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const now = new Date();
                    const timestamp = now.toLocaleString('en-US', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false
                    });
                    const scale = dpr;
                    ctx.font = `${16 * scale}px monospace`;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                    ctx.fillRect(15 * scale, 15 * scale, 190 * scale, 30 * scale);
                    ctx.fillStyle = '#fff';
                    ctx.fillText(timestamp, 20 * scale, 35 * scale);

                    const dataUrl = canvas.toDataURL('image/png');
                    download(dataUrl);
                };
                img.src = response.dataUrl;
            } else {
                download(response.dataUrl);
            }
        } else {
            console.error("Failed to capture tab");
            showToast("❌ Failed to capture tab.");
        }
    });

    function download(dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `screenshot-visible-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("✅ Screenshot saved!");
    }
})();

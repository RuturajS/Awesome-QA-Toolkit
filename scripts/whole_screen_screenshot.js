/**
 * QA Tools Kit - Whole Screen Screenshot
 * Uses getDisplayMedia to capture the entire desktop/screen/window.
 */
(function () {
    async function capture() {
        try {
            // 1. Request screen share
            // Note: The browser will show a picker to the user.
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" },
                audio: false
            });

            // 2. Create a hidden video element to grab a frame
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();

            // Wait for metadata to load so we know dimensions
            await new Promise((resolve) => {
                video.onloadedmetadata = resolve;
            });

            // Wait a tiny bit for the first frame to render
            await new Promise((resolve) => setTimeout(resolve, 500));

            // 3. Draw frame to canvas
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 4. Add timestamp if requested (check global var set by popup)
            if (window.screenshotAddTimestamp !== false) {
                const now = new Date();
                const timestamp = now.toLocaleString('en-US', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false
                });
                const scale = Math.max(1, canvas.width / 1920); // Scale font based on resolution
                ctx.font = `${20 * scale}px monospace`;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(20 * scale, 20 * scale, 240 * scale, 35 * scale);
                ctx.fillStyle = '#fff';
                ctx.fillText(timestamp, 25 * scale, 45 * scale);
            }

            // 5. Download the image
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `full-screen-screenshot-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 6. Cleanup
            stream.getTracks().forEach(t => t.stop());
            video.srcObject = null;

            // Show toast feedback on page
            showToast("✅ Whole screen screenshot saved!");

        } catch (err) {
            console.error("Screen capture failed:", err);
            if (err.name !== 'NotAllowedError') {
                showToast("❌ Failed to capture screen: " + err.message);
            }
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

    capture();

})();

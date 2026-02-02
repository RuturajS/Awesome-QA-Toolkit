(function () {
    // Prevent multiple injections in the same frame
    if (window.hasOverlayRun) return;
    window.hasOverlayRun = true;

    let effectCanvas, effectCtx;
    let animationId;
    let mouseTrail = [];
    let clickEffects = [];
    const TRAIL_LENGTH = 20;

    function createEffectOverlay() {
        effectCanvas = document.createElement('canvas');
        effectCanvas.style.position = 'fixed';
        effectCanvas.style.top = '0';
        effectCanvas.style.left = '0';
        effectCanvas.style.width = '100vw';
        effectCanvas.style.height = '100vh';
        effectCanvas.style.pointerEvents = 'none';
        effectCanvas.style.zIndex = '999998';
        document.body.appendChild(effectCanvas);

        effectCanvas.width = window.innerWidth;
        effectCanvas.height = window.innerHeight;
        effectCtx = effectCanvas.getContext('2d');

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('click', onClick);

        animateEffects();
    }

    function removeEffectOverlay() {
        if (effectCanvas && effectCanvas.parentNode) {
            effectCanvas.parentNode.removeChild(effectCanvas);
            effectCanvas = null;
        }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('click', onClick);
        cancelAnimationFrame(animationId);
        mouseTrail = [];
        clickEffects = [];
        window.hasOverlayRun = false;
    }

    function onResize() {
        if (effectCanvas) {
            effectCanvas.width = window.innerWidth;
            effectCanvas.height = window.innerHeight;
        }
    }

    function onMouseMove(e) {
        mouseTrail.push({ x: e.clientX, y: e.clientY, age: 0 });
        if (mouseTrail.length > TRAIL_LENGTH) {
            mouseTrail.shift();
        }
    }

    function onClick(e) {
        clickEffects.push({ x: e.clientX, y: e.clientY, age: 0 });
    }

    function animateEffects() {
        if (!effectCanvas) return;

        effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);

        // Draw Timestamp if enabled
        if (window.recordingAddTimestamp !== false) {
            const now = new Date();
            const timestamp = now.toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            effectCtx.font = '14px monospace';
            effectCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            effectCtx.fillRect(10, 10, 180, 25);
            effectCtx.fillStyle = '#fff';
            effectCtx.fillText(timestamp, 15, 28);
        }

        // Draw Trail
        if (mouseTrail.length > 1) {
            for (let i = 0; i < mouseTrail.length - 1; i++) {
                const p1 = mouseTrail[i];
                const p2 = mouseTrail[i + 1];

                const opacity = (i / mouseTrail.length) * 0.5;
                effectCtx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
                effectCtx.lineWidth = (i / mouseTrail.length) * 4;
                effectCtx.lineCap = 'round';

                effectCtx.beginPath();
                effectCtx.moveTo(p1.x, p1.y);
                effectCtx.lineTo(p2.x, p2.y);
                effectCtx.stroke();
            }
        }

        // Draw Clicks
        for (let i = clickEffects.length - 1; i >= 0; i--) {
            const click = clickEffects[i];
            click.age++;

            const maxAge = 120;
            if (click.age > maxAge) {
                clickEffects.splice(i, 1);
                continue;
            }

            const progress = click.age / maxAge;
            const radius = 10 + (progress * 30);
            const opacity = 1 - progress;

            effectCtx.beginPath();
            effectCtx.arc(click.x, click.y, radius, 0, Math.PI * 2);
            effectCtx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.3})`;
            effectCtx.fill();
            effectCtx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
            effectCtx.lineWidth = 2;
            effectCtx.stroke();
        }

        animationId = requestAnimationFrame(animateEffects);
    }

    // Listen for stop message from background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'stopOverlay') {
            removeEffectOverlay();
        }
    });

    createEffectOverlay();
})();

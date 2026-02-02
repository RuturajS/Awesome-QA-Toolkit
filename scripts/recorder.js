(function () {
    if (window.hasRecorderRun) return;
    window.hasRecorderRun = true;

    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let controlPanel;
    let effectCanvas, effectCtx;
    let animationId;
    let mouseTrail = [];
    let clickEffects = [];
    const TRAIL_LENGTH = 20;

    // Get config from URL param script arguments if possible, or default
    // Since we can't easily pass args via executeScript files array without injection,
    // we'll listen for a message or just default to enabled if called.
    // Ideally, the popup sends a message to configure.
    // For simplicity: We will ALWAYS show effects if the user requested the tool.
    // Or we can check a global var we set before injection.

    // Let's assume we want effects by default or check window.enableRecorderEffects
    const enableEffects = window.enableRecorderEffects !== false;

    function createEffectOverlay() {
        if (!enableEffects) return;

        effectCanvas = document.createElement('canvas');
        effectCanvas.style.position = 'fixed';
        effectCanvas.style.top = '0';
        effectCanvas.style.left = '0';
        effectCanvas.style.width = '100vw';
        effectCanvas.style.height = '100vh';
        effectCanvas.style.pointerEvents = 'none'; // Click-through
        effectCanvas.style.zIndex = '999998'; // Below control panel
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
        if (effectCanvas) {
            document.body.removeChild(effectCanvas);
            effectCanvas = null;
        }
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('click', onClick);
        cancelAnimationFrame(animationId);
        mouseTrail = [];
        clickEffects = [];
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

        // Draw Trail
        if (mouseTrail.length > 1) {
            effectCtx.beginPath();
            effectCtx.lineCap = 'round';
            effectCtx.lineJoin = 'round';

            for (let i = 0; i < mouseTrail.length - 1; i++) {
                const p1 = mouseTrail[i];
                const p2 = mouseTrail[i + 1];

                // Fade out tail
                const opacity = (i / mouseTrail.length) * 0.5;
                effectCtx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
                effectCtx.lineWidth = (i / mouseTrail.length) * 4;

                effectCtx.beginPath();
                effectCtx.moveTo(p1.x, p1.y);
                effectCtx.lineTo(p2.x, p2.y);
                effectCtx.stroke();
            }
        }

        // Draw Clicks (Red Ripple)
        for (let i = clickEffects.length - 1; i >= 0; i--) {
            const click = clickEffects[i];
            click.age++;

            const maxAge = 120; // 2 seconds at 60fps
            if (click.age > maxAge) {
                clickEffects.splice(i, 1);
                continue;
            }

            const progress = click.age / maxAge;
            const radius = 10 + (progress * 30); // Expand
            const opacity = 1 - progress; // Fade

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

    async function startRecording() {
        try {
            createEffectOverlay();

            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = saveRecording;

            stream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            mediaRecorder.start();
            showControlPanel();

        } catch (err) {
            console.error("Error starting recording:", err);
            window.hasRecorderRun = false;
            removeEffectOverlay();
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        removeControlPanel();
        removeEffectOverlay();
        window.hasRecorderRun = false;
    }

    function saveRecording() {
        const blob = new Blob(recordedChunks, {
            type: "video/webm"
        });

        // Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = `bug-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        recordedChunks = [];
    }

    function showControlPanel() {
        controlPanel = document.createElement('div');
        controlPanel.style.position = 'fixed';
        controlPanel.style.bottom = '20px';
        controlPanel.style.left = '20px';
        controlPanel.style.zIndex = '1000000';
        controlPanel.style.background = '#d32f2f';
        controlPanel.style.padding = '10px 20px';
        controlPanel.style.borderRadius = '50px';
        controlPanel.style.color = 'white';
        controlPanel.style.cursor = 'pointer';
        controlPanel.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
        controlPanel.style.fontFamily = 'sans-serif';
        controlPanel.style.fontWeight = 'bold';
        controlPanel.innerText = '⏹ Stop Recording';

        controlPanel.addEventListener('click', stopRecording);
        document.body.appendChild(controlPanel);
    }

    function removeControlPanel() {
        if (controlPanel) {
            document.body.removeChild(controlPanel);
            controlPanel = null;
        }
    }

    startRecording();

})();

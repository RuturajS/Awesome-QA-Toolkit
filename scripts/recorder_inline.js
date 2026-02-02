(function () {
    if (window.hasRecorderRun) return;
    window.hasRecorderRun = true;

    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    let controlPanel;
    const enableEffects = window.enableRecorderEffects !== false;
    const addTimestamp = window.recordingAddTimestamp !== false;

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8',
                videoBitsPerSecond: 2500000
            });

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunks.push(event.data);
                    console.log('Chunk received:', event.data.size, 'bytes');
                }
            };

            mediaRecorder.onstop = () => {
                console.log('Recording stopped. Total chunks:', recordedChunks.length);
                saveRecording();
            };

            stream.getVideoTracks()[0].onended = () => {
                stopRecording();
            };

            // Start with timeslice to ensure data is collected
            mediaRecorder.start(1000);
            console.log('Recording started');

            showControlPanel();

            // Notify background script
            chrome.runtime.sendMessage({
                action: 'recordingStarted',
                tabId: chrome.devtools ? chrome.devtools.inspectedWindow.tabId : null,
                enableEffects: enableEffects,
                addTimestamp: addTimestamp
            });

        } catch (err) {
            console.error("Error starting recording:", err);
            alert('Failed to start recording: ' + err.message);
            window.hasRecorderRun = false;
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
        window.hasRecorderRun = false;

        // Notify background script
        chrome.runtime.sendMessage({
            action: 'recordingStopped'
        });
    }

    function saveRecording() {
        console.log('Saving recording with', recordedChunks.length, 'chunks');

        if (recordedChunks.length === 0) {
            console.error('No recorded data to save');
            alert('No recording data available. Please try again.');
            return;
        }

        const blob = new Blob(recordedChunks, {
            type: "video/webm"
        });

        console.log('Blob created:', blob.size, 'bytes');

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        a.href = url;
        a.download = `qa-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        a.click();

        console.log('Download triggered');

        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            recordedChunks = [];
        }, 500);
    }

    function showControlPanel() {
        controlPanel = document.createElement('div');
        controlPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            background: #000;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            gap: 15px;
            transition: all 0.3s ease;
        `;

        const indicator = document.createElement('div');
        indicator.style.cssText = `
            width: 12px;
            height: 12px;
            background: #ff0000;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        `;
        document.head.appendChild(style);

        const status = document.createElement('span');
        status.textContent = 'Recording... (Press ESC to stop)';
        status.style.cssText = 'font-size: 14px; font-weight: 600; transition: opacity 0.3s ease;';

        const stopBtn = document.createElement('button');
        stopBtn.textContent = '⏹ Stop';
        stopBtn.style.cssText = `
            background: #d32f2f;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 13px;
        `;
        stopBtn.onmouseover = () => stopBtn.style.background = '#b71c1c';
        stopBtn.onmouseout = () => stopBtn.style.background = '#d32f2f';
        stopBtn.addEventListener('click', stopRecording);

        controlPanel.appendChild(indicator);
        controlPanel.appendChild(status);
        controlPanel.appendChild(stopBtn);
        document.body.appendChild(controlPanel);

        // Auto-hide status text after 3 seconds
        setTimeout(() => {
            status.style.opacity = '0';
            setTimeout(() => {
                status.style.display = 'none';
                controlPanel.style.padding = '12px 15px';
            }, 300);
        }, 3000);

        // Add keyboard listener for Escape key
        document.addEventListener('keydown', handleKeyPress);
    }

    function handleKeyPress(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            stopRecording();
        }
    }

    function removeControlPanel() {
        if (controlPanel && controlPanel.parentNode) {
            controlPanel.parentNode.removeChild(controlPanel);
            controlPanel = null;
        }
        document.removeEventListener('keydown', handleKeyPress);
    }

    startRecording();
})();

(function () {
    if (window.hasRecorderRun) return;
    window.hasRecorderRun = true;

    let mediaRecorder;
    let recordedChunks = [];
    let stream;
    const enableEffects = window.enableRecorderEffects !== false;
    const addTimestamp = window.recordingAddTimestamp !== false;

    function showToast(msg, isError = false) {
        let toast = document.getElementById('__qa_standard_toast__');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = '__qa_standard_toast__';
            Object.assign(toast.style, {
                position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
                background: '#1a1a2e', color: '#fff', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontFamily: 'system-ui, sans-serif',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)', border: '1px solid #444',
                transition: 'opacity 0.3s', opacity: '0', pointerEvents: 'none'
            });
            document.body.appendChild(toast);
        }
        toast.style.background = isError ? '#cc2222' : '#1a1a2e';
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast.__timeout);
        toast.__timeout = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
    }

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

            // Notify background script
            chrome.runtime.sendMessage({
                action: 'recordingStarted',
                tabId: chrome.devtools ? chrome.devtools.inspectedWindow.tabId : null,
                enableEffects: enableEffects,
                addTimestamp: addTimestamp
            });

        } catch (err) {
            console.error("Error starting recording:", err);
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            showToast('❌ Failed to start recording: ' + err.message, true);
            window.hasRecorderRun = false;

            // Notify background to clear any state (just in case)
            chrome.runtime.sendMessage({ action: 'recordingStopped' });
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
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
            showToast('❌ No recording data available. Please try again.', true);
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

    startRecording();
})();

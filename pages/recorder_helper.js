let mediaRecorder;
let recordedChunks = [];
let stream;
let targetTabId;

// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const enableEffects = urlParams.get('effects') === 'true';
const addTimestamp = urlParams.get('timestamp') === 'true';
targetTabId = parseInt(urlParams.get('tabId'));

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
        mediaRecorder.start(1000); // Collect data every 1 second
        console.log('Recording started');

        // Notify background script that recording started
        chrome.runtime.sendMessage({
            action: 'recordingStarted',
            tabId: targetTabId,
            enableEffects: enableEffects,
            addTimestamp: addTimestamp
        });

    } catch (err) {
        console.error("Error starting recording:", err);
        alert('Failed to start recording: ' + err.message);
        window.close();
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    // Notify background script that recording stopped
    chrome.runtime.sendMessage({
        action: 'recordingStopped',
        tabId: targetTabId
    });
}

function saveRecording() {
    console.log('Saving recording with', recordedChunks.length, 'chunks');

    if (recordedChunks.length === 0) {
        console.error('No recorded data to save');
        alert('No recording data available. Please try again.');
        setTimeout(() => window.close(), 1000);
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
        window.close();
    }, 500);
}

document.getElementById('stopBtn').addEventListener('click', stopRecording);

// Start recording when helper loads
startRecording();

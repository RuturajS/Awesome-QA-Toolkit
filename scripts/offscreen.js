let video = document.getElementById('videoElement');
let canvas = document.getElementById('canvasElement');
let ctx = canvas.getContext('2d');
let currentStream = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startCapture') {
        const streamId = request.streamId;
        // In Manifest V3, offscreen documents get user media via desktop stream ID
        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: streamId
                }
            }
        }).then((stream) => {
            currentStream = stream;
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                sendResponse({ success: true });
            };
        }).catch((err) => {
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep message channel open for async response
    }

    if (request.action === 'takeScreenshot') {
        if (!currentStream) {
            sendResponse({ error: 'No active stream' });
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        sendResponse({ dataUrl: dataUrl });
    }

    if (request.action === 'stopCapture') {
        if (currentStream) {
            currentStream.getTracks().forEach(t => t.stop());
            currentStream = null;
            video.srcObject = null;
        }
        sendResponse({ success: true });
    }
});

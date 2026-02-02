chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "captureVisibleTab") {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl: dataUrl });
            }
        });
        return true;
    }

    if (request.action === 'showUrlExtractor') {
        // Store URL data
        chrome.storage.local.set({
            extractedUrls: {
                urls: request.urls,
                pageUrl: request.pageUrl,
                pageTitle: request.pageTitle
            }
        });
        // We don't open a separate window anymore as it's now shown in the popup
        return true;
    }

    // Recording session management
    if (request.action === 'recordingStarted') {
        const tabId = request.tabId || sender.tab?.id;
        if (!tabId) return;

        activeRecordings[tabId] = {
            enableEffects: request.enableEffects,
            addTimestamp: request.addTimestamp
        };

        // Inject overlay if effects are enabled
        if (request.enableEffects) {
            chrome.scripting.executeScript({
                target: { tabId: tabId, allFrames: true },
                func: (timestamp) => { window.recordingAddTimestamp = timestamp; },
                args: [request.addTimestamp]
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId, allFrames: true },
                    files: ['scripts/content_overlay.js']
                });
            });
        }
    }

    if (request.action === 'recordingStopped') {
        const tabId = request.tabId || sender.tab?.id;
        if (!tabId) return;

        delete activeRecordings[tabId];

        // Remove overlays
        chrome.tabs.sendMessage(tabId, { action: 'stopOverlay' }).catch(() => { });
    }

    if (request.action === 'keywordMatchFound') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon128.png',
            title: 'Keyword Spotted!',
            message: `Found "${request.keyword}" on: ${request.url}`,
            priority: 2
        });

        // Log to storage
        chrome.storage.local.get(['matchLogs'], (res) => {
            const logs = res.matchLogs || [];
            logs.unshift({
                id: 'match_' + Date.now(),
                keyword: request.keyword,
                count: request.count,
                url: request.url,
                timestamp: new Date().toLocaleString()
            });
            chrome.storage.local.set({ matchLogs: logs.slice(0, 100) });
        });
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "take_screenshot") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['scripts/screenshot.js']
                });
            }
        });
    }
});

// Track active recording sessions
let activeRecordings = {};

// Handle navigation - re-inject overlay if recording is active
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && activeRecordings[tabId]) {
        // Re-inject overlay after navigation
        if (activeRecordings[tabId].enableEffects) {
            chrome.scripting.executeScript({
                target: { tabId: tabId, allFrames: true },
                func: (timestamp) => { window.recordingAddTimestamp = timestamp; },
                args: [activeRecordings[tabId].addTimestamp]
            }, () => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId, allFrames: true },
                    files: ['scripts/content_overlay.js']
                }).catch(err => console.log('Could not inject overlay:', err));
            });
        }
    }
});

// Handle alarms (URL Scheduling & Auto Screenshots)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name.startsWith('schedule_')) {
        chrome.storage.local.get(['schedules'], (result) => {
            const schedules = result.schedules || [];
            const schedule = schedules.find(s => s.id === alarm.name);
            if (schedule) {
                chrome.tabs.create({ url: schedule.url });
                const updatedSchedules = schedules.filter(s => s.id !== alarm.name);
                chrome.storage.local.set({ schedules: updatedSchedules });
            }
        });
    }

    if (alarm.name.startsWith('autoShot_') || alarm.name.startsWith('specificShot_')) {
        handleAutoScreenshot(alarm.name);
    }
});

async function handleAutoScreenshot(taskId) {
    chrome.storage.local.get(['autoTasks'], async (res) => {
        let tasks = res.autoTasks || [];
        const taskIdx = tasks.findIndex(t => t.id === taskId);
        if (taskIdx === -1) return;

        const task = tasks[taskIdx];

        // Capture visible tab (current active tab)
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
                const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Failed to capture tab';
                console.error('AutoShot failed:', errorMsg);
                // Store error for UI feedback
                chrome.storage.local.set({ lastAutoError: errorMsg });
            } else {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]; // Cleaner timestamp
                const filename = `${task.folder}/shot-${timestamp}.png`;

                chrome.downloads.download({
                    url: dataUrl,
                    filename: filename,
                    conflictAction: 'uniquify',
                    saveAs: false
                }, (downloadId) => {
                    if (downloadId) {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: '/icons/icon128.png',
                            title: 'Screenshot Captured',
                            message: `Saved to: /${filename}`,
                            priority: 0
                        });
                    }
                });
            }

            if (task.type === 'interval') {
                task.remainingCount--;
                if (task.remainingCount > 0) {
                    // Schedule next shot
                    chrome.alarms.create(task.id, { when: Date.now() + (task.interval * 1000) });
                } else {
                    tasks.splice(taskIdx, 1);
                }
            } else {
                tasks.splice(taskIdx, 1);
            }
            chrome.storage.local.set({ autoTasks: tasks });
        });
    });
}


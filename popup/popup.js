document.addEventListener('DOMContentLoaded', () => {

    // ─── Global status bar (replaces all alerts) ─────────────────────────────────
    let _statusTimer = null;
    function showStatus(msg, isError = false) {
        let bar = document.getElementById('__statusBar__');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = '__statusBar__';
            Object.assign(bar.style, {
                position: 'fixed', bottom: '0', left: '0', right: '0', zIndex: '99999',
                padding: '7px 14px', fontSize: '12px', fontWeight: '600',
                transition: 'opacity 0.3s', opacity: '0', textAlign: 'center',
                pointerEvents: 'none', fontFamily: 'system-ui, sans-serif'
            });
            document.body.appendChild(bar);
        }
        bar.textContent = msg;
        bar.style.background = isError ? '#cc2222' : '#16a34a';
        bar.style.color = '#fff';
        bar.style.opacity = '1';
        clearTimeout(_statusTimer);
        _statusTimer = setTimeout(() => { bar.style.opacity = '0'; }, 2800);
    }

    const mainView = document.getElementById('mainView');
    const schedulerView = document.getElementById('schedulerView');
    const extractorView = document.getElementById('extractorView');
    const autoScreenshotView = document.getElementById('autoScreenshotView');
    const keywordSpotterView = document.getElementById('keywordSpotterView');

    const scanBtn = document.getElementById('scanBtn');
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const resultsTableBody = document.querySelector('#resultsTable tbody');
    const issueCountSpan = document.getElementById('issueCount');

    // Export buttons
    const exportJsonBtn = document.getElementById('exportJson');
    const exportCsvBtn = document.getElementById('exportCsv');
    const exportTxtBtn = document.getElementById('exportTxt');
    const exportXlsxBtn = document.getElementById('exportXlsx');

    let currentResults = [];

    // --- UI Scaling Logic ---
    function toggleExpansion(isExpanded) {
        if (isExpanded) {
            document.body.classList.add('expanded');
        } else {
            document.body.classList.remove('expanded');
        }
    }

    // --- View Switching Logic ---
    function switchView(viewId) {
        mainView.classList.add('hidden');
        schedulerView.classList.add('hidden');
        extractorView.classList.add('hidden');
        autoScreenshotView.classList.add('hidden');
        keywordSpotterView.classList.add('hidden');
        document.getElementById('noteTaggerView').classList.add('hidden');
        document.getElementById('cookieManagerView').classList.add('hidden');
        document.getElementById('formFillerView').classList.add('hidden');
        document.getElementById('consoleCollectorView').classList.add('hidden');
        document.getElementById('bulkUrlOpenerView').classList.add('hidden');

        document.getElementById(viewId).classList.remove('hidden');

        // Dynamic expansion based on view
        if (viewId === 'mainView') {
            toggleExpansion(currentResults.length > 0);
        } else {
            toggleExpansion(true);
        }
    }

    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.target));
    });

    // --- Settings Persistence ---
    const settingsKeys = ['screenshotTimestamp', 'annotateRecord', 'recordingTimestamp'];

    chrome.storage.sync.get(settingsKeys, (result) => {
        settingsKeys.forEach(key => {
            const checkbox = document.getElementById(key);
            if (checkbox && result[key] !== undefined) {
                checkbox.checked = result[key];
            }
        });
    });

    settingsKeys.forEach(key => {
        const checkbox = document.getElementById(key);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                chrome.storage.sync.set({ [key]: checkbox.checked });
            });
        }
    });

    // --- Tool Handlers ---

    // 1. Full Page (Scrolling - No Prompt)
    if (document.getElementById('fullPageBtn')) {
        document.getElementById('fullPageBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const addTimestamp = document.getElementById('screenshotTimestamp').checked;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (timestamp) => { window.screenshotAddTimestamp = timestamp; },
                    args: [addTimestamp]
                }, () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/full_page_screenshot.js']
                    });
                });
                window.close();
            }
        });
    }

    // 2. Visible Area (One Click - No Prompt)
    if (document.getElementById('visibleBtn')) {
        document.getElementById('visibleBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const addTimestamp = document.getElementById('screenshotTimestamp').checked;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (timestamp) => { window.screenshotAddTimestamp = timestamp; },
                    args: [addTimestamp]
                }, () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/visible_screenshot.js']
                    });
                });
                window.close();
            }
        });
    }

    // 3. Selection (Always Drappable Box)
    if (document.getElementById('screenshotBtn')) {
        document.getElementById('screenshotBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const addTimestamp = document.getElementById('screenshotTimestamp').checked;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (timestamp) => { window.screenshotAddTimestamp = timestamp; },
                    args: [addTimestamp]
                }, () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/screenshot.js']
                    });
                });
                window.close();
            }
        });
    }

    // 4. Desktop (Entire OS - Prompts)
    if (document.getElementById('desktopBtn')) {
        document.getElementById('desktopBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                const addTimestamp = document.getElementById('screenshotTimestamp').checked;
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (timestamp) => { window.screenshotAddTimestamp = timestamp; },
                    args: [addTimestamp]
                }, () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/whole_screen_screenshot.js']
                    });
                });
                window.close();
            }
        });
    }

    if (document.getElementById('recordBtn')) {
        document.getElementById('recordBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const enableEffects = document.getElementById('annotateRecord').checked;
            const addTimestamp = document.getElementById('recordingTimestamp').checked;

            // Start the actual recording script on the active tab
            if (tab) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (effects, timestamp) => {
                        window.enableRecorderEffects = effects;
                        window.recordingAddTimestamp = timestamp;
                    },
                    args: [enableEffects, addTimestamp]
                }, () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['scripts/recorder_inline.js']
                    });
                });

                window.close();
            }
        });
    }

    if (document.getElementById('measureBtn')) {
        document.getElementById('measureBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['scripts/measure.js']
                });
                window.close();
            }
        });
    }

    if (document.getElementById('schedulerBtn')) {
        document.getElementById('schedulerBtn').addEventListener('click', () => {
            switchView('schedulerView');
            loadSchedules();
        });
    }

    if (document.getElementById('extractUrlsBtn')) {
        document.getElementById('extractUrlsBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                switchView('extractorView');
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['scripts/url_extractor.js']
                });
            }
        });
    }

    if (document.getElementById('autoScreenshotBtn')) {
        document.getElementById('autoScreenshotBtn').addEventListener('click', () => {
            switchView('autoScreenshotView');
            loadAutoTasks();
        });
    }

    if (document.getElementById('keywordSpotterBtn')) {
        document.getElementById('keywordSpotterBtn').addEventListener('click', () => {
            switchView('keywordSpotterView');
            loadMatchLogs();
        });
    }

    if (document.getElementById('cookieManagerBtn')) {
        document.getElementById('cookieManagerBtn').addEventListener('click', () => {
            switchView('cookieManagerView');
        });
    }

    if (document.getElementById('formFillerBtn')) {
        document.getElementById('formFillerBtn').addEventListener('click', () => {
            switchView('formFillerView');
            ffLoadProfiles();
        });
    }

    // --- Page Scanner ---
    scanBtn.addEventListener('click', async () => {
        resultsContainer.classList.add('hidden');
        errorDiv.classList.add('hidden');
        searchInput.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        resultsTableBody.innerHTML = '';
        currentResults = [];
        searchInput.value = '';
        toggleExpansion(false); // Shrink during loading

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error("No active tab found.");
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/scanner.js'] });
            chrome.tabs.sendMessage(tab.id, { action: "scan" }, (response) => {
                loadingDiv.classList.add('hidden');
                if (chrome.runtime.lastError) {
                    showError(chrome.runtime.lastError.message);
                    return;
                }
                if (response && response.error) {
                    showError(response.error);
                    return;
                }
                if (response && response.results) {
                    currentResults = response.results;
                    renderTable(response.results);
                    searchInput.classList.remove('hidden');
                    resultsContainer.classList.remove('hidden');
                    toggleExpansion(true); // Expand to show results
                } else {
                    showError("No results returned from scanner.");
                }
            });
        } catch (err) {
            loadingDiv.classList.add('hidden');
            showError(err.message);
        }
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = currentResults.filter(item =>
            item.type.toLowerCase().includes(query) ||
            item.details.toLowerCase().includes(query) ||
            item.recommendation.toLowerCase().includes(query)
        );
        renderTable(filtered);
    });

    function renderTable(results) {
        resultsTableBody.innerHTML = '';
        issueCountSpan.textContent = `${results.length} issues found`;
        if (results.length === 0) {
            resultsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No matching issues found.</td></tr>`;
        } else {
            results.forEach((issue) => {
                const row = document.createElement('tr');
                row.className = 'clickable-row';
                let severityClass = issue.severity === 'High' ? 'severity-high' : (issue.severity === 'Medium' ? 'severity-medium' : 'severity-low');
                row.innerHTML = `
                    <td>${issue.type}</td>
                    <td class="url-cell">${escapeHtml(issue.details)}</td>
                    <td class="${severityClass}">${issue.severity}</td>
                    <td>${escapeHtml(issue.recommendation)}</td>
                `;
                const detailRow = document.createElement('tr');
                detailRow.className = 'detail-row hidden';
                detailRow.innerHTML = `
                    <td colspan="4">
                        <div class="detail-content">
                            <div class="detail-grid">
                                <span class="label">Actual:</span><span>${escapeHtml(issue.actual || 'N/A')}</span>
                                <span class="label">Expected:</span><span>${escapeHtml(issue.expected || 'N/A')}</span>
                                <span class="label">Details:</span><span>${escapeHtml(issue.details)}</span>
                            </div>
                        </div>
                    </td>
                `;
                row.addEventListener('click', () => detailRow.classList.toggle('hidden'));
                resultsTableBody.appendChild(row);
                resultsTableBody.appendChild(detailRow);
            });
        }
    }

    // --- Scheduler Logic ---
    let schedules = [];

    document.getElementById('singleMode').addEventListener('click', () => {
        document.getElementById('singleMode').classList.add('active');
        document.getElementById('bulkMode').classList.remove('active');
        document.getElementById('singleForm').classList.remove('hidden');
        document.getElementById('bulkForm').classList.add('hidden');
    });

    document.getElementById('bulkMode').addEventListener('click', () => {
        document.getElementById('bulkMode').classList.add('active');
        document.getElementById('singleMode').classList.remove('active');
        document.getElementById('bulkForm').classList.remove('hidden');
        document.getElementById('singleForm').classList.add('hidden');
    });

    function isValidUrl(string) {
        try {
            // Check if it's already a full URL
            new URL(string);
            return true;
        } catch (_) {
            // If not, check if adding https:// makes it a valid URL (for domain-only inputs)
            try {
                if (string.includes('.') && !string.includes(' ')) {
                    new URL('https://' + string);
                    return true;
                }
            } catch (__) { }
            return false;
        }
    }

    function formatUrl(string) {
        try {
            new URL(string);
            return string;
        } catch (_) {
            return 'https://' + string;
        }
    }

    document.getElementById('addSingle').addEventListener('click', () => {
        let url = document.getElementById('singleUrl').value.trim();
        const dateTime = document.getElementById('singleDateTime').value;
        const mins = parseInt(document.getElementById('singleMinutes').value) || 0;
        const hrs = parseInt(document.getElementById('singleHours').value) || 0;
        const days = parseInt(document.getElementById('singleDays').value) || 0;

        if (!url) { showStatus('Enter a URL or domain', true); return; }
        if (!isValidUrl(url)) { showStatus('Please enter a valid URL or domain (e.g., google.com or https://...)', true); return; }
        url = formatUrl(url);

        if (!dateTime && !mins && !hrs && !days) { showStatus('Set a Time or Delay', true); return; }
        let schedTime = (mins || hrs || days) ? Date.now() + (mins * 60 + hrs * 3600 + days * 86400) * 1000 : new Date(dateTime).getTime();
        if (schedTime <= Date.now()) { showStatus('Time must be in future', true); return; }

        createSchedule(url, schedTime);
        document.getElementById('singleUrl').value = '';
    });

    document.getElementById('addBulk').addEventListener('click', () => {
        const rawUrls = document.getElementById('bulkUrls').value.split('\n').map(u => u.trim()).filter(u => u);
        const dateTime = document.getElementById('bulkDateTime').value;
        const mins = parseInt(document.getElementById('bulkMinutes').value) || 0;
        const hrs = parseInt(document.getElementById('bulkHours').value) || 0;
        const days = parseInt(document.getElementById('bulkDays').value) || 0;

        if (!rawUrls.length) { showStatus('Enter URLs (one per line)', true); return; }

        const validUrls = rawUrls.filter(u => isValidUrl(u)).map(u => formatUrl(u));
        if (validUrls.length === 0) { showStatus('No valid URLs or domains found. Please check your list.', true); return; }

        if (!dateTime && !mins && !hrs && !days) { showStatus('Set a Time or Delay', true); return; }
        let schedTime = (mins || hrs || days) ? Date.now() + (mins * 60 + hrs * 3600 + days * 86400) * 1000 : new Date(dateTime).getTime();

        validUrls.forEach(u => createSchedule(u, schedTime));
        document.getElementById('bulkUrls').value = '';

        if (validUrls.length < rawUrls.length) {
            showStatus(`Added ${validUrls.length} schedules. ${rawUrls.length - validUrls.length} entries were skipped due to invalid format.`);
        }
    });

    function createSchedule(url, time) {
        const id = 'schedule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const schedule = { id, url, scheduledTime: time };
        schedules.push(schedule);
        chrome.storage.local.set({ schedules });
        chrome.alarms.create(id, { when: time });
        renderSchedules();
    }

    function loadSchedules() {
        chrome.storage.local.get(['schedules'], (res) => {
            const now = Date.now();
            schedules = (res.schedules || []).filter(s => s.scheduledTime > now);
            chrome.storage.local.set({ schedules });
            renderSchedules();
        });
    }

    function renderSchedules() {
        const container = document.getElementById('scheduleContainer');
        document.getElementById('scheduleCount').textContent = schedules.length;
        if (!schedules.length) {
            container.innerHTML = '<div class="empty-state">No active schedules</div>';
            return;
        }
        schedules.sort((a, b) => a.scheduledTime - b.scheduledTime);
        container.innerHTML = schedules.map(s => `
            <div class="schedule-item">
                <div class="url">${escapeHtml(s.url)}</div>
                <div class="time">${new Date(s.scheduledTime).toLocaleString()}</div>
                <button class="delete-schedule" data-id="${s.id}">Delete</button>
            </div>
        `).join('');
        container.querySelectorAll('.delete-schedule').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                schedules = schedules.filter(s => s.id !== id);
                chrome.storage.local.set({ schedules });
                chrome.alarms.clear(id);
                renderSchedules();
            });
        });
    }

    // --- Extractor Logic ---
    let extractedData = null;
    let extractorFilter = 'all';

    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === 'showUrlExtractor') {
            extractedData = { urls: req.urls, pageUrl: req.pageUrl, pageTitle: req.pageTitle };
            chrome.storage.local.set({ extractedUrls: extractedData });
            renderExtractedUrls();
        }
    });

    document.querySelectorAll('#extractorView .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#extractorView .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            extractorFilter = btn.dataset.filter;
            renderExtractedUrls();
        });
    });

    function renderExtractedUrls() {
        if (!extractedData) return;
        document.getElementById('extractedPageTitle').textContent = extractedData.pageTitle;
        document.getElementById('extractedPageUrl').textContent = extractedData.pageUrl;
        const urls = extractedData.urls[extractorFilter] || [];
        document.getElementById('totalCount').textContent = extractedData.urls.all.length;
        document.getElementById('showingCount').textContent = urls.length;
        const container = document.getElementById('extractedUrlList');
        if (!urls.length) {
            container.innerHTML = '<div class="empty-state">No URLs found</div>';
        } else {
            container.innerHTML = urls.map(u => `<div class="url-item">${escapeHtml(u)}</div>`).join('');
        }
    }

    // Export Extracted
    document.getElementById('extractExportTxt').addEventListener('click', () => downloadFile((extractedData.urls[extractorFilter] || []).join('\n'), 'urls.txt', 'text/plain'));
    document.getElementById('extractExportJson').addEventListener('click', () => downloadFile(JSON.stringify(extractedData, null, 2), 'urls.json', 'application/json'));
    document.getElementById('extractExportCsv').addEventListener('click', () => {
        const urls = extractedData.urls[extractorFilter] || [];
        const csv = 'URL\n' + urls.map(u => `"${u.replace(/"/g, '""')}"`).join('\n');
        downloadFile(csv, 'urls.csv', 'text/csv');
    });
    document.getElementById('extractExportCopy').addEventListener('click', () => {
        navigator.clipboard.writeText((extractedData.urls[extractorFilter] || []).join('\n'));
        const btn = document.getElementById('extractExportCopy');
        const oldText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = oldText, 2000);
    });

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // Load initial extracted data if exists
    chrome.storage.local.get(['extractedUrls'], (res) => {
        if (res.extractedUrls) {
            extractedData = res.extractedUrls;
            renderExtractedUrls();
        }
    });

    // Helper functions
    function showError(msg) { errorDiv.textContent = `Error: ${msg}`; errorDiv.classList.remove('hidden'); }
    function escapeHtml(text) { return text ? String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : ''; }

    // Export page scan results
    exportJsonBtn.addEventListener('click', () => Exporter.downloadJson(currentResults));
    exportCsvBtn.addEventListener('click', () => Exporter.downloadCsv(currentResults));
    exportTxtBtn.addEventListener('click', () => Exporter.downloadTxt(currentResults));
    exportXlsxBtn.addEventListener('click', () => Exporter.downloadXlsx(currentResults));

    // --- Auto Screenshot Logic ---
    let autoTasks = [];

    const openSettingsLink = document.getElementById('openDownloadSettings');
    if (openSettingsLink) {
        openSettingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'chrome://settings/downloads' });
        });
    }

    document.getElementById('intervalMode').addEventListener('click', () => {
        document.getElementById('intervalMode').classList.add('active');
        document.getElementById('specificMode').classList.remove('active');
        document.getElementById('intervalForm').classList.remove('hidden');
        document.getElementById('specificForm').classList.add('hidden');
    });

    document.getElementById('specificMode').addEventListener('click', () => {
        document.getElementById('specificMode').classList.add('active');
        document.getElementById('intervalMode').classList.remove('active');
        document.getElementById('specificForm').classList.remove('hidden');
        document.getElementById('intervalForm').classList.add('hidden');
    });

    document.getElementById('startAutoShot').addEventListener('click', async () => {
        const interval = parseInt(document.getElementById('shotInterval').value);
        const count = parseInt(document.getElementById('shotCount').value);
        const folder = document.getElementById('autoShotFolder').value.trim() || 'QA-Screenshots';
        const isFullScreen = document.getElementById('fullScreenCapture').checked;
        const isFullPage = document.getElementById('fullPageCapture').checked;
        const isVisible = document.getElementById('visibleCapture').checked;

        if (isNaN(interval) || interval < 5) { showStatus('Interval must be at least 5 seconds', true); return; }
        if (isNaN(count) || count < 1) { showStatus('Count must be at least 1', true); return; }

        // Feature: Reminder for "Ask where to save" setting
        if (!confirm('Note: Ensure "Ask where to save each file before downloading" is OFF in Chrome settings for silent capture. Continue?')) return;

        if (isFullScreen) {
            chrome.desktopCapture.chooseDesktopMedia(['screen'], async (streamId) => {
                if (!streamId) {
                    showStatus('Permission to capture screen was denied.');
                    return;
                }
                startAutoShotTask(interval, count, folder, true, false, false, streamId);
            });
        } else {
            startAutoShotTask(interval, count, folder, false, isFullPage, isVisible, null);
        }
    });

    async function startAutoShotTask(interval, count, folder, isFullScreen, isFullPage, isVisible, streamId) {
        let tab = null;
        if (!isFullScreen) {
            [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) { showStatus('No active tab found', true); return; }
        }

        const taskId = 'autoShot_' + Date.now();
        const firstShotTime = Date.now() + 1000; // Start almost immediately

        const task = {
            id: taskId,
            type: 'interval',
            interval: interval,
            totalCount: count,
            remainingCount: count,
            folder: folder,
            tabId: tab ? tab.id : null,
            tabUrl: tab ? tab.url : 'Full Desktop Screen',
            isFullScreen: isFullScreen,
            isFullPage: isFullPage,
            isVisible: isVisible,
            streamId: streamId,
            startTime: Date.now()
        };

        autoTasks.push(task);
        chrome.storage.local.set({ autoTasks });

        // Create the alarm for the first shot
        chrome.alarms.create(taskId, { when: firstShotTime });
        renderAutoTasks();
        showStatus(`Started interval capture: ${count} shots, every ${interval}s`);
    }

    document.getElementById('addSpecificShot').addEventListener('click', async () => {
        const timeInput = document.getElementById('specificShotTime').value;
        const folder = document.getElementById('autoShotFolder').value.trim() || 'QA-Screenshots';

        if (!timeInput) { showStatus('Please select a time', true); return; }
        const schedTime = new Date(timeInput).getTime();
        if (schedTime <= Date.now()) { showStatus('Time must be in the future', true); return; }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { showStatus('No active tab found', true); return; }

        const taskId = 'specificShot_' + Date.now();
        const task = {
            id: taskId,
            type: 'specific',
            scheduledTime: schedTime,
            folder: folder,
            tabId: tab.id,
            tabUrl: tab.url
        };

        autoTasks.push(task);
        chrome.storage.local.set({ autoTasks });
        chrome.alarms.create(taskId, { when: schedTime });
        renderAutoTasks();
        showStatus('Scheduled screenshot for ' + new Date(schedTime).toLocaleString());
    });

    function loadAutoTasks() {
        chrome.storage.local.get(['autoTasks'], (res) => {
            autoTasks = res.autoTasks || [];
            renderAutoTasks();
        });
    }

    function renderAutoTasks() {
        const container = document.getElementById('autoShotContainer');
        const countSpan = document.getElementById('autoShotCount');
        countSpan.textContent = autoTasks.length;

        if (!autoTasks.length) {
            container.innerHTML = '<div class="empty-state">No active capture tasks</div>';
            return;
        }

        container.innerHTML = autoTasks.map(t => `
            <div class="schedule-item">
                <div class="url"><b>${t.type === 'interval' ? 'Interval' : 'Scheduled'}</b>: ${t.tabUrl}</div>
                <div class="time">
                    ${t.type === 'interval' ?
                `Remaining: ${t.remainingCount}/${t.totalCount} (Every ${t.interval}s)` :
                `At: ${new Date(t.scheduledTime).toLocaleString()}`}
                </div>
                <button class="delete-schedule" data-id="${t.id}">Cancel</button>
            </div>
        `).join('');

        container.querySelectorAll('.delete-schedule').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                autoTasks = autoTasks.filter(t => t.id !== id);
                chrome.storage.local.set({ autoTasks });
                chrome.alarms.clear(id);
                renderAutoTasks();
            });
        });
    }

    // --- Keyword Spotter Logic ---
    let matchLogs = [];
    let trackedKeywords = [];

    // Mode Toggle
    document.getElementById('findMode').addEventListener('click', () => {
        document.getElementById('findMode').classList.add('active');
        document.getElementById('watchMode').classList.remove('active');
        document.getElementById('findOnceControls').classList.remove('hidden');
        document.getElementById('watchControls').classList.add('hidden');
        document.getElementById('featureInfoText').innerHTML = '<b>Find Once:</b> Search the current page staticly and highlight matches in yellow.';
    });

    document.getElementById('watchMode').addEventListener('click', () => {
        document.getElementById('watchMode').classList.add('active');
        document.getElementById('findMode').classList.remove('active');
        document.getElementById('watchControls').classList.remove('hidden');
        document.getElementById('findOnceControls').classList.add('hidden');
        document.getElementById('featureInfoText').innerHTML = '<b>Watch & Notify:</b> Save this keyword. The extension will <b>automatically notify you</b> whenever it appears on any page you visit.';
    });

    // Find Once
    document.getElementById('findKeywordBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('keywordInput').value.trim();
        const useRegex = document.getElementById('useRegex').checked;
        if (!keyword) { showStatus('Please enter a keyword', true); return; }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/keyword_spotter.js'] });
            chrome.tabs.sendMessage(tab.id, { action: 'findKeyword', keyword, useRegex }, (response) => {
                if (chrome.runtime.lastError) { showStatus('Error: ' + chrome.runtime.lastError.message, true); return; }
                if (response?.error) { showStatus('Error: ' + response.error, true); return; }
                if (response?.count > 0) {
                    saveMatchLog(keyword, response.count, response.url);
                    showStatus(`Found ${response.count} matches! These are now highlighted in yellow.`);
                } else {
                    showStatus('No matches found on this page.');
                }
            });
        } catch (err) { showStatus('Failed: ' + err.message); }
    });

    // Watch Mode
    document.getElementById('startWatchKeywordBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('keywordInput').value.trim();
        if (!keyword) { showStatus('Please enter a keyword to watch', true); return; }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Save to tracked list
        if (trackedKeywords.find(k => k.keyword === keyword)) { showStatus('Already watching this keyword', true); return; }

        trackedKeywords.push({ id: 'track_' + Date.now(), keyword });
        chrome.storage.local.set({ trackedKeywords });
        renderTrackedKeywords();

        // Start watching immediately on current tab
        if (tab) {
            try {
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/keyword_spotter.js'] });
                chrome.tabs.sendMessage(tab.id, { action: 'startWatching', keywords: trackedKeywords });
            } catch (e) { }
        }

        showStatus(`Now watching for "${keyword}". You will get a notification when it appears!`);
        document.getElementById('keywordInput').value = '';
    });

    function saveMatchLog(keyword, count, url) {
        const log = { id: 'match_' + Date.now(), keyword, count, url, timestamp: new Date().toLocaleString() };
        matchLogs.unshift(log);
        chrome.storage.local.set({ matchLogs: matchLogs.slice(0, 100) });
        renderMatchLogs();
    }

    function loadKeywordSpotterData() {
        chrome.storage.local.get(['matchLogs', 'trackedKeywords'], (res) => {
            matchLogs = res.matchLogs || [];
            trackedKeywords = res.trackedKeywords || [];
            renderMatchLogs();
            renderTrackedKeywords();
        });
    }

    function renderMatchLogs() {
        const container = document.getElementById('matchLogContainer');
        document.getElementById('matchLogCount').textContent = matchLogs.length;
        if (!matchLogs.length) {
            container.innerHTML = '<div class="empty-state">No matches found yet</div>';
            return;
        }
        container.innerHTML = matchLogs.map(log => `
            <div class="url-item" style="font-size: 11px; padding: 10px; border-bottom: 1px solid var(--border);">
                <div style="font-weight: bold; margin-bottom: 4px;">"${escapeHtml(log.keyword)}" → ${log.count} matches</div>
                <div style="color: var(--text-muted); font-size: 10px; word-break: break-all;">${escapeHtml(log.url)}</div>
                <div style="color: var(--text-muted); font-size: 9px; margin-top: 4px;">${log.timestamp}</div>
            </div>
        `).join('');
    }

    function renderTrackedKeywords() {
        const container = document.getElementById('trackedContainer');
        const section = document.getElementById('trackedKeywordsSection');
        document.getElementById('trackedCount').textContent = trackedKeywords.length;

        if (!trackedKeywords.length) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        container.innerHTML = trackedKeywords.map(kw => `
            <div class="url-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px;">
                <span style="font-weight: 600;">${escapeHtml(kw.keyword)}</span>
                <button class="delete-track" data-id="${kw.id}" style="border:none; background:transparent; color:#ff4444; cursor:pointer; font-weight:bold;">×</button>
            </div>
        `).join('');

        container.querySelectorAll('.delete-track').forEach(btn => {
            btn.addEventListener('click', () => {
                trackedKeywords = trackedKeywords.filter(k => k.id !== btn.dataset.id);
                chrome.storage.local.set({ trackedKeywords });
                renderTrackedKeywords();
            });
        });
    }

    document.getElementById('clearMatchLogs').addEventListener('click', () => {
        if (confirm('Clear all logs?')) {
            matchLogs = [];
            chrome.storage.local.set({ matchLogs: [] });
            renderMatchLogs();
        }
    });

    document.getElementById('exportMatchLogs').addEventListener('click', () => {
        if (!matchLogs.length) return;
        const blob = new Blob([JSON.stringify(matchLogs, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `keyword_matches_${Date.now()}.json`;
        a.click();
    });

    // --- Note Tagger Logic ---
    // --- Note Tagger Logic ---
    let isTaggingActive = false;
    let pageNotes = [];

    if (document.getElementById('noteTaggerBtn')) {
        document.getElementById('noteTaggerBtn').addEventListener('click', () => {
            switchView('noteTaggerView');
            loadNotesForCurrentPage();
        });
    }

    const toggleTaggingBtn = document.getElementById('toggleTaggingBtn');
    if (toggleTaggingBtn) {
        toggleTaggingBtn.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;

            isTaggingActive = !isTaggingActive;
            updateTaggingUI();

            try {
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/note_tagger.js'] });
                chrome.tabs.sendMessage(tab.id, { action: 'toggleTagging', state: isTaggingActive });
            } catch (e) { console.log('Tagging toggle failed:', e); }
        });
    }

    function updateTaggingUI() {
        if (isTaggingActive) {
            toggleTaggingBtn.textContent = 'Stop Tagging Mode';
            toggleTaggingBtn.style.background = '#ff4444';
        } else {
            toggleTaggingBtn.textContent = 'Start Tagging Mode';
            toggleTaggingBtn.style.background = 'black';
        }
    }

    const visibilityCheckbox = document.getElementById('toggleNotesVisibility');
    if (visibilityCheckbox) {
        // Load preference
        chrome.storage.local.get(['notesVisible'], (res) => {
            visibilityCheckbox.checked = res.notesVisible !== false;
        });

        visibilityCheckbox.addEventListener('change', async () => {
            const visible = visibilityCheckbox.checked;
            chrome.storage.local.set({ notesVisible: visible });

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.tabs.sendMessage(tab.id, { action: 'toggleNoteVisibility', visible }).catch(() => { });
            }
        });
    }

    async function loadNotesForCurrentPage() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        const key = new URL(tab.url).origin + new URL(tab.url).pathname;
        chrome.storage.local.get(['allNotes'], (res) => {
            const allNotes = res.allNotes || {};
            pageNotes = allNotes[key] || [];
            renderPageNotes();
        });
    }

    function renderPageNotes() {
        const container = document.getElementById('pageNotesContainer');
        document.getElementById('pageNoteCount').textContent = pageNotes.length;

        if (!pageNotes.length) {
            container.innerHTML = '<div class="empty-state">No notes on this page</div>';
            return;
        }

        container.innerHTML = pageNotes.map((note, index) => `
            <div class="url-item" style="padding:10px; border-bottom:1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="font-weight:bold; color:var(--primary); font-size:12px;">${escapeHtml(note.title)}</div>
                    <button class="delete-note" data-index="${index}" style="border:none; background:transparent; color:#ff4444; font-weight:bold; cursor:pointer; padding:0 4px;">×</button>
                </div>
                <div style="font-size:11px; margin-top:4px; line-height:1.4;">${escapeHtml(note.message)}</div>
            </div>
        `).join('');

        container.querySelectorAll('.delete-note').forEach(btn => {
            btn.addEventListener('click', async () => {
                const index = parseInt(btn.dataset.index);
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;
                const key = new URL(tab.url).origin + new URL(tab.url).pathname;

                chrome.storage.local.get(['allNotes'], (res) => {
                    const allNotes = res.allNotes || {};
                    if (allNotes[key]) {
                        allNotes[key].splice(index, 1);
                        chrome.storage.local.set({ allNotes }, () => {
                            loadNotesForCurrentPage();
                            chrome.tabs.sendMessage(tab.id, { action: 'refreshNotes' }).catch(() => { });
                        });
                    }
                });
            });
        });
    }

    // Listen for updates from content script
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'notesUpdated') {
            loadNotesForCurrentPage();
        } else if (request.action === 'taggingCanceled') {
            isTaggingActive = false;
            updateTaggingUI();
        }
    });

    if (document.getElementById('keywordSpotterBtn')) {
        document.getElementById('keywordSpotterBtn').addEventListener('click', () => {
            switchView('keywordSpotterView');
            loadKeywordSpotterData();
        });
    }

    // --- Cookie Manager Logic ---
    function downloadJson(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Cookie mode toggle
    document.getElementById('cookieModeBtn').addEventListener('click', () => {
        document.getElementById('cookieModeBtn').classList.add('active');
        document.getElementById('storageModeBtn').classList.remove('active');
        document.getElementById('cookieSection').classList.remove('hidden');
        document.getElementById('storageSection').classList.add('hidden');
    });

    document.getElementById('storageModeBtn').addEventListener('click', () => {
        document.getElementById('storageModeBtn').classList.add('active');
        document.getElementById('cookieModeBtn').classList.remove('active');
        document.getElementById('storageSection').classList.remove('hidden');
        document.getElementById('cookieSection').classList.add('hidden');
    });

    // --- Export Cookies ---
    document.getElementById('exportCookiesBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) { showStatus('No active tab found.', true); return; }
        const url = new URL(tab.url);
        chrome.cookies.getAll({ domain: url.hostname }, (cookies) => {
            if (chrome.runtime.lastError) {
                showStatus('Error: ' + chrome.runtime.lastError.message);
                return;
            }
            downloadJson(cookies, `cookies-${url.hostname}-${Date.now()}.json`);
        });
    });

    // --- Import Cookies (show textarea) ---
    document.getElementById('importCookiesBtn').addEventListener('click', async () => {
        const section = document.getElementById('cookieImportSection');
        const textarea = document.getElementById('cookieInputData');
        if (section.classList.contains('hidden')) {
            // Pre-populate with current cookies for easy editing
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url) {
                const url = new URL(tab.url);
                chrome.cookies.getAll({ domain: url.hostname }, (cookies) => {
                    textarea.value = JSON.stringify(cookies, null, 2);
                    section.classList.remove('hidden');
                });
            } else {
                section.classList.remove('hidden');
            }
        } else {
            section.classList.add('hidden');
        }
    });

    // --- Save (Import) Cookies ---
    document.getElementById('saveCookiesBtn').addEventListener('click', async () => {
        const raw = document.getElementById('cookieInputData').value.trim();
        if (!raw) { showStatus('Please paste cookie JSON first.', true); return; }
        let cookies;
        try {
            cookies = JSON.parse(raw);
            if (!Array.isArray(cookies)) throw new Error('Must be an array.');
        } catch (e) {
            { showStatus('Invalid JSON: ' + e.message, true); return; }
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url) { showStatus('No active tab.', true); return; }
        const tabUrl = new URL(tab.url);
        let successCount = 0;
        let failCount = 0;

        const setNext = (i) => {
            if (i >= cookies.length) {
                showStatus(`Done! Set ${successCount} cookies, ${failCount} failed.`);
                return;
            }
            const c = cookies[i];
            // Build the cookie details — strip read-only fields
            const details = {
                url: `${tabUrl.protocol}//${c.domain || tabUrl.hostname}${c.path || '/'}`,
                name: c.name,
                value: c.value || '',
                path: c.path || '/',
                secure: c.secure || false,
                httpOnly: c.httpOnly || false,
                sameSite: c.sameSite || 'unspecified',
            };
            if (c.expirationDate) details.expirationDate = c.expirationDate;
            if (c.domain) details.domain = c.domain;
            chrome.cookies.set(details, (result) => {
                if (chrome.runtime.lastError || !result) failCount++;
                else successCount++;
                setNext(i + 1);
            });
        };
        setNext(0);
    });

    // --- Export Local Storage ---
    document.getElementById('exportStorageBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { showStatus('No active tab.', true); return; }
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    data[key] = localStorage.getItem(key);
                }
                return data;
            }
        }, (results) => {
            if (chrome.runtime.lastError) { showStatus('Error: ' + chrome.runtime.lastError.message, true); return; }
            const data = results[0].result;
            const hostname = new URL(tab.url).hostname;
            downloadJson(data, `localstorage-${hostname}-${Date.now()}.json`);
        });
    });

    // --- Import Local Storage (show textarea) ---
    document.getElementById('importStorageBtn').addEventListener('click', async () => {
        const section = document.getElementById('storageImportSection');
        const textarea = document.getElementById('storageInputData');
        if (section.classList.contains('hidden')) {
            // Pre-populate with current localStorage for easy editing
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        const data = {};
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            data[key] = localStorage.getItem(key);
                        }
                        return data;
                    }
                }, (results) => {
                    if (!chrome.runtime.lastError && results[0]) {
                        textarea.value = JSON.stringify(results[0].result, null, 2);
                    }
                    section.classList.remove('hidden');
                });
            } else {
                section.classList.remove('hidden');
            }
        } else {
            section.classList.add('hidden');
        }
    });

    // --- Save (Import) Local Storage ---
    document.getElementById('saveStorageBtn').addEventListener('click', async () => {
        const raw = document.getElementById('storageInputData').value.trim();
        if (!raw) { showStatus('Please paste localStorage JSON first.', true); return; }
        let data;
        try {
            data = JSON.parse(raw);
            if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Must be a plain object {key: value}.');
        } catch (e) {
            { showStatus('Invalid JSON: ' + e.message, true); return; }
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { showStatus('No active tab.', true); return; }
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (storageData) => {
                for (const [key, value] of Object.entries(storageData)) {
                    localStorage.setItem(key, value);
                }
                return Object.keys(storageData).length;
            },
            args: [data]
        }, (results) => {
            if (chrome.runtime.lastError) { showStatus('Error: ' + chrome.runtime.lastError.message, true); return; }
            showStatus(`Saved ${results[0].result} keys to localStorage successfully!`);
        });
    });

    // ─── Form Filler Logic ─────────────────────────────────────────────────────

    let ffProfiles = [];
    let ffCurrentProfileId = null;

    function ffLoadProfiles() {
        chrome.storage.local.get(['ffProfiles', 'ffActiveProfile'], (res) => {
            ffProfiles = res.ffProfiles || [];
            ffCurrentProfileId = res.ffActiveProfile || null;
            ffRenderProfileSelect();
        });
    }

    function ffSaveProfiles(cb) {
        chrome.storage.local.set({ ffProfiles }, cb);
    }

    function ffRenderProfileSelect() {
        const sel = document.getElementById('ffProfileSelect');
        sel.innerHTML = '<option value="">-- Select Profile --</option>';
        ffProfiles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            if (p.id === ffCurrentProfileId) opt.selected = true;
            sel.appendChild(opt);
        });
        ffUpdateActionsVisibility();
    }

    function ffUpdateActionsVisibility() {
        const sel = document.getElementById('ffProfileSelect');
        const hasProfile = sel.value !== '';
        document.getElementById('ffActions').classList.toggle('hidden', !hasProfile);
    }

    // Profile select change
    document.getElementById('ffProfileSelect').addEventListener('change', () => {
        const sel = document.getElementById('ffProfileSelect');
        ffCurrentProfileId = sel.value || null;
        chrome.storage.local.set({ ffActiveProfile: ffCurrentProfileId });
        ffUpdateActionsVisibility();
        if (ffCurrentProfileId) ffOpenProfileEditor(ffCurrentProfileId);
        else document.getElementById('ffProfileEditor').classList.add('hidden');
    });

    // New profile
    document.getElementById('ffNewProfileBtn').addEventListener('click', () => {
        const newProfile = {
            id: 'profile_' + Date.now(),
            name: 'New Profile',
            rules: [
                { match: '', type: 'alphanumeric', length: 10 }
            ]
        };
        ffProfiles.push(newProfile);
        ffSaveProfiles(() => {
            ffCurrentProfileId = newProfile.id;
            chrome.storage.local.set({ ffActiveProfile: ffCurrentProfileId });
            ffRenderProfileSelect();
            ffOpenProfileEditor(newProfile.id);
        });
    });

    // Delete profile
    document.getElementById('ffDeleteProfileBtn').addEventListener('click', () => {
        if (!ffCurrentProfileId) { showStatus('Select a profile to delete.', true); return; }
        if (!confirm('Delete this profile?')) return;
        ffProfiles = ffProfiles.filter(p => p.id !== ffCurrentProfileId);
        ffCurrentProfileId = null;
        chrome.storage.local.set({ ffProfiles, ffActiveProfile: null });
        ffRenderProfileSelect();
        document.getElementById('ffProfileEditor').classList.add('hidden');
        document.getElementById('ffActions').classList.add('hidden');
    });

    function ffOpenProfileEditor(profileId) {
        const profile = ffProfiles.find(p => p.id === profileId);
        if (!profile) return;
        document.getElementById('ffProfileName').value = profile.name;
        ffRenderRules(profile.rules);
        document.getElementById('ffProfileEditor').classList.remove('hidden');
    }

    function ffRenderRules(rules) {
        const container = document.getElementById('ffRulesList');
        container.innerHTML = '';
        rules.forEach((rule, idx) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'background:var(--bg-secondary, #1a1a1a); border:1px solid var(--border, #333); border-radius:8px; padding:8px; margin-bottom:6px; font-size:11px;';
            wrap.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-weight:600;">Rule #${idx + 1}</span>
                    <button class="ff-del-rule" data-idx="${idx}" style="border:none;background:transparent;color:#ff4444;cursor:pointer;font-weight:bold;">✕</button>
                </div>
                <label style="display:block;margin-bottom:3px;">Field Match (name/id/placeholder contains)</label>
                <input class="ff-rule-match" data-idx="${idx}" type="text" value="${escapeHtml(rule.match || '')}" placeholder="e.g. email, phone, username (blank = all)" style="width:100%; margin-bottom:5px;">
                <label style="display:block;margin-bottom:3px;">Data Type</label>
                <select class="ff-rule-type" data-idx="${idx}" style="width:100%; margin-bottom:5px;">
                    ${['name', 'firstname', 'lastname', 'email', 'phone', 'integer', 'alpha', 'alphanumeric', 'symbols', 'mixed', 'url', 'date', 'password', 'custom'].map(t =>
                `<option value="${t}" ${rule.type === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
                </select>
                <div class="ff-extra-fields" data-idx="${idx}">
                    ${rule.type === 'integer' ? `
                        <div style="display:flex;gap:6px;">
                            <div style="flex:1;"><label>Min</label><input class="ff-rule-min" data-idx="${idx}" type="number" value="${rule.min !== undefined ? rule.min : 1}" style="width:100%;"></div>
                            <div style="flex:1;"><label>Max</label><input class="ff-rule-max" data-idx="${idx}" type="number" value="${rule.max !== undefined ? rule.max : 9999}" style="width:100%;"></div>
                        </div>` : rule.type === 'custom' ? `
                        <label>Fixed Value</label>
                        <input class="ff-rule-value" data-idx="${idx}" type="text" value="${escapeHtml(rule.value || '')}" style="width:100%;">` : `
                        <label>Length</label>
                        <input class="ff-rule-length" data-idx="${idx}" type="number" value="${rule.length || 10}" min="1" max="200" style="width:100%;">`
                }
                </div>
            `;
            container.appendChild(wrap);
        });

        // Delete rule
        container.querySelectorAll('.ff-del-rule').forEach(btn => {
            btn.addEventListener('click', () => {
                const profile = ffProfiles.find(p => p.id === ffCurrentProfileId);
                profile.rules.splice(parseInt(btn.dataset.idx), 1);
                ffRenderRules(profile.rules);
            });
        });

        // Live-update rule values
        function syncRule(el, field) {
            const idx = parseInt(el.dataset.idx);
            const profile = ffProfiles.find(p => p.id === ffCurrentProfileId);
            profile.rules[idx][field] = el.type === 'number' ? Number(el.value) : el.value;
            if (field === 'type') {
                ffRenderRules(profile.rules);
            }
        }
        container.querySelectorAll('.ff-rule-match').forEach(el => el.addEventListener('input', () => syncRule(el, 'match')));
        container.querySelectorAll('.ff-rule-type').forEach(el => el.addEventListener('change', () => syncRule(el, 'type')));
        container.querySelectorAll('.ff-rule-length').forEach(el => el.addEventListener('input', () => syncRule(el, 'length')));
        container.querySelectorAll('.ff-rule-min').forEach(el => el.addEventListener('input', () => syncRule(el, 'min')));
        container.querySelectorAll('.ff-rule-max').forEach(el => el.addEventListener('input', () => syncRule(el, 'max')));
        container.querySelectorAll('.ff-rule-value').forEach(el => el.addEventListener('input', () => syncRule(el, 'value')));
    }

    // Add rule
    document.getElementById('ffAddRuleBtn').addEventListener('click', () => {
        const profile = ffProfiles.find(p => p.id === ffCurrentProfileId);
        if (!profile) return;
        profile.rules.push({ match: '', type: 'alphanumeric', length: 10 });
        ffRenderRules(profile.rules);
    });

    // Save profile
    document.getElementById('ffSaveProfileBtn').addEventListener('click', () => {
        const profile = ffProfiles.find(p => p.id === ffCurrentProfileId);
        if (!profile) return;
        profile.name = document.getElementById('ffProfileName').value.trim() || 'Unnamed Profile';
        ffSaveProfiles(() => {
            ffRenderProfileSelect();
            showStatus('Profile saved!');
        });
    });

    // Fill Form
    document.getElementById('ffFillBtn').addEventListener('click', async () => {
        const profile = ffProfiles.find(p => p.id === ffCurrentProfileId);
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { showStatus('No active tab.', true); return; }
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/form_filler.js']
        }, () => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'ffFill',
                rules: profile ? profile.rules : []
            }, (res) => {
                if (chrome.runtime.lastError) { showStatus('Error: ' + chrome.runtime.lastError.message, true); return; }
                showStatus(`✅ Filled ${res.count} fields!`);
            });
        });
    });

    // Clear Form
    document.getElementById('ffClearBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { showStatus('No active tab.', true); return; }
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/form_filler.js']
        }, () => {
            chrome.tabs.sendMessage(tab.id, { action: 'ffClear' }, (res) => {
                if (chrome.runtime.lastError) { showStatus('Error: ' + chrome.runtime.lastError.message, true); return; }
                showStatus(`🗑️ Cleared ${res.count} fields!`);
            });
        });
    });

    // ─── Console Error Collector Logic ────────────────────────────────────────────

    let ccAllLogs = [];
    let ccFilter = 'all';

    // MAIN-world console interceptor (serialized and injected via executeScript)
    function mainWorldInterceptor() {
        if (window.__qaConsoleIntercepted) return;
        window.__qaConsoleIntercepted = true;
        window.__qaLogs = window.__qaLogs || [];

        const _origError = console.error.bind(console);
        const _origWarn = console.warn.bind(console);
        const _origLog = console.log.bind(console);
        const _origInfo = console.info.bind(console);

        function capture(type, args) {
            const msg = args.map(a => {
                try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch (_) { return String(a); }
            }).join(' ');
            window.__qaLogs.push({ type, msg: msg.substring(0, 500), time: new Date().toISOString() });
        }

        console.error = function (...a) { capture('error', a); _origError(...a); };
        console.warn = function (...a) { capture('warn', a); _origWarn(...a); };
        console.log = function (...a) { capture('info', a); _origLog(...a); };
        console.info = function (...a) { capture('info', a); _origInfo(...a); };
    }

    function readMainWorldLogs() {
        return (window.__qaLogs || []).slice();
    }

    async function ccInjectAndFetch(tab) {
        // 1. Inject MAIN world interceptor (captures console.*)  
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: mainWorldInterceptor
        }).catch(() => { });

        // 2. Inject isolated-world collector (captures onerror/unhandledrejection)
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/console_collector.js']
        }).catch(() => { });

        // 3. Read MAIN world logs
        let mainLogs = [];
        const mainResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'MAIN',
            func: readMainWorldLogs
        }).catch(() => null);
        if (mainResult && mainResult[0]) mainLogs = mainResult[0].result || [];

        // 4. Read isolated world logs
        let isoLogs = [];
        await new Promise(resolve => {
            chrome.tabs.sendMessage(tab.id, { action: 'getConsoleLogs' }, (res) => {
                if (!chrome.runtime.lastError && res && res.logs) isoLogs = res.logs;
                resolve();
            });
        });

        // Merge + de-dup by time+msg, sort newest first
        const merged = [...mainLogs, ...isoLogs];
        merged.sort((a, b) => new Date(b.time) - new Date(a.time));
        return merged;
    }

    function ccRenderLogs() {
        const container = document.getElementById('ccLogList');
        const filtered = ccFilter === 'all'
            ? ccAllLogs
            : ccAllLogs.filter(l => l.type === ccFilter);

        // Update counts
        document.getElementById('ccErrorCount').textContent = ccAllLogs.filter(l => l.type === 'error').length;
        document.getElementById('ccWarnCount').textContent = ccAllLogs.filter(l => l.type === 'warn').length;
        document.getElementById('ccInfoCount').textContent = ccAllLogs.filter(l => l.type === 'info').length;

        if (!filtered.length) {
            container.innerHTML = `<div class="empty-state">${ccFilter === 'all' ? 'No logs captured yet. Click Refresh.' : `No ${ccFilter} logs.`}</div>`;
            return;
        }

        container.innerHTML = filtered.map(log => {
            const color = log.type === 'error' ? '#f87171' : log.type === 'warn' ? '#fbbf24' : '#60a5fa';
            const icon = log.type === 'error' ? '✖' : log.type === 'warn' ? '⚠' : 'ℹ';
            const t = new Date(log.time).toLocaleTimeString();
            return `
                <div style="padding:7px 10px; border-bottom:1px solid var(--border,#333); font-size:11px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                        <span style="color:${color}; font-weight:700;">${icon} ${log.type.toUpperCase()}</span>
                        <span style="color:var(--text-muted,#888); font-size:9px;">${t}</span>
                    </div>
                    <div style="word-break:break-word; color:var(--text,#ddd);">${escapeHtml(log.msg)}</div>
                    ${log.source ? `<div style="color:var(--text-muted,#888); font-size:9px; margin-top:2px;">${escapeHtml(log.source)}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    if (document.getElementById('consoleCollectorBtn')) {
        document.getElementById('consoleCollectorBtn').addEventListener('click', async () => {
            switchView('consoleCollectorView');
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) return;
            ccAllLogs = await ccInjectAndFetch(tab);
            ccRenderLogs();
        });
    }

    // Filter buttons
    ['All', 'Error', 'Warn', 'Info'].forEach(label => {
        const btn = document.getElementById(`ccFilter${label}`);
        if (!btn) return;
        btn.addEventListener('click', () => {
            document.querySelectorAll('#consoleCollectorView .mode-toggle button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ccFilter = label.toLowerCase() === 'all' ? 'all' : label.toLowerCase();
            ccRenderLogs();
        });
    });

    // Refresh
    document.getElementById('ccRefreshBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { showStatus('No active tab.', true); return; }
        ccAllLogs = await ccInjectAndFetch(tab);
        ccRenderLogs();
        showStatus(`Refreshed — ${ccAllLogs.length} total log entries`);
    });

    // Clear
    document.getElementById('ccClearBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // Clear MAIN world logs
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: () => { if (window.__qaLogs) window.__qaLogs.length = 0; }
            }).catch(() => { });
            // Clear isolated world logs
            chrome.tabs.sendMessage(tab.id, { action: 'clearConsoleLogs' }).catch(() => { });
        }
        ccAllLogs = [];
        ccRenderLogs();
        showStatus('Logs cleared');
    });

    // Export JSON
    document.getElementById('ccExportBtn').addEventListener('click', () => {
        if (!ccAllLogs.length) { showStatus('No logs to export', true); return; }
        const blob = new Blob([JSON.stringify(ccAllLogs, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `console_logs_${Date.now()}.json`;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        showStatus(`Exported ${ccAllLogs.length} log entries`);
    });

    // ─── Bulk URL Opener Logic ─────────────────────────────────────────────────

    const buTextarea = document.getElementById('buUrlTextarea');
    const buCountSpan = document.getElementById('buUrlCount');

    function buGetUrls() {
        return (buTextarea.value || '')
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 0);
    }

    function buSetUrls(urls) {
        buTextarea.value = urls.join('\n');
        buUpdateCount();
    }

    function buAppendUrls(newUrls) {
        const existing = new Set(buGetUrls());
        const toAdd = newUrls.filter(u => !existing.has(u));  // de-duplicate
        const merged = [...existing, ...toAdd];
        buSetUrls(merged);
        return toAdd.length;
    }

    function buUpdateCount() {
        buCountSpan.textContent = buGetUrls().length;
    }

    function buIsValidUrl(u) {
        try { const p = new URL(u); return p.protocol.startsWith('http'); } catch (_) { return false; }
    }

    function buNormalise(u) {
        u = u.trim();
        if (!u) return null;
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
            if (u.includes('.')) u = 'https://' + u;  // bare domain: google.com
        }
        return buIsValidUrl(u) ? u : null;
    }

    // Keep count in sync as user types
    buTextarea.addEventListener('input', buUpdateCount);

    // Button: Open the view
    if (document.getElementById('bulkUrlOpenerBtn')) {
        document.getElementById('bulkUrlOpenerBtn').addEventListener('click', () => {
            switchView('bulkUrlOpenerView');
            buUpdateCount();
        });
    }

    // Export current tabs
    document.getElementById('buExportTabsBtn').addEventListener('click', () => {
        chrome.tabs.query({}, (tabs) => {
            if (chrome.runtime.lastError) { showStatus('Cannot query tabs: ' + chrome.runtime.lastError.message, true); return; }
            const urls = tabs
                .map(t => t.url)
                .filter(u => u && u.startsWith('http'));
            const added = buAppendUrls(urls);
            showStatus(`✅ Loaded ${added} tab URLs (${urls.length - added} already in list)`);
        });
    });

    // Export history
    document.getElementById('buExportHistoryBtn').addEventListener('click', () => {
        const maxHistory = 200;
        const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // last 7 days
        chrome.history.search({ text: '', maxResults: maxHistory, startTime }, (items) => {
            if (chrome.runtime.lastError) { showStatus('History error: ' + chrome.runtime.lastError.message, true); return; }
            const urls = (items || [])
                .map(i => i.url)
                .filter(u => u && u.startsWith('http'));
            const added = buAppendUrls(urls);
            showStatus(`✅ Loaded ${added} history URLs (${urls.length - added} already in list)`);
        });
    });

    // Import .txt / .csv file
    document.getElementById('buImportFileBtn').addEventListener('click', () => {
        document.getElementById('buFileInput').click();
    });
    document.getElementById('buFileInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const lines = (ev.target.result || '').split(/\r?\n/);
            const urls = lines.map(buNormalise).filter(Boolean);
            const added = buAppendUrls(urls);
            showStatus(`✅ Imported ${added} URLs from ${file.name}`);
        };
        reader.readAsText(file);
        e.target.value = ''; // reset so same file can be re-imported
    });

    // Manual add
    document.getElementById('buAddUrlBtn').addEventListener('click', () => {
        const input = document.getElementById('buAddUrlInput');
        const raw = input.value.trim();
        if (!raw) return;
        const url = buNormalise(raw);
        if (!url) { showStatus('❌ Invalid URL — must start with http(s)://', true); return; }
        const added = buAppendUrls([url]);
        if (added) {
            showStatus(`Added: ${url}`);
            input.value = '';
        } else {
            showStatus('URL already in list', true);
        }
    });
    // Allow pressing Enter in the add input
    document.getElementById('buAddUrlInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('buAddUrlBtn').click();
    });

    // Clear list
    document.getElementById('buClearListBtn').addEventListener('click', () => {
        buTextarea.value = '';
        buUpdateCount();
        showStatus('List cleared');
    });

    // Open All URLs
    document.getElementById('buOpenAllBtn').addEventListener('click', async () => {
        const allUrls = buGetUrls()
            .map(buNormalise)
            .filter(Boolean);

        if (!allUrls.length) { showStatus('No valid URLs in list', true); return; }

        const delay = Math.max(0, parseInt(document.getElementById('buDelay').value) || 400);
        const maxOpen = Math.min(200, parseInt(document.getElementById('buMaxOpen').value) || 20);
        const toOpen = allUrls.slice(0, maxOpen);

        showStatus(`Opening ${toOpen.length} URL(s)...`);

        for (const url of toOpen) {
            chrome.tabs.create({ url, active: false });
            if (delay > 0) await new Promise(r => setTimeout(r, delay));
        }

        if (allUrls.length > maxOpen) {
            showStatus(`Opened ${maxOpen} of ${allUrls.length} URLs. Increase Max to open more.`);
        } else {
            showStatus(`✅ Opened ${toOpen.length} URLs in new tabs`);
        }
    });

});

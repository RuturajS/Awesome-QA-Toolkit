document.addEventListener('DOMContentLoaded', () => {
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
    if (document.getElementById('screenshotBtn')) {
        document.getElementById('screenshotBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const addTimestamp = document.getElementById('screenshotTimestamp').checked;
            if (tab) {
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

    if (document.getElementById('recordBtn')) {
        document.getElementById('recordBtn').addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const enableEffects = document.getElementById('annotateRecord').checked;
            const addTimestamp = document.getElementById('recordingTimestamp').checked;
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

        if (!url) return alert('Enter a URL or domain');
        if (!isValidUrl(url)) return alert('Please enter a valid URL or domain (e.g., google.com or https://...)');
        url = formatUrl(url);

        if (!dateTime && !mins && !hrs && !days) return alert('Set a Time or Delay');
        let schedTime = (mins || hrs || days) ? Date.now() + (mins * 60 + hrs * 3600 + days * 86400) * 1000 : new Date(dateTime).getTime();
        if (schedTime <= Date.now()) return alert('Time must be in future');

        createSchedule(url, schedTime);
        document.getElementById('singleUrl').value = '';
    });

    document.getElementById('addBulk').addEventListener('click', () => {
        const rawUrls = document.getElementById('bulkUrls').value.split('\n').map(u => u.trim()).filter(u => u);
        const dateTime = document.getElementById('bulkDateTime').value;
        const mins = parseInt(document.getElementById('bulkMinutes').value) || 0;
        const hrs = parseInt(document.getElementById('bulkHours').value) || 0;
        const days = parseInt(document.getElementById('bulkDays').value) || 0;

        if (!rawUrls.length) return alert('Enter URLs (one per line)');

        const validUrls = rawUrls.filter(u => isValidUrl(u)).map(u => formatUrl(u));
        if (validUrls.length === 0) return alert('No valid URLs or domains found. Please check your list.');

        if (!dateTime && !mins && !hrs && !days) return alert('Set a Time or Delay');
        let schedTime = (mins || hrs || days) ? Date.now() + (mins * 60 + hrs * 3600 + days * 86400) * 1000 : new Date(dateTime).getTime();

        validUrls.forEach(u => createSchedule(u, schedTime));
        document.getElementById('bulkUrls').value = '';

        if (validUrls.length < rawUrls.length) {
            alert(`Added ${validUrls.length} schedules. ${rawUrls.length - validUrls.length} entries were skipped due to invalid format.`);
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

        if (isNaN(interval) || interval < 5) return alert('Interval must be at least 5 seconds');
        if (isNaN(count) || count < 1) return alert('Count must be at least 1');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return alert('No active tab found');

        // Feature: Reminder for "Ask where to save" setting
        if (!confirm('Note: Ensure "Ask where to save each file before downloading" is OFF in Chrome settings for silent capture. Continue?')) return;

        const taskId = 'autoShot_' + Date.now();
        const firstShotTime = Date.now() + 1000; // Start almost immediately

        const task = {
            id: taskId,
            type: 'interval',
            interval: interval,
            totalCount: count,
            remainingCount: count,
            folder: folder,
            tabId: tab.id,
            tabUrl: tab.url,
            startTime: Date.now()
        };

        autoTasks.push(task);
        chrome.storage.local.set({ autoTasks });

        // Create the alarm for the first shot
        chrome.alarms.create(taskId, { when: firstShotTime });
        renderAutoTasks();
        alert(`Started interval capture: ${count} shots, every ${interval}s`);
    });

    document.getElementById('addSpecificShot').addEventListener('click', async () => {
        const timeInput = document.getElementById('specificShotTime').value;
        const folder = document.getElementById('autoShotFolder').value.trim() || 'QA-Screenshots';

        if (!timeInput) return alert('Please select a time');
        const schedTime = new Date(timeInput).getTime();
        if (schedTime <= Date.now()) return alert('Time must be in the future');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return alert('No active tab found');

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
        alert('Scheduled screenshot for ' + new Date(schedTime).toLocaleString());
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
        if (!keyword) return alert('Please enter a keyword');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['scripts/keyword_spotter.js'] });
            chrome.tabs.sendMessage(tab.id, { action: 'findKeyword', keyword, useRegex }, (response) => {
                if (chrome.runtime.lastError) return alert('Error: ' + chrome.runtime.lastError.message);
                if (response?.error) return alert('Error: ' + response.error);
                if (response?.count > 0) {
                    saveMatchLog(keyword, response.count, response.url);
                    alert(`Found ${response.count} matches! These are now highlighted in yellow.`);
                } else {
                    alert('No matches found on this page.');
                }
            });
        } catch (err) { alert('Failed: ' + err.message); }
    });

    // Watch Mode
    document.getElementById('startWatchKeywordBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('keywordInput').value.trim();
        if (!keyword) return alert('Please enter a keyword to watch');

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Save to tracked list
        if (trackedKeywords.find(k => k.keyword === keyword)) return alert('Already watching this keyword');

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

        alert(`Now watching for "${keyword}". You will get a notification when it appears!`);
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
});

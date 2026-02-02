// Scheduler logic for managing scheduled URL openings
let schedules = [];

// Load schedules on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSchedules();
    setupEventListeners();
});

function setupEventListeners() {
    // Mode toggle
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

    // Add single schedule
    document.getElementById('addSingle').addEventListener('click', addSingleSchedule);

    // Add bulk schedules
    document.getElementById('addBulk').addEventListener('click', addBulkSchedules);
}

function addSingleSchedule() {
    const url = document.getElementById('singleUrl').value.trim();
    const dateTime = document.getElementById('singleDateTime').value;
    const minutes = parseInt(document.getElementById('singleMinutes').value) || 0;
    const hours = parseInt(document.getElementById('singleHours').value) || 0;
    const days = parseInt(document.getElementById('singleDays').value) || 0;

    if (!url) {
        alert('Please enter a URL');
        return;
    }

    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (must start with http:// or https://)');
        return;
    }

    let scheduledTime;
    if (minutes || hours || days) {
        // Calculate time from delay
        const delayMs = (minutes * 60 + hours * 3600 + days * 86400) * 1000;
        scheduledTime = Date.now() + delayMs;
    } else if (dateTime) {
        scheduledTime = new Date(dateTime).getTime();
    } else {
        alert('Please set either a schedule time or delay');
        return;
    }

    if (scheduledTime <= Date.now()) {
        alert('Scheduled time must be in the future');
        return;
    }

    createSchedule(url, scheduledTime);

    // Clear form
    document.getElementById('singleUrl').value = '';
    document.getElementById('singleDateTime').value = '';
    document.getElementById('singleMinutes').value = '';
    document.getElementById('singleHours').value = '';
    document.getElementById('singleDays').value = '';
}

function addBulkSchedules() {
    const urls = document.getElementById('bulkUrls').value
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

    const dateTime = document.getElementById('bulkDateTime').value;
    const minutes = parseInt(document.getElementById('bulkMinutes').value) || 0;
    const hours = parseInt(document.getElementById('bulkHours').value) || 0;
    const days = parseInt(document.getElementById('bulkDays').value) || 0;

    if (urls.length === 0) {
        alert('Please enter at least one URL');
        return;
    }

    // Validate all URLs
    for (const url of urls) {
        if (!isValidUrl(url)) {
            alert(`Invalid URL: ${url}\nAll URLs must start with http:// or https://`);
            return;
        }
    }

    let scheduledTime;
    if (minutes || hours || days) {
        const delayMs = (minutes * 60 + hours * 3600 + days * 86400) * 1000;
        scheduledTime = Date.now() + delayMs;
    } else if (dateTime) {
        scheduledTime = new Date(dateTime).getTime();
    } else {
        alert('Please set either a schedule time or delay');
        return;
    }

    if (scheduledTime <= Date.now()) {
        alert('Scheduled time must be in the future');
        return;
    }

    // Create schedules for all URLs
    urls.forEach(url => createSchedule(url, scheduledTime));

    // Clear form
    document.getElementById('bulkUrls').value = '';
    document.getElementById('bulkDateTime').value = '';
    document.getElementById('bulkMinutes').value = '';
    document.getElementById('bulkHours').value = '';
    document.getElementById('bulkDays').value = '';
}

function createSchedule(url, scheduledTime) {
    const id = 'schedule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const schedule = {
        id: id,
        url: url,
        scheduledTime: scheduledTime,
        createdAt: Date.now()
    };

    schedules.push(schedule);
    saveSchedules();

    // Create Chrome alarm
    chrome.alarms.create(id, { when: scheduledTime });

    renderSchedules();
}

function deleteSchedule(id) {
    schedules = schedules.filter(s => s.id !== id);
    saveSchedules();
    chrome.alarms.clear(id);
    renderSchedules();
}

function saveSchedules() {
    chrome.storage.local.set({ schedules: schedules });
}

function loadSchedules() {
    chrome.storage.local.get(['schedules'], (result) => {
        schedules = result.schedules || [];
        // Remove past schedules
        const now = Date.now();
        schedules = schedules.filter(s => s.scheduledTime > now);
        saveSchedules();
        renderSchedules();
    });
}

function renderSchedules() {
    const container = document.getElementById('scheduleContainer');
    const count = document.getElementById('scheduleCount');

    count.textContent = schedules.length;

    if (schedules.length === 0) {
        container.innerHTML = '<div style="color: #888; font-size: 11px; text-align: center; padding: 20px;">No scheduled URLs</div>';
        return;
    }

    // Sort by scheduled time
    schedules.sort((a, b) => a.scheduledTime - b.scheduledTime);

    container.innerHTML = schedules.map(schedule => {
        const scheduledDate = new Date(schedule.scheduledTime);
        const timeUntil = getTimeUntil(schedule.scheduledTime);

        return `
            <div class="schedule-item">
                <div class="url">${escapeHtml(schedule.url)}</div>
                <div class="time">
                    📅 ${scheduledDate.toLocaleString()}<br>
                    ⏱️ Opens in: ${timeUntil}
                </div>
                <button onclick="deleteSchedule('${schedule.id}')">Delete</button>
            </div>
        `;
    }).join('');
}

function getTimeUntil(timestamp) {
    const diff = timestamp - Date.now();
    if (diff <= 0) return 'Now';

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && days === 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '< 1s';
}

function isValidUrl(url) {
    return url.startsWith('http://') || url.startsWith('https://');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update time remaining every second
setInterval(() => {
    if (schedules.length > 0) {
        renderSchedules();
    }
}, 1000);

// Make deleteSchedule available globally
window.deleteSchedule = deleteSchedule;

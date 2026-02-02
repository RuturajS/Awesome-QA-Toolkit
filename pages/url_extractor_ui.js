let urlData = null;
let currentFilter = 'all';

// Listen for URL data from background
chrome.storage.local.get(['extractedUrls'], (result) => {
    if (result.extractedUrls) {
        urlData = result.extractedUrls;
        displayUrls();
        setupEventListeners();
    }
});

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            displayUrls();
        });
    });

    // Export buttons
    document.getElementById('exportTxt').addEventListener('click', () => exportAsTxt());
    document.getElementById('exportJson').addEventListener('click', () => exportAsJson());
    document.getElementById('exportCsv').addEventListener('click', () => exportAsCsv());
    document.getElementById('exportCopy').addEventListener('click', () => copyToClipboard());
}

function displayUrls() {
    if (!urlData) return;

    // Update page info
    document.getElementById('pageTitle').textContent = urlData.pageTitle;
    document.getElementById('pageUrl').textContent = urlData.pageUrl;

    // Get current filtered URLs
    const urls = urlData.urls[currentFilter] || [];

    // Update stats
    document.getElementById('totalCount').textContent = urlData.urls.all.length;
    document.getElementById('showingCount').textContent = urls.length;

    // Display URLs
    const listContainer = document.getElementById('urlList');

    if (urls.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No URLs in this category</div>';
        return;
    }

    listContainer.innerHTML = urls.map(url =>
        `<div class="url-item">${escapeHtml(url)}</div>`
    ).join('');
}

function exportAsTxt() {
    const urls = urlData.urls[currentFilter] || [];
    const content = urls.join('\n');
    downloadFile(content, `urls_${currentFilter}_${Date.now()}.txt`, 'text/plain');
}

function exportAsJson() {
    const urls = urlData.urls[currentFilter] || [];
    const data = {
        pageTitle: urlData.pageTitle,
        pageUrl: urlData.pageUrl,
        extractedAt: new Date().toISOString(),
        category: currentFilter,
        count: urls.length,
        urls: urls
    };
    const content = JSON.stringify(data, null, 2);
    downloadFile(content, `urls_${currentFilter}_${Date.now()}.json`, 'application/json');
}

function exportAsCsv() {
    const urls = urlData.urls[currentFilter] || [];
    let csv = 'URL,Category,Page Title,Page URL\n';
    urls.forEach(url => {
        csv += `"${url.replace(/"/g, '""')}","${currentFilter}","${urlData.pageTitle.replace(/"/g, '""')}","${urlData.pageUrl}"\n`;
    });
    downloadFile(csv, `urls_${currentFilter}_${Date.now()}.csv`, 'text/csv');
}

function copyToClipboard() {
    const urls = urlData.urls[currentFilter] || [];
    const text = urls.join('\n');

    navigator.clipboard.writeText(text).then(() => {
        // Show temporary success message
        const btn = document.getElementById('exportCopy');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#4CAF50';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy to clipboard');
    });
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

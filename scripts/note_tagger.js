(function () {
    if (window.hasNoteTaggerRun) return;
    window.hasNoteTaggerRun = true;

    let taggingMode = false;
    let pageNotes = [];
    let highlightedElement = null;
    let renderRetryCount = 0;

    // --- 1. Initialize CSS ---
    const style = document.createElement('style');
    style.textContent = `
        .qa-note-dot {
            position: absolute;
            width: 14px;
            height: 14px;
            background: #FFD700;
            border: 2px solid #000;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
            backdrop-filter: blur(1px);
            transition: transform 0.2s;
            display: none;
        }
        .qa-notes-active .qa-note-dot {
            display: block !important;
        }
        .qa-note-dot:hover {
            transform: scale(1.3);
        }
        .qa-note-popup {
            position: absolute;
            background: rgba(255, 252, 220, 0.95);
            border: 1px solid #FFD700;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: 'Inter', sans-serif;
            font-size: 11px;
            color: #333;
            max-width: 200px;
            z-index: 10001;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            backdrop-filter: blur(4px);
            pointer-events: auto;
        }
        .qa-note-popup b { display: block; margin-bottom: 2px; color: #000; }
        .qa-note-popup .close-note {
            position: absolute;
            top: 2px;
            right: 4px;
            cursor: pointer;
            font-weight: bold;
            color: #ff4444;
        }
        .qa-tagging-highlight {
            outline: 2px dashed #FFD700 !important;
            outline-offset: 2px !important;
            cursor: crosshair !important;
        }
        #qa-note-form {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 20000;
            width: 250px;
            border: 2px solid #FFD700;
        }
        #qa-note-form input, #qa-note-form textarea {
            width: 100%;
            margin-bottom: 8px;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            box-sizing: border-box;
        }
        #qa-note-form button {
            width: 100%;
            padding: 8px;
            background: #000;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);

    // --- 2. Load & Render Logic ---
    function loadNotes() {
        chrome.storage.local.get(['allNotes', 'notesVisible'], (res) => {
            const allNotes = res.allNotes || {};
            pageNotes = allNotes[window.location.origin + window.location.pathname] || [];

            // Fix: Default to true if undefined
            const isVisible = res.notesVisible !== false;
            if (isVisible) {
                document.body.classList.add('qa-notes-active');
            } else {
                document.body.classList.remove('qa-notes-active');
            }

            renderNotesOnPage();
        });
    }

    function renderNotesOnPage() {
        // Clear existing
        document.querySelectorAll('.qa-note-dot, .qa-note-popup').forEach(el => el.remove());

        let allFound = true;
        pageNotes.forEach((note, index) => {
            const el = document.querySelector(note.selector);
            if (el) {
                createNoteUI(el, note, index);
            } else {
                allFound = false;
            }
        });

        // Retry logic: if elements aren't found (dynamic page), retry up to 5 times
        if (!allFound && renderRetryCount < 5) {
            renderRetryCount++;
            setTimeout(renderNotesOnPage, 1000);
        } else {
            renderRetryCount = 0; // Reset after success or total fail
        }
    }

    function createNoteUI(targetEl, note, index) {
        // Robust positioning using offsetParent check
        const rect = targetEl.getBoundingClientRect();
        const dot = document.createElement('div');
        dot.className = 'qa-note-dot';
        dot.style.top = (rect.top + window.scrollY - 7) + 'px';
        dot.style.left = (rect.left + window.scrollX - 7) + 'px';

        dot.addEventListener('mouseenter', () => {
            const popup = document.createElement('div');
            popup.className = 'qa-note-popup';
            popup.id = 'popup-' + index;
            popup.innerHTML = `
                <span class="close-note" data-index="${index}">×</span>
                <b>${escapeHtml(note.title)}</b>
                ${escapeHtml(note.message)}
            `;
            const currentRect = targetEl.getBoundingClientRect();
            popup.style.top = (currentRect.top + window.scrollY + 10) + 'px';
            popup.style.left = (currentRect.left + window.scrollX + 10) + 'px';

            popup.querySelector('.close-note').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(index);
            });

            document.body.appendChild(popup);
        });

        dot.addEventListener('mouseleave', () => {
            setTimeout(() => {
                const popup = document.getElementById('popup-' + index);
                if (popup && !popup.matches(':hover')) popup.remove();
            }, 100);
        });

        document.body.appendChild(dot);
    }

    function deleteNote(index) {
        if (!confirm('Delete this note?')) return;
        const key = window.location.origin + window.location.pathname;
        chrome.storage.local.get(['allNotes'], (res) => {
            const allNotes = res.allNotes || {};
            if (allNotes[key]) {
                allNotes[key].splice(index, 1);
                chrome.storage.local.set({ allNotes }, () => {
                    loadNotes();
                    chrome.runtime.sendMessage({ action: 'notesUpdated' });
                });
            }
        });
    }

    // --- 3. Event Listeners ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleTagging') {
            taggingMode = request.state;
            if (!taggingMode) {
                if (highlightedElement) highlightedElement.classList.remove('qa-tagging-highlight');
                document.getElementById('qa-note-form')?.remove();
            }
            sendResponse({ success: true });
        } else if (request.action === 'refreshNotes') {
            loadNotes();
        } else if (request.action === 'toggleNoteVisibility') {
            if (request.visible) {
                document.body.classList.add('qa-notes-active');
            } else {
                document.body.classList.remove('qa-notes-active');
            }
            sendResponse({ success: true });
        }
        return true;
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && taggingMode) {
            taggingMode = false;
            if (highlightedElement) highlightedElement.classList.remove('qa-tagging-highlight');
            document.getElementById('qa-note-form')?.remove();
            chrome.runtime.sendMessage({ action: 'taggingCanceled' });
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (!taggingMode) return;
        if (e.target.closest('#qa-note-form') || e.target.classList.contains('qa-note-dot')) return;

        if (highlightedElement) highlightedElement.classList.remove('qa-tagging-highlight');
        highlightedElement = e.target;
        highlightedElement.classList.add('qa-tagging-highlight');
    });

    document.addEventListener('contextmenu', (e) => {
        if (!taggingMode) return;
        e.preventDefault();
        const selector = getCssSelector(e.target);
        showNoteForm(selector);
    });

    function showNoteForm(selector) {
        document.getElementById('qa-note-form')?.remove();
        const form = document.createElement('div');
        form.id = 'qa-note-form';
        form.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px; font-size:14px;">📌 Add Note</div>
            <input type="text" id="qa-note-title" placeholder="Tag Name">
            <textarea id="qa-note-message" placeholder="Message..."></textarea>
            <button id="qa-save-note">Save Tag</button>
            <button id="qa-cancel-note" style="background:#eee; color:#666; margin-top:5px;">Cancel</button>
        `;
        document.body.appendChild(form);

        document.getElementById('qa-save-note').addEventListener('click', () => {
            const title = document.getElementById('qa-note-title').value.trim() || 'Note';
            const message = document.getElementById('qa-note-message').value.trim();
            if (!message) return alert('Please enter a message');
            saveNote({ title, message, selector });
            form.remove();
        });
        document.getElementById('qa-cancel-note').addEventListener('click', () => form.remove());
    }

    function saveNote(noteData) {
        const key = window.location.origin + window.location.pathname;
        chrome.storage.local.get(['allNotes'], (res) => {
            const allNotes = res.allNotes || {};
            if (!allNotes[key]) allNotes[key] = [];
            allNotes[key].push(noteData);
            chrome.storage.local.set({ allNotes }, () => {
                loadNotes();
                chrome.runtime.sendMessage({ action: 'notesUpdated' });
            });
        });
    }

    function getCssSelector(el) {
        if (!(el instanceof Element)) return;
        const path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sibling = el;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                    if (sibling.nodeName.toLowerCase() == selector) nth++;
                }
                if (nth != 1) selector += ":nth-of-type(" + nth + ")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadNotes);
    } else {
        loadNotes();
    }

    // Periodically sync position if window resizes
    window.addEventListener('resize', renderNotesOnPage);
})();

/**
 * QA Tools Kit - Form Filler Content Script
 * Fills / clears all form fields based on saved profiles.
 * Keyboard shortcuts: Ctrl+Shift+F (fill), Ctrl+Shift+X (clear)
 */
(function () {
    'use strict';

    // Guard: prevent duplicate message listener registration
    if (window.__ffInjected) return;
    window.__ffInjected = true;

    // ─── Data Generators ────────────────────────────────────────────────────────

    const FIRST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia', 'Kevin', 'Laura', 'Mike', 'Nancy', 'Oscar', 'Priya', 'Quinn', 'Rachel', 'Sam', 'Tina'];
    const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Lee', 'Patel'];
    const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'test.com', 'example.com', 'qa-test.io'];
    const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const DIGITS = '0123456789';
    const ALPHANUM = ALPHA + DIGITS;
    const MIXED = ALPHANUM + SYMBOLS;
    const TLD_LIST = ['.com', '.net', '.org', '.io', '.co'];

    // Synonym map: a rule type maps to a set of text patterns that identify the field
    const TYPE_SYNONYMS = {
        name: ['name', 'fullname', 'full_name', 'full-name'],
        firstname: ['first', 'firstname', 'first_name', 'given', 'fname'],
        lastname: ['last', 'lastname', 'last_name', 'surname', 'family', 'lname'],
        email: ['email', 'e-mail', 'mail'],
        phone: ['phone', 'tel', 'mobile', 'cell', 'contact', 'phone_number', 'phonenumber'],
        password: ['password', 'pass', 'pwd', 'passwd', 'secret'],
        integer: ['number', 'qty', 'quantity', 'count', 'amount', 'age', 'zip', 'postal', 'code'],
        alpha: ['alpha', 'letters'],
        alphanumeric: ['alphanumeric', 'alphanum', 'text'],
        url: ['url', 'website', 'site', 'link', 'web'],
        date: ['date', 'dob', 'birthday', 'born', 'expiry', 'expiration'],
        custom: [],
    };

    // HTML input types that map directly to data types
    const INPUT_TYPE_MAP = {
        'email': 'email',
        'tel': 'phone',
        'number': 'integer',
        'date': 'date',
        'url': 'url',
        'password': 'password',
    };

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randStr(charset, length) {
        let out = '';
        for (let i = 0; i < length; i++) out += charset[Math.floor(Math.random() * charset.length)];
        return out;
    }

    function generateValue(rule) {
        const len = Math.max(1, Number(rule.length) || 8);
        const min = rule.min !== undefined ? Number(rule.min) : 1;
        const max = rule.max !== undefined ? Number(rule.max) : 9999;

        switch ((rule.type || 'alphanumeric').toLowerCase()) {
            case 'name': return `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`;
            case 'firstname': return rand(FIRST_NAMES);
            case 'lastname': return rand(LAST_NAMES);
            case 'email': return `${rand(FIRST_NAMES).toLowerCase()}${randInt(1, 99)}@${rand(DOMAINS)}`;
            case 'phone': return `+1${randInt(200, 999)}${randInt(1000000, 9999999)}`;
            case 'integer': return String(randInt(min, max));
            case 'alpha': return randStr(ALPHA, len);
            case 'alphanumeric': return randStr(ALPHANUM, len);
            case 'symbols': return randStr(SYMBOLS, len);
            case 'mixed': return randStr(MIXED, len);
            case 'url': return `https://www${randInt(1, 99)}${rand(TLD_LIST)}`;
            case 'date': {
                const d = new Date(Date.now() - randInt(0, 3153600000000));
                return d.toISOString().split('T')[0];
            }
            case 'password': return randStr(ALPHANUM + '!@#$%', Math.max(len, 8));
            case 'custom': return rule.value || '';
            default: return randStr(ALPHANUM, len);
        }
    }

    // ─── Smart Field Matching ────────────────────────────────────────────────────

    /**
     * Score a field against a rule.
     * Returns: 15 = HTML type exact match, 10 = attr keyword hit, 8 = label hit, 1 = wildcard, 0 = no match
     */
    function scoreFieldMatch(el, rule) {
        // Wildcard rule (no match pattern) — applies to every field
        if (!rule.match || rule.match.trim() === '') return 1;

        const pattern = rule.match.trim().toLowerCase();

        // Build synonym list: the pattern itself + any synonyms for this rule type + synonyms for the pattern as a type
        const synonyms = new Set([pattern]);
        (TYPE_SYNONYMS[rule.type] || []).forEach(s => synonyms.add(s));
        (TYPE_SYNONYMS[pattern] || []).forEach(s => synonyms.add(s));

        // Check HTML input type against synonyms for this rule type
        const elType = (el.type || '').toLowerCase();
        if (TYPE_SYNONYMS[rule.type] && TYPE_SYNONYMS[rule.type].includes(elType)) return 15;
        if (INPUT_TYPE_MAP[elType] === rule.type) return 15;

        // Check element attributes (name, id, placeholder, type, autocomplete, aria-label)
        const attrs = [el.name, el.id, el.placeholder, el.type, el.autocomplete, el.getAttribute('aria-label')];
        for (const a of attrs) {
            if (!a) continue;
            const al = a.toLowerCase();
            for (const syn of synonyms) {
                if (al.includes(syn)) return 10;
            }
        }

        // Check label text
        if (el.id) {
            const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (label) {
                const lt = label.textContent.toLowerCase();
                for (const syn of synonyms) {
                    if (lt.includes(syn)) return 8;
                }
            }
        }

        return 0;
    }

    /** Auto-detect best data type from field attributes when no profile rule matches */
    function autoDetectType(el) {
        // HTML input type takes highest priority
        if (INPUT_TYPE_MAP[el.type]) return INPUT_TYPE_MAP[el.type];

        const hints = [el.type, el.name, el.id, el.placeholder, el.autocomplete]
            .map(s => (s || '').toLowerCase()).join(' ');

        if (/email/.test(hints)) return 'email';
        if (/phone|tel|mobile|cell/.test(hints)) return 'phone';
        if (/first.?name|fname|given/.test(hints)) return 'firstname';
        if (/last.?name|lname|surname|family/.test(hints)) return 'lastname';
        if (/\bname\b/.test(hints)) return 'name';
        if (/pass(word)?|pwd/.test(hints)) return 'password';
        if (/url|website|link/.test(hints)) return 'url';
        if (/date|dob|birth/.test(hints)) return 'date';
        if (/zip|postal/.test(hints)) return 'integer';
        return 'alphanumeric';
    }

    // ─── Fill / Clear ────────────────────────────────────────────────────────────

    function getAllFields() {
        return [...document.querySelectorAll('input, textarea, select')].filter(el => {
            if (el.disabled || el.readOnly) return false;
            const t = (el.type || '').toLowerCase();
            if (['submit', 'button', 'reset', 'image', 'file', 'hidden'].includes(t)) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            return true;
        });
    }

    function setFieldValue(el, value) {
        try {
            if (el.tagName === 'SELECT') {
                // Pick the first non-placeholder option
                const opts = [...el.options];
                const pick = opts.find(o => o.value && o.value !== '' && o.index > 0) || opts[0];
                if (pick) el.value = pick.value;
            } else if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = true;
            } else {
                // Use native setter to bypass React, Vue, Angular dirty-checking
                const proto = el.tagName === 'TEXTAREA'
                    ? window.HTMLTextAreaElement.prototype
                    : window.HTMLInputElement.prototype;
                const setter = Object.getOwnPropertyDescriptor(proto, 'value');
                if (setter && setter.set) {
                    setter.set.call(el, value);
                } else {
                    el.value = value;
                }
            }

            // Fire all framework-compatible events
            ['input', 'change', 'blur'].forEach(type => {
                el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
            });
            // Also fire InputEvent for React 17+
            el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
        } catch (_) { /* ignore */ }
    }

    function fillFields(rules) {
        const fields = getAllFields();
        let filled = 0;

        fields.forEach(el => {
            let bestRule = null;
            let bestScore = 0;

            if (rules && rules.length) {
                for (const rule of rules) {
                    const score = scoreFieldMatch(el, rule);
                    if (score > bestScore) {
                        bestScore = score;
                        bestRule = rule;
                    }
                }
            }

            // If no specific rule matched (score=0), check for wildcard rules (empty match)
            if (bestScore === 0 && rules && rules.length) {
                const wildcards = rules.filter(r => !r.match || r.match.trim() === '');
                bestRule = wildcards[0] || null;
            }

            let value;
            if (bestRule && bestScore > 0) {
                // Specific rule matched
                value = generateValue(bestRule);
            } else if (bestRule && bestScore === 0) {
                // Wildcard rule — still check if this field is better handled by auto-detect
                const autoType = autoDetectType(el);
                // Only auto-override if auto-detect gives a specific type (not generic alphanumeric)
                if (autoType !== 'alphanumeric') {
                    value = generateValue({ type: autoType, length: bestRule.length || 10 });
                } else {
                    value = generateValue(bestRule);
                }
            } else {
                // No rules at all — pure auto-detect
                value = generateValue({ type: autoDetectType(el), length: 10 });
            }

            setFieldValue(el, value);
            filled++;
        });

        return filled;
    }

    function clearFields() {
        const fields = getAllFields();
        fields.forEach(el => {
            try {
                if (el.type === 'checkbox' || el.type === 'radio') {
                    el.checked = false;
                } else if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                } else {
                    const proto = el.tagName === 'TEXTAREA'
                        ? window.HTMLTextAreaElement.prototype
                        : window.HTMLInputElement.prototype;
                    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
                    setter ? setter.set.call(el, '') : (el.value = '');
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            } catch (_) { /* ignore */ }
        });
        return fields.length;
    }

    // ─── Message Listener ────────────────────────────────────────────────────────

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ffFill') {
            const count = fillFields(request.rules || []);
            sendResponse({ ok: true, count });
            return true;
        }
        if (request.action === 'ffClear') {
            const count = clearFields();
            sendResponse({ ok: true, count });
            return true;
        }
    });

    // ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

    if (!window.__ffShortcutsRegistered) {
        window.__ffShortcutsRegistered = true;
        document.addEventListener('keydown', (e) => {
            if (!e.ctrlKey || !e.shiftKey) return;
            if (e.code === 'KeyF') {
                e.preventDefault();
                chrome.storage.local.get(['ffActiveProfile', 'ffProfiles'], (res) => {
                    const profiles = res.ffProfiles || [];
                    const active = profiles.find(p => p.id === res.ffActiveProfile);
                    const count = fillFields(active ? active.rules : []);
                    showToast(`✅ Filled ${count} fields`);
                });
            }
            if (e.code === 'KeyX') {
                e.preventDefault();
                const count = clearFields();
                showToast(`🗑️ Cleared ${count} fields`);
            }
        });
    }

    // ─── On-page Toast ───────────────────────────────────────────────────────────

    function showToast(msg) {
        let toast = document.getElementById('__qaff_toast__');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = '__qaff_toast__';
            Object.assign(toast.style, {
                position: 'fixed', bottom: '24px', right: '24px', zIndex: '2147483647',
                background: '#1a1a2e', color: '#fff', padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', fontFamily: 'system-ui, sans-serif',
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)', border: '1px solid #444',
                transition: 'opacity 0.3s', opacity: '0', pointerEvents: 'none'
            });
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast.__timeout);
        toast.__timeout = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    }

})();

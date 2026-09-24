// ==========================================
// VED AI — SIDEBAR v2.1 (HISTORY + COMPAT FIX)
// Founder: Sayali P. R. Pawar
// ==========================================
(function () {
    'use strict';

    const groupsEl = document.getElementById('sidebarGroups');
    const searchInput = document.getElementById('sidebarSearchInput');

    let allChats = [];
    let filteredChats = [];

    function formatDate(date) {
        const now = new Date();
        const d = new Date(date);
        const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        if (diff < 7) return 'Last 7 days';
        if (diff < 30) return 'Last 30 days';
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    function groupByDate(chats) {
        const groups = {};
        chats.forEach(function (chat) {
            const group = formatDate(chat.timestamp);
            if (!groups[group]) groups[group] = [];
            groups[group].push(chat);
        });
        return groups;
    }

    function renderGroups(chats) {
        if (!groupsEl) return;
        groupsEl.innerHTML = '';
        if (chats.length === 0) {
            groupsEl.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,.4);font-size:13px;">No conversations yet.</div>';
            return;
        }
        const grouped = groupByDate(chats);
        const order = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days'];
        const otherKeys = Object.keys(grouped).filter(function (k) { return order.indexOf(k) === -1; }).sort();
        const keys = order.filter(function (k) { return grouped[k]; }).concat(otherKeys);

        keys.forEach(function (key) {
            const section = document.createElement('div');
            section.className = 'sb-group';
            section.innerHTML = '<div class="sb-group-label">' + key + '</div>';
            grouped[key].forEach(function (chat) {
                const item = document.createElement('div');
                item.className = 'sb-chat-item';
                item.textContent = chat.firstMessage || 'Chat';
                item.addEventListener('click', function () { loadChat(chat); });
                section.appendChild(item);
            });
            groupsEl.appendChild(section);
        });
    }

    function loadChat(chat) {
        const box = document.getElementById('chatMessages');
        if (!box || !chat || !chat.messages) return;
        box.innerHTML = '';
        chat.messages.forEach(function (m) {
            const d = document.createElement('div');
            d.className = m.role === 'user' ? 'user-message' : 'bot-message';
            d.textContent = m.message;
            box.appendChild(d);
        });
        box.scrollTop = box.scrollHeight;
        document.body.classList.add('chat-active');
    }

    function fetchHistory() {
        fetch('/history')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data || !data.history) return;
                const chats = [];
                let current = null;
                data.history.forEach(function (msg, idx) {
                    if (msg.role === 'user') {
                        current = {
                            id: idx,
                            firstMessage: String(msg.message || 'Chat').slice(0, 40),
                            timestamp: msg.timestamp || new Date(),
                            messages: []
                        };
                        chats.push(current);
                    }
                    if (current) current.messages.push(msg);
                });
                allChats = chats.reverse();
                filteredChats = allChats;
                renderGroups(filteredChats);
            })
            .catch(function (err) { console.warn('History load failed:', err); });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const q = searchInput.value.toLowerCase();
            filteredChats = !q ? allChats : allChats.filter(function (c) {
                return c.firstMessage.toLowerCase().indexOf(q) !== -1;
            });
            renderGroups(filteredChats);
        });
    }

    // ==========================================
    // 🛡️ COMPATIBILITY SHIM — script_new.js ko global "Sidebar" chahiye.
    // Ye proxy kisi bhi Sidebar.xxx() call ko crash nahi hone dega.
    // ==========================================
    var SHIM = new Proxy(function () {}, {
        get: function (t, p) {
            if (p === Symbol.toPrimitive) return function () { return 0; };
            if (p === 'toString' || p === 'valueOf') return function () { return 0; };
            if (p === 'then') return undefined;
            if (p === 'refresh' || p === 'reload' || p === 'update') return fetchHistory;
            return SHIM;
        },
        apply: function () { return SHIM; },
        set: function () { return true; }
    });
    window.Sidebar = SHIM;

    setTimeout(fetchHistory, 600);
})();
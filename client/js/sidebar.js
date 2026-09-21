// ==========================================
// VED AI — SIDEBAR v2 (CHAT HISTORY + SEARCH)
// Founder: Sayali P. R. Pawar
// ==========================================
(function () {
    'use strict';

    const groupsEl = document.getElementById('sidebarGroups');
    const searchInput = document.getElementById('sidebarSearchInput');
    const newChatBtn = document.getElementById('newChatBtn');

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
            groupsEl.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,.4);font-size:13px;">No chats yet</div>';
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
                item.addEventListener('click', function () {
                    loadChat(chat.id);
                });
                section.appendChild(item);
            });
            groupsEl.appendChild(section);
        });
    }

    function loadChat(chatId) {
        // TODO: Load specific chat (for now, just alert)
        alert('Loading chat: ' + chatId);
    }

    function fetchHistory() {
        fetch('/history')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.history) {
                    // Group conversations (every 2 messages = 1 chat)
                    const chats = [];
                    let currentChat = null;
                    data.history.forEach(function (msg, idx) {
                        if (msg.role === 'user') {
                            currentChat = {
                                id: idx,
                                firstMessage: msg.message.slice(0, 40),
                                timestamp: msg.timestamp || new Date(),
                                messages: []
                            };
                            chats.push(currentChat);
                        }
                        if (currentChat) {
                            currentChat.messages.push(msg);
                        }
                    });
                    allChats = chats.reverse(); // newest first
                    filteredChats = allChats;
                    renderGroups(filteredChats);
                }
            })
            .catch(function (err) {
                console.warn('Failed to load history:', err);
            });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const q = searchInput.value.toLowerCase();
            if (!q) {
                filteredChats = allChats;
            } else {
                filteredChats = allChats.filter(function (c) {
                    return c.firstMessage.toLowerCase().indexOf(q) !== -1;
                });
            }
            renderGroups(filteredChats);
        });
    }

    if (newChatBtn) {
        newChatBtn.addEventListener('click', function () {
            // Clear chat box
            const box = document.getElementById('chatMessages');
            if (box) box.innerHTML = '<div class="bot-message"><b>Welcome to VED AI</b><br><br>Ask me anything.</div>';
            const inp = document.getElementById('userInput');
            if (inp) inp.value = '';
            document.body.classList.remove('chat-active');
        });
    }

    // Load on init
    setTimeout(fetchHistory, 500);
})();
// ==========================================
// VED AI — LIBRARY 2.0 (v4.0)
// Founder: Sayali P. R. Pawar
// Features: Rename, Pin, Save, Search, Pretty Cards
// ==========================================

const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatMessages");
const newChatBtn = document.getElementById("newChatBtn");
const sidebarGroups = document.getElementById("sidebarGroups");
const searchInput = document.getElementById("sidebarSearchInput");
const micBtn = document.getElementById("micBtn");

// =====================
// SPEECH RECOGNITION
// =====================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
}

// =====================
// LIBRARY MANAGER (The Brain)
// =====================
const LibraryManager = {
    chats: {},
    currentChatId: null,

    // Load from localStorage
    load() {
        try {
            const saved = localStorage.getItem('vedChats');
            this.chats = saved ? JSON.parse(saved) : {};
        } catch (e) {
            this.chats = {};
        }
    },

    // Save to localStorage
    save() {
        try {
            localStorage.setItem('vedChats', JSON.stringify(this.chats));
        } catch (e) {
            console.warn('Library save fail:', e);
        }
    },

    // Create new chat
    createNew() {
        this.currentChatId = 'chat_' + Date.now();
        this.chats[this.currentChatId] = {
            id: this.currentChatId,
            title: 'New Chat',
            messages: [],
            pinned: false,
            saved: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            preview: ''
        };
        this.save();
        chatBox.innerHTML = '<div class="bot-message"><b>Welcome to VED AI</b><br><br>Ask me anything.</div>';
        input.value = '';
        this.render();
        return this.currentChatId;
    },

    // Get current chat
    getCurrent() {
        return this.chats[this.currentChatId];
    },

    // Add message to current chat
    addMessage(sender, text) {
        if (!this.currentChatId || !this.chats[this.currentChatId]) return;
        const chat = this.chats[this.currentChatId];
        chat.messages.push({ sender, text, time: Date.now() });
        chat.updatedAt = Date.now();

        // Auto-title from first user message
        if (chat.messages.length === 1 && sender === 'user') {
            chat.title = text.substring(0, 40);
        }

        // Update preview from last bot message
        if (sender === 'bot') {
            chat.preview = text.substring(0, 60);
        }

        this.save();
        this.render();
    },

    // Rename chat
    rename(id, newTitle) {
        if (this.chats[id]) {
            this.chats[id].title = newTitle.trim() || 'Untitled';
            this.save();
            this.render();
        }
    },

    // Toggle pin
    togglePin(id) {
        if (this.chats[id]) {
            this.chats[id].pinned = !this.chats[id].pinned;
            this.save();
            this.render();
        }
    },

    // Toggle save
    toggleSave(id) {
        if (this.chats[id]) {
            this.chats[id].saved = !this.chats[id].saved;
            this.save();
            this.render();
        }
    },

    // Delete chat
    delete(id) {
        if (!this.chats[id]) return;
        const chat = this.chats[id];
        const msg = chat.saved ? 'Saved chat delete karni hai?' : 'Ye chat delete karni hai?';
        if (!confirm(msg)) return;
        delete this.chats[id];
        if (this.currentChatId === id) {
            this.currentChatId = null;
            chatBox.innerHTML = '<div class="bot-message"><b>Welcome to VED AI</b><br><br>Ask me anything.</div>';
        }
        this.save();
        this.render();
    },

    // Load chat into view
    loadChat(id) {
        if (!this.chats[id]) return;
        this.currentChatId = id;
        const chat = this.chats[id];
        chatBox.innerHTML = '';
        
        chat.messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = msg.sender === 'user' ? 'user-message' : 'bot-message';
            div.textContent = msg.text;
            chatBox.appendChild(div);
        });
        
        chatBox.scrollTop = chatBox.scrollHeight;
        document.body.classList.add('chat-active');
        this.render();
    },

    // Render library (Premium Cards)
    render(searchQuery = '') {
        if (!sidebarGroups) return;
        sidebarGroups.innerHTML = '';

        const allChats = Object.values(this.chats)
            .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return b.updatedAt - a.updatedAt;
            });

        // Search filter
        const filtered = allChats.filter(chat => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return chat.title.toLowerCase().includes(q) ||
                   chat.preview.toLowerCase().includes(q) ||
                   chat.messages.some(m => m.text.toLowerCase().includes(q));
        });

        if (filtered.length === 0) {
            sidebarGroups.innerHTML = '<div style="padding:20px;text-align:center;color:#9aa4b2;font-size:13px;">Koi chat nahi mili</div>';
            return;
        }

        // Render cards
        filtered.forEach(chat => {
            const card = document.createElement('div');
            card.className = 'lib-card' + (chat.pinned ? ' pinned' : '') + (chat.id === this.currentChatId ? ' active' : '');
            card.dataset.id = chat.id;

            // Time ago
            const ago = this.timeAgo(chat.updatedAt);

            card.innerHTML = `
                <div class="lib-card-top">
                    <div class="lib-title">${this.escapeHtml(chat.title)}</div>
                    <button class="lib-menu-btn" type="button">⋮</button>
                </div>
                <div class="lib-meta">${ago} • ${chat.messages.length} msgs</div>
                <div class="lib-preview">${this.escapeHtml(chat.preview || 'Koi message nahi...')}</div>
                <div class="lib-menu" style="display:none;">
                    <button class="lib-act" data-act="rename">✏️ Rename</button>
                    <button class="lib-act" data-act="pin">${chat.pinned ? '📌 Unpin' : '📌 Pin'}</button>
                    <button class="lib-act" data-act="save">${chat.saved ? '💾 Unsave' : '💾 Save'}</button>
                    <button class="lib-act lib-danger" data-act="delete">🗑️ Delete</button>
                </div>
            `;

            sidebarGroups.appendChild(card);
        });

        this.attachCardEvents();
    },

    // Attach events to cards
    attachCardEvents() {
        sidebarGroups.querySelectorAll('.lib-card').forEach(card => {
            const id = card.dataset.id;

            // Card click = load chat
            card.addEventListener('click', (e) => {
                if (e.target.closest('.lib-menu-btn') || e.target.closest('.lib-menu')) return;
                this.loadChat(id);
            });

            // Menu toggle
            const menuBtn = card.querySelector('.lib-menu-btn');
            const menu = card.querySelector('.lib-menu');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close all other menus
                sidebarGroups.querySelectorAll('.lib-menu').forEach(m => {
                    if (m !== menu) m.style.display = 'none';
                });
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            });

            // Menu actions
            menu.querySelectorAll('.lib-act').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const act = btn.dataset.act;
                    menu.style.display = 'none';

                    if (act === 'rename') {
                        const newTitle = prompt('Naya naam:', this.chats[id].title);
                        if (newTitle !== null) this.rename(id, newTitle);
                    } else if (act === 'pin') {
                        this.togglePin(id);
                    } else if (act === 'save') {
                        this.toggleSave(id);
                    } else if (act === 'delete') {
                        this.delete(id);
                    }
                });
            });
        });

        // Close menus on outside click
        document.addEventListener('click', () => {
            sidebarGroups.querySelectorAll('.lib-menu').forEach(m => m.style.display = 'none');
        }, { once: false });
    },

    // Time ago helper
    timeAgo(ts) {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Abhi abhi';
        if (mins < 60) return mins + ' min pehle';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + ' ghante pehle';
        const days = Math.floor(hrs / 24);
        if (days < 7) return days + ' din pehle';
        return new Date(ts).toLocaleDateString();
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// =====================
// STREAMING CHAT (existing system ke saath integrate)
// =====================
async function streamChat(text) {
    if (!text.trim()) return;
    
    document.body.classList.add('chat-active');
    
    // Ensure current chat exists
    if (!LibraryManager.currentChatId || !LibraryManager.chats[LibraryManager.currentChatId]) {
        LibraryManager.createNew();
    }

    // Add user message
    const userDiv = document.createElement('div');
    userDiv.className = 'user-message';
    userDiv.textContent = text;
    chatBox.appendChild(userDiv);
    LibraryManager.addMessage('user', text);

    input.value = '';

    // Bot placeholder
    const botDiv = document.createElement('div');
    botDiv.className = 'bot-message';
    botDiv.innerHTML = '<span class="ved-dots"><span></span><span></span><span></span></span>';
    chatBox.appendChild(botDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    let fullText = '';
    try {
        const res = await fetch('/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n\n');
            buffer = lines.pop();

            lines.forEach(line => {
                if (!line.startsWith('data:')) return;
                try {
                    const obj = JSON.parse(line.slice(5));
                    if (obj.t) {
                        fullText += obj.t;
                        botDiv.textContent = fullText;
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                } catch (e) {}
            });
        }

        if (!fullText) fullText = 'Kuch gadbad ho gayi. Dobara prayas karein. 🙏';
        botDiv.textContent = fullText;
        
    } catch (err) {
        fullText = 'Internet mein dikkat. Dobara try karein.';
        botDiv.textContent = fullText;
    }

    // Save bot reply
    LibraryManager.addMessage('bot', fullText);
    
    // Speak if voice mode on
    if (window.SpeechEngine && typeof window.SpeechEngine.speak === 'function') {
        window.SpeechEngine.speak(fullText);
    }
}

// =====================
// SEARCH (debounced)
// =====================
let searchTimer;
if (searchInput) {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            LibraryManager.render(searchInput.value.trim());
        }, 200);
    });
}

// =====================
// EVENT BINDINGS
// =====================
button.addEventListener('click', () => {
    const msg = input.value.trim();
    if (msg) streamChat(msg);
});

input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const msg = input.value.trim();
        if (msg) streamChat(msg);
    }
});

newChatBtn.addEventListener('click', () => {
    LibraryManager.createNew();
});

// Mic button
if (micBtn && recognition) {
    micBtn.addEventListener('click', () => {
        recognition.start();
        micBtn.classList.add('listening');
    });

    recognition.onresult = (e) => {
        input.value = e.results[0][0].transcript;
        streamChat(input.value);
    };

    recognition.onend = () => micBtn.classList.remove('listening');
    recognition.onerror = () => micBtn.classList.remove('listening');
}

// =====================
// BOOT
// =====================
window.addEventListener('load', () => {
    LibraryManager.load();
    LibraryManager.render();
});
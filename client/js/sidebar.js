// ==========================================
// VED AI — SIDEBAR CONTROLLER
// Handles: collapse/expand, search filter,
// time-grouped chat list, rename/delete menu.
// Talks to script_new.js only through the
// onSelect / onDelete callbacks below —
// it doesn't touch chats{} directly.
// ==========================================

const Sidebar = (function () {

    let collapsed = false;
    let activeId = null;
    let selectCallback = null;
    let deleteCallback = null;
    let openMenuId = null;

    // Each entry: { id, title, timestamp }
    let entries = [];

    let root, toggleBtn, searchInput, groupsEl;

    function init() {

        root = document.querySelector(".sidebar");
        toggleBtn = document.getElementById("sidebarCollapseBtn");
        searchInput = document.getElementById("sidebarSearchInput");
        groupsEl = document.getElementById("sidebarGroups");

        toggleBtn.addEventListener("click", toggleCollapse);
        searchInput.addEventListener("input", () => render(searchInput.value));

        // Close any open context menu when clicking elsewhere
        document.addEventListener("click", (e) => {
            if (openMenuId && !e.target.closest(".chat-row-menu") && !e.target.closest(".chat-row-kebab")) {
                closeMenu();
            }
        });

        render();
    }

    function toggleCollapse() {
        collapsed = !collapsed;
        root.classList.toggle("collapsed", collapsed);
    }

    function timeGroup(ts) {

        const now = new Date();
        const d = new Date(ts);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfEntry = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        const diffDays = Math.round((startOfToday - startOfEntry) / 86400000);

        if (diffDays <= 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays <= 7) return "Previous 7 Days";
        return "Older";

    }

    // Called from script_new.js's saveHistory() with the chat's id + first message
    function addChat(id, title) {

        entries = entries.filter(e => e.id !== id);
        entries.unshift({
            id,
            title: title.slice(0, 60),
            timestamp: Number(id) || Date.now()
        });

        setActive(id);
        render(searchInput.value);

    }

    function renameChat(id, newTitle) {
        const entry = entries.find(e => e.id === id);
        if (entry) entry.title = newTitle.slice(0, 60);
        render(searchInput.value);
    }

    function removeChat(id) {
        entries = entries.filter(e => e.id !== id);
        render(searchInput.value);
    }

    function setActive(id) {
        activeId = id;
        render(searchInput ? searchInput.value : "");
    }

    function closeMenu() {
        const openEl = document.querySelector(".chat-row-menu");
        if (openEl) openEl.remove();
        document.querySelectorAll(".chat-row-kebab.menu-open")
            .forEach(el => el.classList.remove("menu-open"));
        openMenuId = null;
    }

    function openMenu(id, kebabEl, rowEl) {

        closeMenu();
        openMenuId = id;
        kebabEl.classList.add("menu-open");

        const menu = document.createElement("div");
        menu.className = "chat-row-menu";
        menu.innerHTML = `
            <button type="button" data-action="rename">Rename</button>
            <button type="button" data-action="delete" class="danger">Delete</button>
        `;

        menu.addEventListener("click", (e) => {

            const action = e.target.dataset.action;
            if (!action) return;

            if (action === "rename") {
                const entry = entries.find(en => en.id === id);
                const next = prompt("Rename conversation", entry ? entry.title : "");
                if (next && next.trim()) renameChat(id, next.trim());
            }

            if (action === "delete") {
                if (confirm("Delete this conversation? This can't be undone.")) {
                    removeChat(id);
                    if (deleteCallback) deleteCallback(id);
                }
            }

            closeMenu();

        });

        rowEl.appendChild(menu);
        requestAnimationFrame(() => menu.classList.add("open"));

    }

    function render(filter = "") {

        groupsEl.innerHTML = "";

        const q = filter.trim().toLowerCase();
        const filtered = q
            ? entries.filter(e => e.title.toLowerCase().includes(q))
            : entries;

        if (filtered.length === 0) {
            const empty = document.createElement("div");
            empty.className = "sidebar-empty";
            empty.textContent = q ? "No matches." : "No conversations yet.";
            groupsEl.appendChild(empty);
            return;
        }

        const order = ["Today", "Yesterday", "Previous 7 Days", "Older"];
        const buckets = {};

        filtered.forEach(e => {
            const g = timeGroup(e.timestamp);
            if (!buckets[g]) buckets[g] = [];
            buckets[g].push(e);
        });

        order.forEach(groupName => {

            const items = buckets[groupName];
            if (!items || items.length === 0) return;

            const groupEl = document.createElement("div");
            groupEl.className = "chat-group";

            const label = document.createElement("div");
            label.className = "chat-group-label";
            label.textContent = groupName;
            groupEl.appendChild(label);

            items.forEach(entry => {

                const row = document.createElement("div");
                row.className = "chat-row" + (entry.id === activeId ? " active" : "");
                row.dataset.chatId = entry.id;

                const title = document.createElement("span");
                title.className = "chat-row-title";
                title.textContent = entry.title;
                row.appendChild(title);

                const kebab = document.createElement("button");
                kebab.type = "button";
                kebab.className = "chat-row-kebab";
                kebab.setAttribute("aria-label", "Conversation options");
                kebab.textContent = "\u22EF";
                kebab.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openMenu(entry.id, kebab, row);
                });
                row.appendChild(kebab);

                row.addEventListener("click", () => {
                    setActive(entry.id);
                    if (selectCallback) selectCallback(entry.id);
                });

                groupEl.appendChild(row);

            });

            groupsEl.appendChild(groupEl);

        });

    }

    return {
        init,
        addChat,
        removeChat,
        renameChat,
        setActive,
        onSelect: (cb) => { selectCallback = cb; },
        onDelete: (cb) => { deleteCallback = cb; }
    };

})();

document.addEventListener("DOMContentLoaded", Sidebar.init);
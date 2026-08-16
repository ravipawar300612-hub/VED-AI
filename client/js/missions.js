(function () {
    'use strict';
    const API_BASE = '/api/missions';
    const TAGS = {
        prahari: 'System ka Remote Control',
        avenger: 'Digital Lawyer',
        nyay: 'Digital Lok Adalat',
        satya: 'Deepfake Detector'
    };
    const ASKS = {
        prahari: 'Civic issue likho:',
        avenger: 'Consumer case likho:',
        nyay: 'Dispute likho:',
        satya: 'Forwarded message paste karo:'
    };
    const FALLBACK = [
        { id: 'prahari', name: 'VED PRAHARI', icon: '🏛️' },
        { id: 'avenger', name: 'VED AVENGER', icon: '⚖️' },
        { id: 'nyay', name: 'VED NYAY', icon: '🤝' },
        { id: 'satya', name: 'VED SATYA-SHIELD', icon: '👁️' }
    ];
    let missions = FALLBACK;
    function el(tag, cls, html) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html !== undefined) n.innerHTML = html;
        return n;
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
    const btn = el('button', null, '🚀');
    btn.id = 'missionsBtn';
    btn.title = 'VED Missions';
    document.body.appendChild(btn);
    const overlay = el('div');
    overlay.id = 'missionsOverlay';
    document.body.appendChild(overlay);
    btn.addEventListener('click', function () { overlay.classList.add('open'); renderList(); });
    function close() { overlay.classList.remove('open'); }
    function head(title, sub, showClose) {
        const h = el('div', 'ms-head');
        if (!showClose) {
            const back = el('button', 'ms-back', '←');
            back.onclick = renderList;
            h.appendChild(back);
        }
        const t = el('div');
        t.innerHTML = '<div class="ms-title">' + title + '</div>' + (sub ? '<div class="ms-sub">' + esc(sub) + '</div>' : '');
        h.appendChild(t);
        if (showClose) {
            const x = el('button', 'ms-back', '✕');
            x.onclick = close;
            h.appendChild(x);
        }
        return h;
    }
    function renderList() {
        overlay.innerHTML = '';
        overlay.appendChild(head('🚀 VED MISSIONS', 'Jo kaam baaki AI nahi karte', true));
        const grid = el('div', 'ms-grid');
        missions.forEach(function (m) {
            const card = el('div', 'ms-card');
            card.innerHTML = '<div class="ms-icon">' + m.icon + '</div><div class="ms-name">' + esc(m.name) + '</div><div class="ms-tag">' + esc(TAGS[m.id] || '') + '</div>';
            card.addEventListener('click', function () { renderComposer(m); });
            grid.appendChild(card);
        });
        overlay.appendChild(grid);
    }
    function renderComposer(m) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), ASKS[m.id] || 'Case likho:', false));
        const ta = el('textarea');
        ta.id = 'msText';
        ta.placeholder = 'Yahan apna case likho...';
        overlay.appendChild(ta);
        const send = el('button', 'ms-primary', '⚡ Mission Launch Karo');
        send.addEventListener('click', function () { launch(m, ta.value); });
        overlay.appendChild(send);
        ta.focus();
    }
    function renderLoading(m) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), 'VED kaam kar raha hai...', false));
        overlay.appendChild(el('div', 'ms-spinner'));
        overlay.appendChild(el('div', 'ms-loading-text', 'Mission report taiyar ho rahi hai...'));
    }
    function renderReport(m, report) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), 'MISSION REPORT ✅', false));
        const box = el('div', 'ms-report');
        box.innerHTML = fmt(report);
        overlay.appendChild(box);
        const actions = el('div', 'ms-actions');
        const copy = el('button', null, '📋 Copy Karo');
        copy.onclick = function () {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(report).then(function () { copy.textContent = '✅ Copied!'; });
            } else {
                alert('Text select karke copy karo.');
            }
        };
        const again = el('button', null, '🔄 Naya Mission');
        again.onclick = renderList;
        actions.appendChild(copy);
        actions.appendChild(again);
        overlay.appendChild(actions);
        overlay.scrollTop = 0;
    }
    function renderError(m, msg) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), '', false));
        overlay.appendChild(el('div', 'ms-error', '❌ ' + esc(msg || 'Kuch galat ho gaya. Dobara try karo.')));
        const actions = el('div', 'ms-actions');
        const retry = el('button', null, '↩️ Wapas');
        retry.onclick = renderList;
        actions.appendChild(retry);
        overlay.appendChild(actions);
    }
    function launch(m, text) {
        const t = (text || '').trim();
        if (!t) { alert('Pehle apna case likho!'); return; }
        renderLoading(m);
        fetch(API_BASE + '/' + m.id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: t })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) throw new Error(data.error || 'Server error');
            renderReport(m, data.report);
        })
        .catch(function (e) {
            renderError(m, e && e.message);
        });
    }
    fetch(API_BASE)
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.success && d.missions && d.missions.length) missions = d.missions; })
        .catch(function () {});
})();
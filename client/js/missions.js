/* =====================================
   VED MISSIONS HUB — Professional Client
   Founder : Sayali P. R. Pawar
===================================== */
(function () {
    'use strict';

    const API_BASE = '/api/missions';

    const FALLBACK = [
        { id: 'prahari', name: 'VED PRAHARI', icon: '🏛️', tag: 'System ka Remote Control', ask: 'Civic issue likho:' },
        { id: 'avenger', name: 'VED AVENGER', icon: '⚖️', tag: 'Digital Lawyer', ask: 'Consumer case likho:' },
        { id: 'nyay', name: 'VED NYAY', icon: '🤝', tag: 'Digital Lok Adalat', ask: 'Dispute likho:' },
        { id: 'satya', name: 'VED SATYA-SHIELD', icon: '👁️', tag: 'Deepfake Forensics', ask: 'Forwarded message paste karo:' },
        { id: 'prana', name: 'VED PRANA', icon: '🫀', tag: 'Health & Mind Companion', ask: 'Tabiyat ya feelings likho:' },
        { id: 'hunar', name: 'VED HUNAR', icon: '💼', tag: 'Talent → Roadmap → Kamai', ask: 'Interests likho:' },
        { id: 'yaadsathi', name: 'VED YAADSATHI', icon: '❤️', tag: 'Buzurgon ka Memory Companion', ask: 'Buzurg ki yaad likho:' },
        { id: 'ustaad', name: 'VED USTAAD', icon: '🎓', tag: 'Padhai Buddy', ask: 'Doubt ya topic likho:' },
        { id: 'dawai', name: 'VED DAWAI DECODER', icon: '💊', tag: 'Medicine Translator', ask: 'Dawai ka naam likho:' },
        { id: 'sarkari', name: 'VED SARKARI SAHAYAK', icon: '📋', tag: 'Form Guide', ask: 'Kaunsa form bharna hai:' },
        { id: 'traffic', name: 'VED TRAFFIC RIGHTS', icon: '🚦', tag: 'Traffic Legal Advisor', ask: 'Police ne kyu roka:' },
        { id: 'upi', name: 'VED UPI SHIELD', icon: '💸', tag: 'UPI Fraud Detector', ask: 'UPI message paste karo:' },
        { id: 'kisan', name: 'VED KISAN SHIELD', icon: '🌾', tag: 'Kisan ka Digital Bodyguard', ask: 'Fasal ki problem likho:' },
        { id: 'health', name: 'VED HEALTH SHIELD', icon: '🚑', tag: 'First Aid + Symptom Guide', ask: 'Symptoms likho:' },
        { id: 'bankfraud', name: 'VED BANK FRAUD SHIELD', icon: '🏦', tag: 'Bank Scam Detector', ask: 'Bank message/call likho:' },
        { id: 'raksha', name: 'VED RAKSHA', icon: '🛡️', tag: 'Women Safety & Rights', ask: 'Situation likho:' },
        { id: 'scholar', name: 'VED SCHOLARSHIP RADAR', icon: '🎯', tag: 'Scholarship Finder', ask: 'Class/course + state likho:' },
        { id: 'rozgar', name: 'VED ROZGAR', icon: '🧑‍', tag: 'Resume + Pehli Naukri', ask: 'Qualification + interest likho:' },
        { id: 'bima', name: 'VED BIMA SAHAYAK', icon: '📑', tag: 'Insurance Claim Guide', ask: 'Kaunsa claim karna hai:' },
        { id: 'apatkal', name: 'VED APATKAL', icon: '🚨', tag: 'Emergency First-Response', ask: 'Emergency likho:' }
    ];

    let missions = FALLBACK;

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function fmt(s) {
        return esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
    }

    // ==========================================
    // 🚀 ROCKET — UPAR RIGHT CORNER
    // ==========================================
    const btn = document.createElement('button');
    btn.id = 'missionsBtn';
    btn.title = 'VED Missions';
    btn.textContent = '🚀';
    btn.style.cssText = `
        position: fixed !important;
        left: auto !important;
        top: 20px !important;
        bottom: auto !important;
        right: 20px !important;
        width: 60px !important;
        height: 60px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #ff416c, #ff4b2b) !important;
        color: white !important;
        font-size: 28px !important;
        border: 3px solid rgba(255,255,255,0.8) !important;
        box-shadow: 0 8px 25px rgba(0,0,0,0.5) !important;
        z-index: 999999 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: transform 0.2s !important;
    `;
    btn.onmouseover = function() { btn.style.transform = 'scale(1.1) rotate(15deg)'; };
    btn.onmouseout = function() { btn.style.transform = 'scale(1) rotate(0deg)'; };
    document.body.appendChild(btn);

    // ==========================================
    // 🧹 PURANE ALAG BUTTONS HIDE (sab rocket mein)
    // ==========================================
    function hideFloaters() {
        document.querySelectorAll('button, a, div[role="button"]').forEach(function (b) {
            if (b.id === 'missionsBtn') return;
            const key = ((b.id || '') + ' ' + (b.className || '')).toLowerCase();
            if (/(health|heart|suraksha|shield|kyc|scam|kisan|farmer|crop)/.test(key)) {
                b.style.display = 'none';
            }
        });
    }
    setTimeout(hideFloaters, 400);
    setTimeout(hideFloaters, 1200);
    setTimeout(hideFloaters, 2500);

    const overlay = document.createElement('div');
    overlay.id = 'missionsOverlay';
    document.body.appendChild(overlay);

    btn.addEventListener('click', function () {
        overlay.classList.add('open');
        renderList();
    });

    function close() { overlay.classList.remove('open'); }

    function head(title, sub, showClose) {
        const h = document.createElement('div');
        h.className = 'ms-head';
        if (!showClose) {
            const back = document.createElement('button');
            back.className = 'ms-back';
            back.textContent = '←';
            back.onclick = renderList;
            h.appendChild(back);
        }
        const t = document.createElement('div');
        t.innerHTML = '<div class="ms-title">' + title + '</div>' + (sub ? '<div class="ms-sub">' + esc(sub) + '</div>' : '');
        h.appendChild(t);
        if (showClose) {
            const x = document.createElement('button');
            x.className = 'ms-back';
            x.textContent = '✕';
            x.onclick = close;
            h.appendChild(x);
        }
        return h;
    }

    function renderList() {
        overlay.innerHTML = '';
        overlay.appendChild(head('🚀 VED MISSIONS', 'Jo kaam baaki AI nahi karte — VED karta hai.', true));
        const grid = document.createElement('div');
        grid.className = 'ms-grid';
        missions.forEach(function (m) {
            const card = document.createElement('div');
            card.className = 'ms-card';
            card.innerHTML =
                '<div class="ms-icon">' + m.icon + '</div>' +
                '<div class="ms-name">' + esc(m.name) + '</div>' +
                '<div class="ms-tag">' + esc(m.tag || '') + '</div>';
            card.addEventListener('click', function () { renderComposer(m); });
            grid.appendChild(card);
        });
        overlay.appendChild(grid);
    }

    function renderComposer(m) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), m.ask || 'Apna case likho:', false));
        const ta = document.createElement('textarea');
        ta.id = 'msText';
        ta.placeholder = 'Yahan apna case likho...';
        overlay.appendChild(ta);
        const send = document.createElement('button');
        send.className = 'ms-primary';
        send.textContent = '⚡ Mission Launch Karo';
        send.addEventListener('click', function () { launch(m, ta.value); });
        overlay.appendChild(send);
        ta.focus();
    }

    function renderLoading(m) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), 'VED kaam kar raha hai...', false));
        const sp = document.createElement('div');
        sp.className = 'ms-spinner';
        overlay.appendChild(sp);
        const lt = document.createElement('div');
        lt.className = 'ms-loading-text';
        lt.textContent = 'Mission report taiyar ho rahi hai...';
        overlay.appendChild(lt);
    }

    function renderReport(m, report) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), 'MISSION REPORT ✅', false));
        const box = document.createElement('div');
        box.className = 'ms-report';
        box.innerHTML = fmt(report);
        overlay.appendChild(box);
        const actions = document.createElement('div');
        actions.className = 'ms-actions';
        const copy = document.createElement('button');
        copy.textContent = '📋 Copy Karo';
        copy.onclick = function () {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(report).then(function () { copy.textContent = '✅ Copied!'; });
            } else {
                alert('Text select karke copy karo.');
            }
        };
        const again = document.createElement('button');
        again.textContent = '🔄 Naya Mission';
        again.onclick = renderList;
        actions.appendChild(copy);
        actions.appendChild(again);
        overlay.appendChild(actions);
        overlay.scrollTop = 0;
    }

    function renderError(m, msg) {
        overlay.innerHTML = '';
        overlay.appendChild(head(m.icon + ' ' + esc(m.name), '', false));
        const er = document.createElement('div');
        er.className = 'ms-error';
        er.textContent = '❌ ' + (msg || 'Kuch galat ho gaya. Dobara try karo.');
        overlay.appendChild(er);
        const actions = document.createElement('div');
        actions.className = 'ms-actions';
        const retry = document.createElement('button');
        retry.textContent = '↩️ Wapas';
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
/* =====================================
   VED MISSIONS HUB — INTERNATIONAL (i18n)
   English UI + Auto-Language Responses
   Founder : Sayali P. R. Pawar
===================================== */
(function () {
    'use strict';

    const API_BASE = '/api/missions';

    // English master dictionary (names + tags + asks)
    const EN = {
        prahari:   { name: 'VED PRAHARI',           tag: 'Civic System Remote Control',   ask: 'Describe your civic issue:' },
        avenger:   { name: 'VED AVENGER',           tag: 'Digital Consumer Lawyer',       ask: 'Describe your consumer case:' },
        nyay:      { name: 'VED NYAY',              tag: "Digital People's Court",        ask: 'Describe your dispute:' },
        satya:     { name: 'VED SATYA-SHIELD',      tag: 'Deepfake Forensics',            ask: 'Paste the forwarded message:' },
        prana:     { name: 'VED PRANA',             tag: 'Health & Mind Companion',       ask: 'Describe health or feelings:' },
        hunar:     { name: 'VED HUNAR',             tag: 'Talent to Roadmap to Earnings', ask: 'List your interests:' },
        yaadsathi: { name: 'VED YAADSATHI',         tag: 'Memory Companion for Elders',   ask: "Describe the elder's memory:" },
        ustaad:    { name: 'VED USTAAD',            tag: 'Study Buddy',                   ask: 'Write your doubt or topic:' },
        dawai:     { name: 'VED DAWAI DECODER',     tag: 'Medicine Translator',           ask: 'Write the medicine name:' },
        sarkari:   { name: 'VED SARKARI SAHAYAK',   tag: 'Government Form Guide',         ask: 'Which form do you need?' },
        traffic:   { name: 'VED TRAFFIC RIGHTS',    tag: 'Traffic Legal Advisor',         ask: 'Why did police stop you?' },
        upi:       { name: 'VED UPI SHIELD',        tag: 'UPI Fraud Detector',            ask: 'Paste the UPI message:' },
        kisan:     { name: 'VED KISAN SHIELD',      tag: "Farmer's Digital Bodyguard",    ask: 'Describe the crop problem:' },
        health:    { name: 'VED HEALTH SHIELD',     tag: 'First Aid + Symptom Guide',     ask: 'List the symptoms:' },
        bankfraud: { name: 'VED BANK FRAUD SHIELD', tag: 'Bank Scam Detector',            ask: 'Describe the bank message or call:' },
        raksha:    { name: 'VED RAKSHA',            tag: 'Women Safety & Rights',         ask: 'Describe the situation:' },
        scholar:   { name: 'VED SCHOLARSHIP RADAR', tag: 'Scholarship Finder',            ask: 'Class/course + state:' },
        rozgar:    { name: 'VED ROZGAR',            tag: 'Resume + First Job',            ask: 'Qualification + interest:' },
        bima:      { name: 'VED BIMA SAHAYAK',      tag: 'Insurance Claim Guide',         ask: 'Which claim do you want to file?' },
        apatkal:   { name: 'VED APATKAL',           tag: 'Emergency First-Response',      ask: 'Describe the emergency:' }
    };

    const FALLBACK = Object.keys(EN).map(function (id) {
        return { id: id, name: EN[id].name, icon: '', tag: EN[id].tag, ask: EN[id].ask };
    });
    const ICONS = { prahari:'🏛️', avenger:'⚖️', nyay:'🤝', satya:'👁️', prana:'🫀', hunar:'💼', yaadsathi:'❤️', ustaad:'🎓', dawai:'💊', sarkari:'📋', traffic:'🚦', upi:'💸', kisan:'🌾', health:'🚑', bankfraud:'🏦', raksha:'🛡️', scholar:'🎯', rozgar:'🧑‍💼', bima:'📑', apatkal:'🚨' };

    let missions = FALLBACK;

    // Server list lao, par English dictionary se override karo
    function normalize(list) {
        return (list || []).map(function (m) {
            const e = EN[m.id] || {};
            return {
                id: m.id,
                name: e.name || m.name,
                tag: e.tag || m.tag || '',
                ask: e.ask || m.ask || 'Describe your case:',
                icon: m.icon || ICONS[m.id] || '🛰️'
            };
        });
    }

    // ---------- LANGUAGE DETECTION ----------
    function detectLang(t) {
        const s = String(t || '');
        const dev = /[\u0900-\u097F]/.test(s);
        const marathiWords = /(आहे|आहात|नाही|काय|कसे|कशी|झाले|झाली|मला|तुम्ही|होय|करू|हवी|पाहिजे)/.test(s);
        const marathiRoman = /\b(ahe|aahet|nahi|kay|kasa|zala|zali|mala|tumhi|hoy|karu|havay|pahije)\b/i.test(s);
        const hindiRoman = /\b(kya|hai|ho|kaise|nahi|kab|kahan|kaun|kyun|accha|theek|haan|matlab|yaar|bhai|didi|namaste)\b/i.test(s);
        if (dev) return marathiWords ? 'marathi' : 'hindi';
        if (marathiRoman) return 'marathi';
        if (hindiRoman) return 'hinglish';
        return 'english';
    }
    function langInstruction(t) {
        const l = detectLang(t);
        if (l === 'marathi') return '\n\n[SYSTEM RULE: Reply ONLY in simple Marathi (Devanagari script).]';
        if (l === 'hindi') return '\n\n[SYSTEM RULE: Reply ONLY in simple Hindi (Devanagari script).]';
        if (l === 'hinglish') return '\n\n[SYSTEM RULE: Reply ONLY in Hinglish (Roman Hindi, same style as user input).]';
        return '\n\n[SYSTEM RULE: Reply ONLY in simple English.]';
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function fmt(s) {
        return esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
    }

    // ---------- CLEAN PROFESSIONAL BUTTON (no emoji rocket) ----------
    const btn = document.createElement('button');
    btn.id = 'missionsBtn';
    btn.title = 'VED Missions';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:7px"><circle cx="12" cy="12" r="9"/><path d="M8.5 13.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><path d="M9 10h.01M15 10h.01"/></svg>Missions';
    btn.style.cssText = `
        position: fixed !important;
        top: 18px !important; right: 18px !important;
        width: auto !important; height: 40px !important;
        padding: 0 16px !important;
        border-radius: 999px !important;
        background: #171a1e !important;
        color: #d7dbe0 !important;
        font-size: 13.5px !important; font-weight: 500 !important;
        font-family: inherit !important;
        border: 1px solid rgba(255,255,255,.12) !important;
        box-shadow: 0 2px 10px rgba(0,0,0,.35) !important;
        z-index: 999999 !important; cursor: pointer !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        transition: background .2s !important;
    `;
    btn.onmouseover = function () { btn.style.background = '#1f242a'; };
    btn.onmouseout = function () { btn.style.background = '#171a1e'; };
    document.body.appendChild(btn);

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
        overlay.appendChild(head('VED MISSIONS', 'The jobs other AI won\'t do — VED does.', true));
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
        overlay.appendChild(head(esc(m.name), m.ask || 'Describe your case:', false));
        const ta = document.createElement('textarea');
        ta.id = 'msText';
        ta.placeholder = 'Describe your case here... (Hindi / Marathi / English — VED replies in your language)';
        overlay.appendChild(ta);
        const send = document.createElement('button');
        send.className = 'ms-primary';
        send.textContent = 'Launch Mission';
        send.addEventListener('click', function () { launch(m, ta.value); });
        overlay.appendChild(send);
        ta.focus();
    }

    function renderLoading(m) {
        overlay.innerHTML = '';
        overlay.appendChild(head(esc(m.name), 'VED is working...', false));
        const sp = document.createElement('div');
        sp.className = 'ms-spinner';
        overlay.appendChild(sp);
        const lt = document.createElement('div');
        lt.className = 'ms-loading-text';
        lt.textContent = 'Preparing mission report...';
        overlay.appendChild(lt);
    }

    function renderReport(m, report) {
        overlay.innerHTML = '';
        overlay.appendChild(head(esc(m.name), 'MISSION REPORT', false));
        const box = document.createElement('div');
        box.className = 'ms-report';
        box.innerHTML = fmt(report);
        overlay.appendChild(box);
        const actions = document.createElement('div');
        actions.className = 'ms-actions';
        const copy = document.createElement('button');
        copy.textContent = 'Copy';
        copy.onclick = function () {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(report).then(function () { copy.textContent = 'Copied!'; });
            } else {
                alert('Select the text and copy manually.');
            }
        };
        const again = document.createElement('button');
        again.textContent = 'New Mission';
        again.onclick = renderList;
        actions.appendChild(copy);
        actions.appendChild(again);
        overlay.appendChild(actions);
        overlay.scrollTop = 0;
    }

    function renderError(m, msg) {
        overlay.innerHTML = '';
        overlay.appendChild(head(esc(m.name), '', false));
        const er = document.createElement('div');
        er.className = 'ms-error';
        er.textContent = 'Something went wrong. Please try again.';
        overlay.appendChild(er);
        const actions = document.createElement('div');
        actions.className = 'ms-actions';
        const retry = document.createElement('button');
        retry.textContent = 'Back';
        retry.onclick = renderList;
        actions.appendChild(retry);
        overlay.appendChild(actions);
    }

    function launch(m, text) {
        const t = (text || '').trim();
        if (!t) { alert('Please describe your case first.'); return; }
        renderLoading(m);
        fetch(API_BASE + '/' + m.id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: t + langInstruction(t) })
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
        .then(function (d) {
            if (d && d.success && d.missions && d.missions.length) missions = normalize(d.missions);
        })
        .catch(function () {});
})();
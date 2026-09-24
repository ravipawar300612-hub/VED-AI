// ==========================================
// VED AI — WAKE WORD v2 ("Hey VED" hands-free)
// Founder: Sayali P. R. Pawar
// ==========================================
(function () {
    'use strict';

    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    const KEY = 'vedWakeWord';
    let rec = null;
    let enabled = false;
    let running = false;
    let btn = null;
    let cooldownUntil = 0;

    function overlayOpen() {
        const o = document.getElementById('voiceOverlay');
        return !!(o && o.classList.contains('active'));
    }

    function injectCSS() {
        const st = document.createElement('style');
        st.textContent = '#wakeWordToggleBtn.wake-on{color:#4ade80 !important;border-color:rgba(74,222,128,.5) !important;box-shadow:0 0 10px rgba(74,222,128,.35);animation:wakePulse 1.6s infinite}@keyframes wakePulse{0%,100%{opacity:1}50%{opacity:.55}}';
        document.head.appendChild(st);
    }

    function setBtn() {
        if (!btn) btn = document.getElementById('wakeWordToggleBtn');
        if (!btn) return;
        btn.classList.toggle('wake-on', enabled);
        btn.title = enabled ? 'Hey VED: ON' : 'Hey VED: OFF';
    }

    function toast(msg) {
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.95);color:#fff;padding:10px 18px;border-radius:12px;font-size:13.5px;z-index:2147483647;border:1px solid rgba(255,255,255,0.25);';
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 2200);
    }

    function onHeard(text) {
        if (!enabled || overlayOpen()) return;
        if (Date.now() < cooldownUntil) return;
        const t = String(text || '').toLowerCase();
        const hit = /(hey|hi|hello|oye|are)\s+(ved|red|wed)(\s+ai)?\b/.test(t) || /\bved\s+ai\b/.test(t);
        if (!hit) return;
        cooldownUntil = Date.now() + 4000;
        stop();
        toast('🎤 Hey VED suna!');
        setTimeout(function () {
            if (window.VoiceMode && VoiceMode.open) VoiceMode.open();
        }, 150);
    }

    function start() {
        if (!API || !enabled || running || overlayOpen()) return;
        running = true;
        try {
            rec = new API();
            rec.lang = 'en-IN';
            rec.continuous = true;
            rec.interimResults = true;
            rec.maxAlternatives = 1;
            rec.onresult = function (e) {
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    onHeard(e.results[i][0].transcript);
                }
            };
            rec.onend = function () {
                running = false;
                if (enabled && !overlayOpen()) setTimeout(start, 400);
            };
            rec.onerror = function (e) {
                if (e.error === 'not-allowed') { enabled = false; localStorage.setItem(KEY, '0'); setBtn(); }
                running = false;
            };
            rec.start();
        } catch (err) { running = false; }
    }

    function stop() {
        if (rec) { try { rec.onend = null; rec.abort(); } catch (e) {} rec = null; }
        running = false;
    }

    function enable() { enabled = true; localStorage.setItem(KEY, '1'); setBtn(); start(); }
    function disable() { enabled = false; localStorage.setItem(KEY, '0'); setBtn(); stop(); }

    function init() {
        injectCSS();
        btn = document.getElementById('wakeWordToggleBtn');
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (enabled) { disable(); toast('Hey VED: OFF'); }
                else { enable(); toast('Hey VED: ON — bolo "Hey VED"!'); }
            });
        }
        // Watchdog: voice overlay band ho → wake wapas chalu; overlay khule → wake chup
        setInterval(function () {
            if (enabled && !overlayOpen() && !running) start();
            if (overlayOpen() && running) stop();
        }, 1500);
        if (localStorage.getItem(KEY) === '1') setTimeout(enable, 1500);
        setBtn();
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);

    window.WakeWord = { enable: enable, disable: disable, isEnabled: function () { return enabled; } };
})();
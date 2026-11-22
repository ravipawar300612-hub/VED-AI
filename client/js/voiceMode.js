// ==========================================
// VED AI — VOICE MODE v4.1 (STOPPPPP PRO + VOICE STUDIO + STABLE)
// Founder: Sayali P. R. Pawar
// ==========================================
const VoiceMode = (function () {
    let overlay, statusEl, transcriptEl, waveformEl, waveBars, exitBtn, stopBtn;
    let studioBtn, studioDrawer, studioClose, studioGrid;
    let isOpen = false;
    let isExiting = false;
    let isProcessing = false;
    let queuedText = null;
    let lastInterimText = "";
    let interimTimeout = null;
    let bargeInActive = false;
    let streamController = null;
    let previewAudio = null;
    let voicesCache = null;

    // 🔥 UPGRADED: STOPPPPP, rukooo, band karo sab support karega!
    const STOP_RE = /stop+|ruko*|roko*|band\s*karo?|chup\s*karo?|bas|pause|ruk+|halt|wait|thamb/i;
    const VOICE_KEY = "ved_voice_pref";

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function toast(msg, duration) {
        if (!/^(❌|⚠️)/.test(msg)) { console.log("[VED]", msg); return; }
        const t = document.createElement("div");
        t.textContent = msg;
        t.style.cssText = "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.95);color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:2147483647;max-width:90%;text-align:center;border:1px solid rgba(255,255,255,0.25);";
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, duration || 3000);
    }

    // ---------- INIT ----------
    function init() {
        overlay = document.getElementById("voiceOverlay");
        statusEl = document.getElementById("voiceStatus");
        transcriptEl = document.getElementById("voiceTranscript");
        waveformEl = document.getElementById("voiceWaveform");
        exitBtn = document.getElementById("voiceExitBtn");
        stopBtn = document.getElementById("voiceStopBtn");
        studioBtn = document.getElementById("voiceStudioBtn");
        studioDrawer = document.getElementById("voiceStudioDrawer");
        studioClose = document.getElementById("vsClose");
        studioGrid = document.getElementById("vsGrid");
        if (!overlay || !exitBtn) return;
        waveBars = waveformEl ? Array.from(waveformEl.querySelectorAll("span")) : [];

        exitBtn.addEventListener("click", function (e) { e.stopPropagation(); close(); });
        if (stopBtn) stopBtn.addEventListener("click", function (e) { e.stopPropagation(); interrupt(); });
        if (studioBtn) studioBtn.addEventListener("click", function (e) { e.stopPropagation(); openStudio(); });
        if (studioClose) studioClose.addEventListener("click", function (e) { e.stopPropagation(); closeStudio(); });

        const saved = localStorage.getItem(VOICE_KEY);
        if (saved && window.SpeechEngine && SpeechEngine.setVoice) SpeechEngine.setVoice(saved);
    }

    // ---------- UI STATES ----------
    function setState(state) {
        if (!overlay) return;
        overlay.dataset.state = state;
        const labels = { idle: "Idle", listening: "Listening...", thinking: "Thinking...", speaking: "Speaking..." };
        if (statusEl) statusEl.textContent = labels[state] || "";
        if (!waveformEl) return;
        if (state === "listening" || state === "speaking") waveformEl.classList.add("visible");
        else waveformEl.classList.remove("visible");
    }

    function setWaveAmplitude(a) {
        if (!waveBars || !waveBars.length) return;
        waveBars.forEach(function (bar, i) {
            const variance = 0.5 + Math.sin(i * 1.3) * 0.5;
            bar.style.height = Math.max(6, a * 34 * variance) + "px";
        });
    }
    function resetWave() { if (waveBars) waveBars.forEach(function (b) { b.style.height = "6px"; }); }

    // ---------- VOICE STUDIO 🎛️ ----------
    function openStudio() {
        if (!studioDrawer) return;
        studioDrawer.classList.add("open");
        loadVoices();
    }
    function closeStudio() {
        if (studioDrawer) studioDrawer.classList.remove("open");
        if (previewAudio) { try { previewAudio.pause(); previewAudio = null; } catch (e) {} }
    }

    async function loadVoices() {
        if (!studioGrid || studioGrid.dataset.loaded) return;
        studioGrid.innerHTML = '<div class="vs-loading">Voices load ho rahi hain…</div>';
        try {
            const r = await fetch('/tts/voices');
            const d = await r.json();
            voicesCache = d.voices || [];
            studioGrid.dataset.loaded = "1";
            renderVoices();
        } catch (e) {
            studioGrid.innerHTML = '<div class="vs-loading">⚠️ Voices load nahi hui</div>';
        }
    }

    function renderVoices() {
        const current = localStorage.getItem(VOICE_KEY) || (voicesCache[0] ? voicesCache[0].id : "");
        studioGrid.innerHTML = "";
        voicesCache.forEach(function (v) {
            const card = document.createElement("div");
            card.className = "vs-card" + (v.id === current ? " selected" : "");
            card.innerHTML = '<button class="vs-play" type="button">▶</button><div class="vs-name">' + v.name + '</div>';
            card.querySelector(".vs-play").addEventListener("click", function (e) {
                e.stopPropagation();
                previewVoice(v.id);
            });
            card.addEventListener("click", function () {
                selectVoice(v.id);
                studioGrid.querySelectorAll(".vs-card").forEach(function (c) { c.classList.remove("selected"); });
                card.classList.add("selected");
            });
            studioGrid.appendChild(card);
        });
    }

    function previewVoice(id) {
        if (previewAudio) { try { previewAudio.pause(); previewAudio = null; } catch (e) {} }
        const text = "Namaste! Main VED hoon. Kaisi lagi meri ye awaaz?";
        fetch('/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text, voice: id, mood: 'neutral', u: 'preview' })
        })
            .then(function (r) { if (!r.ok) throw new Error('tts fail'); return r.arrayBuffer(); })
            .then(function (buf) {
                const blob = new Blob([buf], { type: 'audio/wav' });
                previewAudio = new Audio(URL.createObjectURL(blob));
                previewAudio.play();
            })
            .catch(function () { toast('⚠️ Preview fail ho gaya'); });
    }

    function selectVoice(id) {
        localStorage.setItem(VOICE_KEY, id);
        if (window.SpeechEngine && SpeechEngine.setVoice) SpeechEngine.setVoice(id);
        console.log("[VED] Voice selected:", id);
    }

    // ---------- INTERRUPT (REAL STOP 🛑 - Handles STOPPPPP!) ----------
    function interrupt() {
        if (streamController) { try { streamController.abort(); } catch (e) {} streamController = null; }
        try { SpeechEngine.cancelSpeaking(); } catch (e) {}
        try { SpeechEngine.stopListening(); } catch (e) {}
        if (previewAudio) { try { previewAudio.pause(); previewAudio = null; } catch (e) {} }
        bargeInActive = false;
        isProcessing = false;
        queuedText = null;
        resetWave();
        if (isOpen && !isExiting) {
            setState("listening");
            setTimeout(listenStep, 300);
        }
    }

    function startBargeIn() {
        bargeInActive = true;
        SpeechEngine.startListening({
            // Agar beech mein STOPPPPP ya RUKOOO bola toh turant interrupt karega
            onInterim: function (t) { if (t && STOP_RE.test(t)) interrupt(); },
            onFinal: function (t) { if (t && STOP_RE.test(t)) interrupt(); },
            onEnd: function () { if (bargeInActive && isOpen && !isExiting) setTimeout(startBargeIn, 300); },
            onError: function () {}
        });
    }

    // ---------- STREAM + SPEAK ----------
    async function processSpokenText(text) {
        if (!text || !text.trim()) {
            toast("⚠️ Kuch suna nahi, dobara boliye");
            if (isOpen) setTimeout(listenStep, 1000);
            return;
        }
        if (isProcessing) { queuedText = text; return; }
        isProcessing = true;

        setState("thinking");
        resetWave();

        const chatBox = document.getElementById("chatMessages");
        if (chatBox) {
            const um = document.createElement("div");
            um.className = "user-message";
            um.textContent = text;
            chatBox.appendChild(um);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        let fullReply = "";
        let pending = "";
        let speakingStarted = false;
        streamController = new AbortController();

        const speakHooks = {
            onAmplitude: function (a) { if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(a); },
            onEnd: function () {
                resetWave();
                bargeInActive = false;
                try { SpeechEngine.stopListening(); } catch (e) {}
                if (isOpen && !isExiting) setTimeout(listenStep, 500);
            }
        };

        function beginSpeaking() {
            if (speakingStarted) return;
            speakingStarted = true;
            setState("speaking");
            SpeechEngine.speakStreamBegin(speakHooks);
            startBargeIn();
        }

        try {
            const res = await fetch("/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
                signal: streamController.signal
            });
            if (!res.ok || !res.body) throw new Error("stream error");
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = "";

            while (true) {
                const r = await reader.read();
                if (r.done) break;
                buf += dec.decode(r.value, { stream: true });
                const lines = buf.split("\n\n");
                buf = lines.pop();
                for (const line of lines) {
                    if (line.indexOf("data:") !== 0) continue;
                    let obj; try { obj = JSON.parse(line.slice(5)); } catch (e) { continue; }
                    if (obj.t) {
                        fullReply += obj.t;
                        pending += obj.t;
                        let m;
                        while ((m = pending.match(/[^.!?।]+[.!?।]/)) !== null) {
                            const sentence = m[0];
                            pending = pending.slice(sentence.length);
                            beginSpeaking();
                            SpeechEngine.speakStreamPush(sentence);
                        }
                    }
                }
            }

            if (pending.trim()) {
                beginSpeaking();
                SpeechEngine.speakStreamPush(pending);
            }
            if (speakingStarted) SpeechEngine.speakStreamEnd();

            if (chatBox) {
                const bm = document.createElement("div");
                bm.className = "bot-message";
                bm.textContent = fullReply || "Kuch gadbad ho gayi. Dobara prayas karein. 🙏";
                chatBox.appendChild(bm);
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            if (!speakingStarted) {
                setState("speaking");
                SpeechEngine.speak(fullReply || "Maaf kijiye, jawab nahi mila.", {
                    onAmplitude: speakHooks.onAmplitude,
                    onEnd: function () { resetWave(); if (isOpen && !isExiting) setTimeout(listenStep, 500); }
                });
            }
        } catch (err) {
            if (err && err.name === "AbortError") {
                console.log("[VED] Stream stopped by user");
            } else {
                console.error("❌ Voice stream error:", err);
                toast("❌ Internet mein dikkat hai", 3000);
                if (isOpen && !isExiting) setTimeout(listenStep, 1500);
            }
        } finally {
            streamController = null;
            isProcessing = false;
            const q = queuedText; queuedText = null;
            if (q && isOpen && !isExiting) processSpokenText(q);
        }
    }

    // ---------- OPEN / CLOSE ----------
    function open() {
        if (!overlay) return;
        if (!window.SpeechEngine || !SpeechEngine.isSupported) { toast("❌ Browser voice support nahi hai"); return; }
        if (isOpen) close();
        isOpen = true; isExiting = false; lastInterimText = "";
        isProcessing = false; queuedText = null;
        overlay.style.display = "";
        overlay.classList.add("active");
        setState("idle");
        if (transcriptEl) transcriptEl.textContent = "";
        setTimeout(function () { if (isOpen && !isExiting) listenStep(); }, 500);
    }

    function close() {
        if (!overlay) return;
        isExiting = true; isOpen = false; bargeInActive = false;
        if (streamController) { try { streamController.abort(); } catch (e) {} streamController = null; }
        try { SpeechEngine.stopListening(); } catch (e) {}
        try { SpeechEngine.cancelSpeaking(); } catch (e) {}
        if (previewAudio) { try { previewAudio.pause(); previewAudio = null; } catch (e) {} }
        if (interimTimeout) clearTimeout(interimTimeout);
        closeStudio();
        overlay.classList.remove("active");
        resetWave();
        setTimeout(function () { if (!isOpen) overlay.style.display = "none"; }, 300);
    }

    // ---------- LISTEN LOOP ----------
    function listenStep() {
        if (!isOpen || isExiting) return;
        setState("listening");
        if (transcriptEl) transcriptEl.textContent = "";
        lastInterimText = "";
        try { SpeechEngine.stopListening(); } catch (e) {} 

        SpeechEngine.startListening({
            onInterim: function (text) {
                if (transcriptEl) transcriptEl.textContent = text;
                lastInterimText = text;
                if (interimTimeout) clearTimeout(interimTimeout);
                interimTimeout = setTimeout(function () {
                    if (lastInterimText && isOpen && !isExiting) {
                        const t = lastInterimText; lastInterimText = "";
                        processSpokenText(t);
                    }
                }, 2500);
            },
            onAmplitude: function (a) { if (overlay && overlay.dataset.state === "listening") setWaveAmplitude(a); },
            onFinal: async function (text) {
                if (interimTimeout) clearTimeout(interimTimeout);
                if (isExiting || !isOpen) return;
                if (transcriptEl) transcriptEl.textContent = text;
                lastInterimText = "";
                await processSpokenText(text);
            },
            onEnd: function () {
                if (lastInterimText && isOpen && !isExiting && overlay && overlay.dataset.state === "listening") {
                    const t = lastInterimText; lastInterimText = "";
                    processSpokenText(t);
                } else if (isOpen && !isExiting) {
                    setTimeout(listenStep, 400);
                }
            },
            onError: function () { if (isOpen && !isExiting) setTimeout(listenStep, 800); }
        });
    }

    return { init: init, open: open, close: close, interrupt: interrupt };
})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
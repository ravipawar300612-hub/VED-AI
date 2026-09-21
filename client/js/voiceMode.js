// ==========================================
// VED AI — VOICE MODE v3 (FAST + REAL STOP)
// Founder: Sayali P. R. Pawar
// ==========================================
const VoiceMode = (function () {
    let overlay, statusEl, transcriptEl, waveformEl, waveBars, exitBtn, stopBtn;
    let isOpen = false;
    let isExiting = false;
    let lastInterimText = "";
    let interimTimeout = null;
    let bargeInActive = false;

    const STOP_RE = /\b(stop|ruk|ruko|roko|pause|chup|band|bas)\b/i;

    function toast(msg, duration) {
        if (!/^(❌|⚠️)/.test(msg)) { console.log("[VED]", msg); return; }
        const t = document.createElement("div");
        t.textContent = msg;
        t.style.cssText = "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.95);color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:2147483647;max-width:90%;text-align:center;border:1px solid rgba(255,255,255,0.25);";
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, duration || 3000);
    }

    function init() {
        overlay = document.getElementById("voiceOverlay");
        statusEl = document.getElementById("voiceStatus");
        transcriptEl = document.getElementById("voiceTranscript");
        waveformEl = document.getElementById("voiceWaveform");
        exitBtn = document.getElementById("voiceExitBtn");
        if (!overlay || !exitBtn) return;
        waveBars = Array.from(waveformEl.querySelectorAll("span"));

        exitBtn.addEventListener("click", function (e) { e.stopPropagation(); close(); });

        // STOP button (speaking ke waqt dikhta hai)
        stopBtn = document.createElement("button");
        stopBtn.id = "voiceStopBtn";
        stopBtn.type = "button";
        stopBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="margin-right:8px"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>Stop';
        overlay.appendChild(stopBtn);
        stopBtn.addEventListener("click", function (e) { e.stopPropagation(); interrupt(); });

        const st = document.createElement("style");
        st.textContent = "#voiceStopBtn{position:fixed;bottom:34px;left:50%;transform:translateX(-50%);display:none;align-items:center;padding:10px 22px;border-radius:999px;background:rgba(20,20,20,.85);border:1px solid rgba(255,255,255,.25);color:#fff;font-size:14px;font-weight:600;font-family:inherit;z-index:2147483646;cursor:pointer;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}#voiceOverlay[data-state=speaking] #voiceStopBtn{display:inline-flex}";
        document.head.appendChild(st);
    }

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

    // ---------- INTERRUPT (STOP) ----------
    function interrupt() {
        SpeechEngine.cancelSpeaking();
        SpeechEngine.stopListening();
        bargeInActive = false;
        resetWave();
        if (isOpen && !isExiting) {
            setState("listening");
            setTimeout(listenStep, 300);
        }
    }

    function startBargeIn() {
        bargeInActive = true;
        SpeechEngine.startListening({
            onInterim: function (t) { if (STOP_RE.test(t)) interrupt(); },
            onFinal: function (t) { if (STOP_RE.test(t)) interrupt(); },
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

        try {
            const res = await fetch("/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
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
                        // poore sentences turant TTS queue mein
                        let m;
                        while ((m = pending.match(/[^.!?।]+[.!?।]/)) !== null) {
                            const sentence = m[0];
                            pending = pending.slice(sentence.length);
                            if (!speakingStarted) {
                                speakingStarted = true;
                                setState("speaking");
                                SpeechEngine.speakStreamBegin({
                                    onAmplitude: function (a) { if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(a); },
                                    onEnd: function () {
                                        resetWave();
                                        bargeInActive = false;
                                        SpeechEngine.stopListening();
                                        if (isOpen && !isExiting) setTimeout(listenStep, 500);
                                    }
                                });
                                startBargeIn();
                            }
                            SpeechEngine.speakStreamPush(sentence);
                        }
                    } else if (obj.done) {
                        if (obj.error && !fullReply) fullReply = "";
                    }
                }
            }

            // bacha hua pending sentence
            if (pending.trim()) {
                if (!speakingStarted) {
                    speakingStarted = true;
                    setState("speaking");
                    SpeechEngine.speakStreamBegin({
                        onAmplitude: function (a) { if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(a); },
                        onEnd: function () {
                            resetWave();
                            bargeInActive = false;
                            SpeechEngine.stopListening();
                            if (isOpen && !isExiting) setTimeout(listenStep, 500);
                        }
                    });
                    startBargeIn();
                }
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
                // stream khaali tha
                setState("speaking");
                SpeechEngine.speak(fullReply || "Maaf kijiye, jawab nahi mila.", {
                    onAmplitude: function (a) { if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(a); },
                    onEnd: function () { resetWave(); if (isOpen && !isExiting) setTimeout(listenStep, 500); }
                });
            }
        } catch (err) {
            console.error("❌ Voice stream error:", err);
            toast("❌ Internet mein dikkat hai", 3000);
            if (isOpen && !isExiting) setTimeout(listenStep, 1500);
        }
    }

    function open() {
        if (!overlay) return;
        if (!SpeechEngine || !SpeechEngine.isSupported) { toast("❌ Browser voice support nahi hai"); return; }
        if (isOpen) close();
        isOpen = true; isExiting = false; lastInterimText = "";
        overlay.style.display = "";
        overlay.classList.add("active");
        setState("idle");
        if (transcriptEl) transcriptEl.textContent = "";
        setTimeout(function () { if (isOpen && !isExiting) listenStep(); }, 500);
    }

    function close() {
        if (!overlay) return;
        isExiting = true; isOpen = false; bargeInActive = false;
        try { SpeechEngine.stopListening(); } catch (e) {}
        try { SpeechEngine.cancelSpeaking(); } catch (e) {}
        if (interimTimeout) clearTimeout(interimTimeout);
        overlay.classList.remove("active");
        resetWave();
        setTimeout(function () { if (!isOpen) overlay.style.display = "none"; }, 300);
    }

    function listenStep() {
        if (!isOpen || isExiting) return;
        setState("listening");
        if (transcriptEl) transcriptEl.textContent = "";
        lastInterimText = "";

        SpeechEngine.startListening({
            onInterim: function (text) {
                if (transcriptEl) transcriptEl.textContent = text;
                lastInterimText = text;
                if (interimTimeout) clearTimeout(interimTimeout);
                interimTimeout = setTimeout(function () {
                    if (lastInterimText && isOpen && !isExiting) processSpokenText(lastInterimText);
                }, 2500);
            },
            onAmplitude: function (a) { if (overlay && overlay.dataset.state === "listening") setWaveAmplitude(a); },
            onFinal: async function (text) {
                if (interimTimeout) clearTimeout(interimTimeout);
                if (isExiting || !isOpen) return;
                if (transcriptEl) transcriptEl.textContent = text;
                await processSpokenText(text);
            },
            onEnd: function () {
                if (lastInterimText && isOpen && !isExiting && overlay && overlay.dataset.state === "listening") {
                    processSpokenText(lastInterimText);
                } else if (isOpen && !isExiting) {
                    setTimeout(listenStep, 400);
                }
            },
            onError: function () { if (isOpen && !isExiting) setTimeout(listenStep, 800); }
        });
    }

    return { init, open, close };
})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
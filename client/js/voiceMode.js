// ==========================================
// VED AI — VOICE MODE CONTROLLER (FINAL FIX)
// Auto-detect language + Toast feedback
// ==========================================

const VoiceMode = (function () {

    let overlay, statusEl, transcriptEl, waveformEl, waveBars, exitBtn;
    let isOpen = false;
    let isExiting = false;

    function toast(msg, duration = 3000) {
        const t = document.createElement("div");
        t.textContent = msg;
        t.style.cssText = "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,0.95);color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:2147483647;max-width:90%;text-align:center;border:1px solid rgba(255,255,255,0.25);";
        document.body.appendChild(t);
        setTimeout(() => t.remove(), duration);
    }

    function init() {
        overlay = document.getElementById("voiceOverlay");
        statusEl = document.getElementById("voiceStatus");
        transcriptEl = document.getElementById("voiceTranscript");
        waveformEl = document.getElementById("voiceWaveform");
        exitBtn = document.getElementById("voiceExitBtn");

        if (!overlay || !exitBtn) return;
        waveBars = Array.from(waveformEl.querySelectorAll("span"));

        exitBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            close();
        });
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

    function setWaveAmplitude(amplitude) {
        if (!waveBars || waveBars.length === 0) return;
        waveBars.forEach((bar, i) => {
            const variance = 0.5 + Math.sin(i * 1.3) * 0.5;
            const height = Math.max(6, amplitude * 34 * variance);
            bar.style.height = height + "px";
        });
    }

    function resetWave() {
        if (!waveBars) return;
        waveBars.forEach(bar => bar.style.height = "6px");
    }

    // DIRECT API CALL — bypass VedChat completely
    async function directAPICall(text) {
        console.log("🎤 Voice → Server:", text);
        
        // NO lang parameter — let server auto-detect!
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => "");
            throw new Error("Server " + response.status + ": " + errText.slice(0, 100));
        }

        const data = await response.json();
        console.log("🤖 Reply:", data.reply);
        
        // Add to main chat (if open)
        const chatBox = document.getElementById("chatMessages");
        if (chatBox) {
            const userMsg = document.createElement("div");
            userMsg.className = "user-message";
            userMsg.innerHTML = text.replace(/\n/g, "<br>");
            chatBox.appendChild(userMsg);
            
            const botMsg = document.createElement("div");
            botMsg.className = "bot-message";
            botMsg.innerHTML = data.reply.replace(/\n/g, "<br>");
            chatBox.appendChild(botMsg);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        return data.reply || "Sorry, I couldn't generate a response.";
    }

    function open() {
        if (!overlay) return;
        if (!SpeechEngine || !SpeechEngine.isSupported) {
            toast("❌ Browser voice support nahi hai. Chrome use karein.");
            return;
        }
        if (isOpen) close();

        isOpen = true;
        isExiting = false;
        overlay.style.display = "";
        overlay.classList.add("active");
        setState("idle");
        if (transcriptEl) transcriptEl.textContent = "";

        toast("🎙️ Boliye, main sun raha hu...", 2000);
        setTimeout(() => {
            if (isOpen && !isExiting) listenStep();
        }, 500);
    }

    function close() {
        if (!overlay) return;
        isExiting = true;
        isOpen = false;

        if (SpeechEngine) {
            try { SpeechEngine.stopListening(); } catch (e) {}
            try { SpeechEngine.cancelSpeaking(); } catch (e) {}
        }
        overlay.classList.remove("active");
        resetWave();
        setTimeout(() => {
            if (!isOpen) overlay.style.display = "none";
        }, 300);
    }

    function listenStep() {
        if (!isOpen || isExiting) return;
        setState("listening");
        if (transcriptEl) transcriptEl.textContent = "";

        SpeechEngine.startListening({
            onInterim: (text) => {
                if (transcriptEl) transcriptEl.textContent = text;
            },
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "listening") setWaveAmplitude(amp);
            },
            onFinal: async (text) => {
                if (isExiting || !isOpen) return;
                if (transcriptEl) transcriptEl.textContent = text;
                setState("thinking");
                resetWave();

                try {
                    const reply = await directAPICall(text);
                    if (!isOpen || isExiting) return;
                    speakStep(reply);
                } catch (err) {
                    console.error("❌ Voice API Error:", err);
                    toast("❌ Error: " + err.message, 4000);
                    if (transcriptEl) transcriptEl.textContent = "Error: " + err.message;
                    if (isOpen) setTimeout(listenStep, 2500);
                }
            },
            onEnd: () => {
                if (isOpen && !isExiting && overlay && overlay.dataset.state === "listening") {
                    setTimeout(listenStep, 400);
                }
            },
            onError: (err) => {
                console.warn("Recognition error:", err);
                if (isOpen && !isExiting) setTimeout(listenStep, 800);
            }
        });
    }

    function speakStep(reply) {
        if (!isOpen || isExiting) return;
        setState("speaking");

        if (!SpeechEngine || !SpeechEngine.speak) {
            if (isOpen) setTimeout(listenStep, 1000);
            return;
        }

        SpeechEngine.speak(reply, {
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(amp);
            },
            onEnd: () => {
                resetWave();
                if (isOpen && !isExiting) setTimeout(listenStep, 500);
            }
        });
    }

    return { init, open, close };
})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
// ==========================================
// VED AI — VOICE MODE CONTROLLER (FIXED)
// Drives the fullscreen voice overlay:
// idle → listening → thinking → speaking → loop
// ==========================================

const VoiceMode = (function () {

    let overlay, statusEl, transcriptEl, waveformEl, waveBars, exitBtn;
    let isOpen = false;
    let isExiting = false;

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

        const labels = {
            idle: "Idle",
            listening: "Listening...",
            thinking: "Thinking...",
            speaking: "Speaking..."
        };

        if (statusEl) statusEl.textContent = labels[state] || "";

        if (!waveformEl) return;
        if (state === "listening" || state === "speaking") {
            waveformEl.classList.add("visible");
        } else {
            waveformEl.classList.remove("visible");
        }
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

    // ---------------------------------
    // OPEN / CLOSE (FIXED)
    // ---------------------------------

    function open() {
        if (!overlay) return;

        if (!SpeechEngine || !SpeechEngine.isSupported) {
            alert("Voice mode isn't supported in this browser. Try Chrome.");
            return;
        }

        // FORCE RESET — agar pehle se stuck hai toh clear karo
        if (isOpen) close();

        isOpen = true;
        isExiting = false;

        overlay.style.display = "";
        overlay.classList.add("active");
        setState("idle");
        if (transcriptEl) transcriptEl.textContent = "";

        setTimeout(() => {
            if (isOpen && !isExiting) listenStep();
        }, 500);
    }

    function close() {
        if (!overlay) return;

        isExiting = true;
        isOpen = false;

        // FORCE STOP — SpeechEngine ko properly kill karo
        if (SpeechEngine) {
            try { SpeechEngine.stopListening(); } catch (e) {}
            try { SpeechEngine.cancelSpeaking(); } catch (e) {}
        }

        overlay.classList.remove("active");
        resetWave();

        // Hide karo taaki next time clean open ho
        setTimeout(() => {
            if (!isOpen) overlay.style.display = "none";
        }, 300);
    }

    // ---------------------------------
    // CONVERSATION LOOP
    // ---------------------------------

    function listenStep() {
        if (!isOpen || isExiting) return;

        setState("listening");
        if (transcriptEl) transcriptEl.textContent = "";

        if (!SpeechEngine || !SpeechEngine.startListening) {
            close();
            return;
        }

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
                    const reply = await window.VedChat.sendToServer(text, { showThinkingBubble: false });
                    if (!isOpen || isExiting) return;
                    speakStep(reply);
                } catch (err) {
                    console.warn("Voice send error:", err);
                    if (isOpen) setTimeout(listenStep, 800);
                }
            },
            onEnd: () => {
                if (isOpen && !isExiting && overlay && overlay.dataset.state === "listening") {
                    setTimeout(listenStep, 400);
                }
            },
            onError: (err) => {
                console.warn("Voice recognition error:", err);
                if (isOpen && !isExiting) setTimeout(listenStep, 800);
            }
        });
    }

    function speakStep(reply) {
        if (!isOpen || isExiting) return;

        setState("speaking");

        if (!SpeechEngine || !SpeechEngine.speak) {
            if (isOpen) listenStep();
            return;
        }

        SpeechEngine.speak(reply, {
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(amp);
            },
            onEnd: () => {
                resetWave();
                if (isOpen && !isExiting) {
                    setTimeout(listenStep, 500);
                }
            }
        });
    }

    return { init, open, close };
})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
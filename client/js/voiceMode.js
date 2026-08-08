// ==========================================
// VED AI — VOICE MODE CONTROLLER
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

        waveBars = Array.from(waveformEl.querySelectorAll("span"));

        exitBtn.addEventListener("click", close);
    }

    function setState(state) {
        overlay.dataset.state = state;

        const labels = {
            idle: "Idle",
            listening: "Listening...",
            thinking: "Thinking...",
            speaking: "Speaking..."
        };

        statusEl.textContent = labels[state] || "";

        if (state === "listening" || state === "speaking") {
            waveformEl.classList.add("visible");
        } else {
            waveformEl.classList.remove("visible");
        }
    }

    function setWaveAmplitude(amplitude) {
        // amplitude: 0–1, spread unevenly across bars for a natural look
        waveBars.forEach((bar, i) => {
            const variance = 0.5 + Math.sin(i * 1.3) * 0.5;
            const height = Math.max(6, amplitude * 34 * variance);
            bar.style.height = height + "px";
        });
    }

    function resetWave() {
        waveBars.forEach(bar => bar.style.height = "6px");
    }

    // ---------------------------------
    // OPEN / CLOSE
    // ---------------------------------

    function open() {

        if (!SpeechEngine.isSupported) {
            alert("Voice mode isn't supported in this browser. Try Chrome.");
            return;
        }

        isOpen = true;
        isExiting = false;

        overlay.classList.add("active");
        setState("idle");
        transcriptEl.textContent = "";

        // Small delay so the open animation finishes before listening starts
        setTimeout(() => {
            if (isOpen) listenStep();
        }, 400);

    }

    function close() {

        isExiting = true;
        isOpen = false;

        SpeechEngine.stopListening();
        SpeechEngine.cancelSpeaking();

        overlay.classList.remove("active");
        resetWave();

    }

    // ---------------------------------
    // CONVERSATION LOOP
    // ---------------------------------

    function listenStep() {

        if (!isOpen) return;

        setState("listening");
        transcriptEl.textContent = "";

        SpeechEngine.startListening({

            onInterim: (text) => {
                transcriptEl.textContent = text;
            },

            onAmplitude: (amp) => {
                if (overlay.dataset.state === "listening") setWaveAmplitude(amp);
            },

            onFinal: async (text) => {

                if (isExiting) return;

                transcriptEl.textContent = text;
                setState("thinking");
                resetWave();

                // Reuses the same network call + chat-history logic
                // as normal text chat, so voice messages show up in
                // the regular chat log too.
                const reply = await window.VedChat.sendToServer(text, { showThinkingBubble: false });

                if (!isOpen) return;

                speakStep(reply);

            },

            onEnd: () => {
                // If nothing was said (silence timeout), just listen again
                if (isOpen && overlay.dataset.state === "listening") {
                    listenStep();
                }
            },

            onError: (err) => {
                console.warn("Voice recognition error:", err);
                if (isOpen) setTimeout(listenStep, 600);
            }

        });

    }

    function speakStep(reply) {

        if (!isOpen) return;

        setState("speaking");

        SpeechEngine.speak(reply, {

            onAmplitude: (amp) => {
                if (overlay.dataset.state === "speaking") setWaveAmplitude(amp);
            },

            onEnd: () => {
                resetWave();
                if (isOpen) listenStep(); // auto-continue the conversation
            }

        });

    }

    return { init, open, close };

})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
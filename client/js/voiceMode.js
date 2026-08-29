// ==========================================
// VED AI — VOICE MODE CONTROLLER (BRIDGE FIXED)
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
    // ADD MESSAGE TO CHAT (so user sees it)
    // ---------------------------------
    function addToChat(role, text) {
        const chatBox = document.getElementById("chatMessages");
        if (!chatBox) return;
        
        const msgDiv = document.createElement("div");
        msgDiv.className = role === "user" ? "user-message" : "bot-message";
        msgDiv.innerHTML = text.replace(/\n/g, "<br>");
        chatBox.appendChild(msgDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // ---------------------------------
    // DIRECT API CALL (bridge fix)
    // ---------------------------------
    async function sendToServer(text) {
        console.log("🎤 Voice sending:", text);
        
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
            throw new Error("Server error: " + response.status);
        }

        const data = await response.json();
        console.log("🤖 Voice reply:", data.reply);
        
        // Add to chat so user sees it
        addToChat("user", text);
        addToChat("bot", data.reply);
        
        return data.reply;
    }

    // ---------------------------------
    // OPEN / CLOSE
    // ---------------------------------
    function open() {
        if (!overlay) return;

        if (!SpeechEngine || !SpeechEngine.isSupported) {
            alert("Voice mode isn't supported in this browser. Try Chrome.");
            return;
        }

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
                    // Use VedChat if available, otherwise direct API call
                    let reply;
                    if (window.VedChat && window.VedChat.sendToServer) {
                        reply = await window.VedChat.sendToServer(text, { showThinkingBubble: false });
                    } else {
                        reply = await sendToServer(text);
                    }
                    
                    if (!isOpen || isExiting) return;
                    speakStep(reply);
                } catch (err) {
                    console.error("❌ Voice send error:", err);
                    if (isOpen) {
                        if (transcriptEl) transcriptEl.textContent = "Sorry, I couldn't process that. Try again?";
                        setTimeout(listenStep, 1500);
                    }
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
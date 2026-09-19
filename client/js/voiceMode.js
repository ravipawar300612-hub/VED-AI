// ==========================================
// VED AI — VOICE MODE v2 (TURBO MODE)
// Streaming + Interruption Support
// Founder: Sayali P. R. Pawar
// ==========================================

const VoiceMode = (function () {
    let overlay, statusEl, transcriptEl, waveformEl, waveBars, exitBtn;
    let isOpen = false;
    let isExiting = false;
    let lastInterimText = "";
    let interimTimeout = null;
    let isSpeaking = false;

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

        exitBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            close();
        });

        // Set up interrupt callback
        if (SpeechEngine && SpeechEngine.setInterruptCallback) {
            SpeechEngine.setInterruptCallback(() => {
                console.log("🛑 User interrupted, stopping speech");
                toast("🛑 Ruk gaya!", 1500);
                isSpeaking = false;
                setTimeout(listenStep, 500);
            });
        }
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

    // Process text with STREAMING (Fast response!)
    async function processSpokenText(text) {
        if (!text || text.trim().length === 0) {
            toast("⚠️ Kuch suna nahi, dobara boliye");
            if (isOpen) setTimeout(listenStep, 1000);
            return;
        }

        console.log("✅ Processing:", text);
        toast("📤 Bhej raha hu: " + text, 2000);

        setState("thinking");
        resetWave();

        // Add user message to chat
        const chatBox = document.getElementById("chatMessages");
        if (chatBox) {
            const userMsg = document.createElement("div");
            userMsg.className = "user-message";
            userMsg.innerHTML = text.replace(/\n/g, "<br>");
            chatBox.appendChild(userMsg);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        try {
            // Use STREAMING endpoint for fast response
            const response = await fetch("/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok || !response.body) {
                throw new Error("Stream error");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullReply = "";
            let firstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (!line.startsWith('data:')) continue;

                    try {
                        const data = JSON.parse(line.slice(5));

                        if (data.t) {
                            fullReply += data.t;

                            // On first chunk, switch to speaking mode
                            if (firstChunk && isOpen && !isExiting) {
                                firstChunk = false;
                                toast("🔊 Bolne laga...", 1000);
                                setState("speaking");
                                isSpeaking = true;
                            }
                        } else if (data.done) {
                            // Add bot message to chat
                            if (chatBox && fullReply) {
                                const botMsg = document.createElement("div");
                                botMsg.className = "bot-message";
                                botMsg.innerHTML = fullReply.replace(/\n/g, "<br>");
                                chatBox.appendChild(botMsg);
                                chatBox.scrollTop = chatBox.scrollHeight;
                            }

                            // Start speaking the full reply
                            if (isOpen && !isExiting && fullReply) {
                                speakStep(fullReply);
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
            }
        } catch (err) {
            console.error("❌ Stream Error:", err);
            toast("❌ Error: " + err.message, 4000);
            if (isOpen) setTimeout(listenStep, 2000);
        }
    }

    function open() {
        if (!overlay) return;
        if (!SpeechEngine || !SpeechEngine.isSupported) {
            toast("❌ Browser voice support nahi hai");
            return;
        }
        if (isOpen) close();

        isOpen = true;
        isExiting = false;
        lastInterimText = "";
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
        isSpeaking = false;

        if (SpeechEngine) {
            try { SpeechEngine.stopListening(); } catch (e) {}
            try { SpeechEngine.cancelSpeaking(); } catch (e) {}
        }
        if (interimTimeout) clearTimeout(interimTimeout);
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
        lastInterimText = "";

        SpeechEngine.startListening({
            onInterim: (text) => {
                console.log("🎤 Interim:", text);
                if (transcriptEl) transcriptEl.textContent = text;
                lastInterimText = text;

                if (interimTimeout) clearTimeout(interimTimeout);
                interimTimeout = setTimeout(() => {
                    if (lastInterimText && isOpen && !isExiting) {
                        console.log("⏰ Timeout — processing");
                        processSpokenText(lastInterimText);
                    }
                }, 3000);
            },
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "listening") {
                    setWaveAmplitude(amp);
                }
            },
            onFinal: async (text) => {
                console.log("✅ Final:", text);
                if (interimTimeout) clearTimeout(interimTimeout);

                if (isExiting || !isOpen) return;
                if (transcriptEl) transcriptEl.textContent = text;

                toast("✅ Sun liya: " + text, 1500);
                await processSpokenText(text);
            },
            onEnd: () => {
                console.log("🔚 Recognition ended");
                if (lastInterimText && isOpen && !isExiting && overlay && overlay.dataset.state === "listening") {
                    console.log("⏰ End without final — processing interim");
                    processSpokenText(lastInterimText);
                } else if (isOpen && !isExiting) {
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
        isSpeaking = true;

        if (!SpeechEngine || !SpeechEngine.speak) {
            toast("❌ SpeechEngine.speak nahi mila!");
            if (isOpen) setTimeout(listenStep, 1500);
            return;
        }

        SpeechEngine.speak(reply, {
            onStart: () => {
                console.log("🔊 Audio started");
            },
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "speaking") {
                    setWaveAmplitude(amp);
                }
            },
            onEnd: () => {
                console.log("🔚 Audio ended");
                resetWave();
                isSpeaking = false;
                if (isOpen && !isExiting) setTimeout(listenStep, 500);
            },
            onError: () => {
                toast("❌ Audio play nahi hua!");
                resetWave();
                isSpeaking = false;
                if (isOpen && !isExiting) setTimeout(listenStep, 1500);
            }
        });
    }

    return { init, open, close };
})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
// ==========================================
// VED AI — VOICE MODE (SUPER DEBUG VERSION)
// Har step par toast — kahan ruk raha hai pata chalega
// ==========================================

const VoiceMode = (function () {

    let overlay, statusEl, transcriptEl, waveformEl, waveBars, exitBtn;
    let isOpen = false;
    let isExiting = false;
    let lastInterimText = "";
    let interimTimeout = null;

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

    // Process text when we think user finished speaking
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

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) {
                throw new Error("Server " + response.status);
            }

            const data = await response.json();
            const reply = data.reply || "Sorry, reply nahi mila";
            
            console.log("🤖 Reply:", reply);
            toast("📥 Reply aaya: " + reply.slice(0, 50) + "...", 2500);

            // Add to chat
            const chatBox = document.getElementById("chatMessages");
            if (chatBox) {
                const userMsg = document.createElement("div");
                userMsg.className = "user-message";
                userMsg.innerHTML = text.replace(/\n/g, "<br>");
                chatBox.appendChild(userMsg);
                
                const botMsg = document.createElement("div");
                botMsg.className = "bot-message";
                botMsg.innerHTML = reply.replace(/\n/g, "<br>");
                chatBox.appendChild(botMsg);
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            if (!isOpen || isExiting) return;
            speakStep(reply);
        } catch (err) {
            console.error("❌ API Error:", err);
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
                
                // Agar 3 second tak kuch nahi bola, toh process karo
                if (interimTimeout) clearTimeout(interimTimeout);
                interimTimeout = setTimeout(() => {
                    if (lastInterimText && isOpen && !isExiting) {
                        console.log("⏰ Timeout — processing last interim");
                        processSpokenText(lastInterimText);
                    }
                }, 3000);
            },
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "listening") setWaveAmplitude(amp);
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
                // Agar final nahi aaya lekin interim tha, toh process karo
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
        
        toast("🔊 Bolne ki koshish kar raha hu...", 1500);
        setState("speaking");

        if (!SpeechEngine || !SpeechEngine.speak) {
            toast("❌ SpeechEngine.speak nahi mila!");
            if (isOpen) setTimeout(listenStep, 1500);
            return;
        }

        SpeechEngine.speak(reply, {
            onStart: () => {
                console.log("🔊 Audio started");
                toast("🔊 Audio chal raha hai", 1000);
            },
            onAmplitude: (amp) => {
                if (overlay && overlay.dataset.state === "speaking") setWaveAmplitude(amp);
            },
            onEnd: () => {
                console.log("🔚 Audio ended");
                resetWave();
                if (isOpen && !isExiting) setTimeout(listenStep, 500);
            },
            onError: () => {
                toast("❌ Audio play nahi hua!");
                resetWave();
                if (isOpen && !isExiting) setTimeout(listenStep, 1500);
            }
        });
    }

    return { init, open, close };
})();

document.addEventListener("DOMContentLoaded", VoiceMode.init);
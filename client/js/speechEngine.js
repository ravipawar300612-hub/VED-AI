// ==========================================
// VED AI — SPEECH ENGINE (FIXED FOR PHONES)
// Real natural voice + browser fallback
// Founder: Sayali P. R. Pawar
// ==========================================

const SpeechEngine = (function () {

    const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    let recognition = null;
    let restartCount = 0;
    const MAX_RESTARTS = 5;
    let currentAudio = null;
    let simulatedLoopId = null;
    let isExplicitlyStopped = false;

    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.lang = "hi-IN";
        // Note: Mobile browsers ignore continuous=true, so we manage re-entry in onend
        recognition.continuous = false; 
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
    }

    const isSupported = !!SpeechRecognitionAPI;
    let currentCallbacks = null;

    // ---------- LISTENING ----------
    function startListening(callbacks = {}) {
        if (!recognition) {
            if (callbacks.onError) callbacks.onError(new Error("SpeechRecognition not supported"));
            return;
        }

        currentCallbacks = callbacks;
        restartCount = 0;
        isExplicitlyStopped = false;
        attachHandlers();

        try {
            recognition.start();
        } catch (e) {
            console.warn("Recognition already running, aborting and restarting safely...");
            recognition.abort(); // Clears thread locks on mobile
            setTimeout(() => {
                try { if(!isExplicitlyStopped) recognition.start(); } catch (err) {}
            }, 400);
        }
    }

    function attachHandlers() {
        if (!recognition || !currentCallbacks) return;

        const { onInterim, onFinal, onEnd, onError } = currentCallbacks;

        recognition.onresult = (event) => {
            let finalText = "";
            let interimText = "";
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                // Mobile Fix: Ignore empty anomalies or zero confidence frames
                if (event.results[i][0].confidence === 0 && event.results[i].isFinal) {
                    continue;
                }
                
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interimText += transcript;
                }
            }
            
            if (interimText && onInterim) onInterim(interimText);
            if (finalText) {
                restartCount = 0; 
                if (onFinal) onFinal(finalText);
            }
        };

        recognition.onend = () => {
            if (isExplicitlyStopped) {
                if (onEnd) onEnd();
                return;
            }

            // Mobile Auto-Restart Workaround (Gives OS time to clean up hardware locks)
            if (restartCount < MAX_RESTARTS && currentCallbacks) {
                restartCount++;
                setTimeout(() => {
                    try {
                        if (currentCallbacks && !isExplicitlyStopped) {
                            recognition.start();
                        }
                    } catch (e) {
                        // Fallback retry if OS was still busy
                        recognition.abort();
                        setTimeout(() => { try { recognition.start(); } catch(err){} }, 500);
                    }
                }, 400); // 400ms delay protects mobile memory channels
            } else {
                if (onEnd) onEnd();
            }
        };

        recognition.onerror = (e) => {
            if (e.error === 'not-allowed') {
                console.error("❌ Mic permission denied by user or unsecure origin (HTTP)");
                isExplicitlyStopped = true;
            }
            if (onError) onError(e);
        };
    }

    function stopListening() {
        isExplicitlyStopped = true;
        restartCount = MAX_RESTARTS; 
        if (recognition) {
            try { recognition.abort(); } catch (e) {}
        }
        currentCallbacks = null;
    }

    // ---------- SIMULATED WAVEFORM ----------
    function startSimulatedWave(onAmplitude) {
        if (!onAmplitude) return;
        stopSimulatedWave();
        simulatedLoopId = setInterval(() => onAmplitude(0.25 + Math.random() * 0.75), 90);
    }
    
    function stopSimulatedWave() {
        if (simulatedLoopId) clearInterval(simulatedLoopId);
        simulatedLoopId = null;
    }

    function stopCurrentAudio() {
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        stopSimulatedWave();
    }

    // ---------- SPEAKING ----------
    function speak(text, { onStart, onAmplitude, onEnd } = {}) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        stopCurrentAudio();

        const cleanText = String(text)
            .replace(/[#*_`~]/g, "")
            .replace(/https?:\/\/\S+/g, " link ")
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2764}]/gu, "")
            .trim();

        if (!cleanText) { if (onEnd) onEnd(); return; }

        fetch("/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText })
        })
        .then(res => {
            if (!res.ok) throw new Error("TTS server error " + res.status);
            return res.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            currentAudio = new Audio(url);
            currentAudio.onplay = () => { startSimulatedWave(onAmplitude); if (onStart) onStart(); };
            currentAudio.onended = () => { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; if (onEnd) onEnd(); };
            currentAudio.onerror = () => { stopSimulatedWave(); URL.revokeObjectURL(url); currentAudio = null; if (onEnd) onEnd(); };
            return currentAudio.play();
        })
        .catch(err => {
            console.warn("⚠️ ElevenLabs unavailable, browser voice fallback:", err.message);
            browserSpeak(cleanText, { onStart, onAmplitude, onEnd });
        });
    }

    // ---------- FALLBACK: BROWSER VOICE ----------
    function browserSpeak(text, { onStart, onAmplitude, onEnd } = {}) {
        if (!window.speechSynthesis) return;
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickBestVoice();
        if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
        else utterance.lang = "en-US";
        
        utterance.onstart = () => { startSimulatedWave(onAmplitude); if (onStart) onStart(); };
        utterance.onend = () => { stopSimulatedWave(); if (onEnd) onEnd(); };
        utterance.onerror = () => { stopSimulatedWave(); if (onEnd) onEnd(); };
        window.speechSynthesis.speak(utterance);
    }

    function pickBestVoice() {
        const voices = window.speechSynthesis.getVoices();
        if (!voices.length) return null;

        const savedVoiceURI = localStorage.getItem("vedPreferredVoice");
        let voice = voices.find(v => v.voiceURI === savedVoiceURI);

        if (!voice) {
            voice =
                voices.find(v => v.name === "Google US English") ||
                voices.find(v => v.lang === "en-IN") ||
                voices.find(v => v.lang === "en-US") ||
                voices.find(v => v.lang.startsWith("en")) ||
                voices[0];

            if (voice) {
                localStorage.setItem("vedPreferredVoice", voice.voiceURI);
            }
        }
        return voice;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.addEventListener("voiceschanged", pickBestVoice);
    }

    function cancelSpeaking() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        stopCurrentAudio();
    }

    return { isSupported, startListening, stopListening, speak, cancelSpeaking };
})();

// ==========================================
// VED AI — SPEECH ENGINE v2 (TURBO MODE)
// Fast TTS + Better Cleaning + Interruption Support
// Founder: Sayali P. R. Pawar
// ==========================================

const SpeechEngine = (function () {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let restartCount = 0;
    const MAX_RESTARTS = 15;
    let currentAudio = null;
    let simulatedLoopId = null;
    let isExplicitlyStopped = false;
    let lastFinalTime = 0;
    let audioQueue = [];
    let isPlaying = false;
    let onInterruptCallback = null;

    if (SpeechRecognitionAPI) {
        recognition = new SpeechRecognitionAPI();
        recognition.lang = "en-IN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
    }

    const isSupported = !!SpeechRecognitionAPI;
    let currentCallbacks = null;

    // ---------- TEXT CLEANING (ChatGPT-grade) ----------
    function cleanTextForSpeech(text) {
        return String(text)
            // Remove markdown
            .replace(/#{1,6}\s*/g, "")  // Headers
            .replace(/\*\*([^*]+)\*\*/g, "$1")  // Bold
            .replace(/\*([^*]+)\*/g, "$1")  // Italic
            .replace(/`{1,3}[^`]*`{1,3}/g, " code ")  // Code blocks
            .replace(/`([^`]+)`/g, "$1")  // Inline code
            // Convert numbers to words (basic)
            .replace(/\b(\d{1,3}(?:,\d{3})*)\b/g, (match) => {
                const num = parseInt(match.replace(/,/g, ""));
                if (num >= 1000000) return (num / 1000000).toFixed(1) + " million ";
                if (num >= 1000) return (num / 1000).toFixed(1) + " thousand ";
                return match + " ";
            })
            // Clean bullet points
            .replace(/^[-*]\s+/gm, "point, ")
            .replace(/^\d+\.\s+/gm, (match) => "point " + match.replace(/\./, "") + ", ")
            // Remove URLs
            .replace(/https?:\/\/\S+/g, " link ")
            // Remove emojis
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2764}]/gu, "")
            // Clean excessive whitespace
            .replace(/\s+/g, " ")
            .replace(/\n+/g, ". ")
            .trim();
    }

    // Split text into sentences for streaming
    function splitIntoSentences(text) {
        const cleaned = cleanTextForSpeech(text);
        return cleaned
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0)
            .map(s => s.trim());
    }

    // ---------- LISTENING ----------
    function startListening(callbacks = {}) {
        if (!recognition) {
            if (callbacks.onError) callbacks.onError(new Error("SpeechRecognition not supported"));
            return;
        }

        currentCallbacks = callbacks;
        restartCount = 0;
        isExplicitlyStopped = false;
        lastFinalTime = Date.now();
        attachHandlers();

        try {
            recognition.start();
        } catch (e) {
            console.warn("Recognition already running, restarting...");
            recognition.abort();
            setTimeout(() => {
                try { if (!isExplicitlyStopped) recognition.start(); } catch (err) {}
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
                if (event.results[i][0].confidence === 0 && event.results[i].isFinal) continue;

                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript;
                    lastFinalTime = Date.now();
                    restartCount = 0;
                } else {
                    interimText += transcript;
                }
            }

            if (interimText && onInterim) onInterim(interimText);
            if (finalText && onFinal) onFinal(finalText);
        };

        recognition.onend = () => {
            if (isExplicitlyStopped) {
                if (onEnd) onEnd();
                return;
            }

            const timeSinceLastFinal = Date.now() - lastFinalTime;
            const shouldRestart = restartCount < MAX_RESTARTS &&
                currentCallbacks &&
                timeSinceLastFinal < 30000;

            if (shouldRestart) {
                restartCount++;
                setTimeout(() => {
                    try {
                        if (currentCallbacks && !isExplicitlyStopped) {
                            recognition.start();
                        }
                    } catch (e) {
                        recognition.abort();
                        setTimeout(() => {
                            try { recognition.start(); } catch (err) {}
                        }, 500);
                    }
                }, 300);
            } else {
                if (onEnd) onEnd();
            }
        };

        recognition.onerror = (e) => {
            if (e.error === 'not-allowed') {
                console.error("❌ Mic permission denied");
                isExplicitlyStopped = true;
            }
            if (e.error === 'no-speech' || e.error === 'aborted') return;
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

    // ---------- AUDIO QUEUE SYSTEM ----------
    function processQueue() {
        if (isPlaying || audioQueue.length === 0) return;

        isPlaying = true;
        const text = audioQueue.shift();
        const callbacks = audioQueue.callbacks || {};

        fetch("/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        })
            .then(res => {
                if (!res.ok) throw new Error("TTS error " + res.status);
                return res.blob();
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                currentAudio = new Audio(url);

                currentAudio.onplay = () => {
                    startSimulatedWave(callbacks.onAmplitude);
                    if (callbacks.onStart) callbacks.onStart();
                };

                currentAudio.onended = () => {
                    stopSimulatedWave();
                    URL.revokeObjectURL(url);
                    currentAudio = null;
                    isPlaying = false;

                    // Process next sentence in queue
                    if (audioQueue.length > 0) {
                        setTimeout(processQueue, 100);
                    } else {
                        if (callbacks.onEnd) callbacks.onEnd();
                    }
                };

                currentAudio.onerror = () => {
                    stopSimulatedWave();
                    URL.revokeObjectURL(url);
                    currentAudio = null;
                    isPlaying = false;
                    console.warn("⚠️ Audio error, trying browser fallback");
                    browserSpeak(text, callbacks);
                };

                return currentAudio.play();
            })
            .catch(err => {
                console.warn("⚠️ ElevenLabs failed, using browser voice:", err.message);
                browserSpeak(text, {
                    ...callbacks,
                    onEnd: () => {
                        isPlaying = false;
                        if (audioQueue.length > 0) {
                            setTimeout(processQueue, 100);
                        } else {
                            if (callbacks.onEnd) callbacks.onEnd();
                        }
                    }
                });
            });
    }

    // ---------- SPEAKING (Queue-based) ----------
    function speak(text, { onStart, onAmplitude, onEnd } = {}) {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        stopCurrentAudio();

        const sentences = splitIntoSentences(text);
        if (sentences.length === 0) {
            if (onEnd) onEnd();
            return;
        }

        audioQueue = sentences;
        audioQueue.callbacks = { onStart, onAmplitude, onEnd };
        processQueue();
    }

    // ---------- INTERRUPT HANDLING ----------
    function setInterruptCallback(callback) {
        onInterruptCallback = callback;
    }

    function checkForInterrupt(amplitude) {
        // If amplitude spike detected while speaking, trigger interrupt
        if (isPlaying && amplitude > 0.6 && onInterruptCallback) {
            console.log("🛑 Interrupt detected!");
            cancelSpeaking();
            onInterruptCallback();
        }
    }

    // ---------- FALLBACK: BROWSER VOICE ----------
    function browserSpeak(text, { onStart, onAmplitude, onEnd } = {}) {
        if (!window.speechSynthesis) {
            if (onEnd) onEnd();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickBestVoice();
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
        } else {
            utterance.lang = "en-IN";
        }

        utterance.onstart = () => {
            startSimulatedWave(onAmplitude);
            if (onStart) onStart();
        };
        utterance.onend = () => {
            stopSimulatedWave();
            if (onEnd) onEnd();
        };
        utterance.onerror = () => {
            stopSimulatedWave();
            if (onEnd) onEnd();
        };

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
        audioQueue = [];
        stopCurrentAudio();
        isPlaying = false;
    }

    // ---------- SIMULATED WAVEFORM ----------
    function startSimulatedWave(onAmplitude) {
        if (!onAmplitude) return;
        stopSimulatedWave();
        simulatedLoopId = setInterval(() => {
            const amp = 0.25 + Math.random() * 0.75;
            onAmplitude(amp);
            checkForInterrupt(amp);
        }, 90);
    }

    function stopSimulatedWave() {
        if (simulatedLoopId) clearInterval(simulatedLoopId);
        simulatedLoopId = null;
    }

    function stopCurrentAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        stopSimulatedWave();
    }

    return {
        isSupported,
        startListening,
        stopListening,
        speak,
        cancelSpeaking,
        setInterruptCallback
    };
})();
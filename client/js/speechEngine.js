// ==========================================
// VED AI — ENTERPRISE SPEECH ENGINE (FIXED)
// Native Speech Rec + Audio Streaming Router
// ==========================================

import { ChatbotState } from './stateEngine.js';

export const SpeechEngine = (function () {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let currentAudio = null;
    let simulatedWaveInterval = null;
    let onAmplitudeCallback = null;

    // Check configuration safety hooks
    const isSupported = !!SpeechRecognitionAPI;

    function init(callbacks = {}) {
        if (!isSupported) {
            console.error("❌ Web Speech API is not supported in this browser environment.");
            return;
        }

        onAmplitudeCallback = callbacks.onAmplitude || null;

        recognition = new SpeechRecognitionAPI();
        recognition.lang = "hi-IN"; // Set for target localized input engine
        recognition.continuous = false; // Kept false: stable standard for mobile memory channels
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        // Bind core Web Speech thread events
        bindHardwareEvents(callbacks);

        // Connect this engine directly to the central state coordinator
        ChatbotState.subscribe((state, payload) => {
            handleStateChange(state, payload, callbacks);
        });
    }

    function bindHardwareEvents(callbacks) {
        recognition.onresult = (event) => {
            let interimText = "";
            let finalText = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                // Mobile Patch: Discard zero confidence audio frames
                if (event.results[i].confidence === 0 && event.results[i].isFinal) continue;

                const transcript = event.results[i].transcript;
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interimText += transcript;
                }
            }

            if (interimText && callbacks.onInterimText) {
                callbacks.onInterimText(interimText);
            }

            if (finalText.trim()) {
                // Instantly advance state to processing to kill mic locks
                ChatbotState.transitionTo('THINKING', finalText.trim());
            }
        };

        recognition.onend = () => {
            // Mobile Auto-Restart Workaround: Gives OS time to release hardware allocations
            if (ChatbotState.current === 'LISTENING') {
                setTimeout(() => {
                    try {
                        if (ChatbotState.current === 'LISTENING') recognition.start();
                    } catch (e) {
                        // Quick-force cycle if lock persists
                        try { recognition.abort(); setTimeout(() => recognition.start(), 300); } catch(err){}
                    }
                }, 400); 
            }
        };

        recognition.onerror = (e) => {
            if (e.error === 'not-allowed') {
                console.error("❌ Mic access blocked. Ensure app runs via HTTPS.");
                ChatbotState.transitionTo('IDLE');
            }
        };
    }

    function handleStateChange(state, payload, callbacks) {
        switch (state) {
            case 'LISTENING':
                cancelSpeaking();
                if (callbacks.onListeningStart) callbacks.onListeningStart();
                try { recognition.start(); } catch (e) {}
                break;

            case 'THINKING':
                try { recognition.abort(); } catch (e) {} // Instantly free up audio thread
                if (callbacks.onThinkingStart) callbacks.onThinkingStart();
                break;

            case 'SPEAKING':
                try { recognition.abort(); } catch (e) {}
                executeTextToSpeech(payload, callbacks);
                break;

            case 'IDLE':
                try { recognition.abort(); } catch (e) {}
                cancelSpeaking();
                if (callbacks.onIdle) callbacks.onIdle();
                break;
        }
    }

    function executeTextToSpeech(text, callbacks) {
        if (!text) { ChatbotState.transitionTo('LISTENING'); return; }

        // Sanitize characters matching Markdown or emojis
        const cleanText = String(text)
            .replace(/[#*_`~]/g, "")
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
            .trim();

        fetch("/api/tts", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText })
        })
        .then(res => {
            if (!res.ok) throw new Error("TTS Route unreachable");
            return res.blob();
        })
        .then(blob => {
            const audioUrl = URL.createObjectURL(blob);
            currentAudio = new Audio(audioUrl);

            currentAudio.onplay = () => {
                startWaveSimulation();
                if (callbacks.onSpeakingStart) callbacks.onSpeakingStart();
            };

            currentAudio.onended = () => {
                stopWaveSimulation();
                URL.revokeObjectURL(audioUrl);
                currentAudio = null;
                // Yellow.ai pattern: automatically jump back to listening loop
                ChatbotState.transitionTo('LISTENING');
            };

            currentAudio.play().catch(() => browserFallbackSpeak(cleanText));
        })
        .catch(() => browserFallbackSpeak(cleanText));
    }

    function browserFallbackSpeak(text) {
        if (!window.speechSynthesis) { ChatbotState.transitionTo('LISTENING'); return; }
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "hi-IN";

        utterance.onstart = () => { startWaveSimulation(); };
        utterance.onend = () => { stopWaveSimulation(); ChatbotState.transitionTo('LISTENING'); };
        utterance.onerror = () => { stopWaveSimulation(); ChatbotState.transitionTo('LISTENING'); };

        window.speechSynthesis.speak(utterance);
    }

    function startWaveSimulation() {
        if (simulatedWaveInterval || !onAmplitudeCallback) return;
        simulatedWaveInterval = setInterval(() => {
            const amplitude = 0.2 + Math.random() * 0.8;
            onAmplitudeCallback(amplitude);
        }, 80);
    }

    function stopWaveSimulation() {
        if (simulatedWaveInterval) clearInterval(simulatedWaveInterval);
        simulatedWaveInterval = null;
        if (onAmplitudeCallback) onAmplitudeCallback(0);
    }

    function cancelSpeaking() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (currentAudio) { try { currentAudio.pause(); } catch(e){} currentAudio = null; }
        stopWaveSimulation();
    }

    return { init, isSupported };
})();

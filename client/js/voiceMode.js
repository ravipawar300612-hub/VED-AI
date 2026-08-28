// ==========================================
// VOICE MODE APPLICATION INTERFACE CONTROLLER
// Binds layout mutations directly to safe state engines
// ==========================================

import { ChatbotState } from './stateEngine.js';
import { SpeechEngine } from './speechEngine.js';

document.addEventListener("DOMContentLoaded", () => {
    // Locate critical DOM targets
    const micButton = document.getElementById("mic-toggle-btn");
    const statusText = document.getElementById("chatbot-status-prompt");
    const waveVisualizer = document.getElementById("wave-canvas-container");
    const textOutputContainer = document.getElementById("speech-transcript-view");

    if (!micButton) {
        console.warn("[VoiceMode] Mic button element missing from the current view configuration.");
        return;
    }

    // Step 1: Initialize speech engine configurations
    SpeechEngine.init({
        onInterimText: (text) => {
            if (textOutputContainer) textOutputContainer.innerText = text;
        },
        onListeningStart: () => {
            if (statusText) statusText.innerText = "Listening to you...";
            micButton.classList.add("recording-active");
            if (waveVisualizer) waveVisualizer.style.opacity = "0.5";
        },
        onThinkingStart: () => {
            if (statusText) statusText.innerText = "Processing answer...";
            if (waveVisualizer) waveVisualizer.style.opacity = "0.2";
        },
        onSpeakingStart: () => {
            if (statusText) statusText.innerText = "VED AI is speaking...";
            if (waveVisualizer) waveVisualizer.style.opacity = "1";
        },
        onIdle: () => {
            if (statusText) statusText.innerText = "Tap mic to start";
            micButton.classList.remove("recording-active");
            if (waveVisualizer) waveVisualizer.style.opacity = "0";
        },
        onAmplitude: (value) => {
            // Animate interface container scaling dynamically using frequency updates
            if (waveVisualizer) {
                waveVisualizer.style.transform = `scale(${1 + value * 0.15})`;
            }
        }
    });

    // Step 2: Bind explicit user click triggers (Fulfills Mobile Gesture Sandbox Rules)
    micButton.addEventListener("click", () => {
        // Unlock browser audio context context constraints safely via gesture invocation
        if (window.AudioContext || window.webkitAudioContext) {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            if (context.state === 'suspended') {
                context.resume();
            }
        }

        if (ChatbotState.current === 'IDLE') {
            ChatbotState.transitionTo('LISTENING');
        } else {
            ChatbotState.transitionTo('IDLE');
        }
    });

    // Step 3: Listen for incoming text payload triggers
    ChatbotState.subscribe((state, payload) => {
        if (state === 'THINKING') {
            if (textOutputContainer) textOutputContainer.innerText = payload; // Sync transcription view
            sendPayloadToBotBackend(payload);
        }
    });

    // Step 4: Dispatch payload payload data to back-end routes safely
    async function sendPayloadToBotBackend(userText) {
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userText })
            });

            if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
            
            const data = await response.json();
            
            // Pass bot response string into the audio generator pipeline
            ChatbotState.transitionTo('SPEAKING', data.reply || data.message || "");
        } catch (error) {
            console.error("Backend dispatch error connection failed:", error);
            ChatbotState.transitionTo('IDLE');
        }
    }
});

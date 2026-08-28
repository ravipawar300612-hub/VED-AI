// ==========================================
// CENTRAL STATE MACHINE (ENTERPRISE PATTERN)
// Handles system lifecycles across UI and Hardware
// ==========================================

export const ChatbotState = {
    _state: 'IDLE', // Valid states: IDLE, LISTENING, THINKING, SPEAKING
    _listeners: [],

    // Transition to a new system state safely
    transitionTo(newState, payload = null) {
        if (this._state === newState && newState !== 'THINKING') return;
        
        console.log(`[State Transition]: ${this._state} ➔ ${newState}`);
        this._state = newState;

        // Broadcast state change across the application architecture
        this._listeners.forEach(callback => callback(newState, payload));
    },

    // Register modules to listen to state shifts
    subscribe(callback) {
        this._listeners.push(callback);
    },

    get current() {
        return this._state;
    }
};

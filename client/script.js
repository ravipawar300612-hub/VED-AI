// ==========================================
// VED AI SCRIPT v3.0
// Founder : Sayali P. R. Pawar
// ==========================================

// =====================
// ELEMENTS
// =====================

const input = document.getElementById("userInput");
const button = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatMessages");
const newChatBtn = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");
const micBtn = document.getElementById("micBtn");

// =====================
// SPEECH RECOGNITION
// =====================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();

recognition.lang = "en-IN";
recognition.continuous = false;
recognition.interimResults = false;

// =====================
// TEXT TO SPEECH
// =====================

function speak(text) {

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();

    speech.voice =
        voices.find(
            voice => voice.name === "Google UK English Female"
        ) || null;

    speech.lang = "en-GB";
    speech.rate = 0.9;
    speech.pitch = 1.1;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);

}

// =====================
// DATA
// =====================

let chats = {};
let currentChatId = null;
// =====================
// CREATE NEW CHAT
// =====================

function createNewChat() {
    console.log("CREATE NEW CHAT CALLED");

    currentChatId = Date.now().toString();

    chats[currentChatId] = [];

    chatBox.innerHTML = `

        <div class="bot-message">

            👋 <b>Welcome to VED AI</b>

            <br><br>

            Your Intelligent AI Companion.

            <br>

            Ask me anything! 💙

        </div>

    `;

    input.value = "";

}

// =====================
// SAVE HISTORY
// =====================

function saveHistory(title) {

    const li = document.createElement("li");

    li.textContent = "💬 " + title.substring(0, 25);

    li.dataset.chatId = currentChatId;

    historyList.prepend(li);

}// =====================
// SEND MESSAGE
// =====================

async function sendMessage() {

    const message = input.value.trim();

    if (message === "") return;

    // Save first message to history
    if (chats[currentChatId].length === 0) {
        saveHistory(message);
    }

    // Save user message
    chats[currentChatId].push({
        sender: "user",
        text: message
    });

    // Show user message
    chatBox.innerHTML += `
        <div class="user-message">
            ${message}
        </div>
    `;

    input.value = "";

    chatBox.scrollTop = chatBox.scrollHeight;
    historyList.addEventListener("click", function (e) {


    chats[id].forEach(msg => {

        

    })

})
    // Thinking bubble
    const thinking = document.createElement("div");

    thinking.className = "bot-message";

    thinking.innerHTML = "🤖 <i>VED is thinking...</i>";

    chatBox.appendChild(thinking);

    chatBox.scrollTop = chatBox.scrollHeight;

    try {

        const response = await fetch("/chat", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                message: message
            })

        });

        const data = await response.json();

        console.log("Response:", data);

        thinking.remove();

        // Save bot reply
        chats[currentChatId].push({

            sender: "bot",

            text: data.reply

        });

        // Show bot reply
        chatBox.innerHTML += `
            <div class="bot-message">
                🤖 ${data.reply}
            </div>
        `;

        speak(data.reply);

        chatBox.scrollTop = chatBox.scrollHeight;

    } catch (err) {

        console.error(err);

        thinking.remove();

        chatBox.innerHTML += `
            <div class="bot-message">
                ❌ Error connecting to server.
            </div>
        `;

    }

}// =====================
// HISTORY CLICK
// =====================

historyList.addEventListener("click", function (e) {

    if (e.target.tagName !== "LI") return;

    const id = e.target.dataset.chatId;

    currentChatId = id;
console.log("Adding user message");
    chatBox.innerHTML = "";

    chats[id].forEach(msg => {

        if (msg.sender === "user") {

            chatBox.innerHTML += `
                <div class="user-message">
                    ${msg.text}
                </div>
            `;

       } else {

    console.log("Adding bot message");

    chatBox.innerHTML += `
        <div class="bot-message">
            🤖 ${msg.text}
        </div>
    `;

}

    chatBox.scrollTop = chatBox.scrollHeight;

});

// =====================
// NEW CHAT
// =====================

newChatBtn.addEventListener("click", createNewChat);

// =====================
// SEND BUTTON
// =====================

button.addEventListener("click", sendMessage);

// =====================
// ENTER KEY
// =====================

input.addEventListener("keydown", function (event) {

    if (event.key === "Enter") {

        sendMessage();

    }

});

// =====================
// MICROPHONE
// =====================

micBtn.addEventListener("click", () => {

    recognition.start();

    micBtn.classList.add("listening");

});

recognition.onresult = (event) => {

    input.value = event.results[0][0].transcript;

    sendMessage();

};

recognition.onend = () => {

    micBtn.classList.remove("listening");

};

recognition.onerror = () => {

    micBtn.classList.remove("listening");

};

// =====================
// START
// =====================

window.onload = () => {
    console.log("WINDOW LOADED");

    createNewChat();

    window.speechSynthesis.getVoices();

};

window.speechSynthesis.onvoiceschanged = () => {

    window.speechSynthesis.getVoices();

}

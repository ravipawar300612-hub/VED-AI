// ==========================================
// VED AI SCRIPT v2.0
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

const SpeechRecognition =
window.SpeechRecognition ||
window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();

recognition.lang = "en-IN";
recognition.continuous = false;
recognition.interimResults = false;
// ===============================
// TEXT TO SPEECH
// ===============================

function speak(text) {

    // Agar pehle se bol raha hai to stop
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-US";

    speech.rate = 1;

    speech.pitch = 1;

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

function saveHistory(title){

    const li = document.createElement("li");

    li.textContent = "💬 " + title.substring(0,25);

    li.dataset.chatId = currentChatId;

    historyList.prepend(li);

}// =====================
// SEND MESSAGE
// =====================

async function sendMessage(){

    const message = input.value.trim();

    if(message === "") return;

    // First message → save history
    if(chats[currentChatId].length === 0){

        saveHistory(message);

    }

    // Save user message
    chats[currentChatId].push({

        sender:"user",

        text:message

    });

    // Show user bubble
    chatBox.innerHTML += `
        <div class="user-message">
            ${message}
        </div>
    `;

    input.value="";

    chatBox.scrollTop = chatBox.scrollHeight;

    // Thinking bubble
    const thinking=document.createElement("div");

    thinking.className="bot-message";

    thinking.innerHTML=`🤖 <i>VED is thinking...</i>`;

    chatBox.appendChild(thinking);

    chatBox.scrollTop=chatBox.scrollHeight;

    try{

        const response=await fetch("http://localhost:3000/chat",{

           // Speak AI Reply
speak(data.reply);

chatBox.scrollTop = chatBox.scrollHeight;
        });

        // Show bot reply

        chatBox.innerHTML += `
    <div class="bot-message">
        🤖 ${data.reply}
    </div>
`;

// ===============================
// TEXT TO SPEECH
// ===============================

function speak(text) {

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();

    // Google UK Female Voice
    speech.voice = voices.find(
        voice => voice.name === "Google UK English Female"
    );

    speech.lang = "en-GB";

    speech.rate = 0.88;

    speech.pitch = 1.15;

    speech.volume = 1;

    window.speechSynthesis.speak(speech);

}

}

    catch(err){

        console.error(err);

        thinking.remove();

        chatBox.innerHTML+=`
            <div class="bot-message">
                ❌ Error connecting to server.
            </div>
        `;

    }
    // ===============================
// TEXT TO SPEECH
// ===============================

function speak(text) {

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();

    // Google UK English Female
    speech.voice = voices.find(
        voice => voice.name === "Google UK English Female"
    );

    speech.lang = "en-GB";

    speech.rate = 0.88;

    speech.pitch = 1.15;

    speech.volume = 1;

    window.speechSynthesis.speak(speech);

}

}// =====================
// HISTORY CLICK
// =====================

historyList.addEventListener("click",function(e){

    if(e.target.tagName!=="LI") return;

    const id=e.target.dataset.chatId;

    currentChatId=id;

    chatBox.innerHTML="";

    chats[id].forEach(msg=>{

        if(msg.sender==="user"){

            chatBox.innerHTML+=`
                <div class="user-message">
                    ${msg.text}
                </div>
            `;

        }

        else{

            chatBox.innerHTML+=`
                <div class="bot-message">
                    🤖 ${msg.text}
                </div>
            `;

        }

    });

    chatBox.scrollTop=chatBox.scrollHeight;

});

// =====================
// NEW CHAT
// =====================

newChatBtn.addEventListener("click",createNewChat);

// =====================
// BUTTON
// =====================

button.addEventListener("click",sendMessage);

// =====================
// ENTER KEY
// =====================

input.addEventListener("keydown",function(event){

    if(event.key==="Enter"){

        sendMessage();

    }

});

// =====================
// START
// =====================

window.onload=()=>{

    createNewChat();

};micBtn.addEventListener("click", () => {

    recognition.start();

    micBtn.classList.add("listening");

});

recognition.onresult = (event) => {

    input.value = event.results[0][0].transcript;

};

recognition.onend = () => {

    micBtn.classList.remove("listening");

};

recognition.onerror = () => {

    micBtn.classList.remove("listening");

};
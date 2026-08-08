// ======================================
// VED AI LOADING ANIMATION (OVERLAY MODE)
// ======================================
(function () {

    const loadingScreen = document.getElementById("loading-screen");
    if (!loadingScreen) return; // Agar loading screen nahi hai toh kuch mat karo

    const logo = document.getElementById("logo-text");
    const founder = document.getElementById("founder");
    const status = document.getElementById("status-text");
    const quote = document.getElementById("quote");

    const logoSequence = ["V", "VE", "VED", "VED AI"];

    const bootMessages = [
        "Initializing Intelligence...",
        "Loading Neural Core...",
        "Connecting Memory...",
        "Preparing Voice Engine...",
        "Synchronizing Memory...",
        "Almost Ready..."
    ];

    let logoIndex = 0;
    let statusIndex = 0;

    function animateLogo() {
        if (logoIndex >= logoSequence.length) {
            founder.style.opacity = "1";
            setTimeout(() => { animateStatus(); }, 700);
            return;
        }
        logo.classList.remove("show");
        setTimeout(() => {
            logo.innerText = logoSequence[logoIndex];
            logo.classList.add("show");
            logoIndex++;
            setTimeout(animateLogo, 700);
        }, 150);
    }

    function animateStatus() {
        if (statusIndex >= bootMessages.length) {
            showQuote();
            return;
        }
        status.style.opacity = "0";
        setTimeout(() => {
            status.innerText = bootMessages[statusIndex];
            status.style.opacity = "1";
            statusIndex++;
            setTimeout(animateStatus, 900);
        }, 250);
    }

    function showQuote() {
        quote.style.opacity = "1";
        setTimeout(() => { endLoading(); }, 2200);
    }

    function endLoading() {
        loadingScreen.classList.add("fadeOut");
        setTimeout(() => {
            loadingScreen.remove(); // Overlay hat jayega aur chat page reveal hoga
        }, 1200);
    }

    document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => { animateLogo(); }, 500);
    });

})();
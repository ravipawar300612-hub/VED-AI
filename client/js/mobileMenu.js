// =====================================
// VED AI — MOBILE MENU (Hamburger + Drawer)
// Founder: Sayali P. R. Pawar
// =====================================
(function () {
    const sidebar = document.querySelector(".sidebar");
    const menuBtn = document.getElementById("mobileMenuBtn");
    const backdrop = document.getElementById("mobileBackdrop");

    if (!sidebar || !menuBtn || !backdrop) return;

    // Mobile par collapsed mode hata do taaki drawer poora dikhe
    if (window.innerWidth <= 700) {
        sidebar.classList.remove("collapsed");
    }

    function openMenu() {
        sidebar.classList.add("mobile-open");
        backdrop.classList.add("show");
    }

    function closeMenu() {
        sidebar.classList.remove("mobile-open");
        backdrop.classList.remove("show");
    }

    menuBtn.addEventListener("click", function () {
        if (sidebar.classList.contains("mobile-open")) closeMenu();
        else openMenu();
    });

    backdrop.addEventListener("click", closeMenu);

    // Chat row par click karo -> drawer band ho jaye
    sidebar.addEventListener("click", function (e) {
        if (e.target.closest(".chat-row") && window.innerWidth <= 700) {
            closeMenu();
        }
    });
})();
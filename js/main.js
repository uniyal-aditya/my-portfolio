/* main.js — drop-in replacement
   - lucide-based theme icon toggle (sun <-> moon)
   - robust localStorage + cross-tab sync
   - mobile nav show/hide fix (removes invisible overlay when closed)
   - safe modal/hire modal wiring (no errors if close btn missing)
   - small safety / accessibility improvements
*/

(() => {
    "use strict";

    const THEME_KEY = "site-theme";
    const SUN_ICON_PNG = "/assets/icons/sun.png";
    const MOON_ICON_PNG = "/assets/icons/moon.png";

    /* ---------- tiny helpers ---------- */
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => Array.from(document.querySelectorAll(sel));
    function safeAddEvent(el, ev, fn, opts) { if (!el) return; el.addEventListener(ev, fn, opts); }

    /* ---------- Theme toggle (lucide if available) ---------- */
    function renderLucideSVG(name, options = {}) {
        // lucide.icons[name].toSvg(...) -> returns markup string
        if (window.lucide && window.lucide.icons && window.lucide.icons[name]) {
            try {
                return window.lucide.icons[name].toSvg(Object.assign({ width: 18, height: 18 }, options));
            } catch (e) {
                // fallthrough to png fallback
            }
        }
        return null;
    }

    function setThemeIcon(btn, isDark) {
        if (!btn) return;
        // Desired behaviour: when DARK theme is active -> show SUN icon (indicates switch to light)
        // when LIGHT theme is active -> show MOON icon (indicates switch to dark)
        const showSun = Boolean(isDark);
        // Prefer lucide SVG icons (stroke uses currentColor)
        const lucideMarkup = renderLucideSVG(showSun ? "sun" : "moon");
        if (lucideMarkup) {
            btn.innerHTML = lucideMarkup;
            // ensure icon uses button color (lucide uses stroke="currentColor")
            btn.style.color = isDark ? "#ffffff" : "#0b0b0b";
        } else {
            // fallback to simple img
            const imgSrc = showSun ? SUN_ICON_PNG : MOON_ICON_PNG;
            btn.innerHTML = `<img src="${imgSrc}" alt="${showSun ? "Sun" : "Moon"}" width="18" height="18" style="display:block">`;
        }
        btn.setAttribute("aria-pressed", isDark ? "true" : "false");
        btn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
    }

    function initThemeToggle() {
        const root = document.documentElement;
        const btn = document.getElementById("theme-toggle");
        if (!btn) return;

        function applyTheme(theme) {
            const isDark = theme === "dark";

            if (isDark) {
                root.setAttribute("data-theme", "dark");
            } else {
                root.removeAttribute("data-theme");
            }

            // 🔁 Swap Lucide icon properly
            btn.innerHTML = isDark
                ? '<i data-lucide="sun"></i>'   // show sun in dark mode
                : '<i data-lucide="moon"></i>'; // show moon in light mode

            // Re-render lucide icons
            if (window.lucide) {
                lucide.createIcons();
            }
        }

        // Load saved theme
        let saved = localStorage.getItem("site-theme");

        if (saved === "dark" || saved === "light") {
            applyTheme(saved);
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            applyTheme(prefersDark ? "dark" : "light");
        }

        btn.addEventListener("click", () => {
            const isDark = root.getAttribute("data-theme") === "dark";
            const next = isDark ? "light" : "dark";
            localStorage.setItem("site-theme", next);
            applyTheme(next);
        });
    }

    /* ---------- Year replacement ---------- */
    function initYear() {
        const yearEl = document.getElementById("year");
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    /* ---------- Desktop nav toggle (non-mobile) ---------- */
    function initNavToggle() {
        const nav = document.querySelector(".main-nav");
        const toggle = document.getElementById("nav-toggle");
        if (!toggle || !nav) return;
        toggle.addEventListener("click", () => nav.classList.toggle("open"));
    }

    /* ---------- Mobile nav logic (fix: avoid invisible overlay) ---------- */
    function initMobileNav() {
        const mobileToggle = document.getElementById("mobile-menu-toggle");
        const mobileNav = document.getElementById("mobileNav");
        const mobileClose = document.getElementById("mobileNavClose");

        if (!mobileToggle || !mobileNav) return;

        // Ensure closed state is not blocking clicks (remove layout/display when closed)
        function closeMobileNav() {
            mobileNav.setAttribute("aria-hidden", "true");
            mobileNav.style.display = "none";               // important fix
            mobileToggle.classList.remove("open");
            mobileToggle.setAttribute("aria-expanded", "false");
            document.documentElement.style.overflow = "";
            mobileToggle.focus();
        }

        function openMobileNav() {
            mobileNav.style.display = "block";
            // small delay to allow CSS transitions if any
            requestAnimationFrame(() => {
                mobileNav.setAttribute("aria-hidden", "false");
            });
            mobileToggle.classList.add("open");
            mobileToggle.setAttribute("aria-expanded", "true");
            const first = mobileNav.querySelector('a, button');
            if (first) first.focus();
            document.documentElement.style.overflow = "hidden";
        }

        // initial ensure closed / hidden
        if (mobileNav.getAttribute("aria-hidden") !== "false") {
            mobileNav.style.display = "none";
            mobileNav.setAttribute("aria-hidden", "true");
        }

        mobileToggle.addEventListener("click", () => {
            if (mobileNav.getAttribute("aria-hidden") === "false") closeMobileNav();
            else openMobileNav();
        });

        safeAddEvent(mobileClose, "click", closeMobileNav);

        mobileNav.addEventListener("click", (ev) => {
            // click backdrop or explicit data-close -> close
            if (ev.target === mobileNav || ev.target.dataset.close === "true" || ev.target.classList.contains("mobile-nav-backdrop")) {
                closeMobileNav();
            }
        });

        // escape key to close
        window.addEventListener("keydown", (ev) => {
            if (ev.key === "Escape" && mobileNav.getAttribute("aria-hidden") === "false") closeMobileNav();
        });

        // keep responsive: on resize to desktop ensure menu removed
        window.addEventListener("resize", () => {
            if (window.innerWidth > 900 && mobileNav) {
                mobileNav.style.display = ""; // let CSS take precedence on desktop
                mobileNav.setAttribute("aria-hidden", "true");
                mobileToggle.classList.remove("open");
                mobileToggle.setAttribute("aria-expanded", "false");
                document.documentElement.style.overflow = "";
            }
        });
    }

    /* ---------- Generic modal maker (safe) ---------- */
    function makeModal(modalId, contentId, closeId) {
        const modal = document.getElementById(modalId);
        if (!modal) return null;
        const content = contentId ? document.getElementById(contentId) : null;
        const closeBtn = closeId ? document.getElementById(closeId) : null;

        function open(html) {
            if (content && typeof html === "string") content.innerHTML = html;
            modal.setAttribute("aria-hidden", "false");
            // make sure modal is visible
            modal.style.display = "flex";
            // trap focus lightly is handled by caller if needed
        }

        function close() {
            modal.setAttribute("aria-hidden", "true");
            if (content && typeof content.innerHTML === "string") content.innerHTML = "";
            modal.style.display = "none";
        }

        if (closeBtn) safeAddEvent(closeBtn, "click", close);

        // escape to close
        window.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && modal.getAttribute("aria-hidden") === "false") close(); });

        // click outside to close
        safeAddEvent(modal, "click", (ev) => { if (ev.target === modal || ev.target.dataset.close === "true") close(); });

        // ensure initial hidden style
        if (modal.getAttribute("aria-hidden") !== "false") {
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
        }

        return { open, close, modal, content };
    }

    /* ---------- Case modals ---------- */
    function initCaseModals() {
        const caseModal = makeModal("modal", "modal-content", "modal-close");
        $$(".open-case").forEach(btn => {
            safeAddEvent(btn, "click", (ev) => {
                const slug = ev.currentTarget.getAttribute("data-slug");
                const cases = {
                    'numexa': `<h2>Numexa — Discord Scientific Calculator</h2>
                        <p><strong>Stack:</strong> Python, discord.py.</p>
                        <ul><li>Complex math parsing</li><li>Command architecture</li></ul>`,
                    'raftarfun': `<h2>RaftarFun — Interactive Web Experiments</h2>
                        <p><strong>Stack:</strong> JS, HTML5 Canvas.</p>`,
                    'quiz': `<h2>Multiplayer Quiz — Real-time Gameplay</h2><p><strong>Stack:</strong> WebSockets, Firebase/Socket.io</p>`,
                    'aichat': `<h2>AI Chatbot</h2><p><strong>Stack:</strong> Node/Python + LLM integration</p>`
                };
                if (caseModal) caseModal.open(cases[slug] || "<p>Case study not found.</p>");
            });
        });
    }

    /* ---------- Feedback form ---------- */
    function initFeedbackForm() {
        const form = document.getElementById("feedback-form");
        if (!form) return;

        safeAddEvent(form, "submit", async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const msgEl = document.getElementById("form-msg");

            const payload = {
                name: document.getElementById('name') ? document.getElementById('name').value || 'Anonymous' : 'Anonymous',
                email: document.getElementById('email') ? document.getElementById('email').value || '' : '',
                rating: document.getElementById('rating') ? document.getElementById('rating').value || '' : '',
                message: document.getElementById('message') ? document.getElementById('message').value || '' : '',
                project: document.getElementById('project') ? document.getElementById('project').value || '' : ''
            };

            if (btn) btn.disabled = true;
            if (msgEl) msgEl.textContent = "Sending...";

            try {
                const res = await fetch('/.netlify/functions/sendFeedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    if (msgEl) msgEl.textContent = "Thanks — feedback sent.";
                    form.reset();
                } else {
                    if (msgEl) msgEl.textContent = data.error || "Failed to send. Check console.";
                    console.error("sendFeedback error", data);
                }
            } catch (err) {
                console.error(err);
                if (msgEl) msgEl.textContent = "Network error — please try later.";
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    /* ---------- UPI modal helper ---------- */
    function initUPI() {
        const modal = document.getElementById("upiModal");
        const upiRedirectBtn = document.getElementById("upiRedirectBtn");
        const upiQRBtn = document.getElementById("upiQRBtn");
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (upiRedirectBtn && isMobile) upiQRBtn && (upiQRBtn.style.display = "none");
        if (upiQRBtn && !isMobile) upiRedirectBtn && (upiRedirectBtn.style.display = "none");

        window.payUPI = function () {
            const parts = ['ma f@', '9581380707'].map(s => s.split('').reverse().join(''));
            const pa = parts[1] + parts[0].trim();
            window.location.href = `upi://pay?pa=${pa}&pn=Aditya%20Uniyal&cu=INR`;
        };
        window.openUPIModal = function () { if (modal) modal.style.display = "flex"; modal && modal.classList.add("active"); };
        window.closeUPIModal = function () { if (modal) modal.classList.remove("active"); modal && (modal.style.display = "none"); };

        if (modal) {
            modal.addEventListener("click", function (e) {
                if (e.target === modal) {
                    modal.classList.remove("active");
                    modal.style.display = "none";
                }
            });
        }
    }

    /* ---------- Hire modal ---------- */
    function initHireModal() {
        const hireBtn = document.getElementById('hireBtn');
        const hireModal = document.getElementById('hireModal');
        // there is intentionally no close button per requested UI — clicking outside closes.
        if (!hireModal) return;

        function openHire() {
            hireModal.setAttribute('aria-hidden', 'false');
            hireModal.style.display = "grid";
            const first = hireModal.querySelector('a, button');
            if (first) first.focus();
            document.body.style.overflow = 'hidden';
        }
        function closeHire() {
            hireModal.setAttribute('aria-hidden', 'true');
            hireModal.style.display = "none";
            document.body.style.overflow = '';
            if (hireBtn) hireBtn.focus();
        }

        if (hireBtn) safeAddEvent(hireBtn, 'click', (e) => { e.preventDefault(); openHire(); });

        // close on backdrop or explicit data-close
        safeAddEvent(hireModal, 'click', (e) => {
            if (e.target === hireModal || e.target.dataset.close === "true" || e.target.classList.contains("hire-modal-backdrop")) {
                closeHire();
            }
        });

        window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && hireModal.getAttribute('aria-hidden') === 'false') closeHire(); });

        // small focus loop to prevent tab loss
        hireModal.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Tab') return;
            const focusables = hireModal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
            if (!focusables.length) return;
            const first = focusables[0], last = focusables[focusables.length - 1];
            if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
            else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        });

        // ensure hidden by default
        if (hireModal.getAttribute('aria-hidden') !== 'false') {
            hireModal.style.display = "none";
            hireModal.setAttribute('aria-hidden', 'true');
        }
    }

    /* ---------- Reveal observer (cards/sections) ---------- */
    function initRevealObserver() {
        const revealEls = Array.from(document.querySelectorAll('.card, section, .reveal-on-scroll'));
        if (!revealEls.length) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('active');
            });
        }, { threshold: 0.08 });

        revealEls.forEach(el => {
            if (!el.classList.contains('reveal')) el.classList.add('reveal');
            observer.observe(el);
        });
    }

    /* ---------- Skill bars animation ---------- */
    function initSkillBars() {
        const bars = Array.from(document.querySelectorAll('.bar div'));
        if (!bars.length) return;
        bars.forEach((b) => {
            let target = "";
            const inline = b.getAttribute("style");
            if (inline && /width\s*:\s*\d+%/.test(inline)) {
                const match = inline.match(/width\s*:\s*(\d+%)/);
                target = match ? match[1] : "";
                b.style.width = "0%";
            } else if (b.dataset && b.dataset.width) {
                target = b.dataset.width;
                b.style.width = "0%";
            } else {
                target = b.style.width || b.getAttribute('data-width') || "80%";
                b.style.width = "0%";
            }
            const delay = Math.random() * 300 + 120;
            setTimeout(() => {
                b.style.transition = "width .9s cubic-bezier(.2,.9,.28,1)";
                b.style.width = target;
            }, delay);
        });
    }

    /* ---------- Add hover smoothing class ---------- */
    function addHoverSmoothing() {
        const hoverables = document.querySelectorAll('.card, .card .card-actions, .mini-contact .glass, .btn, .btn-outline');
        hoverables.forEach(elm => elm.classList.add('hover-smooth'));
    }

    /* ---------- Boot sequence ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        initYear();
        initNavToggle();
        initMobileNav();
        initThemeToggle();
        initCaseModals();
        initFeedbackForm();
        initUPI();
        initHireModal();
        initRevealObserver();
        initSkillBars();
        addHoverSmoothing();
    });

})();
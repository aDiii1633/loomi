// Config placeholders — swap these before shipping to production. Nothing
// else in this file needs to change when you do.
const CONFIG = {
  // Set to the real Google Play listing URL once Loomi is published.
  PLAY_STORE_URL: null,
};

// ---- Mobile menu ---------------------------------------------------------
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');

function closeMenu() {
  mobileMenu.hidden = true;
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-label', 'Open menu');
}

navToggle.addEventListener('click', () => {
  const isOpen = !mobileMenu.hidden;
  mobileMenu.hidden = isOpen;
  navToggle.setAttribute('aria-expanded', String(!isOpen));
  navToggle.setAttribute('aria-label', isOpen ? 'Open menu' : 'Close menu');
});

mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !mobileMenu.hidden) closeMenu();
});

// ---- Download CTA: honest behavior, no dead link -------------------------
const downloadBtn = document.getElementById('downloadBtn');
const downloadStatus = document.getElementById('downloadStatus');

downloadBtn.addEventListener('click', () => {
  if (CONFIG.PLAY_STORE_URL) {
    window.location.href = CONFIG.PLAY_STORE_URL;
    return;
  }
  downloadStatus.textContent = "Loomi isn't live on Google Play yet — we're finishing up before launch. Check back soon!";
  downloadStatus.dataset.visible = 'true';
});

// ---- Entrance reveal on scroll (skipped entirely for reduced motion) -----
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealEls = document.querySelectorAll('.reveal');

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in-view'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
}

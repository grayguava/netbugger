import { getRandomQuote } from './quotes.js';

function initNav() {
  const btn      = document.querySelector('.nav-hamburger');
  const sidebar  = document.querySelector('.nav-sidebar');
  const backdrop = document.querySelector('.nav-sidebar-backdrop');

  if (!btn || !sidebar) return;

  const quoteText = sidebar.querySelector('.nav-sidebar-quote-text');
  const quoteAttr = sidebar.querySelector('.nav-sidebar-quote-attr');

  if (quoteText && quoteAttr) {
    getRandomQuote()
      .then(q => {
        quoteText.textContent = q.text || '';
        quoteAttr.textContent = q.attr || '';
      })
      .catch(() => {
        quoteText.textContent = '';
        quoteAttr.textContent = '';
      });
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    setMenuState(!isOpen);
  });

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      setMenuState(false);
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav') && !e.target.closest('.nav-sidebar')) {
      setMenuState(false);
    }
  });

  sidebar.querySelectorAll('.nav-sidebar-link').forEach(function (link) {
    link.addEventListener('click', function () {
      setMenuState(false);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenuState(false);
  });

  function setMenuState(open) {
    btn.setAttribute('aria-expanded', String(open));
    sidebar.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav);
} else {
  initNav();
}
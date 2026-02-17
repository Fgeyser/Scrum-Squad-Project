(function () {
  function updateNavbarState() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;

    if (window.scrollY > 12) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateNavbarState();
    window.addEventListener('scroll', updateNavbarState, { passive: true });
    window.addEventListener('resize', updateNavbarState);
  });
})();

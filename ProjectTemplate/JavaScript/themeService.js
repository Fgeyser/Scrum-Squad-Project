// Theme Service - Manages dark/light mode switching and persistence
const ThemeService = {
  STORAGE_KEY: 'scrum-squad-theme-mode',
  THEME_DARK: 'dark',
  THEME_LIGHT: 'light',
  
  /**
   * Get the current theme mode (dark or light)
   * Default to dark if not set
   */
  getCurrentTheme() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved === this.THEME_LIGHT) return this.THEME_LIGHT;
    if (saved === this.THEME_DARK) return this.THEME_DARK;
    // Default to dark mode
    return this.THEME_DARK;
  },

  /**
   * Set theme and apply it to the page
   */
  setTheme(theme) {
    if (theme !== this.THEME_DARK && theme !== this.THEME_LIGHT) {
      console.warn('Invalid theme:', theme);
      return;
    }
    
    // Save preference
    localStorage.setItem(this.STORAGE_KEY, theme);
    
    // Apply theme
    this.applyTheme(theme);
    
    // Notify listeners
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  },

  /**
   * Toggle between dark and light mode
   */
  toggleTheme() {
    const current = this.getCurrentTheme();
    const newTheme = current === this.THEME_DARK ? this.THEME_LIGHT : this.THEME_DARK;
    this.setTheme(newTheme);
    return newTheme;
  },

  /**
   * Apply theme to document
   */
  applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === this.THEME_LIGHT) {
      root.setAttribute('data-theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
    }
  },

  /**
   * Initialize theme on page load
   */
  init() {
    const theme = this.getCurrentTheme();
    this.applyTheme(theme);
  }
};

// Initialize theme when page loads if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ThemeService.init();
  });
} else {
  ThemeService.init();
}

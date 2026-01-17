// Theme Controller for Drum Game
const ThemeController = {
  STORAGE_KEY: 'drum-game-theme',
  DEFAULT_THEME: 'analog-warmth',

  themes: [
    { id: 'analog-warmth', name: 'Analog Warmth', color: '#1c1410' },
    { id: 'dark-synth', name: 'Dark Synth', color: '#1a1a2e' },
    { id: 'retrowave', name: 'Retrowave', color: '#1a0a2e' },
    { id: 'neon-club', name: 'Neon Club', color: '#0a0a0f' },
    { id: 'midnight-studio', name: 'Midnight Studio', color: '#0d1117' },
  ],

  init() {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_THEME;
    this.setTheme(savedTheme);
    this.createSelector();
    this.bindEvents();
  },

  setTheme(themeName) {
    // Validate theme exists
    const theme = this.themes.find(t => t.id === themeName);
    if (!theme) {
      themeName = this.DEFAULT_THEME;
    }

    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(this.STORAGE_KEY, themeName);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor && theme) {
      metaThemeColor.setAttribute('content', theme.color);
    }

    // Update selector if it exists
    const selector = document.getElementById('theme-select');
    if (selector) {
      selector.value = themeName;
    }
  },

  createSelector() {
    // Find the instructions paragraph to insert after
    const gameSection = document.querySelector('.game');
    const instructions = gameSection?.querySelector('p');

    if (!instructions) return;

    // Create theme switcher paragraph
    const switcher = document.createElement('p');
    switcher.className = 'theme-switcher';

    const label = document.createElement('span');
    label.className = 'theme-label';
    label.textContent = 'Theme:';

    const select = document.createElement('select');
    select.id = 'theme-select';
    select.className = 'theme-selector';
    select.setAttribute('aria-label', 'Select theme');

    // Add theme options
    this.themes.forEach(theme => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      select.appendChild(option);
    });

    // Set current value
    const currentTheme = localStorage.getItem(this.STORAGE_KEY) || this.DEFAULT_THEME;
    select.value = currentTheme;

    switcher.appendChild(label);
    switcher.appendChild(select);

    // Insert after the instructions paragraph
    instructions.insertAdjacentElement('afterend', switcher);
  },

  bindEvents() {
    // Use event delegation for the selector
    document.addEventListener('change', (e) => {
      if (e.target.id === 'theme-select') {
        this.setTheme(e.target.value);
      }
    });
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ThemeController.init());
} else {
  ThemeController.init();
}

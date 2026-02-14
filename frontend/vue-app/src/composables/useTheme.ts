import { ref, watch, shallowRef } from 'vue';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Theme Composable
 * 
 * Best practices implemented:
 * - Uses shallowRef for performance (no deep reactivity needed for theme strings)
 * - Initialization separated from composable (call initTheme() once in App.vue)
 * - Single event listener for system theme changes
 * - Returns computed-like derived state (effectiveTheme)
 */

// Module-level state - initialized once
const theme = shallowRef<Theme>('system');
const resolvedTheme = shallowRef<'light' | 'dark'>('light');
let mediaQuery: MediaQueryList | null = null;
let initialized = false;

/**
 * Get the current system theme from OS preferences
 */
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Apply theme to the document
 * Sets data-theme attribute for CSS variables
 * Sets data-bs-theme for Bootstrap 5.3+ native dark mode
 */
function applyTheme(themeValue: Theme) {
  const root = document.documentElement;
  
  // Resolve system to actual theme
  const resolved = themeValue === 'system' ? getSystemTheme() : themeValue;
  resolvedTheme.value = resolved;
  
  // Apply to document
  root.setAttribute('data-theme', resolved);
  
  // Bootstrap 5.3+ native dark mode support
  root.setAttribute('data-bs-theme', resolved);
  
  // Save preference to localStorage
  try {
    localStorage.setItem('dlux-theme', themeValue);
  } catch (e) {
    // localStorage might not be available (private browsing, etc.)
    console.warn('Could not save theme to localStorage:', e);
  }
}

/**
 * Handle system theme changes
 */
function handleSystemThemeChange() {
  if (theme.value === 'system') {
    applyTheme('system');
  }
}

/**
 * Initialize theme system - call this once in App.vue onMounted
 * Sets up event listeners and applies saved preference
 */
export function initTheme() {
  if (initialized) return;
  initialized = true;
  
  // Load saved preference
  try {
    const saved = localStorage.getItem('dlux-theme') as Theme | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      theme.value = saved;
    }
  } catch (e) {
    // localStorage not available
  }
  
  // Apply initial theme
  applyTheme(theme.value);
  
  // Listen for system theme changes (only once!)
  if (typeof window !== 'undefined' && window.matchMedia) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }
  
  // Watch for programmatic theme changes
  watch(theme, (newTheme) => {
    applyTheme(newTheme);
  });
}

/**
 * Clean up event listeners - call in App.vue onUnmounted
 */
export function cleanupTheme() {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', handleSystemThemeChange);
    mediaQuery = null;
  }
  initialized = false;
}

/**
 * Set theme to a specific value
 */
export function setTheme(newTheme: Theme) {
  theme.value = newTheme;
  applyTheme(newTheme);
}

/**
 * Cycle through themes: light -> dark -> system -> light
 */
export function toggleTheme() {
  const current = theme.value;
  if (current === 'light') {
    setTheme('dark');
  } else if (current === 'dark') {
    setTheme('system');
  } else {
    setTheme('light');
  }
}

/**
 * Vue composable for theme
 * Use this in components to access theme state
 */
export function useTheme() {
  /**
   * The currently selected theme (light, dark, or system)
   */
  const currentTheme = theme;
  
  /**
   * The resolved theme (actual light/dark, never system)
   * Use this for conditional styling based on actual appearance
   */
  const effectiveTheme = resolvedTheme;
  
  /**
   * Convenience: is dark mode currently active?
   */
  const isDark = () => resolvedTheme.value === 'dark';
  
  /**
   * Convenience: is light mode currently active?
   */
  const isLight = () => resolvedTheme.value === 'light';
  
  return {
    theme: currentTheme,
    resolvedTheme,
    effectiveTheme,
    isDark,
    isLight,
    setTheme,
    toggleTheme,
    initTheme,
    cleanupTheme
  };
}

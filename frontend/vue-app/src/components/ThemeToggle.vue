<template>
  <div class="theme-toggle dropdown">
    <button
      class="btn btn-link theme-toggle-btn dropdown-toggle"
      type="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      :title="`Current: ${theme}`"
    >
      <i :class="themeIcon" class="theme-icon"></i>
      <span class="theme-label">{{ themeLabel }}</span>
    </button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li>
        <button 
          class="dropdown-item" 
          :class="{ active: theme === 'light' }"
          @click="setTheme('light')"
        >
          <i class="bi bi-sun-fill me-2"></i> Light
        </button>
      </li>
      <li>
        <button 
          class="dropdown-item" 
          :class="{ active: theme === 'dark' }"
          @click="setTheme('dark')"
        >
          <i class="bi bi-moon-fill me-2"></i> Dark
        </button>
      </li>
      <li>
        <button 
          class="dropdown-item" 
          :class="{ active: theme === 'system' }"
          @click="setTheme('system')"
        >
          <i class="bi bi-display me-2"></i> System
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '../composables/useTheme';

const props = defineProps<{
  themeClass?: 'light' | 'dark';
}>();

const { theme, setTheme } = useTheme();

// Use prop if provided, otherwise fall back to theme value
const effectiveTheme = computed(() => props.themeClass || theme.value);

const themeIcon = computed(() => {
  switch (effectiveTheme.value) {
    case 'light': return 'bi bi-sun-fill';
    case 'dark': return 'bi bi-moon-fill';
    default: return 'bi bi-display';
  }
});

const themeLabel = computed(() => {
  switch (effectiveTheme.value) {
    case 'light': return 'Light';
    case 'dark': return 'Dark';
    default: return 'System';
  }
});
</script>

<style>
/* ThemeToggle - placed in global scope to ensure proper cascade */

/* Default (light navbar) */
.theme-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #212529 !important;
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: background-color 0.2s, color 0.2s;
}

.theme-toggle-btn:hover,
.theme-toggle-btn:focus {
  background-color: rgba(0, 0, 0, 0.04);
  text-decoration: none;
}

/* Dark navbar variant */
.navbar-dark .theme-toggle-btn {
  color: rgba(255, 255, 255, 0.85) !important;
}

.navbar-dark .theme-toggle-btn:hover,
.navbar-dark .theme-toggle-btn:focus {
  background-color: rgba(255, 255, 255, 0.08);
}

/* Dropdown menu styling */
.theme-toggle .dropdown-menu {
  background-color: #ffffff;
  border: 1px solid #e9ecef;
}

[data-theme="dark"] .theme-toggle .dropdown-menu {
  background-color: #161b22;
  border-color: #30363d;
}

/* Dropdown items */
.theme-toggle .dropdown-item {
  color: #0f1419;
}

[data-theme="dark"] .theme-toggle .dropdown-item {
  color: #f0f6fc;
}

.theme-toggle .dropdown-item:hover,
.theme-toggle .dropdown-item:focus {
  background-color: rgba(0, 0, 0, 0.04);
}

[data-theme="dark"] .theme-toggle .dropdown-item:hover,
[data-theme="dark"] .theme-toggle .dropdown-item:focus {
  background-color: rgba(255, 255, 255, 0.08);
}

.theme-toggle .dropdown-item.active {
  background-color: #667eea;
  color: white;
}

.theme-toggle-btn::after {
  display: none;
}

.theme-label {
  font-size: 0.875rem;
}

@media (max-width: 575px) {
  .theme-label {
    display: none;
  }
}
</style>

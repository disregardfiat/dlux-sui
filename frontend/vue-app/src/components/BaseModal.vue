<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="app-modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? 'app-modal-title' : undefined"
      @click.self="emitClose"
      @keydown.escape="emitClose"
    >
      <div
        class="app-modal-dialog"
        :class="sizeClass"
        @click.stop
      >
        <div class="app-modal-content">
          <header v-if="!hideHeader" class="app-modal-header">
            <slot name="header">
              <h2 v-if="title" id="app-modal-title" class="app-modal-title">{{ title }}</h2>
              <button
                type="button"
                class="app-modal-close"
                aria-label="Close"
                @click="emitClose"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </slot>
          </header>
          <div class="app-modal-body">
            <slot></slot>
          </div>
          <footer v-if="!hideFooter" class="app-modal-footer">
            <slot name="footer">
              <button type="button" class="btn btn-secondary" @click="emitClose">
                Cancel
              </button>
              <button
                v-if="primaryLabel"
                type="button"
                class="btn btn-primary"
                :disabled="primaryDisabled"
                @click="emitPrimary"
              >
                <span v-if="primaryLoading" class="spinner-border spinner-border-sm me-1"></span>
                {{ primaryLabel }}
              </button>
            </slot>
          </footer>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    hideHeader?: boolean;
    hideFooter?: boolean;
    primaryLabel?: string;
    primaryDisabled?: boolean;
    primaryLoading?: boolean;
  }>(),
  {
    size: 'md',
    hideHeader: false,
    hideFooter: false,
    primaryDisabled: false,
    primaryLoading: false
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'primary'): void;
}>();

const sizeClass = computed(() => `app-modal-dialog--${props.size}`);

function emitClose() {
  emit('close');
}

function emitPrimary() {
  emit('primary');
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) emitClose();
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', onEscape);
      document.body.classList.add('app-modal-open');
    } else {
      document.removeEventListener('keydown', onEscape);
      document.body.classList.remove('app-modal-open');
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  document.removeEventListener('keydown', onEscape);
  document.body.classList.remove('app-modal-open');
});
</script>

<style scoped>
.app-modal {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.app-modal-dialog {
  width: 100%;
  max-width: 500px;
  max-height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.app-modal-dialog--sm {
  max-width: 400px;
}

.app-modal-dialog--lg {
  max-width: 600px;
}

.app-modal-content {
  background: var(--bs-body-bg, #fff);
  color: var(--bs-body-color, #212529);
  border-radius: 0.5rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 2rem);
}

.app-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-primary);
  flex-shrink: 0;
}

.app-modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.app-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  border-radius: 0.25rem;
  cursor: pointer;
  opacity: 0.7;
}

.app-modal-close:hover {
  opacity: 1;
  background: var(--bs-secondary-bg, rgba(0, 0, 0, 0.05));
}

.app-modal-body {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1 1 auto;
}

.app-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border-primary);
  flex-shrink: 0;
}
</style>

<style>
/* Global: prevent body scroll when modal open (use when BaseModal is mounted) */
body.app-modal-open {
  overflow: hidden;
}
</style>

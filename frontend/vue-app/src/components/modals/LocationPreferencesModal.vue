<template>
  <BaseModal
    :show="show"
    title="Location & spots"
    size="md"
    primary-label="Save preferences"
    :primary-disabled="saving"
    :primary-loading="saving"
    @close="$emit('close')"
    @primary="doSave"
  >
    <div class="location-prefs-modal-body">
      <p class="text-muted small mb-3">
        Choose regions and spots to get relevant content and notifications.
      </p>
      <div class="mb-3">
        <label class="form-label">Regions</label>
        <input
          v-model="regions"
          type="text"
          class="form-control"
          placeholder="e.g. US, EU (comma-separated)"
        />
      </div>
      <div class="mb-3">
        <label class="form-label">Notify for new spots</label>
        <div class="form-check">
          <input
            id="location-notify"
            v-model="notifyNewSpots"
            type="checkbox"
            class="form-check-input"
          />
          <label class="form-check-label" for="location-notify">
            Get notified when new spots are added in my regions
          </label>
        </div>
      </div>
      <p class="text-muted small mb-0">
        Subscribing to a spot links your account to that location for discovery.
      </p>
      <p v-if="saveError" class="text-danger small mb-0 mt-2">{{ saveError }}</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    initialRegions?: string;
    initialNotifyNewSpots?: boolean;
  }>(),
  { initialRegions: '', initialNotifyNewSpots: false }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { regions: string; notifyNewSpots: boolean }): void;
}>();

const regions = ref(props.initialRegions);
const notifyNewSpots = ref(props.initialNotifyNewSpots);
const saving = ref(false);
const saveError = ref('');

watch(
  () => [props.show, props.initialRegions, props.initialNotifyNewSpots] as const,
  ([visible, initRegions, initNotify]) => {
    if (visible) {
      regions.value = initRegions ?? '';
      notifyNewSpots.value = initNotify ?? false;
      saveError.value = '';
    }
  }
);

async function doSave() {
  saving.value = true;
  saveError.value = '';
  try {
    emit('save', {
      regions: regions.value.trim(),
      notifyNewSpots: notifyNewSpots.value
    });
    emit('close');
  } catch (e: any) {
    saveError.value = e?.message || 'Failed to save';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.location-prefs-modal-body {
  min-width: 360px;
}
</style>

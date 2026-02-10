<template>
  <BaseModal
    :show="show"
    title="Subscribe for ad-free"
    size="md"
    primary-label="Connect & Pay"
    :primary-disabled="subscribing || props.loading"
    :primary-loading="subscribing || props.loading"
    @close="$emit('close')"
    @primary="startSubscribe"
  >
    <div class="subscribe-modal-body">
      <div class="mb-3">
        <label class="form-label">Plan</label>
        <select v-model="selectedTier" class="form-select">
          <option value="monthly">Monthly — {{ subscriptionPriceSui }} SUI/month</option>
          <option value="annual">Annual — {{ annualPriceSui }} SUI/year (save ~17%)</option>
        </select>
      </div>
      <p class="text-muted small mb-0">
        Platform-wide ad-free access. Payment goes to the foundation (developer fund, APIs).
        Connect your wallet to complete payment.
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    subscriptionPriceSui?: number;
    loading?: boolean;
  }>(),
  { subscriptionPriceSui: 1, loading: false }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'subscribe', payload: { tier: 'monthly' | 'annual' }): void;
}>();

const selectedTier = ref<'monthly' | 'annual'>('monthly');
const subscribing = ref(false);

const annualPriceSui = computed(() =>
  Math.round(props.subscriptionPriceSui * 10 * 100) / 100
);

watch(
  () => props.show,
  (visible) => {
    if (visible) selectedTier.value = 'monthly';
  }
);

async function startSubscribe() {
  subscribing.value = true;
  try {
    emit('subscribe', { tier: selectedTier.value });
  } finally {
    subscribing.value = false;
  }
}
</script>

<style scoped>
.subscribe-modal-body {
  min-width: 320px;
}
</style>

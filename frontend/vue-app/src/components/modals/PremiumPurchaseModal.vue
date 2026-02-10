<template>
  <BaseModal
    :show="show"
    :title="contentName ? `Unlock: ${contentName}` : 'Unlock premium content'"
    size="sm"
    primary-label="Pay with wallet"
    :primary-disabled="!contentName || purchasing"
    :primary-loading="purchasing"
    @close="$emit('close')"
    @primary="purchase"
  >
    <div class="premium-purchase-modal-body">
      <p v-if="contentName" class="mb-2">
        <strong>{{ contentName }}</strong>
      </p>
      <p class="mb-3">
        Price: <strong>{{ formatSui(priceSui) }}</strong>
      </p>
      <p class="text-muted small mb-0">
        You will be prompted to sign a transaction. After payment, content will be unlocked for this account.
      </p>
      <p v-if="purchaseError" class="text-danger small mb-0 mt-2">{{ purchaseError }}</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';

const props = defineProps<{
  show: boolean;
  contentName?: string;
  priceSui?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'purchase'): void;
}>();

const purchasing = ref(false);
const purchaseError = ref('');

function formatSui(amount: number): string {
  return `${(amount ?? 0).toFixed(4)} SUI`;
}

watch(
  () => props.show,
  (visible) => {
    if (visible) purchaseError.value = '';
  }
);

async function purchase() {
  purchasing.value = true;
  purchaseError.value = '';
  try {
    emit('purchase');
    emit('close');
  } catch (e: any) {
    purchaseError.value = e?.message || 'Purchase failed';
  } finally {
    purchasing.value = false;
  }
}
</script>

<style scoped>
.premium-purchase-modal-body {
  min-width: 280px;
}
</style>

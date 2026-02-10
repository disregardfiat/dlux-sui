<template>
  <BaseModal
    :show="show"
    title="Claim payout"
    size="sm"
    primary-label="Claim SUI"
    :primary-disabled="claiming || !recipientAddress.trim()"
    :primary-loading="claiming"
    @close="$emit('close')"
    @primary="confirmClaim"
  >
    <div class="claim-payout-modal-body">
      <p class="mb-2">
        <strong>{{ bucketLabel }}</strong>: {{ formatSui(amount) }}
      </p>
      <div class="mb-3">
        <label class="form-label">Recipient address (SUI)</label>
        <input
          v-model="recipientAddress"
          type="text"
          class="form-control font-monospace"
          placeholder="0x..."
        />
      </div>
      <p class="text-muted small mb-0">
        Funds will be sent to this address. Make sure it is correct.
      </p>
      <p v-if="claimError" class="text-danger small mb-0 mt-2">{{ claimError }}</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';

export type PayoutBucketType = 'adShare' | 'subscriptionShare' | 'pmShare' | 'premiumShare';

const BUCKET_LABELS: Record<PayoutBucketType, string> = {
  adShare: 'Ad Share',
  subscriptionShare: 'Subscription Share',
  pmShare: 'PM Share',
  premiumShare: 'Premium Content'
};

const props = withDefaults(
  defineProps<{
    show: boolean;
    bucketType: PayoutBucketType;
    amount: number;
    defaultRecipient?: string;
  }>(),
  { defaultRecipient: '' }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm', payload: { bucketType: PayoutBucketType; amount: number; recipientAddress: string }): void;
}>();

const recipientAddress = ref(props.defaultRecipient);
const claiming = ref(false);
const claimError = ref('');

const bucketLabel = computed(() => BUCKET_LABELS[props.bucketType] ?? props.bucketType);

function formatSui(amount: number): string {
  return `${amount.toFixed(4)} SUI`;
}

watch(
  () => [props.show, props.defaultRecipient] as const,
  ([visible, defaultRecipient]) => {
    if (visible) {
      recipientAddress.value = defaultRecipient ?? '';
      claimError.value = '';
    }
  }
);

async function confirmClaim() {
  const addr = recipientAddress.value.trim();
  if (!addr) return;
  claiming.value = true;
  claimError.value = '';
  try {
    emit('confirm', {
      bucketType: props.bucketType,
      amount: props.amount,
      recipientAddress: addr
    });
    emit('close');
  } catch (e: any) {
    claimError.value = e?.message || 'Claim failed';
  } finally {
    claiming.value = false;
  }
}
</script>

<style scoped>
.claim-payout-modal-body {
  min-width: 320px;
}
</style>

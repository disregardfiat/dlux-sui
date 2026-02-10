<template>
  <BaseModal
    :show="show"
    :title="market ? `Place bet — ${formatMetric(market.safetyMetric)}` : 'Place bet'"
    size="sm"
    primary-label="Place Bet"
    :primary-disabled="!canSubmit || placing"
    :primary-loading="placing"
    @close="$emit('close')"
    @primary="submitBet"
  >
    <template v-if="market">
      <div class="pm-bet-modal-body">
        <p class="text-muted small mb-2">dApp: {{ market.dappId || '—' }}</p>
        <p class="small mb-3">
          Total Pool: {{ formatPool(market.totalPool) }} MIST · 
          {{ getBettorCount(market) }} {{ getBettorCount(market) === 1 ? 'bettor' : 'bettors' }} · 
          Expires: {{ market.expiresAt?.slice(0, 10) || '—' }}
        </p>
        <div class="mb-3 p-2 bg-light rounded">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="small">
              <span class="text-success fw-bold">Safe:</span> 
              {{ formatPool(market.safePool) }} MIST 
              <span class="text-muted">({{ getOdds(market, 'safe') }})</span>
            </span>
            <span class="small">
              <span class="text-danger fw-bold">Unsafe:</span> 
              {{ formatPool(market.unsafePool) }} MIST 
              <span class="text-muted">({{ getOdds(market, 'unsafe') }})</span>
            </span>
          </div>
          <div class="progress" style="height: 6px;">
            <div 
              class="progress-bar bg-success" 
              :style="{ width: getSafePercentage(market) + '%' }"
              role="progressbar"
            ></div>
            <div 
              class="progress-bar bg-danger" 
              :style="{ width: getUnsafePercentage(market) + '%' }"
              role="progressbar"
            ></div>
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Outcome</label>
          <div class="btn-group w-100" role="group">
            <input
              id="pm-side-safe"
              v-model="side"
              type="radio"
              class="btn-check"
              value="safe"
            />
            <label class="btn btn-outline-success" for="pm-side-safe">
              Safe <span class="small">({{ getOdds(market, 'safe') }})</span>
            </label>
            <input
              id="pm-side-unsafe"
              v-model="side"
              type="radio"
              class="btn-check"
              value="unsafe"
            />
            <label class="btn btn-outline-danger" for="pm-side-unsafe">
              Unsafe <span class="small">({{ getOdds(market, 'unsafe') }})</span>
            </label>
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">Amount (SUI)</label>
          <input
            v-model.number="amount"
            type="number"
            step="0.01"
            min="0.01"
            class="form-control"
            placeholder="0.1"
          />
        </div>
        <p v-if="betError || externalError" class="text-danger small mb-0">{{ betError || externalError }}</p>
      </div>
    </template>
    <p v-else class="text-muted mb-0">No market selected.</p>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';
import type { PredictionMarket } from '@dlux-sui/types';

const props = withDefaults(
  defineProps<{
    show: boolean;
    market: PredictionMarket | null;
    /** Error message from parent (e.g. API failure) */
    externalError?: string;
    /** When true, modal does not auto-close on placeBet; parent should close on success */
    closeOnPlaceBet?: boolean;
  }>(),
  { externalError: '', closeOnPlaceBet: false }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'placeBet', payload: { market: PredictionMarket; side: 'safe' | 'unsafe'; amount: number }): void;
}>();

const side = ref<'safe' | 'unsafe'>('safe');
const amount = ref<number>(0.1);
const placing = ref(false);
const betError = ref('');

const canSubmit = computed(() =>
  props.market && amount.value >= 0.01 && !placing.value
);

function formatMetric(metric: string): string {
  if (!metric || metric === '—') return metric || '—';
  return metric.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Convert MIST to SUI (1 SUI = 1,000,000,000 MIST)
function mistToSui(mist: number | undefined | null): number {
  if (mist == null || mist === 0) return 0;
  return mist / 1_000_000_000;
}

function formatPool(amount: number | undefined | null): string {
  // Display raw MIST values (as stored on-chain)
  if (amount == null || amount === 0) return '0';
  // Format large numbers with commas for readability
  return amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getEffectivePools(market: PredictionMarket): { safe: number; unsafe: number; total: number } {
  // Values are stored in MIST, convert to SUI for calculations
  let safe = mistToSui(market.safePool);
  let unsafe = mistToSui(market.unsafePool);
  const totalPool = mistToSui(market.totalPool);
  
  // If pools are 0 but totalPool > 0, check if postingFeeContribution should be counted
  // The initial posting fee contribution goes to safePool (creator's YES vote = safe)
  if (safe === 0 && unsafe === 0 && totalPool > 0) {
    const postingFee = mistToSui(market.postingFeeContribution);
    if (postingFee > 0) {
      // Initial bet goes to safe (creator's YES vote means "yes, it is safe")
      safe = postingFee;
    }
  }
  
  // Use totalPool if it's larger than the sum of pools (includes unallocated funds)
  const calculatedTotal = safe + unsafe;
  const total = totalPool > calculatedTotal ? totalPool : calculatedTotal;
  
  return { safe, unsafe, total };
}

function getSafePercentage(market: PredictionMarket): number {
  const { safe, unsafe, total } = getEffectivePools(market);
  if (total === 0) return 50;
  return Math.round((safe / total) * 100);
}

function getUnsafePercentage(market: PredictionMarket): number {
  const { safe, unsafe, total } = getEffectivePools(market);
  if (total === 0) return 50;
  return Math.round((unsafe / total) * 100);
}

function getOdds(market: PredictionMarket, side: 'safe' | 'unsafe'): string {
  const { safe, unsafe, total } = getEffectivePools(market);
  if (total === 0) return '50%';
  const percentage = side === 'safe' ? (safe / total) * 100 : (unsafe / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

function getBettorCount(market: PredictionMarket): number {
  if (!market.bets || market.bets.length === 0) {
    // If no bets but there's a posting fee contribution, count the creator as 1 bettor
    return market.postingFeeContribution > 0 ? 1 : 0;
  }
  // Count unique bettors
  const uniqueBettors = new Set(market.bets.map(b => b.bettor));
  return uniqueBettors.size;
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      side.value = 'safe';
      amount.value = 0.1;
      betError.value = '';
    }
  }
);

async function submitBet() {
  if (!props.market || amount.value < 0.01) return;
  placing.value = true;
  betError.value = '';
  try {
    const payload = { market: props.market, side: side.value, amount: amount.value };
    emit('placeBet', payload);
    if (props.closeOnPlaceBet) {
      // Parent will close on success; don't auto-close
    } else {
      emit('close');
    }
  } catch (e: any) {
    betError.value = e?.message || 'Failed to place bet';
  } finally {
    placing.value = false;
  }
}
</script>

<style scoped>
.pm-bet-modal-body {
  min-width: 280px;
}
</style>

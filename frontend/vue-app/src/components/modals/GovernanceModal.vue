<template>
  <BaseModal
    :show="show"
    title="Governance"
    size="md"
    :hide-footer="true"
    @close="$emit('close')"
  >
    <div class="governance-modal-body">
      <p class="text-muted small mb-3">
        On-chain platform parameters and revenue splits. 
        <router-link to="/governance">View full governance page &rarr;</router-link>
      </p>
      <div v-if="govConfig" class="small">
        <div class="d-flex justify-content-between py-2 border-bottom">
          <span>PM Duration</span>
          <span class="text-muted">{{ govConfig.pmDurationDays.toFixed(1) }} days</span>
        </div>
        <div class="d-flex justify-content-between py-2 border-bottom">
          <span>Votable Posting Fee</span>
          <span class="text-muted">{{ govConfig.votablePostingFeeSui.toFixed(2) }} SUI</span>
        </div>
        <div class="d-flex justify-content-between py-2 border-bottom">
          <span>Quorum</span>
          <span class="text-muted">{{ govConfig.quorum_pct }}%</span>
        </div>
        <hr class="my-2" />
        <p class="text-muted small mb-1"><strong>During PM</strong></p>
        <div class="d-flex justify-content-between py-1">
          <span>Foundation</span>
          <span class="text-muted">{{ govConfig.pm_foundation_pct }}%</span>
        </div>
        <div class="d-flex justify-content-between py-1">
          <span>Gateway</span>
          <span class="text-muted">{{ govConfig.pm_gateway_pct }}%</span>
        </div>
        <div class="d-flex justify-content-between py-1">
          <span>Creator (escrow)</span>
          <span class="text-muted">{{ govConfig.pm_creator_pct }}%</span>
        </div>
        <div class="d-flex justify-content-between py-1 border-bottom">
          <span>PM Pool</span>
          <span class="text-muted">{{ govConfig.pm_pool_pct }}%</span>
        </div>
        <p class="text-muted small mb-1 mt-2"><strong>After PM Success</strong></p>
        <div class="d-flex justify-content-between py-1">
          <span>Foundation</span>
          <span class="text-muted">{{ govConfig.post_foundation_pct }}%</span>
        </div>
        <div class="d-flex justify-content-between py-1">
          <span>Gateway</span>
          <span class="text-muted">{{ govConfig.post_gateway_pct }}%</span>
        </div>
        <div class="d-flex justify-content-between py-1">
          <span>Creator</span>
          <span class="text-muted">{{ govConfig.post_creator_pct }}%</span>
        </div>
        <div class="d-flex justify-content-between py-1">
          <span>PM Pool</span>
          <span class="text-muted">{{ govConfig.post_pm_pct }}%</span>
        </div>
      </div>
      <div v-else-if="loading" class="text-center py-3">
        <div class="spinner-border spinner-border-sm" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
      <p v-else class="text-muted small mb-0">
        Unable to load governance parameters.
      </p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import BaseModal from '@/components/BaseModal.vue';
import { useGovernanceConfig } from '@/composables/useGovernanceConfig';

defineProps<{
  show: boolean;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const { config: govConfig, loading, fetchConfig } = useGovernanceConfig();

onMounted(() => {
  if (!govConfig.value) {
    fetchConfig();
  }
});
</script>

<style scoped>
.governance-modal-body {
  min-width: 320px;
}
</style>

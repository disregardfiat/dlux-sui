<template>
  <div class="governance-page">
    <div class="container py-4">
      <!-- Header -->
      <section class="hero mb-4">
        <h1 class="display-5 fw-bold">
          <i class="bi bi-bank me-2"></i>Governance
        </h1>
        <p class="lead text-muted">
          On-chain platform parameters, proposals, and community voting.
        </p>
        <router-link to="/" class="btn btn-outline-secondary btn-sm">
          <i class="bi bi-arrow-left me-1"></i> Back to Home
        </router-link>
      </section>

      <!-- Platform Parameters (on-chain GovernanceConfig) -->
      <section class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h2 class="h5 mb-0"><i class="bi bi-sliders me-2"></i>Platform Parameters</h2>
          <button
            class="btn btn-sm btn-outline-primary"
            :disabled="variablesLoading"
            @click="loadVariables"
          >
            <span v-if="variablesLoading" class="spinner-border spinner-border-sm me-1"></span>
            <i v-else class="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </button>
        </div>
        <div class="card-body">
          <div v-if="variablesLoading && !govConfig" class="text-center py-3">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <div v-else-if="variablesError" class="alert alert-warning mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>{{ variablesError }}
          </div>
          <div v-else-if="govConfig" class="variables-sections">
            <!-- Core Parameters -->
            <h6 class="section-label mb-2">Core Parameters</h6>
            <div class="variables-grid mb-4">
              <div class="variable-card">
                <div class="variable-label">PM Duration</div>
                <div class="variable-value">{{ govConfig.pmDurationDays.toFixed(1) }} days</div>
                <small class="text-muted">Prediction market duration</small>
              </div>
              <div class="variable-card">
                <div class="variable-label">Votable Posting Fee</div>
                <div class="variable-value">{{ govConfig.votablePostingFeeSui.toFixed(2) }} SUI</div>
                <small class="text-muted">Fee on top of 2&times; storage cost</small>
              </div>
              <div class="variable-card">
                <div class="variable-label">Proposal Duration</div>
                <div class="variable-value">{{ govConfig.proposalDurationDays.toFixed(1) }} days</div>
                <small class="text-muted">How long voting lasts</small>
              </div>
              <div class="variable-card">
                <div class="variable-label">Quorum</div>
                <div class="variable-value">{{ govConfig.quorum_pct }}%</div>
                <small class="text-muted">Required voter turnout</small>
              </div>
            </div>

            <!-- Revenue Splits During PM -->
            <h6 class="section-label mb-2">Revenue Splits (During PM)</h6>
            <div class="variables-grid mb-4">
              <div class="variable-card">
                <div class="variable-label">Foundation</div>
                <div class="variable-value">{{ govConfig.pm_foundation_pct }}%</div>
              </div>
              <div class="variable-card">
                <div class="variable-label">Gateway / Walrus</div>
                <div class="variable-value">{{ govConfig.pm_gateway_pct }}%</div>
              </div>
              <div class="variable-card">
                <div class="variable-label">Creator (Escrow)</div>
                <div class="variable-value">{{ govConfig.pm_creator_pct }}%</div>
                <small class="text-muted">Held until PM resolves</small>
              </div>
              <div class="variable-card">
                <div class="variable-label">PM Pool</div>
                <div class="variable-value">{{ govConfig.pm_pool_pct }}%</div>
              </div>
            </div>

            <!-- Revenue Splits After PM Success -->
            <h6 class="section-label mb-2">Revenue Splits (After PM Success)</h6>
            <div class="variables-grid mb-4">
              <div class="variable-card">
                <div class="variable-label">Foundation</div>
                <div class="variable-value">{{ govConfig.post_foundation_pct }}%</div>
              </div>
              <div class="variable-card">
                <div class="variable-label">Gateway / Walrus</div>
                <div class="variable-value">{{ govConfig.post_gateway_pct }}%</div>
              </div>
              <div class="variable-card">
                <div class="variable-label">Creator</div>
                <div class="variable-value">{{ govConfig.post_creator_pct }}%</div>
              </div>
              <div class="variable-card">
                <div class="variable-label">PM Pool</div>
                <div class="variable-value">{{ govConfig.post_pm_pct }}%</div>
              </div>
            </div>

            <small class="text-muted d-block text-end">
              Last updated: {{ govConfig.last_updated_ms ? new Date(govConfig.last_updated_ms).toLocaleDateString() : 'genesis' }}
            </small>
          </div>
          <div v-else class="text-center py-3 text-muted">
            <p class="mb-0">Unable to load governance parameters.</p>
          </div>
        </div>
      </section>

      <!-- On-chain Proposals -->
      <section class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h2 class="h5 mb-0"><i class="bi bi-clipboard-check me-2"></i>On-chain Proposals</h2>
          <button
            v-if="isAuthenticated"
            class="btn btn-sm btn-primary"
            @click="showCreateProposal = true"
          >
            <i class="bi bi-plus-lg me-1"></i> New Proposal
          </button>
        </div>
        <div class="card-body">
          <div class="alert alert-info small mb-3">
            <i class="bi bi-info-circle me-1"></i>
            Governance proposals are created by eligible top creators and PM earners.
            Votes are recorded for discussion; parameter changes are executed on-chain by the backend after quorum is met via Merkle proofs.
          </div>
          <div v-if="proposalsLoading && proposals.length === 0" class="text-center py-3">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <div v-else-if="proposals.length === 0" class="text-center py-4 text-muted">
            <i class="bi bi-inbox display-4 d-block mb-3"></i>
            <p class="mb-1">No active proposals</p>
            <small>When eligible members propose parameter changes, they will appear here.</small>
          </div>
          <div v-else class="proposals-list">
            <div
              v-for="proposal in proposals"
              :key="String(proposal.proposalId ?? proposal.txDigest ?? '')"
              class="proposal-card"
            >
              <div class="proposal-header">
                <div class="proposal-title-row">
                  <h3 class="h6 mb-0">
                    Change <code>{{ proposal.paramKey || 'parameter' }}</code>
                    <span v-if="proposal.paramValue"> to {{ formatParamValue(proposal.paramKey, proposal.paramValue) }}</span>
                  </h3>
                  <span class="badge" :class="getStatusBadgeClass(proposal.status)">
                    {{ proposal.status }}
                  </span>
                </div>
                <small class="text-muted">
                  by {{ truncateAddress(proposal.proposer) }}
                  <span v-if="proposal.timestamp"> &middot; {{ formatDate(proposal.timestamp) }}</span>
                </small>
              </div>

              <div class="d-flex justify-content-between small mt-2">
                <span v-if="proposal.expiresAt" class="text-muted">
                  Expires: {{ formatDate(proposal.expiresAt) }}
                </span>
                <span v-if="proposal.txDigest" class="text-muted">
                  Tx: {{ truncateAddress(proposal.txDigest) }}
                </span>
              </div>

              <!-- Vote actions (community discussion votes via DGraph) -->
              <div v-if="isAuthenticated && proposal.status === 'active'" class="vote-actions">
                <button
                  class="btn btn-sm btn-outline-success"
                  :disabled="voting"
                  @click="castVote(proposal, 'for')"
                >
                  <i class="bi bi-hand-thumbs-up me-1"></i> Vote For
                </button>
                <button
                  class="btn btn-sm btn-outline-danger"
                  :disabled="voting"
                  @click="castVote(proposal, 'against')"
                >
                  <i class="bi bi-hand-thumbs-down me-1"></i> Vote Against
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Past Proposals -->
      <section v-if="pastProposals.length > 0" class="card mb-4">
        <div class="card-header">
          <h2 class="h5 mb-0"><i class="bi bi-archive me-2"></i>Past Proposals</h2>
        </div>
        <div class="card-body">
          <div class="proposals-list">
            <div
              v-for="proposal in pastProposals"
              :key="String(proposal.proposalId ?? proposal.txDigest ?? '')"
              class="proposal-card past"
            >
              <div class="proposal-header">
                <div class="proposal-title-row">
                  <h3 class="h6 mb-0">
                    Change <code>{{ proposal.paramKey || 'parameter' }}</code>
                  </h3>
                  <span class="badge" :class="getStatusBadgeClass(proposal.status)">
                    {{ proposal.status }}
                  </span>
                </div>
              </div>
              <div class="d-flex justify-content-between small text-muted">
                <span>by {{ truncateAddress(proposal.proposer) }}</span>
                <span>{{ formatDate(proposal.timestamp) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Create Proposal Modal (discussion layer via DGraph) -->
      <div v-if="showCreateProposal" class="modal show d-block" tabindex="-1" @click.self="showCreateProposal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title"><i class="bi bi-plus-circle me-2"></i>New Proposal</h5>
              <button type="button" class="btn-close" @click="showCreateProposal = false"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-info small">
                <i class="bi bi-info-circle me-1"></i>
                This creates a discussion proposal. If the community reaches quorum, the backend will create an on-chain proposal and execute it with Merkle proofs.
              </div>
              <div class="mb-3">
                <label class="form-label">Title</label>
                <input
                  v-model="newProposal.title"
                  type="text"
                  class="form-control"
                  placeholder="Proposal title"
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea
                  v-model="newProposal.description"
                  class="form-control"
                  rows="4"
                  placeholder="Describe the proposed change and its rationale..."
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Category</label>
                <select v-model="newProposal.category" class="form-select">
                  <option value="parameter">Parameter Change</option>
                  <option value="feature">Feature Request</option>
                  <option value="policy">Policy Update</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Duration (days)</label>
                <input
                  v-model.number="newProposal.durationDays"
                  type="number"
                  class="form-control"
                  min="1"
                  max="90"
                  placeholder="7"
                />
              </div>
              <div v-if="createError" class="alert alert-danger mb-0">{{ createError }}</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showCreateProposal = false">Cancel</button>
              <button
                type="button"
                class="btn btn-primary"
                :disabled="!canCreateProposal || creatingProposal"
                @click="submitProposal"
              >
                <span v-if="creatingProposal" class="spinner-border spinner-border-sm me-1"></span>
                Submit Proposal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { getDgraphServiceUrl, getSuiServiceUrl } from '@/config/links';
import { useGovernanceConfig, type GovernanceConfigData } from '@/composables/useGovernanceConfig';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const DGRAPH_SERVICE = getDgraphServiceUrl();
const SUI_SERVICE = getSuiServiceUrl();
const MIST_PER_SUI = 1_000_000_000;

// Governance config from on-chain
const { config: govConfigRef, loading: govLoading, error: govError, refetch: refetchGov, fetchConfig } = useGovernanceConfig();
const govConfig = computed(() => govConfigRef.value);
const variablesLoading = ref(false);
const variablesError = ref('');

// Proposals (from sui-service which queries on-chain events)
type OnChainProposal = {
  proposalId: string | null;
  proposer: string;
  paramKey: string;
  paramValue: number;
  splitValues: number[];
  expiresAtMs: number;
  expiresAt: string | null;
  txDigest: string | null;
  timestamp: string | null;
  executed: boolean;
  status: 'active' | 'expired' | 'executed';
};
const proposals = ref<OnChainProposal[]>([]);
const pastProposals = ref<OnChainProposal[]>([]);
const proposalsLoading = ref(false);
const voting = ref(false);

// Create proposal (discussion layer via DGraph)
const showCreateProposal = ref(false);
const creatingProposal = ref(false);
const createError = ref('');
const newProposal = ref({
  title: '',
  description: '',
  category: 'parameter',
  durationDays: 7
});

const canCreateProposal = computed(() =>
  newProposal.value.title.trim().length > 0 &&
  newProposal.value.description.trim().length > 0 &&
  newProposal.value.durationDays > 0
);

onMounted(() => {
  loadVariables();
  loadProposals();
});

async function loadVariables() {
  variablesLoading.value = true;
  variablesError.value = '';
  try {
    await fetchConfig(true);
    if (govError.value) {
      variablesError.value = govError.value;
    }
  } catch (err: any) {
    variablesError.value = err?.message || 'Failed to load governance config.';
  } finally {
    variablesLoading.value = false;
  }
}

async function loadProposals() {
  proposalsLoading.value = true;
  try {
    const res = await axios.get(`${SUI_SERVICE}/governance/proposals`).catch(() => null);
    if (res?.data?.proposals) {
      const all = res.data.proposals as OnChainProposal[];
      proposals.value = all.filter(p => p.status === 'active');
      pastProposals.value = all.filter(p => p.status !== 'active');
    }
  } catch {
    proposals.value = [];
    pastProposals.value = [];
  } finally {
    proposalsLoading.value = false;
  }
}

async function castVote(proposal: OnChainProposal, vote: 'for' | 'against') {
  if (!authStore.user?.suiAddress) {
    authStore.openLoginModal();
    return;
  }
  voting.value = true;
  try {
    // Discussion vote via DGraph
    await axios.post(`${DGRAPH_SERVICE}/governance/proposals/${proposal.proposalId}/vote`, {
      voter: authStore.user.suiAddress,
      vote
    }, {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
    });
    alert('Vote recorded for discussion. On-chain execution happens when quorum is reached.');
  } catch (err: any) {
    console.error('Vote failed:', err);
    alert(err?.response?.data?.error || err?.message || 'Vote failed');
  } finally {
    voting.value = false;
  }
}

async function submitProposal() {
  if (!authStore.user?.suiAddress) {
    authStore.openLoginModal();
    return;
  }
  creatingProposal.value = true;
  createError.value = '';
  try {
    await axios.post(`${DGRAPH_SERVICE}/governance/proposals`, {
      title: newProposal.value.title.trim(),
      description: newProposal.value.description.trim(),
      category: newProposal.value.category,
      durationDays: newProposal.value.durationDays,
      author: authStore.user.suiAddress
    }, {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
    });
    showCreateProposal.value = false;
    newProposal.value = { title: '', description: '', category: 'parameter', durationDays: 7 };
    await loadProposals();
  } catch (err: any) {
    createError.value = err?.response?.data?.error || err?.message || 'Failed to create proposal';
  } finally {
    creatingProposal.value = false;
  }
}

function formatParamValue(key: string, value: number): string {
  if (!key) return String(value);
  if (key.includes('fee')) return `${(value / MIST_PER_SUI).toFixed(2)} SUI`;
  if (key.includes('duration') || key.includes('ms')) return `${(value / (1000 * 60 * 60 * 24)).toFixed(1)} days`;
  if (key.includes('pct')) return `${value}%`;
  return String(value);
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active': return 'bg-primary';
    case 'executed': return 'bg-success';
    case 'expired': return 'bg-secondary';
    default: return 'bg-light text-dark';
  }
}

function truncateAddress(address: string): string {
  if (!address) return '\u2014';
  if (address.length > 10) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return address;
}

function formatDate(date: string | undefined | null): string {
  if (!date) return '\u2014';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '\u2014';
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) {
    // Future date
    const absDays = Math.abs(days);
    if (absDays === 0) return 'Today';
    if (absDays === 1) return 'Tomorrow';
    return `in ${absDays}d`;
  }
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
</script>

<style scoped>
.governance-page {
  min-height: 100vh;
  background: var(--bg-secondary);
}

.hero {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  padding: 2.5rem;
  border-radius: 12px;
}

.section-label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-light);
  border-bottom: 1px solid var(--border-primary);
  padding-bottom: 0.3rem;
}

.variables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.variable-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.variable-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.variable-value {
  font-size: 1.4rem;
  font-weight: bold;
  color: var(--primary);
}

.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.proposal-card {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.25rem;
  background: var(--bg-card);
  transition: border-color 0.2s;
}

.proposal-card:hover {
  border-color: var(--primary);
}

.proposal-card.past {
  opacity: 0.8;
}

.proposal-header {
  margin-bottom: 0.75rem;
}

.proposal-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.proposal-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.vote-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.modal.show {
  background: rgba(0, 0, 0, 0.5);
}
</style>

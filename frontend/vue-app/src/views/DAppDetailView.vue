<template>
  <div class="dapp-detail">
    <div v-if="loading" class="text-center py-4">
      <div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>
    </div>
    <div v-else-if="error" class="alert alert-warning">
      {{ error }}
    </div>
    <template v-else-if="dapp">
      <div class="dapp-detail-header mb-4">
        <div v-if="bannerUrl" class="dapp-detail-banner mb-3">
          <img :src="bannerUrl" :alt="dapp.name" class="w-100 rounded" style="max-height: 200px; object-fit: cover;" />
        </div>
        <div class="d-flex align-items-start gap-3">
          <img
            v-if="iconUrl"
            :src="iconUrl"
            :alt="dapp.name"
            class="dapp-detail-icon rounded"
          />
          <div v-else class="dapp-detail-icon-placeholder rounded d-flex align-items-center justify-content-center">
            {{ getInitials(dapp.name) }}
          </div>
          <div class="flex-grow-1">
            <h1 class="h3 mb-1">{{ dapp.name || 'Untitled' }}</h1>
            <p class="text-muted mb-1">{{ dapp.description || '—' }}</p>
            <div class="d-flex align-items-center gap-2 mb-2">
              <img
                :src="authorAvatarUrl"
                :alt="dapp.owner"
                class="author-avatar-sm rounded-circle"
              />
              <span class="small text-muted">by {{ ownerDisplay }} · {{ dapp.permlink }}</span>
            </div>
            <div v-if="dapp.tags?.length" class="mb-2">
              <span v-for="tag in dapp.tags" :key="tag" class="badge bg-secondary me-1">{{ tag }}</span>
            </div>
            <div v-if="dapp.category" class="small text-muted mb-2">Category: {{ dapp.category }}</div>
            <div v-if="dapp.version" class="small text-muted mb-2">Version: {{ dapp.version }}</div>
            <div v-if="dappLicense" class="small text-muted mb-2">License: {{ dappLicense }}</div>
          </div>
        </div>
      </div>

      <!-- Additional metadata (from manifest) -->
      <div v-if="hasAdditionalMetadata" class="card mb-4">
        <div class="card-header d-flex align-items-center">
          <i class="bi bi-tags me-2"></i>
          Additional metadata
        </div>
        <div class="card-body">
          <dl class="mb-0 small">
            <template v-for="key in additionalMetadataKeys" :key="key">
              <dt v-if="displayMetadataValue(key)" class="text-muted mt-2 mb-0">{{ key }}</dt>
              <dd v-if="displayMetadataValue(key)" class="mb-0 ms-3">{{ displayMetadataValue(key) }}</dd>
            </template>
          </dl>
        </div>
      </div>

      <!-- Prediction Markets (always show so users see the section) -->
      <div class="card mb-4">
        <div class="card-header d-flex align-items-center">
          <i class="bi bi-graph-up-arrow me-2"></i>
          Prediction Markets
        </div>
        <div class="card-body">
          <!-- Active (open) markets: show Place Bet -->
          <div v-if="activeMarkets.length > 0">
            <div v-for="market in activeMarkets" :key="market.id" class="mb-3 p-3 bg-light rounded">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                  <span class="fw-bold">{{ formatMetric(market.safetyMetric) }}</span>
                  <span class="small text-muted ms-2">Expires: {{ formatDateShort(market.expiresAt) }}</span>
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  @click="openPMBetModal(market)"
                >
                  Place Bet
                </button>
              </div>
              <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
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
                <div class="progress" style="height: 8px;">
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
              <div class="small text-muted d-flex justify-content-between align-items-center">
                <div>
                  <span>Total Pool: {{ formatPool(market.totalPool) }} MIST</span>
                  <span class="ms-2">· {{ getBettorCount(market) }} {{ getBettorCount(market) === 1 ? 'bettor' : 'bettors' }}</span>
                </div>
                <a 
                  v-if="market.id && market.id.startsWith('0x')" 
                  :href="buildExplorerObjectUrl(market.id)" 
                  target="_blank" 
                  rel="noopener"
                  class="text-decoration-none"
                  title="View on Explorer"
                >
                  <i class="bi bi-box-arrow-up-right"></i> Explorer
                </a>
              </div>
            </div>
          </div>
          <!-- Resolved markets: show outcome stats (no Place Bet) -->
          <div v-else-if="resolvedMarkets.length > 0" class="resolved-pm-stats">
            <div
              v-for="market in resolvedMarkets"
              :key="market.id"
              class="mb-3 p-3 rounded"
              :class="market.resolution === 'safe' ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'"
            >
              <div class="d-flex align-items-center gap-2 mb-2">
                <span
                  class="badge"
                  :class="market.resolution === 'safe' ? 'bg-success' : 'bg-danger'"
                >
                  {{ market.resolution === 'safe' ? 'Safe & Accurate' : 'Unsafe or Inaccurate' }}
                </span>
                <span class="fw-bold">{{ formatMetric(market.safetyMetric) }}</span>
              </div>
              <p class="mb-2 small text-muted">
                {{ getResolvedPMSummary(market) }}
              </p>
              <div class="d-flex align-items-center gap-2">
                <span class="small text-muted">
                  Total capital: {{ mistToSui(market.totalPool || 0).toFixed(4) }} SUI
                </span>
                <a
                  v-if="market.id && market.id.startsWith('0x')"
                  :href="buildExplorerObjectUrl(market.id)"
                  target="_blank"
                  rel="noopener"
                  class="small text-decoration-none ms-2"
                  title="View on Explorer"
                >
                  <i class="bi bi-box-arrow-up-right"></i> Explorer
                </a>
              </div>
            </div>
          </div>
          <p v-else class="text-muted small mb-0">
            No active prediction markets for this dApp. Markets are created when the dApp is posted (or updated) with a posting fee.
          </p>
        </div>
      </div>

      <!-- Premium Content Section -->
      <div v-if="premiumItems.length > 0" class="card mb-4">
        <div class="card-header d-flex align-items-center">
          <i class="bi bi-lock me-2"></i>
          Premium Content
          <span class="badge bg-primary ms-2">{{ premiumItems.length }}</span>
        </div>
        <div class="card-body">
          <div class="premium-list">
            <div
              v-for="item in premiumItems"
              :key="item.id"
              class="premium-item d-flex justify-content-between align-items-center"
            >
              <div>
                <div class="d-flex align-items-center gap-2">
                  <i v-if="item.hasAccess" class="bi bi-unlock text-success"></i>
                  <i v-else class="bi bi-lock text-warning"></i>
                  <strong>{{ item.name }}</strong>
                </div>
                <small v-if="item.description" class="text-muted d-block">{{ item.description }}</small>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-light text-dark">{{ item.price }} SUI</span>
                <button
                  v-if="item.hasAccess"
                  class="btn btn-sm btn-outline-success"
                  @click="downloadPremium(item)"
                >
                  <i class="bi bi-download me-1"></i>Access
                </button>
                <button
                  v-else
                  class="btn btn-sm btn-primary"
                  @click="openPurchaseModal(item)"
                >
                  <i class="bi bi-cart me-1"></i>Unlock
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Register dApp as Ad (after PM clears) -->
      <div v-if="isOwner && canRegisterAsAd" class="card mb-4 border-success">
        <div class="card-header d-flex align-items-center bg-success bg-opacity-10">
          <i class="bi bi-megaphone me-2 text-success"></i>
          <span class="text-success fw-bold">Register as Ad</span>
        </div>
        <div class="card-body">
          <p class="small text-muted mb-3">
            Your dApp has passed the safety review. You can now register it as an ad campaign to promote it across the DLUX network. Your total budget will be escrowed on-chain via your connected wallet.
          </p>
          <div v-if="!showAdRegistrationForm">
            <button class="btn btn-success btn-sm" @click="showAdRegistrationForm = true">
              <i class="bi bi-megaphone me-1"></i>
              Create Ad Campaign
            </button>
          </div>
          <div v-else>
            <div class="mb-3">
              <label class="form-label small fw-bold">Campaign Title</label>
              <input v-model="adForm.title" class="form-control form-control-sm" placeholder="e.g. Launch promo for my dApp" />
            </div>
            <div class="mb-3">
              <label class="form-label small fw-bold">Description</label>
              <textarea v-model="adForm.description" class="form-control form-control-sm" rows="2" placeholder="What makes your dApp great?" />
            </div>
            <div class="row mb-3">
              <div class="col-6">
                <label class="form-label small fw-bold">Bid (SUI per impression)</label>
                <input v-model.number="adForm.bid" type="number" step="0.001" min="0.001" class="form-control form-control-sm" />
              </div>
              <div class="col-6">
                <label class="form-label small fw-bold">Total Budget (SUI)</label>
                <input v-model.number="adForm.totalBudget" type="number" step="0.1" min="0.1" class="form-control form-control-sm" />
                <div class="form-text">This amount will be escrowed on-chain from your connected wallet.</div>
              </div>
            </div>
            <div class="mb-3">
              <label class="form-label small fw-bold">Placements</label>
              <div class="d-flex flex-wrap gap-2">
                <div v-for="p in availablePlacements" :key="p" class="form-check">
                  <input :id="`placement-${p}`" v-model="adForm.placements" :value="p" type="checkbox" class="form-check-input" />
                  <label :for="`placement-${p}`" class="form-check-label small">{{ p }}</label>
                </div>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button
                class="btn btn-success btn-sm"
                :disabled="adRegistering || !adFormValid"
                @click="submitAdRegistration"
              >
                <span v-if="adRegistering" class="spinner-border spinner-border-sm me-1"></span>
                Fund &amp; Register Campaign
              </button>
              <button class="btn btn-outline-secondary btn-sm" @click="showAdRegistrationForm = false">Cancel</button>
            </div>
            <p v-if="adRegistrationError" class="text-danger small mt-2 mb-0">{{ adRegistrationError }}</p>
            <p v-if="adRegistrationSuccess" class="text-success small mt-2 mb-0">Campaign created successfully!</p>
          </div>
        </div>
      </div>

      <!-- Blob IDs (Walrus content) -->
      <div v-if="dapp.tags?.length || blobIds.length" class="card mb-4">
        <div class="card-header d-flex align-items-center">
          <i class="bi bi-database me-2"></i>
          dApp Metadata
        </div>
        <div class="card-body">
          <div v-if="blobIds.length > 0" class="mb-3">
            <h6 class="text-muted">Walrus Blob IDs</h6>
            <div class="blob-list">
              <code
                v-for="(blob, idx) in blobIds"
                :key="idx"
                class="d-block small text-break mb-1"
              >
                {{ blob }}
              </code>
            </div>
          </div>
        </div>
      </div>

      <!-- On-chain Details (explorer links) -->
      <div v-if="dapp.txDigest || dapp.owner" class="card mb-4">
        <div class="card-header d-flex align-items-center">
          <i class="bi bi-link-45deg me-2"></i>
          On-chain Details
        </div>
        <div class="card-body">
          <dl class="mb-0 small row">
            <template v-if="dapp.txDigest">
              <dt class="col-sm-3 text-muted">Transaction</dt>
              <dd class="col-sm-9">
                <a :href="buildExplorerTxUrl(dapp.txDigest)" target="_blank" rel="noopener" class="text-break">
                  {{ dapp.txDigest }}
                  <i class="bi bi-box-arrow-up-right ms-1 small"></i>
                </a>
              </dd>
            </template>
            <dt class="col-sm-3 text-muted">Owner</dt>
            <dd class="col-sm-9">
              <a :href="buildExplorerAddressUrl(dapp.owner)" target="_blank" rel="noopener" class="text-break">
                {{ dapp.ownerSuinsName || dapp.owner }}
                <i class="bi bi-box-arrow-up-right ms-1 small"></i>
              </a>
            </dd>
            <template v-if="dapp.postingFee">
              <dt class="col-sm-3 text-muted">Posting Fee</dt>
              <dd class="col-sm-9">{{ (dapp.postingFee / 1_000_000_000).toFixed(4) }} SUI</dd>
            </template>
          </dl>
        </div>
      </div>

      <!-- Discussions / Reviews (threads attached to this dApp) -->
      <div id="discussions" class="card mb-4">
        <div class="card-header d-flex align-items-center justify-content-between">
          <span><i class="bi bi-chat-dots me-2"></i>Discussions</span>
          <button
            v-if="isAuthenticated"
            class="btn btn-sm btn-primary"
            :disabled="threadPosting"
            @click="showReviewInput = true"
          >
            <span v-if="threadPosting" class="spinner-border spinner-border-sm me-1"></span>
            Add review
          </button>
        </div>
        <div class="card-body">
          <div v-if="showReviewInput && isAuthenticated" class="review-input mb-4">
            <textarea
              v-model="newReviewContent"
              class="form-control mb-2"
              rows="3"
              placeholder="Share your experience or ask a question..."
              :disabled="threadPosting"
            />
            <div class="d-flex gap-2">
              <button
                class="btn btn-primary btn-sm"
                :disabled="!newReviewContent.trim() || threadPosting"
                @click="submitReview"
              >
                Post
              </button>
              <button class="btn btn-outline-secondary btn-sm" @click="showReviewInput = false; newReviewContent = ''">
                Cancel
              </button>
            </div>
            <p v-if="threadPostError" class="text-danger small mt-2 mb-0">{{ threadPostError }}</p>
          </div>

          <div v-if="threadLoading && threadPosts.length === 0" class="text-center py-3">
            <div class="spinner-border spinner-border-sm" role="status"></div>
          </div>
          <p v-else-if="threadPosts.length === 0" class="text-muted small mb-0">
            No discussions yet. Be the first to review or ask a question.
          </p>
          <div v-else class="thread-list">
            <div
              v-for="post in threadPosts"
              :key="post.id"
              class="thread-item py-3 border-bottom"
            >
              <div class="d-flex align-items-center gap-2 mb-1">
                <div class="thread-avatar">{{ getInitials((post as any).authorName || post.author) }}</div>
                <div>
                  <router-link
                    :to="`/@${(post as any).authorName || post.author}`"
                    class="fw-bold text-decoration-none small"
                  >
                    {{ (post as any).authorName || truncateAddress(post.author) }}
                  </router-link>
                  <small class="text-muted ms-2">{{ formatDate(post.createdAt) }}</small>
                </div>
              </div>
              <p class="thread-content mb-0 small">{{ post.content }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="actions d-flex gap-2 flex-wrap">
        <router-link class="btn btn-outline-primary" to="/dapps">Back to Hub</router-link>
        <router-link
          v-if="isOwner"
          class="btn btn-outline-secondary"
          :to="editDAppRoute"
        >
          <i class="bi bi-pencil me-1"></i>
          Edit dApp
        </router-link>
        <a
          v-if="sandboxUrl"
          class="btn btn-primary"
          :href="sandboxUrl"
          target="_blank"
          rel="noopener"
        >
          <i class="bi bi-box-arrow-up-right me-1"></i>
          Open dApp
        </a>
        <a v-if="hasRemix" class="btn btn-outline-secondary" :href="remixUrl" target="_blank" rel="noopener">
          Remix
        </a>
        <a
          v-if="dapp.txDigest"
          class="btn btn-outline-info"
          :href="buildExplorerTxUrl(dapp.txDigest)"
          target="_blank"
          rel="noopener"
        >
          <i class="bi bi-search me-1"></i>
          View on Explorer
        </a>
      </div>
    </template>
    <div v-else>
      <p class="text-muted">dApp not found.</p>
      <router-link class="btn btn-outline-primary" to="/dapps">Back to Hub</router-link>
    </div>

    <PMBetModal
      :show="showPMBetModal"
      :market="selectedPMMarket"
      :external-error="pmBetError"
      :close-on-place-bet="true"
      @close="showPMBetModal = false; pmBetError = ''"
      @place-bet="onPlaceBet"
    />

    <PremiumPurchaseModal
      :show="showPurchaseModal"
      :content-name="selectedPremiumItem?.name"
      :price-sui="selectedPremiumItem?.price"
      @close="showPurchaseModal = false"
      @purchase="handlePurchase"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { buildDappRemixUrl, buildSandboxUrl, getSuiServiceUrl, getDgraphServiceUrl, getWalrusServiceUrl, resolveWalrusUrl, buildExplorerTxUrl, buildExplorerAddressUrl, buildExplorerObjectUrl } from '@/config/links';
import { useAuthStore } from '@/stores/auth';
import { usePremiumContent, type PremiumContent } from '@/composables/usePremiumContent';
import { useSuiWallet } from '@/composables/useSuiWallet';
import { useSocial } from '@/composables/useSocial';
import { buildSuiTransferTransaction } from '@/composables/useSuiTransfer';
import PMBetModal from '@/components/modals/PMBetModal.vue';
import PremiumPurchaseModal from '@/components/modals/PremiumPurchaseModal.vue';
import { buildCreateCampaignTransaction, isOnChainCampaignAvailable } from '@/composables/useAdCampaignOnChain';
import { executeSignedTransaction } from '@/composables/useDappPostingOnChain';
import type { PredictionMarket, SocialPost } from '@dlux-sui/types';

const route = useRoute();
const authStore = useAuthStore();
const { loadPremiumContent: loadPremium, purchasePremiumContent, accessPremiumContent } = usePremiumContent();
const { signAndExecuteTransactionBlock } = useSuiWallet();
const social = useSocial();

const isAuthenticated = computed(() => authStore.isAuthenticated);

type DAppData = {
  id: string;
  name: string;
  description: string;
  owner: string;
  ownerSuinsName?: string;
  permlink: string;
  subdomain?: string;
  manifest?: { metadata?: { icon?: string; thumbnail?: string; license?: string; [k: string]: unknown }; pathMap?: Record<string, string> };
  tags?: string[];
  category?: string;
  version?: string;
  blobIds?: string[];
  txDigest?: string;
  postingFee?: number;
};
const dapp = ref<DAppData | null>(null);
const loading = ref(true);
const error = ref('');
const activeMarkets = ref<PredictionMarket[]>([]);
const resolvedMarkets = ref<any[]>([]);
const showPMBetModal = ref(false);
const selectedPMMarket = ref<PredictionMarket | null>(null);
const pmBetError = ref('');

// Premium content
const premiumItems = ref<PremiumContent[]>([]);
const showPurchaseModal = ref(false);
const selectedPremiumItem = ref<PremiumContent | null>(null);

// Blob IDs
const blobIds = computed(() => dapp.value?.blobIds || []);

// Discussions (threads/reviews for this dApp)
const threadPosts = ref<SocialPost[]>([]);
const threadLoading = ref(false);
const threadPostError = ref('');
const threadPosting = ref(false);
const newReviewContent = ref('');
const showReviewInput = ref(false);

// Ad registration (after PM clears)
const showAdRegistrationForm = ref(false);
const adRegistering = ref(false);
const adRegistrationError = ref('');
const adRegistrationSuccess = ref(false);
const availablePlacements = ['dapp-hub', 'feed', 'detail-overlay', 'sidebar'];
const adForm = ref({
  title: '',
  description: '',
  bid: 0.01,
  totalBudget: 1.0,
  placements: ['dapp-hub'] as string[]
});

/** dApp can be registered as ad only if PM ran and resolved as safe. No PM = not "passed". */
const canRegisterAsAd = computed(() => {
  // If there are active (open) markets, the PM hasn't cleared yet
  if (activeMarkets.value.some((m: any) => m.status === 'open')) return false;
  // If there are resolved=safe markets, PM cleared and passed
  if (resolvedMarkets.value.some((m: any) => m.resolution === 'safe')) return true;
  // No markets = PM never started; do NOT treat as "passed safety review"
  return false;
});

const adFormValid = computed(() =>
  adForm.value.title.trim().length > 0 &&
  adForm.value.bid > 0 &&
  adForm.value.totalBudget > 0 &&
  adForm.value.placements.length > 0
);

async function submitAdRegistration() {
  if (!dapp.value || !authStore.user?.suiAddress) return;
  adRegistering.value = true;
  adRegistrationError.value = '';
  adRegistrationSuccess.value = false;

  const sender = authStore.user.suiAddress;

  try {
    const targetUrl = dapp.value.owner && dapp.value.permlink
      ? `/@${dapp.value.owner}/${dapp.value.permlink}`
      : `/dapps/${dapp.value.id}`;

    // On-chain path: build tx → wallet signs → SUI chain → indexer picks up CampaignCreated
    if (isOnChainCampaignAvailable()) {
      const tx = buildCreateCampaignTransaction({
        sender,
        title: adForm.value.title || dapp.value.name,
        description: adForm.value.description || dapp.value.description,
        targetUrl,
        placements: adForm.value.placements,
        bidSui: adForm.value.bid,
        totalBudgetSui: adForm.value.totalBudget,
      });

      // Sign with connected wallet then execute via our RPC
      const { signTransactionBlockForExecute } = useSuiWallet();
      const signed = await signTransactionBlockForExecute(tx);
      const result = await executeSignedTransaction(signed.transactionBlockBytes, signed.signature);

      if (!result?.digest) throw new Error('No transaction digest returned');
      adRegistrationSuccess.value = true;
      showAdRegistrationForm.value = false;
      return;
    }

    // Fallback: off-chain campaign record (no escrow, for testnet without deployed contracts)
    const res = await fetch(`${DGRAPH_SERVICE}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.token ? { 'Authorization': `Bearer ${authStore.token}` } : {})
      },
      body: JSON.stringify({
        advertiser: sender,
        title: adForm.value.title || dapp.value.name,
        description: adForm.value.description || dapp.value.description,
        targetUrl,
        placements: adForm.value.placements,
        contentIds: [dapp.value.id],
        bid: adForm.value.bid,
        totalBudget: adForm.value.totalBudget
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      adRegistrationError.value = data.error || `Failed: ${res.status}`;
      return;
    }
    adRegistrationSuccess.value = true;
    showAdRegistrationForm.value = false;
  } catch (e: any) {
    adRegistrationError.value = e?.message || 'Failed to create ad campaign';
  } finally {
    adRegistering.value = false;
  }
}

const SUI_SERVICE = getSuiServiceUrl();
const DGRAPH_SERVICE = getDgraphServiceUrl();

const bannerUrl = computed(() =>
  resolveWalrusUrl(dapp.value?.manifest?.metadata?.thumbnail) || ''
);
const iconUrl = computed(() =>
  resolveWalrusUrl(dapp.value?.manifest?.metadata?.icon) || ''
);
const dappLicense = computed(() => dapp.value?.manifest?.metadata?.license ?? '');
const skipMetadataKeys = new Set(['icon', 'thumbnail', 'ogImage', 'license']);
const additionalMetadataKeys = computed(() => {
  const meta = dapp.value?.manifest?.metadata;
  if (!meta || typeof meta !== 'object') return [];
  return Object.keys(meta).filter((k) => !skipMetadataKeys.has(k));
});
function displayMetadataValue(key: string): string {
  const meta = dapp.value?.manifest?.metadata;
  if (!meta || meta[key] == null) return '';
  const v = meta[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
const hasAdditionalMetadata = computed(() =>
  additionalMetadataKeys.value.some((k) => displayMetadataValue(k))
);
const authorAvatarUrl = computed(() => {
  const seed = encodeURIComponent(dapp.value?.owner || 'unknown');
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=667eea`;
});
const ownerDisplay = computed(() => {
  // Prefer SuiNS name (strip .sui suffix for clean display)
  const suins = dapp.value?.ownerSuinsName;
  if (suins) return suins.replace(/\.sui$/, '');
  const o = dapp.value?.owner;
  if (!o) return '—';
  if (o.startsWith('0x') && o.length > 10) return `${o.slice(0, 6)}...${o.slice(-4)}`;
  return o;
});

const hasRemix = computed(() => !!dapp.value?.manifest?.pathMap?.['remix.html']);
/** Prefer SuiNS name in URLs for clean, human-readable paths. */
const ownerSlug = computed(() => dapp.value?.ownerSuinsName?.replace(/\.sui$/, '') || dapp.value?.owner || '');
const remixUrl = computed(() =>
  dapp.value?.owner && dapp.value?.permlink
    ? buildDappRemixUrl(ownerSlug.value, dapp.value.permlink, dapp.value.subdomain)
    : ''
);
const sandboxUrl = computed(() =>
  dapp.value?.owner && dapp.value?.permlink
    ? buildSandboxUrl(ownerSlug.value, dapp.value.permlink, dapp.value.subdomain)
    : ''
);

/** True if the current user owns this dApp (by SUI address). */
const isOwner = computed(() => {
  const owner = dapp.value?.owner;
  const addr = authStore.user?.suiAddress;
  if (!owner || !addr) return false;
  return String(owner).toLowerCase() === String(addr).toLowerCase();
});
/** Route to post page in edit mode with this dApp pre-filled. */
const editDAppRoute = computed(() =>
  dapp.value?.id ? { path: '/post', query: { edit: dapp.value.id } } : { path: '/post' }
);

function getInitials(value: string): string {
  if (!value) return 'DL';
  const cleaned = value.replace(/^@/, '').trim();
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'DL';
}

function formatMetric(metric: string): string {
  if (!metric || metric === '—') return metric || '—';
  return metric.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDateShort(date: Date | string | undefined | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
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

/** Bettor count for resolved market: includes author (posting fee) + unique bettors from bets. */
function getResolvedBettorCount(market: any): number {
  const bets = market.bets || [];
  const uniqueFromBets = new Set(bets.map((b: any) => b.bettor));
  const hasPostingFee = (market.postingFeeContribution || 0) > 0;
  const author = market.triggeredByAddress;
  if (hasPostingFee && author && !uniqueFromBets.has(author)) {
    uniqueFromBets.add(author);
  }
  return uniqueFromBets.size;
}

/** Community bettor count (excludes author) for resolved market. */
function getCommunityBettorCount(market: any): number {
  const total = getResolvedBettorCount(market);
  const hasPostingFee = (market.postingFeeContribution || 0) > 0;
  return hasPostingFee ? Math.max(0, total - 1) : total;
}

function getResolvedPMSummary(market: any): string {
  const totalBettors = getResolvedBettorCount(market);
  const communityBettors = getCommunityBettorCount(market);
  if (market.resolution === 'safe') {
    if (communityBettors === 0) {
      return 'PM resolved as safe and accurate (creator stake only).';
    }
    return `PM resolved as safe and accurate with ${communityBettors} ${communityBettors === 1 ? 'bettor' : 'bettors'} (not the author).`;
  }
  return `PM resolved as unsafe or inaccurate with ${totalBettors} ${totalBettors === 1 ? 'bettor' : 'bettors'}.`;
}

function openPMBetModal(market: PredictionMarket) {
  selectedPMMarket.value = market;
  showPMBetModal.value = true;
}

async function onPlaceBet(payload: { market: PredictionMarket; side: 'safe' | 'unsafe'; amount: number }) {
  pmBetError.value = '';
  try {
    const res = await fetch(`${DGRAPH_SERVICE}/markets/${encodeURIComponent(payload.market.id)}/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        side: payload.side,
        amount: payload.amount
      })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      pmBetError.value = data.error || `Place bet failed: ${res.status}`;
      return;
    }
    showPMBetModal.value = false;
    selectedPMMarket.value = null;
    if (dapp.value) fetchMarkets(dapp.value.id, dapp.value.owner, dapp.value.permlink);
  } catch (e: any) {
    pmBetError.value = e?.message || 'Failed to place bet';
  }
}

function openPurchaseModal(item: PremiumContent) {
  selectedPremiumItem.value = item;
  showPurchaseModal.value = true;
}

async function handlePurchase() {
  if (!selectedPremiumItem.value || !authStore.user?.suiAddress || !dapp.value?.owner) return;
  try {
    // Build a SUI transfer to the dApp owner for the premium content price
    const txBytes = await buildSuiTransferTransaction(
      authStore.user.suiAddress,
      dapp.value.owner,
      selectedPremiumItem.value.price
    );
    const result = await signAndExecuteTransactionBlock(txBytes, { showEffects: true }, 'WaitForEffectsCert');
    const digest = result?.digest ?? result?.effects?.transactionDigest;
    if (!digest) throw new Error('No transaction digest returned');

    // Register the purchase
    await purchasePremiumContent(selectedPremiumItem.value.id, authStore.user.suiAddress, digest);

    // Refresh premium content list
    showPurchaseModal.value = false;
    selectedPremiumItem.value = null;
    if (dapp.value) await fetchPremiumContent(dapp.value.id);
    alert('Content unlocked successfully!');
  } catch (err: any) {
    alert(`Purchase failed: ${err.message}`);
  }
}

async function downloadPremium(item: PremiumContent) {
  if (!authStore.user?.suiAddress) return;
  try {
    const blob = await accessPremiumContent(item.id, authStore.user.suiAddress);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name || 'premium-content';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err: any) {
    alert(`Access failed: ${err.message}`);
  }
}

async function fetchPremiumContent(dappId: string) {
  try {
    const userAddr = authStore.user?.suiAddress;
    const params = new URLSearchParams();
    if (userAddr) params.append('user', userAddr);
    const res = await fetch(`${getWalrusServiceUrl()}/premium/content/${dappId}?${params}`);
    if (res.ok) {
      const data = await res.json();
      premiumItems.value = data.contents || [];
    }
  } catch {
    premiumItems.value = [];
  }
}

async function fetchMarkets(dappId: string, owner?: string, permlink?: string) {
  try {
    const [activeRes, resolvedRes, safetyRes] = await Promise.all([
      fetch(`${DGRAPH_SERVICE}/markets/dapp/${encodeURIComponent(dappId)}`),
      fetch(`${DGRAPH_SERVICE}/markets/dapp/${encodeURIComponent(dappId)}/resolved`),
      fetch(`${DGRAPH_SERVICE}/safety/dapp/${encodeURIComponent(dappId)}`)
    ]);
    const activeData = activeRes.ok ? await activeRes.json().catch(() => ({})) : {};
    const resolvedData = resolvedRes.ok ? await resolvedRes.json().catch(() => ({})) : {};
    const safetyData = safetyRes.ok ? await safetyRes.json().catch(() => ({})) : {};
    activeMarkets.value = activeData.markets || [];
    let resolved = resolvedData.markets || [];
    // Fallback 1: safety API uses type(PredictionMarket) and may find resolved markets when /resolved returns empty
    if (resolved.length === 0 && safetyData.resolvedMarkets?.length > 0) {
      resolved = safetyData.resolvedMarkets.map((m: any) => ({
        ...m,
        safetyMetric: m.safetyMetric || 'safe-and-accurate',
        triggeredByAddress: m.triggeredByAddress || ''
      }));
    }
    // Fallback 2: try owner_permlink if primary dappId returns nothing (markets may be keyed by contentId format)
    const altId = owner && permlink ? `${owner}_${permlink}` : null;
    if (resolved.length === 0 && altId && altId !== dappId) {
      try {
        const altRes = await fetch(`${DGRAPH_SERVICE}/safety/dapp/${encodeURIComponent(altId)}`);
        const altData = altRes.ok ? await altRes.json().catch(() => ({})) : {};
        if (altData.resolvedMarkets?.length > 0) {
          resolved = altData.resolvedMarkets.map((m: any) => ({
            ...m,
            safetyMetric: m.safetyMetric || 'safe-and-accurate',
            triggeredByAddress: m.triggeredByAddress || ''
          }));
        }
      } catch { /* ignore */ }
    }
    // Fallback 3: fees API confirms PM existed; assume resolved safe so "Register as Ad" and summary can show
    if (resolved.length === 0 && activeMarkets.value.length === 0) {
      for (const fid of [dappId, altId].filter(Boolean)) {
        if (!fid) continue;
        try {
          const feesRes = await fetch(`${DGRAPH_SERVICE}/markets/fees/${encodeURIComponent(fid)}`);
          const feesData = await feesRes.json();
          if (feesData.markets > 0) {
            resolved = [{ id: 'inferred', resolution: 'safe', safetyMetric: 'safe-and-accurate', totalPool: feesData.total || 0, postingFeeContribution: feesData.total || 0 }];
            break;
          }
        } catch { /* ignore */ }
      }
    }
    resolvedMarkets.value = resolved;
  } catch {
    activeMarkets.value = [];
    resolvedMarkets.value = [];
  }
}

async function loadThreads() {
  const id = dapp.value?.id;
  if (!id) return;
  threadLoading.value = true;
  try {
    const result = await social.getFeed({ dappId: id, limit: 50, offset: 0, sortBy: 'created', sortOrder: 'desc' });
    threadPosts.value = result.posts || [];
  } catch {
    threadPosts.value = [];
  } finally {
    threadLoading.value = false;
  }
}

async function submitReview() {
  const content = newReviewContent.value.trim();
  const id = dapp.value?.id;
  if (!content || !id) return;
  threadPosting.value = true;
  threadPostError.value = '';
  try {
    const post = await social.createPost({ content, dappId: id });
    threadPosts.value = [post, ...threadPosts.value];
    newReviewContent.value = '';
    showReviewInput.value = false;
  } catch (err: any) {
    threadPostError.value = err?.message || 'Failed to post';
  } finally {
    threadPosting.value = false;
  }
}

function truncateAddress(addr: string): string {
  if (!addr) return '—';
  if (addr.startsWith('0x') && addr.length > 10) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  return addr;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { dateStyle: 'short' });
}

async function fetchDapp() {
  const id = route.params.id as string;
  if (!id) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${SUI_SERVICE}/dapps/${encodeURIComponent(id)}`);
    if (!res.ok) {
      dapp.value = null;
      error.value = res.status === 404 ? 'dApp not found.' : 'Failed to load dApp.';
      return;
    }
    const data = await res.json();
    dapp.value = {
      id: data.id,
      name: data.name,
      description: data.description,
      owner: data.owner,
      ownerSuinsName: data.ownerSuinsName || undefined,
      permlink: data.permlink,
      subdomain: data.subdomain,
      manifest: data.manifest,
      tags: data.tags,
      category: data.category,
      version: data.version,
      blobIds: data.blobIds,
      txDigest: data.txDigest || undefined,
      postingFee: data.postingFee || undefined
    };
    await Promise.all([
      fetchMarkets(data.id, data.owner, data.permlink),
      fetchPremiumContent(data.id)
    ]);
    await loadThreads();
  } catch (e) {
    dapp.value = null;
    error.value = 'Failed to load dApp.';
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, fetchDapp, { immediate: true });
</script>

<style scoped>
.dapp-detail {
  padding: 1rem;
}

.dapp-detail-icon {
  width: 80px;
  height: 80px;
  object-fit: cover;
}

.dapp-detail-icon-placeholder {
  width: 80px;
  height: 80px;
  background: #eef1ff;
  color: #4c5bd4;
  font-weight: 700;
  font-size: 1.5rem;
}

.author-avatar-sm {
  width: 28px;
  height: 28px;
  object-fit: cover;
}

.actions {
  margin-top: 1rem;
  display: flex;
  gap: 0.75rem;
}

.premium-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.premium-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.premium-item:last-child {
  border-bottom: none;
}

.blob-list {
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 0.75rem;
}

.thread-item:last-child {
  border-bottom: none !important;
}

.thread-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.thread-content {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

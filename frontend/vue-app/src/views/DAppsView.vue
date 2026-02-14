<template>
  <div class="hub-page">
    <div v-if="postedSuccess" class="hub-alert alert alert-success alert-dismissible fade show" role="alert">
      <i class="bi bi-check-circle me-2"></i>
      <strong>dApp posted!</strong>
      <router-link v-if="postedDappId" :to="`/dapps/${postedDappId}`" class="alert-link ms-2">View your dApp</router-link>
      <button type="button" class="btn-close" aria-label="Close" @click="dismissPostedSuccess"></button>
    </div>

    <section class="hero">
      <h1 class="hero-title">dApp Hub</h1>
      <p class="hero-subtitle">
        Discover dApps, creators, and NFTs across the {{ brandName }} ecosystem.
      </p>
      <div class="hero-ctas">
        <a class="btn btn-primary btn-hero-primary" href="https://suins.io" target="_blank" rel="noopener">
          <i class="bi bi-person-badge me-2"></i>Get your account on SuiNS
        </a>
        <router-link class="btn btn-outline-secondary btn-hero-secondary" to="/@sui_artist">
          Profile
        </router-link>
        <router-link class="btn btn-outline-secondary btn-hero-secondary" to="/">
          Back to Home
        </router-link>
      </div>
    </section>

    <section class="search-section">
      <div class="search-wrap">
        <label class="search-label" for="hub-search">Search</label>
        <input
          id="hub-search"
          v-model="query"
          type="search"
          class="search-input"
          placeholder="dApps, authors, NFTs..."
          autocomplete="off"
        />
      </div>
      <div class="filter-tabs" role="tablist">
        <button
          v-for="filter in filters"
          :key="filter"
          type="button"
          class="filter-tab"
          :class="{ active: activeFilter === filter }"
          role="tab"
          :aria-selected="activeFilter === filter"
          @click="activeFilter = filter"
        >
          {{ filter }}
        </button>
      </div>
    </section>

    <section class="results">
      <header class="results-header">
        <h2 class="results-title">
          {{ activeFilter === 'PMs' ? 'Prediction markets' : activeFilter === 'dApps' ? 'dApps' : activeFilter === 'Authors' ? 'Creators' : activeFilter === 'NFTs' ? 'NFTs' : 'Explore' }}
        </h2>
        <span class="results-count">
          {{ activeFilter === 'PMs' ? pmMarkets.length : filteredResults.length }} {{ (activeFilter === 'PMs' ? pmMarkets.length : filteredResults.length) === 1 ? 'item' : 'items' }}
        </span>
      </header>
      <div v-if="activeFilter === 'PMs'">
        <!-- User's positions -->
        <div v-if="isAuthenticated && userBets.length > 0" class="user-positions mb-4">
          <h3 class="h6 text-muted mb-2">
            <i class="bi bi-person-circle me-1"></i>My Positions
          </h3>
          <div class="positions-grid">
            <div
              v-for="bet in userBets"
              :key="`${bet.marketId}-${bet.side}`"
              class="position-card"
              :class="`position-${bet.side}`"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <span class="badge" :class="bet.side === 'safe' ? 'bg-success' : 'bg-danger'">
                    {{ bet.side === 'safe' ? 'Safe' : 'Unsafe' }}
                  </span>
                  <span class="ms-2 small text-muted">Market: {{ bet.marketId?.slice(0, 8) }}...</span>
                </div>
                <strong>{{ bet.amount }} SUI</strong>
              </div>
            </div>
          </div>
        </div>

        <div v-if="pmMarkets.length === 0" class="empty-state">
          <i class="bi bi-graph-up-arrow empty-state-icon"></i>
          <p class="empty-state-text">No prediction markets right now.</p>
          <p class="empty-state-hint">Switch to All or dApps to browse.</p>
        </div>
        <div v-else class="result-grid">
          <div v-for="market in pmMarkets" :key="market.id" class="result-card result-card-pm">
            <div class="result-card-badges">
              <span class="badge badge-pm">PM</span>
              <span class="badge badge-payout">High Payout</span>
            </div>
            <h3 class="result-card-title">{{ formatMetric(market.safetyMetric || '—') }}</h3>
            <p class="result-card-desc">dApp: {{ market.dappId || '—' }}</p>
            <div class="pm-pool-breakdown mb-2">
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
            <div class="result-card-footer result-card-footer-pm">
              <span class="result-card-meta">Total Pool: {{ formatPool(market.totalPool) }} MIST</span>
              <span class="result-card-meta">{{ getBettorCount(market) }} {{ getBettorCount(market) === 1 ? 'bettor' : 'bettors' }}</span>
              <span class="result-card-meta">Expires: {{ market.expiresAt ? formatDate(market.expiresAt as any) : '—' }}</span>
              <a 
                v-if="market.id && market.id.startsWith('0x')" 
                :href="buildExplorerObjectUrl(market.id)" 
                target="_blank" 
                rel="noopener"
                class="result-card-meta text-decoration-none"
                title="View on Explorer"
              >
                <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
            <div class="pm-actions">
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                aria-label="Place bet on this market"
                @click="openPMBetModal(market)"
              >
                Place Bet
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-success"
                aria-label="Claim winnings"
                @click="openPMClaimModal(market)"
              >
                Claim
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="(activeFilter === 'All' || activeFilter === 'dApps') && dappsLoading" class="text-center py-4">
        <div class="spinner-border" role="status"><span class="visually-hidden">Loading dApps...</span></div>
      </div>
      <div v-else-if="filteredResults.length === 0" class="empty-state">
        <i class="bi bi-search empty-state-icon"></i>
        <p class="empty-state-text">No matches yet.</p>
        <p class="empty-state-hint">Try a different search or switch tabs.</p>
      </div>
      <div v-else class="result-grid">
        <template v-for="item in filteredResults" :key="item.id">
          <DAppCard
            v-if="item.type === 'dApp' && item.dapp"
            :dapp-id="item.id"
            :title="item.title || 'Untitled'"
            :description="item.description || '—'"
            :owner="item.owner || ''"
            :owner-suins-name="item.ownerSuinsName || ''"
            :owner-avatar-url="item.ownerAvatar || ''"
            :permlink="item.permlink"
            :subdomain="item.subdomain"
            :manifest="item.dapp?.manifest"
            :pm-status="item.pmStatus"
          />
          <div v-else class="result-card result-card-other">
            <div class="result-card-badges">
              <span class="badge badge-type">{{ item.type }}</span>
              <span v-if="item.sfw" class="badge badge-sfw">SFW</span>
            </div>
            <h3 class="result-card-title">{{ item.title || 'Untitled' }}</h3>
            <p class="result-card-desc">{{ item.description || '—' }}</p>
            <div class="result-card-footer">
              <span v-if="item.ownerSuinsName" class="result-card-meta">by {{ item.ownerSuinsName.replace(/\.sui$/, '') }}</span>
              <span v-else-if="item.owner" class="result-card-meta">by {{ item.owner.startsWith('0x') && item.owner.length > 10 ? item.owner.slice(0,6) + '...' + item.owner.slice(-4) : item.owner }}</span>
              <router-link v-if="item.type === 'Author'" :to="`/@${item.id}`" class="result-card-link">
                View profile
              </router-link>
              <span v-else class="result-card-meta">Details soon</span>
            </div>
          </div>
        </template>
      </div>
    </section>

    <PMBetModal
      :show="showPMBetModal"
      :market="selectedPMMarket"
      @close="showPMBetModal = false"
      @place-bet="onPlaceBet"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { BRAND_NAME, getDgraphServiceUrl, getSuiServiceUrl, buildExplorerObjectUrl } from '@/config/links';
import { useAuthStore } from '@/stores/auth';
import PMBetModal from '@/components/modals/PMBetModal.vue';
import DAppCard from '@/components/DAppCard.vue';
import type { PredictionMarket } from '@dlux-sui/types';

const route = useRoute();
const authStore = useAuthStore();

const brandName = BRAND_NAME;
const isAuthenticated = computed(() => authStore.isAuthenticated);

type HubResult = {
  id: string;
  type: 'dApp' | 'Author' | 'NFT';
  title: string;
  description: string;
  owner?: string;
  ownerSuinsName?: string;
  ownerAvatar?: string | null;
  sfw?: boolean;
  subdomain?: string;
  permlink?: string;
  dapp?: { manifest?: { metadata?: { icon?: string; thumbnail?: string } } };
  pmStatus?: { hasActiveMarkets?: boolean };
};

const query = ref('');
const filters = ['All', 'dApps', 'Authors', 'NFTs', 'PMs'];
const activeFilter = ref(filters[0]);

const SUI_SERVICE = getSuiServiceUrl();

const dappResults = ref<HubResult[]>([]);
const dappsLoading = ref(false);
const staticAuthors: HubResult[] = [
  { id: 'sui_artist', type: 'Author', title: '@sui_artist', description: 'Daily generative art and community drops.', sfw: true }
];
const results = ref<HubResult[]>([...staticAuthors]);

const postedSuccess = ref(false);
const postedDappId = ref('');
function initPostedSuccess() {
  const q = route.query;
  if (q?.posted === '1') {
    postedSuccess.value = true;
    postedDappId.value = (q.dappId as string) || '';
  }
}
function dismissPostedSuccess() {
  postedSuccess.value = false;
  postedDappId.value = '';
}

const pmMarkets = ref<PredictionMarket[]>([]);
const showPMBetModal = ref(false);
const selectedPMMarket = ref<PredictionMarket | null>(null);

// User positions
type UserBet = {
  marketId: string;
  side: 'safe' | 'unsafe';
  amount: number;
  dappId?: string;
  placedAt?: string | Date;
};
const userBets = ref<UserBet[]>([]);

function formatMetric(metric: string): string {
  if (!metric || metric === '—') return metric || '—';
  return metric.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(date: Date | string | undefined | null): string {
  if (!date) return '—';
  let d: Date;
  if (typeof date === 'string') {
    d = new Date(date);
  } else if (date instanceof Date) {
    d = date;
  } else {
    return '—';
  }
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

function openPMBetModal(market: PredictionMarket) {
  selectedPMMarket.value = market;
  showPMBetModal.value = true;
}

function openPMClaimModal(market: PredictionMarket) {
  // TODO: open PMClaimModal or call claim API when implemented
  console.log('Claim winnings for market', market.id);
}

async function onPlaceBet(payload: { market: PredictionMarket; side: 'safe' | 'unsafe'; amount: number }) {
  try {
    const res = await fetch(`${DGRAPH_SERVICE}/markets/${encodeURIComponent(payload.market.id)}/bets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side: payload.side, amount: payload.amount })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error('Place bet failed:', data.error || res.status);
    }
    showPMBetModal.value = false;
    selectedPMMarket.value = null;
    refreshPmMarkets();
  } catch (e) {
    console.error('Place bet failed:', e);
  }
}

const filteredResults = computed(() => {
  const lower = query.value.trim().toLowerCase();
  const matchesQuery = (item: HubResult) =>
    !lower ||
    (item.title || '').toLowerCase().includes(lower) ||
    (item.description || '').toLowerCase().includes(lower);

  const matchesFilter = (item: HubResult) => {
    if (activeFilter.value === 'All') return true;
    if (activeFilter.value === 'dApps') return item.type === 'dApp';
    if (activeFilter.value === 'Authors') return item.type === 'Author';
    if (activeFilter.value === 'NFTs') return item.type === 'NFT';
    if (activeFilter.value === 'PMs') return false;
    return true;
  };

  return results.value.filter((item) => matchesQuery(item) && matchesFilter(item));
});

const DGRAPH_SERVICE = getDgraphServiceUrl();

const fetchDapps = async () => {
  dappsLoading.value = true;
  try {
    const response = await fetch(`${SUI_SERVICE}/dapps?limit=100`);
    const data = await response.json();
    const list = data.dapps || [];
    dappResults.value = list.map((d: any) => ({
      id: d.id,
      type: 'dApp' as const,
      title: d.name || d.manifest?.metadata?.title || 'Untitled',
      description: d.description || d.manifest?.metadata?.description || '—',
      owner: d.owner,
      ownerSuinsName: d.ownerSuinsName || undefined,
      ownerAvatar: d.ownerAvatar || undefined,
      sfw: true,
      subdomain: d.subdomain,
      permlink: d.permlink,
      dapp: d,
      pmStatus: d.pmStatus
    }));
    results.value = [...dappResults.value, ...staticAuthors];
  } catch (error) {
    console.error('Failed to load dApps', error);
    dappResults.value = [];
    results.value = [...staticAuthors];
  } finally {
    dappsLoading.value = false;
  }
};

const refreshPmMarkets = async () => {
  if (activeFilter.value !== 'PMs') return;
  try {
    const response = await fetch(`${DGRAPH_SERVICE}/markets/high-payout?limit=10`);
    const data = await response.json();
    pmMarkets.value = data.markets || [];
  } catch (error) {
    console.error('Failed to load PM markets', error);
    pmMarkets.value = [];
  }
  // Also load user positions when viewing PMs
  if (authStore.user?.suiAddress) {
    await loadUserPositions();
  }
};

const loadUserPositions = async () => {
  if (!authStore.user?.suiAddress) return;
  try {
    // Try to fetch user bets from markets API
    const allBets: UserBet[] = [];
    for (const market of pmMarkets.value) {
      if (market.bets) {
        const myBets = market.bets.filter(
          (b: any) => b.user === authStore.user?.suiAddress || b.bettor === authStore.user?.suiAddress
        );
        for (const b of myBets) {
          allBets.push({
            marketId: market.id,
            side: b.side || 'safe',
            amount: b.amount || 0,
            dappId: market.dappId,
            placedAt: b.createdAt ? new Date(b.createdAt).toISOString() : undefined
          });
        }
      }
    }
    userBets.value = allBets;
  } catch {
    userBets.value = [];
  }
};

const fetchNftsByOwner = async (owner: string) => {
  try {
    const response = await fetch(`${SUI_SERVICE}/nfts/owner/${owner}`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.nfts || []).map((nft: any) => ({
      id: nft.objectId,
      type: 'NFT',
      title: nft.name || 'Untitled NFT',
      description: nft.collection || nft.type || 'Sui NFT',
      owner,
      sfw: true
    })) as HubResult[];
  } catch {
    return [];
  }
};

const refreshNftSearch = async () => {
  if (activeFilter.value !== 'NFTs') return;
  const owner = query.value.trim();
  if (!owner.startsWith('0x')) return;
  const nftResults = await fetchNftsByOwner(owner);
  results.value = results.value.filter((item) => item.type !== 'NFT').concat(nftResults);
};

onMounted(() => {
  initPostedSuccess();
  fetchDapps();
});

// Auto-refresh when navigated to with posted=1 (e.g., after posting a dApp)
watch(() => route.query.posted, (posted) => {
  if (posted === '1') {
    initPostedSuccess();
    fetchDapps(); // Refresh the list to include the newly posted dApp
  }
});

watch([query, activeFilter], () => {
  refreshNftSearch();
  refreshPmMarkets();
});
</script>

<style scoped>
.hub-page {
  min-height: 60vh;
  padding-bottom: 3rem;
}

.hub-alert {
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

/* Hero */
.hero {
  background: linear-gradient(145deg, var(--bg-tertiary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%);
  padding: 2.5rem 2rem;
  border-radius: 16px;
  margin-bottom: 1.75rem;
  border: 1px solid var(--border-primary);
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
  max-width: 36rem;
}

.hero-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.btn-hero-primary {
  font-weight: 600;
  padding: 0.5rem 1.25rem;
  border-radius: 10px;
}

.btn-hero-secondary {
  border-radius: 10px;
  padding: 0.5rem 1rem;
}

/* Search */
.search-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
  margin-bottom: 1.5rem;
}

.search-wrap {
  flex: 1;
  min-width: 200px;
}

.search-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.35rem;
}

.search-input {
  width: 100%;
  padding: 0.65rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  background: var(--bg-input);
  color: var(--text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
}

.search-input::placeholder {
  color: var(--text-placeholder);
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--bg-tertiary);
  border-radius: 10px;
}

.filter-tab {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
}

.filter-tab:hover {
  color: var(--text-primary);
  background: var(--bg-card);
}

.filter-tab.active {
  color: var(--text-primary);
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* Results */
.results {
  margin-top: 0.5rem;
}

.results-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.results-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.results-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.25rem;
}

.result-card {
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  padding: 1.25rem;
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.result-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.result-card-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge-type, .badge-pm {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.badge-sfw {
  background: var(--badge-sfw-bg);
  color: var(--badge-sfw-text);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.badge-payout {
  background: var(--badge-payout-bg);
  color: var(--badge-payout-text);
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.result-card-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.35;
}

.result-card-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}

.result-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-primary);
}

.result-card-footer-pm {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.result-card-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.result-card-link {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--primary);
  text-decoration: none;
}

.result-card-link:hover {
  text-decoration: underline;
}

.pm-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px dashed var(--border-primary);
}

.empty-state-icon {
  font-size: 2.5rem;
  color: var(--text-light);
  margin-bottom: 0.75rem;
  display: block;
}

.empty-state-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.empty-state-hint {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.user-positions {
  background: var(--status-success-bg);
  border: 1px solid var(--status-success-text);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.positions-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.position-card {
  background: var(--bg-card);
  border: 1px solid var(--status-success-bg);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  border-left: 4px solid;
}

.position-safe {
  border-left-color: var(--safe-color);
}

.position-unsafe {
  border-left-color: var(--unsafe-color);
}
</style>

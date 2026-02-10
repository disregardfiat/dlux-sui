<template>
  <div
    class="dapp-card"
    role="article"
    @click="goToDetail"
  >
    <div class="dapp-card-banner">
      <img
        v-if="bannerUrl"
        :src="bannerUrl"
        :alt="title"
        loading="lazy"
      />
      <div v-else class="dapp-card-banner-placeholder">
        {{ getInitials(title) }}
      </div>
    </div>
    <div class="dapp-card-body">
      <div class="dapp-card-header">
        <img
          v-if="iconUrl"
          :src="iconUrl"
          :alt="title"
          class="dapp-card-icon"
        />
        <div v-else class="dapp-card-icon-placeholder">
          {{ getInitials(title) }}
        </div>
        <div v-if="pmStatus?.hasActiveMarkets || pmStatus?.hasResolvedMarkets" class="pm-badge">
          <span
            v-if="pmStatus?.hasActiveMarkets"
            class="badge"
            :class="pmBadgeClass"
            :title="pmTooltip"
          >
            <i class="bi bi-graph-up-arrow me-1"></i>
            {{ pmLabel }}
          </span>
          <span
            v-else-if="pmStatus?.hasResolvedMarkets"
            class="badge bg-success"
          >
            <i class="bi bi-check-circle me-1"></i>Reviewed
          </span>
        </div>
      </div>
      <!-- PM indicator strip -->
      <div
        v-if="pmStatus?.hasActiveMarkets && (pmStatus?.totalPool || pmStatus?.safeOdds)"
        class="pm-indicator"
        @click.stop="$emit('openBetModal')"
      >
        <span v-if="pmStatus.totalPool" class="pm-stat" title="Total pool">
          <i class="bi bi-coin"></i> {{ pmStatus.totalPool }} SUI
        </span>
        <span v-if="pmStatus.safeOdds !== undefined" class="pm-stat" title="Cost to buy $1 if safe (safe odds)">
          <i class="bi bi-bullseye"></i> {{ safeBetCost }}
        </span>
        <span v-if="daysRemaining !== null" class="pm-stat" :title="`${daysRemaining} days remaining`">
          <i class="bi bi-clock"></i> {{ daysRemaining }}d
        </span>
      </div>
      <h3 class="dapp-card-title">{{ title }}</h3>
      <p class="dapp-card-description">{{ description }}</p>
      <div class="dapp-card-author">
        <img
          :src="authorAvatarUrl"
          :alt="owner"
          class="author-avatar"
          loading="lazy"
        />
        <span class="author-name">by {{ ownerDisplay }}</span>
      </div>
      <div class="dapp-card-actions">
        <a
          v-if="sandboxUrl"
          class="btn btn-sm btn-primary"
          :href="sandboxUrl"
          target="_blank"
          rel="noopener"
          @click.stop
        >
          <i class="bi bi-box-arrow-up-right me-1"></i>
          Open dApp
        </a>
        <router-link
          :to="`/dapps/${detailId}`"
          class="btn btn-sm btn-outline-secondary"
          @click.stop
        >
          View
        </router-link>
        <router-link
          :to="`/dapps/${detailId}#discussions`"
          class="btn btn-sm btn-outline-secondary"
          @click.stop
        >
          <i class="bi bi-chat-dots me-1"></i>Discuss
        </router-link>
        <a
          v-if="hasRemix && remixUrl"
          class="btn btn-sm btn-outline-secondary"
          :href="remixUrl"
          target="_blank"
          rel="noopener"
          @click.stop
        >
          Remix
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { buildDappRemixUrl, buildSandboxUrl, resolveWalrusUrl } from '@/config/links';

const props = withDefaults(
  defineProps<{
    dappId: string;
    title: string;
    description: string;
    owner: string;
    ownerSuinsName?: string;
    permlink?: string;
    subdomain?: string;
    manifest?: { metadata?: { icon?: string; thumbnail?: string; ogImage?: string }; pathMap?: Record<string, string> };
    pmStatus?: {
      hasActiveMarkets?: boolean;
      hasResolvedMarkets?: boolean;
      overallStatus?: string;
      overallColor?: string;
      lessTested?: boolean;
      totalPool?: number;
      expiresAt?: string;
      safeOdds?: number;
    };
  }>(),
  { ownerSuinsName: '', permlink: '', subdomain: '', manifest: () => ({}), pmStatus: () => ({}) }
);

defineEmits<{
  (e: 'openBetModal'): void;
}>();

const router = useRouter();

const pmBadgeClass = computed(() => {
  const color = props.pmStatus?.overallColor;
  if (color === 'green') return 'bg-success';
  if (color === 'red') return 'bg-danger';
  return 'bg-warning text-dark';
});

const pmLabel = computed(() => {
  const status = props.pmStatus?.overallStatus;
  if (status === 'safe') return 'Safe';
  if (status === 'unsafe') return 'Unsafe';
  if (status === 'unknown') return 'Unverified';
  return 'PM Active';
});

const pmTooltip = computed(() => {
  const parts: string[] = [];
  if (props.pmStatus?.totalPool) parts.push(`Pool: ${props.pmStatus.totalPool} SUI`);
  if (props.pmStatus?.safeOdds !== undefined) parts.push(`Safe odds: ${(props.pmStatus.safeOdds * 100).toFixed(0)}%`);
  if (daysRemaining.value !== null) parts.push(`${daysRemaining.value} days left`);
  return parts.join(' · ') || 'Active prediction market';
});

const safeBetCost = computed(() => {
  const odds = props.pmStatus?.safeOdds;
  if (odds === undefined || odds === null) return '—';
  // Cost to buy $1 if safe = safe odds (e.g., 0.9 = 90 cents to buy $1 if it succeeds)
  return `$${(odds).toFixed(2)}`;
});

const daysRemaining = computed<number | null>(() => {
  if (!props.pmStatus?.expiresAt) return null;
  const expires = new Date(props.pmStatus.expiresAt);
  if (isNaN(expires.getTime())) return null;
  const diff = expires.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

const bannerUrl = computed(() => {
  const thumb = props.manifest?.metadata?.thumbnail;
  const og = props.manifest?.metadata?.ogImage;
  return resolveWalrusUrl(thumb || og) || '';
});

const iconUrl = computed(() => {
  const icon = props.manifest?.metadata?.icon;
  return resolveWalrusUrl(icon) || '';
});

/** Programmatic doodle (like GitHub identicons) - deterministic avatar from owner address */
const authorAvatarUrl = computed(() => {
  const seed = encodeURIComponent(props.owner || 'unknown');
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}&backgroundColor=667eea`;
});

const ownerDisplay = computed(() => {
  // Prefer SuiNS name (strip .sui suffix for clean display)
  if (props.ownerSuinsName) return props.ownerSuinsName.replace(/\.sui$/, '');
  if (!props.owner) return '—';
  if (props.owner.startsWith('0x') && props.owner.length > 10) {
    return `${props.owner.slice(0, 6)}...${props.owner.slice(-4)}`;
  }
  return props.owner;
});

/** URL-safe dApp detail id: owner_permlink (backend may return hash bytes as id; this is stable and shareable). */
const detailId = computed(() => {
  if (props.owner && props.permlink) {
    return `${String(props.owner).toLowerCase()}_${props.permlink}`;
  }
  return props.dappId;
});

const sandboxUrl = computed(() => {
  if (!props.owner || !(props.permlink || props.dappId)) return '';
  const pl = props.permlink || props.dappId.split('_')[1] || props.dappId;
  // Use SuiNS name (without .sui) for cleaner URL paths
  const ownerSlug = props.ownerSuinsName?.replace(/\.sui$/, '') || props.owner;
  return buildSandboxUrl(ownerSlug, pl, props.subdomain);
});

/** True if dApp has remix.html in pathMap (remix UI for swapping assets). */
const hasRemix = computed(() => !!props.manifest?.pathMap?.['remix.html']);

const remixUrl = computed(() => {
  const pl = props.permlink || props.dappId.split('_')[1];
  if (props.owner && pl) {
    const ownerSlug = props.ownerSuinsName?.replace(/\.sui$/, '') || props.owner;
    return buildDappRemixUrl(ownerSlug, pl, props.subdomain);
  }
  return '';
});

function getInitials(value: string): string {
  if (!value) return 'DL';
  const cleaned = value.replace(/^@/, '').trim();
  const parts = cleaned.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'DL';
}

function goToDetail() {
  router.push(`/dapps/${detailId.value}`);
}
</script>

<style scoped>
.dapp-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.dapp-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-color: #d1d5db;
}

.dapp-card-banner {
  height: 140px;
  background: linear-gradient(145deg, #eef1ff 0%, #e8e4f8 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.dapp-card-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dapp-card-banner-placeholder {
  font-size: 2.25rem;
  font-weight: 700;
  color: #5b21b6;
  opacity: 0.85;
  letter-spacing: -0.02em;
}

.dapp-card-body {
  padding: 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dapp-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dapp-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
}

.dapp-card-icon-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #eef1ff;
  color: #4c5bd4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
}

.pm-badge {
  margin-left: auto;
}

.pm-indicator {
  display: flex;
  gap: 0.75rem;
  padding: 0.4rem 0.75rem;
  background: #f0f4ff;
  border-top: 1px solid #e0e8ff;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 0.75rem;
}

.pm-indicator:hover {
  background: #e0e8ff;
}

.pm-stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #4c5bd4;
  font-weight: 500;
  white-space: nowrap;
}

.pm-stat i {
  font-size: 0.7rem;
}

.dapp-card-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.35;
  color: #1a1d24;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dapp-card-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dapp-card-author {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
}

.author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.author-name {
  font-size: 0.8rem;
  color: #6b7280;
}

.dapp-card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.75rem;
  margin-top: auto;
  border-top: 1px solid #f3f4f6;
}

.dapp-card-actions .btn {
  flex: 1;
  min-width: fit-content;
}
</style>

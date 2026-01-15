<template>
  <div class="account-page">
    <!-- Banner -->
    <div 
      class="account-banner" 
      :style="{ backgroundImage: profile?.banner ? `url(${profile.banner})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }"
    >
      <div class="banner-overlay"></div>
    </div>

    <div class="container mt-4">
      <!-- Profile Header -->
      <div class="profile-header">
        <div class="avatar-container">
          <img 
            :src="profile?.avatar || '/default-avatar.png'" 
            :alt="displayName"
            class="avatar"
            @error="handleAvatarError"
          />
          <div v-if="profile?.verified" class="verified-badge">
            <i class="bi bi-check-circle-fill"></i>
          </div>
        </div>
        <div class="profile-info">
          <h1 class="display-name">
            {{ displayName }}
            <span v-if="vanityAddress" class="vanity-badge">@{{ vanityAddress }}</span>
          </h1>
          <p v-if="profile?.bio" class="bio">{{ profile.bio }}</p>
          <div class="profile-meta">
            <span v-if="profile?.location" class="meta-item">
              <i class="bi bi-geo-alt"></i> {{ profile.location }}
            </span>
            <span v-if="profile?.website" class="meta-item">
              <i class="bi bi-link-45deg"></i> 
              <a :href="profile.website" target="_blank" rel="noopener">{{ profile.website }}</a>
            </span>
          </div>
        </div>
        <div v-if="isOwnProfile" class="profile-actions">
          <button 
            v-if="!vanityAddress" 
            class="btn btn-success me-2" 
            @click="showVanityModal = true"
          >
            <i class="bi bi-tag"></i> Get Vanity Address
          </button>
          <button class="btn btn-primary" @click="showEditModal = true">
            <i class="bi bi-pencil"></i> Edit Profile
          </button>
        </div>
      </div>

      <!-- Linked Accounts -->
      <div class="section">
        <h2 class="section-title">Linked Accounts</h2>
        <div class="linked-accounts">
          <div 
            v-for="zkp in linkedZKPs" 
            :key="zkp.provider"
            class="linked-account-card"
          >
            <div class="account-icon">
              <i :class="getProviderIcon(zkp.provider)"></i>
            </div>
            <div class="account-info">
              <strong>{{ getProviderName(zkp.provider) }}</strong>
              <small>Linked {{ formatDate(zkp.linkedAt) }}</small>
            </div>
            <div v-if="zkp.verified" class="verified-badge-small">
              <i class="bi bi-check-circle"></i>
            </div>
          </div>
          <div v-if="linkedZKPs.length === 0" class="empty-state">
            <p>No linked accounts</p>
          </div>
        </div>
      </div>

      <!-- dApps -->
      <div class="section">
        <h2 class="section-title">Published dApps</h2>
        <div v-if="loadingDApps" class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div v-else-if="dapps.length === 0" class="empty-state">
          <p>No dApps published yet</p>
        </div>
        <div v-else class="dapps-grid">
          <div 
            v-for="dapp in dapps" 
            :key="dapp.id"
            class="dapp-card"
            @click="navigateToDApp(dapp)"
          >
            <div class="dapp-header">
              <h3>{{ dapp.name }}</h3>
              <span class="dapp-version">v{{ dapp.version }}</span>
            </div>
            <p class="dapp-description">{{ dapp.description }}</p>
            <div class="dapp-tags">
              <span 
                v-for="tag in dapp.tags" 
                :key="tag"
                class="tag"
              >{{ tag }}</span>
            </div>
            <div class="dapp-footer">
              <small class="text-muted">
                Updated {{ formatDate(dapp.updatedAt) }}
              </small>
            </div>
          </div>
        </div>
      </div>

      <!-- Prediction Markets -->
      <div class="section">
        <h2 class="section-title">Safety Reviews</h2>
        <div v-if="loadingMarkets" class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div v-else-if="markets.length === 0" class="empty-state">
          <p>No active safety reviews</p>
        </div>
        <div v-else class="markets-list">
          <div 
            v-for="market in markets" 
            :key="market.id"
            class="market-card"
          >
            <div class="market-header">
              <span class="market-metric">{{ formatMetric(market.safetyMetric) }}</span>
              <span 
                class="market-status"
                :class="`status-${getMarketColor(market)}`"
              >
                {{ market.status }}
              </span>
            </div>
            <p class="market-description">{{ market.description }}</p>
            <div class="market-stats">
              <div class="stat">
                <strong>{{ market.totalPool }}</strong>
                <small>SUI Pool</small>
              </div>
              <div class="stat">
                <strong>{{ market.bets.length }}</strong>
                <small>Bets</small>
              </div>
              <div class="stat">
                <strong>{{ getDaysRemaining(market) }}</strong>
                <small>Days Left</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Vanity Purchase Modal -->
    <VanityPurchaseModal 
      :show="showVanityModal"
      @close="showVanityModal = false"
      @purchased="handleVanityPurchased"
    />

    <!-- Edit Profile Modal -->
    <div v-if="showEditModal" class="modal show d-block" @click.self="showEditModal = false">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Edit Profile</h5>
            <button type="button" class="btn-close" @click="showEditModal = false"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveProfile">
              <div class="mb-3">
                <label class="form-label">Display Name</label>
                <input 
                  v-model="editProfile.displayName" 
                  type="text" 
                  class="form-control"
                  placeholder="Your display name"
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Bio</label>
                <textarea 
                  v-model="editProfile.bio" 
                  class="form-control" 
                  rows="3"
                  placeholder="Tell us about yourself"
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Avatar URL</label>
                <input 
                  v-model="editProfile.avatar" 
                  type="url" 
                  class="form-control"
                  placeholder="https://..."
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Banner URL</label>
                <input 
                  v-model="editProfile.banner" 
                  type="url" 
                  class="form-control"
                  placeholder="https://..."
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Website</label>
                <input 
                  v-model="editProfile.website" 
                  type="url" 
                  class="form-control"
                  placeholder="https://..."
                />
              </div>
              <div class="mb-3">
                <label class="form-label">Location</label>
                <input 
                  v-model="editProfile.location" 
                  type="text" 
                  class="form-control"
                  placeholder="City, Country"
                />
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showEditModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" @click="saveProfile">Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import VanityPurchaseModal from '../components/VanityPurchaseModal.vue';
import axios from 'axios';
import type { UserProfile, ZKLink, SUIdApp, PredictionMarket } from '@dlux-sui/types';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const identifier = computed(() => route.params.identifier as string);
const isOwnProfile = computed(() => {
  const user = authStore.user;
  return user && (user.suiAddress === identifier.value || user.vanityAddress === identifier.value);
});

const profile = ref<UserProfile | null>(null);
const vanityAddress = ref<string | null>(null);
const suiAddress = ref<string>('');
const linkedZKPs = ref<ZKLink[]>([]);
const dapps = ref<SUIdApp[]>([]);
const markets = ref<PredictionMarket[]>([]);
const loadingDApps = ref(false);
const loadingMarkets = ref(false);
const showEditModal = ref(false);
const showVanityModal = ref(false);
const editProfile = ref<Partial<UserProfile>>({});

const displayName = computed(() => {
  return profile.value?.displayName || 
         vanityAddress.value || 
         `${suiAddress.value.substring(0, 6)}...${suiAddress.value.substring(suiAddress.value.length - 4)}`;
});

const SUI_SERVICE = import.meta.env.VITE_SUI_SERVICE_URL || 'http://localhost:3001';
const PM_SERVICE = import.meta.env.VITE_PM_SERVICE_URL || 'http://localhost:3008';

onMounted(async () => {
  await loadUserData();
  await loadDApps();
  await loadMarkets();
});

async function loadUserData() {
  try {
    // Try to get user by vanity address or SUI address
    const response = await axios.get(`${SUI_SERVICE}/vanity/${identifier.value}`);
    const userData = response.data;
    
    suiAddress.value = userData.owner || identifier.value;
    vanityAddress.value = userData.address;
    profile.value = userData.profile || {};
    
    // Load linked ZKPs
    const zkpResponse = await axios.get(`${SUI_SERVICE}/auth/profile/${suiAddress.value}`);
    linkedZKPs.value = zkpResponse.data.linkedZKPs || [];
  } catch (error) {
    console.error('Error loading user data:', error);
    // Fallback to SUI address
    suiAddress.value = identifier.value;
  }
}

async function loadDApps() {
  loadingDApps.value = true;
  try {
    const response = await axios.get(`${SUI_SERVICE}/dapps/owner/${suiAddress.value}`);
    dapps.value = response.data.dapps || [];
  } catch (error) {
    console.error('Error loading dApps:', error);
  } finally {
    loadingDApps.value = false;
  }
}

async function loadMarkets() {
  loadingMarkets.value = true;
  try {
    // Get markets for all user's dApps
    const allMarkets: PredictionMarket[] = [];
    for (const dapp of dapps.value) {
      try {
        const response = await axios.get(`${PM_SERVICE}/markets/dapp/${dapp.id}`);
        allMarkets.push(...(response.data.markets || []));
      } catch (error) {
        // Skip if error
      }
    }
    markets.value = allMarkets;
  } catch (error) {
    console.error('Error loading markets:', error);
  } finally {
    loadingMarkets.value = false;
  }
}

async function saveProfile() {
  if (!vanityAddress.value || !authStore.user) return;
  
  try {
    // TODO: Sign message with wallet
    const signature = 'placeholder-signature';
    
    await axios.put(`${SUI_SERVICE}/vanity/${vanityAddress.value}/profile`, {
      suiAddress: authStore.user.suiAddress,
      signature,
      profile: editProfile.value
    });
    
    profile.value = { ...profile.value, ...editProfile.value };
    showEditModal.value = false;
  } catch (error) {
    console.error('Error saving profile:', error);
    alert('Failed to save profile');
  }
}

function navigateToDApp(dapp: SUIdApp) {
  const permlink = dapp.permlink || dapp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Get vanity address or use first 8 chars of SUI address
  const vanity = dapp.owner.substring(0, 8); // TODO: Look up vanity address from owner
  window.location.href = `https://${vanity}.walrus.dlux.io/${permlink}`;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString();
}

function formatMetric(metric: string): string {
  return metric.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getMarketColor(market: PredictionMarket): string {
  if (market.status === 'resolved') {
    return market.resolution === 'safe' ? 'green' : 'red';
  }
  const safeOdds = market.safePool / (market.safePool + market.unsafePool);
  if (safeOdds > 0.6) return 'green';
  if (safeOdds < 0.4) return 'red';
  return 'yellow';
}

function getDaysRemaining(market: PredictionMarket): number {
  const now = new Date();
  const expires = new Date(market.expiresAt);
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getProviderIcon(provider: string): string {
  const icons: Record<string, string> = {
    github: 'bi bi-github',
    gmail: 'bi bi-envelope',
    facebook: 'bi bi-facebook'
  };
  return icons[provider] || 'bi bi-person';
}

function getProviderName(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function handleAvatarError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = '/default-avatar.png';
}

function handleVanityPurchased(vanity: string) {
  vanityAddress.value = vanity;
  // Reload user data to get updated profile
  loadUserData();
}
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.account-banner {
  height: 200px;
  width: 100%;
  background-size: cover;
  background-position: center;
  position: relative;
}

.banner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3), transparent);
}

.profile-header {
  display: flex;
  align-items: flex-start;
  gap: 2rem;
  margin-top: -80px;
  margin-bottom: 2rem;
  position: relative;
  z-index: 1;
}

.avatar-container {
  position: relative;
}

.avatar {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 4px solid white;
  background: white;
  object-fit: cover;
}

.verified-badge {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid white;
}

.profile-info {
  flex: 1;
}

.display-name {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.vanity-badge {
  font-size: 1.2rem;
  color: #667eea;
  font-weight: normal;
}

.bio {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 1rem;
}

.profile-meta {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.meta-item {
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
}

.linked-accounts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.linked-account-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #f9f9f9;
}

.account-icon {
  font-size: 2rem;
  color: #667eea;
}

.verified-badge-small {
  color: #28a745;
  margin-left: auto;
}

.dapps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.dapp-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.dapp-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.dapp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.dapp-version {
  font-size: 0.8rem;
  color: #666;
  background: #f0f0f0;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.dapp-description {
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.dapp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tag {
  background: #667eea;
  color: white;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
}

.markets-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.market-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  background: #f9f9f9;
}

.market-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.market-metric {
  font-weight: bold;
  color: #667eea;
}

.market-status {
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

.status-green {
  background: #d4edda;
  color: #155724;
}

.status-yellow {
  background: #fff3cd;
  color: #856404;
}

.status-red {
  background: #f8d7da;
  color: #721c24;
}

.market-stats {
  display: flex;
  gap: 2rem;
  margin-top: 1rem;
}

.stat {
  text-align: center;
}

.stat strong {
  display: block;
  font-size: 1.2rem;
  color: #667eea;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #999;
}

.modal.show {
  background: rgba(0,0,0,0.5);
}
</style>

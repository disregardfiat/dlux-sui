<template>
  <div class="home-view">
    <!-- Hero Section - Privacy Story -->
    <section class="hero-section">
      <div class="hero-background">
        <div class="hero-pattern"></div>
        <div class="hero-glow"></div>
      </div>
      <div class="container position-relative">
        <div class="row align-items-center min-vh-60">
          <div class="col-lg-7">
            <div class="hero-badge">
              <i class="bi bi-shield-check"></i>
              Privacy-First Advertising
            </div>
            <h1 class="hero-title">
              Your Attention.<br>
              <span class="text-gradient">Your Rules.</span>
            </h1>
            <p class="hero-subtitle">
              Traditional ads track you everywhere. DLUX ads verify views 
              <strong>without ever knowing who you are</strong>. Zero-knowledge cryptography 
              ensures advertisers pay for real engagement—but your identity stays private.
            </p>
            <div class="hero-actions">
              <router-link to="/dapps" class="btn btn-primary-hero me-3">
                <i class="bi bi-grid"></i>
                Explore the Hub
              </router-link>
              <a class="btn btn-outline-hero" href="https://suins.io" target="_blank" rel="noopener">
                <i class="bi bi-person-badge"></i>
                Get SuiNS Name
              </a>
            </div>
          </div>
          <div class="col-lg-5 d-none d-lg-block">
            <div class="hero-visual">
              <!-- Privacy Shield Animation -->
              <div class="privacy-shield">
                <div class="shield-ring ring-1"></div>
                <div class="shield-ring ring-2"></div>
                <div class="shield-ring ring-3"></div>
                <div class="shield-core">
                  <i class="bi bi-person-lock"></i>
                </div>
              </div>
              <div class="floating-cards">
                <div class="float-card card-1">
                  <i class="bi bi-eye-slash"></i>
                  <span>No Tracking</span>
                </div>
                <div class="float-card card-2">
                  <i class="bi bi-graph-up-arrow"></i>
                  <span>Verified Views</span>
                </div>
                <div class="float-card card-3">
                  <i class="bi bi-currency-bitcoin"></i>
                  <span>Get Paid</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- The Problem Section -->
    <section class="problem-section">
      <div class="container">
        <div class="section-header text-center mb-5">
          <h2 class="section-title">The Traditional Ad Problem</h2>
          <p class="section-subtitle">How your data is exploited</p>
        </div>
        <div class="row g-4">
          <div class="col-md-4">
            <div class="problem-card">
              <div class="problem-icon bg-danger-subtle">
                <i class="bi bi-cursor text-danger"></i>
              </div>
              <h4>Cross-Site Tracking</h4>
              <p class="text-muted mb-0">
                Advertisers follow you across websites, building a detailed profile of your behavior, interests, and habits.
              </p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="problem-card">
              <div class="problem-icon bg-warning-subtle">
                <i class="bi bi-fingerprint text-warning"></i>
              </div>
              <h4>Device Fingerprinting</h4>
              <p class="text-muted mb-0">
                Your device's unique signature is used to identify you even without cookies—across Incognito mode.
              </p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="problem-card">
              <div class="problem-icon bg-secondary-subtle">
                <i class="bi bi-incognito text-secondary"></i>
              </div>
              <h4>Data Brokers</h4>
              <p class="text-muted mb-0">
                Your profile is sold to dozens of companies you've never heard of—with no way to opt out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- The Solution Section -->
    <section class="solution-section">
      <div class="container">
        <div class="solution-badge mx-auto mb-4">
          <i class="bi bi-lightning-charge"></i>
          The DLUX Difference
        </div>
        <h2 class="solution-title text-center mb-5">
          Ads that verify without<br>
          <span class="text-gradient">violating your privacy</span>
        </h2>
        
        <div class="solution-grid">
          <!-- ZK Proof -->
          <div class="solution-card">
            <div class="solution-visual zk-visual">
              <div class="zk-icon">
                <i class="bi bi-shield-lock"></i>
              </div>
            </div>
            <h4>Zero-Knowledge Proofs</h4>
            <p>
              When you view an ad, a cryptographic proof is generated that verifies 
              <strong>"someone viewed this ad"</strong>—without revealing 
              <strong>"who"</strong>. The math guarantees truth without exposure.
            </p>
            <ul class="solution-features">
              <li><i class="bi bi-check-circle-fill"></i> Viewer identity stays hidden</li>
              <li><i class="bi bi-check-circle-fill"></i> Cryptographically verifiable</li>
              <li><i class="bi bi-check-circle-fill"></i> No personal data collected</li>
            </ul>
          </div>

          <!-- Homomorphic Encryption -->
          <div class="solution-card">
            <div class="solution-visual homomorphic-visual">
              <div class="homo-icon">
                <i class="bi bi-safe2"></i>
              </div>
            </div>
            <h4>Homomorphic Encryption</h4>
            <p>
              Analytics are computed on <strong>encrypted data</strong>. Advertisers 
              get aggregate metrics (total views, clicks) but can never see 
              individual user activity.
            </p>
            <ul class="solution-features">
              <li><i class="bi bi-check-circle-fill"></i> GDPR-friendly by design</li>
              <li><i class="bi bi-check-circle-fill"></i> No raw data stored</li>
              <li><i class="bi bi-check-circle-fill"></i> Accurate totals, no exposure</li>
            </ul>
          </div>

          <!-- User Control -->
          <div class="solution-card">
            <div class="solution-visual control-visual">
              <div class="control-icon">
                <i class="bi bi-sliders"></i>
              </div>
            </div>
            <h4>You Control Everything</h4>
            <p>
              Your privacy settings aren't a buried checkbox—they're central. 
              Choose what data you share, opt out of tracking, or go 
              <strong>completely ad-free</strong> with a subscription.
            </p>
            <ul class="solution-features">
              <li><i class="bi bi-check-circle-fill"></i> Granular privacy controls</li>
              <li><i class="bi bi-check-circle-fill"></i> Subscription for ad-free</li>
              <li><i class="bi bi-check-circle-fill"></i> Transparent data usage</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Revenue Sharing Section -->
    <section class="revenue-section">
      <div class="container">
        <div class="row align-items-center">
          <div class="col-lg-6">
            <div class="revenue-visual">
              <!-- PM Phase Toggle -->
              <div class="pm-phase-toggle mb-4">
                <button 
                  class="toggle-btn" 
                  :class="{ active: pmPhase === 'after' }"
                  @click="pmPhase = 'after'"
                >
                  After PM Success
                </button>
                <button 
                  class="toggle-btn" 
                  :class="{ active: pmPhase === 'during' }"
                  @click="pmPhase = 'during'"
                >
                  During PM
                </button>
              </div>
              <div 
                class="pie-chart"
                :style="pieChartStyle"
              ></div>
              <div class="pie-legend">
                <div class="legend-item">
                  <span class="legend-color creator"></span>
                  <span>{{ revenueSplits.creator }}% Creator</span>
                </div>
                <div class="legend-item">
                  <span class="legend-color foundation"></span>
                  <span>{{ revenueSplits.foundation }}% Foundation</span>
                </div>
                <div class="legend-item">
                  <span class="legend-color gateway"></span>
                  <span>{{ revenueSplits.gateway }}% Gateway / Walrus</span>
                </div>
                <div class="legend-item">
                  <span class="legend-color pm"></span>
                  <span>{{ revenueSplits.pmPool }}% PM Pool</span>
                </div>
              </div>
              <!-- Phase description -->
              <p class="phase-description mt-3 text-center">
                <span v-if="pmPhase === 'after'">
                  After the prediction market resolves successfully, creators receive their full revenue share.
                </span>
                <span v-else>
                  During PM, creator revenue is held in escrow until the market resolves.
                </span>
              </p>
            </div>
          </div>
          <div class="col-lg-6">
            <h2 class="revenue-title">Fair Revenue for Creators</h2>
            <p class="revenue-subtitle">
              Unlike platforms that keep the majority, DLUX splits ad revenue 
              <strong>{{ afterPmSplits.creator }}% to creators</strong>. Your content, your fair share.
            </p>
            <div class="revenue-features">
              <div class="revenue-feature">
                <div class="feature-icon">
                  <i class="bi bi-bank"></i>
                </div>
                <div>
                  <h5>Prediction Market Pool</h5>
                  <p class="mb-0 text-muted">{{ duringPmSplits.pmPool }}% held in escrow during PM—released to creator after market succeeds, funds community moderation.</p>
                </div>
              </div>
              <div class="revenue-feature">
                <div class="feature-icon">
                  <i class="bi bi-wallet2"></i>
                </div>
                <div>
                  <h5>Direct Payouts</h5>
                  <p class="mb-0 text-muted">Verified impressions and clicks flow to your wallet—no middleman delays.</p>
                </div>
              </div>
              <div class="revenue-feature">
                <div class="feature-icon">
                  <i class="bi bi-gift"></i>
                </div>
                <div>
                  <h5>Subscribe to Go Ad-Free</h5>
                  <p class="mb-0 text-muted">Skip ads entirely while still supporting creators—subscription revenue shares with them.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="how-it-works">
      <div class="container">
        <div class="section-header text-center mb-5">
          <h2 class="section-title">How DLUX Privacy Works</h2>
          <p class="section-subtitle">Simple for you, cryptographic under the hood</p>
        </div>
        
        <div class="steps-container">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Ad Displays</h4>
              <p>You see an ad attached to content or your approximate location—not to your device fingerprint or account.</p>
            </div>
          </div>
          <div class="step-connector"></div>
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>ZK Proof Generated</h4>
              <p>Your device creates a zero-knowledge proof: "Someone viewed this" without identifying you.</p>
            </div>
          </div>
          <div class="step-connector"></div>
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Proof Verified</h4>
              <p>The proof is verified cryptographically. Real view confirmed—your identity remains secret.</p>
            </div>
          </div>
          <div class="step-connector"></div>
          <div class="step">
            <div class="step-number">4</div>
            <div class="step-content">
              <h4>Revenue Distributed</h4>
              <p>Advertiser pays, creator gets {{ afterPmSplits.creator }}%, you got content without being tracked. Everyone wins.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-content text-center">
          <h2>Ready for Privacy-First Advertising?</h2>
          <p>Explore dApps that respect you, or post your own and earn fair revenue.</p>
          <div class="cta-actions">
            <router-link to="/dapps" class="btn btn-primary-cta me-3">
              <i class="bi bi-grid"></i> Browse dApps
            </router-link>
            <router-link to="/post" class="btn btn-outline-cta">
              <i class="bi bi-plus-circle"></i> Post Your dApp
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- Trending dApps -->
    <section class="featured-dapps">
      <div class="container">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2 class="mb-0">Trending dApps</h2>
          <router-link to="/dapps" class="btn btn-sm btn-outline-primary">
            View all
          </router-link>
        </div>
        
        <div v-if="dappsLoading" class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading dApps...</span>
          </div>
        </div>
        
        <div v-else-if="featuredDApps.length === 0" class="text-center py-4 text-muted">
          <p>No dApps available yet. Be the first to post one!</p>
        </div>
        
        <div v-else class="row">
          <div v-for="dapp in featuredDApps" :key="dapp.id" class="col-md-4 mb-4">
            <DAppCard
              :dapp-id="dapp.id"
              :title="dapp.manifest?.metadata?.title || dapp.name || 'Untitled'"
              :description="dapp.manifest?.metadata?.description || dapp.description || '—'"
              :owner="dapp.owner || ''"
              :owner-suins-name="(dapp as any).ownerSuinsName || ''"
              :owner-avatar-url="(dapp as any).ownerAvatar || ''"
              :permlink="(dapp as any).permlink"
              :subdomain="(dapp as any).subdomain"
              :manifest="dapp.manifest"
              :pm-status="dapp.pmStatus"
            />
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import type { DApp } from '@dlux-sui/types'
import { BRAND_NAME, getSuiServiceUrl } from '@/config/links'
import { useDApps, type DAppWithPMStatus } from '@/composables/useDApps'
import { useTheme } from '@/composables/useTheme'
import { useGovernanceConfig } from '@/composables/useGovernanceConfig'
import DAppCard from '@/components/DAppCard.vue'

const brandName = BRAND_NAME
const dappsComposable = useDApps()
const { resolvedTheme } = useTheme()
const { config: govConfig, loading: govLoading, fetchConfig } = useGovernanceConfig()

const isDark = computed(() => resolvedTheme.value === 'dark')

// dApps state
const featuredDApps = ref<DAppWithPMStatus[]>([])
const dappsLoading = ref(false)

// PM phase toggle: 'during' or 'after'
const pmPhase = ref<'during' | 'after'>('after')

/**
 * Revenue splits during PM:
 * - Creator % held in escrow
 * - Foundation % for protocol
 * - Gateway % for Walrus/storage
 * - PM Pool % held for community moderation (released to creator if PM succeeds)
 * 
 * Default fallback values (if API unavailable): Total must equal 100
 */
const duringPmSplits = computed(() => {
  // Default fallback values (must sum to 100)
  const fallback = {
    creator: 41,
    foundation: 10,
    gateway: 9,
    pmPool: 40,
    reserve: 0
  }
  
  if (!govConfig.value) {
    return fallback
  }
  
  const foundation = govConfig.value.pm_foundation_pct ?? 0
  const gateway = govConfig.value.pm_gateway_pct ?? 0
  const creator = govConfig.value.pm_creator_pct ?? 0
  const pmPool = govConfig.value.pm_pool_pct ?? 0
  const total = foundation + gateway + creator + pmPool
  
  // If values don't sum to 100, calculate reserve to make up the difference
  const reserve = Math.max(0, 100 - total)
  
  return { creator, foundation, gateway, pmPool, reserve }
})

/**
 * Revenue splits after PM success:
 * - Creator % receives full share (escrow released + ongoing)
 * - Foundation % for protocol
 * - Gateway % for Walrus/storage
 * - PM Pool % goes to 0 (pool funds released to creator)
 * 
 * Default fallback values (if API unavailable): Total must equal 100
 */
const afterPmSplits = computed(() => {
  // Default fallback values (must sum to 100)
  const fallback = {
    creator: 81,
    foundation: 10,
    gateway: 9,
    pmPool: 0,
    reserve: 0
  }
  
  if (!govConfig.value) {
    return fallback
  }
  
  const foundation = govConfig.value.post_foundation_pct ?? 0
  const gateway = govConfig.value.post_gateway_pct ?? 0
  const creator = govConfig.value.post_creator_pct ?? 0
  const pmPool = govConfig.value.post_pm_pct ?? 0
  const total = foundation + gateway + creator + pmPool
  
  // If values don't sum to 100, calculate reserve to make up the difference
  const reserve = Math.max(0, 100 - total)
  
  return { creator, foundation, gateway, pmPool, reserve }
})

// Current revenue splits based on selected phase
const revenueSplits = computed(() => {
  return pmPhase.value === 'during' ? duringPmSplits.value : afterPmSplits.value
})

// Dynamic pie chart gradient based on governance config and selected phase
const pieChartStyle = computed(() => {
  const { creator, foundation, gateway, pmPool } = revenueSplits.value
  
  // Convert percentages to degrees (percentage * 3.6 = degrees)
  const creatorEnd = creator * 3.6
  const foundationEnd = creatorEnd + (foundation * 3.6)
  const gatewayEnd = foundationEnd + (gateway * 3.6)
  const pmPoolEnd = gatewayEnd + (pmPool * 3.6)
  
  return {
    background: `conic-gradient(
      #28a745 0deg ${creatorEnd}deg,
      #667eea ${creatorEnd}deg ${foundationEnd}deg,
      #9b59b6 ${foundationEnd}deg ${gatewayEnd}deg,
      #ffc107 ${gatewayEnd}deg ${pmPoolEnd}deg
    )`
  }
})

onMounted(() => {
  loadFeaturedDApps()
  // Fetch governance config for dynamic revenue splits
  fetchConfig(true)
})

async function loadFeaturedDApps() {
  dappsLoading.value = true
  try {
    const trending = await dappsComposable.getTrendingDApps(9)
    
    if (trending.length > 0) {
      featuredDApps.value = trending
    } else {
      try {
        const response = await axios.get(`${getSuiServiceUrl()}/dapps`, {
          params: { limit: 9 }
        })
        const dapps = response.data.dapps || []
        if (dapps.length > 0) {
          featuredDApps.value = dapps.map((d: any) => ({
            ...d,
            pmStatus: {
              overallStatus: 'unknown' as const,
              overallColor: 'gray' as const,
              hasActiveMarkets: false,
              hasResolvedMarkets: false,
              lessTested: true
            }
          }))
        } else {
          featuredDApps.value = []
        }
      } catch (fallbackError) {
        console.error('Failed to load any dApps:', fallbackError)
        featuredDApps.value = []
      }
    }
  } catch (error) {
    console.error('Failed to load featured dApps:', error)
    try {
      const response = await axios.get(`${getSuiServiceUrl()}/dapps`, {
        params: { limit: 9 }
      })
      const dapps = response.data.dapps || []
      featuredDApps.value = dapps.map((d: any) => ({
        ...d,
        pmStatus: {
          overallStatus: 'unknown' as const,
          overallColor: 'gray' as const,
          hasActiveMarkets: false,
          hasResolvedMarkets: false,
          lessTested: true
        }
      }))
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
      featuredDApps.value = []
    }
  } finally {
    dappsLoading.value = false
  }
}
</script>

<style scoped>
/* Hero Section */
.hero-section {
  position: relative;
  padding: 4rem 0;
  overflow: hidden;
  min-height: 60vh;
  display: flex;
  align-items: center;
}

.hero-background {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(118, 75, 162, 0.08) 0%, transparent 50%);
}

.hero-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, transparent 70%);
  pointer-events: none;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 2rem;
  color: var(--primary);
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.text-gradient {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  max-width: 540px;
}

.hero-subtitle strong {
  color: var(--primary);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn-primary-hero {
  background: var(--accent-gradient);
  color: white;
  font-weight: 600;
  padding: 0.875rem 1.75rem;
  border-radius: 0.5rem;
  border: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-primary-hero:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
  color: white;
}

.btn-outline-hero {
  background: transparent;
  color: var(--primary);
  font-weight: 600;
  padding: 0.875rem 1.75rem;
  border-radius: 0.5rem;
  border: 2px solid var(--primary);
  transition: all 0.3s ease;
}

.btn-outline-hero:hover {
  background: rgba(102, 126, 234, 0.1);
  color: var(--primary);
}

/* Hero Visual */
.hero-visual {
  position: relative;
  height: 400px;
}

.privacy-shield {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
}

.shield-ring {
  position: absolute;
  border: 2px solid rgba(102, 126, 234, 0.3);
  border-radius: 50%;
  animation: pulse-ring 3s ease-out infinite;
}

.ring-1 { inset: 0; animation-delay: 0s; }
.ring-2 { inset: 20px; animation-delay: 1s; }
.ring-3 { inset: 40px; animation-delay: 2s; }

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

.shield-core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  box-shadow: 0 0 30px rgba(102, 126, 234, 0.5);
}

.floating-cards {
  position: absolute;
  inset: 0;
}

.float-card {
  position: absolute;
  background: var(--bg-card);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
  animation: float 4s ease-in-out infinite;
}

.float-card i {
  font-size: 1.25rem;
  color: var(--primary);
}

.float-card:nth-child(1) { top: 10%; left: 0; animation-delay: 0s; }
.float-card:nth-child(2) { top: 45%; right: 0; animation-delay: 1.5s; }
.float-card:nth-child(3) { bottom: 15%; left: 10%; animation-delay: 3s; }

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Problem Section */
.problem-section {
  padding: 5rem 0;
  background: var(--bg-secondary);
}

.section-header {
  max-width: 600px;
  margin: 0 auto;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.section-subtitle {
  color: var(--text-secondary);
  font-size: 1.125rem;
}

.problem-card {
  background: var(--bg-card);
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-primary);
  transition: transform 0.3s ease;
  height: 100%;
}

.problem-card:hover {
  transform: translateY(-5px);
}

.problem-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  font-size: 1.5rem;
}

.problem-card h4 {
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--text-primary);
}

/* Solution Section */
.solution-section {
  padding: 6rem 0;
  background: var(--bg-primary);
}

.solution-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 2rem;
  color: var(--primary);
  font-weight: 600;
}

.solution-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.solution-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.solution-card {
  background: var(--bg-card);
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border-primary);
  transition: all 0.3s ease;
}

.solution-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-hover);
  border-color: rgba(102, 126, 234, 0.2);
}

.solution-visual {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  position: relative;
}

/* ZK Proof - static icon with pulsing ring */
.zk-visual .zk-icon {
  width: 80px;
  height: 80px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  position: relative;
  z-index: 1;
}

.zk-visual::after {
  content: '';
  position: absolute;
  width: 100px;
  height: 100px;
  border: 2px solid rgba(102, 126, 234, 0.4);
  border-radius: 50%;
  animation: pulse-ring 2s ease-out infinite;
}

/* Homomorphic Encryption - static icon with pulsing ring */
.homomorphic-visual .homo-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  position: relative;
  z-index: 1;
}

.homomorphic-visual::after {
  content: '';
  position: absolute;
  width: 100px;
  height: 100px;
  border: 2px solid rgba(40, 167, 69, 0.4);
  border-radius: 50%;
  animation: pulse-ring 2s ease-out infinite;
  animation-delay: 0.5s;
}

/* User Control - static icon with pulsing ring */
.control-visual .control-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #fd7e14 0%, #ffc107 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
  position: relative;
  z-index: 1;
}

.control-visual::after {
  content: '';
  position: absolute;
  width: 100px;
  height: 100px;
  border: 2px solid rgba(253, 126, 20, 0.4);
  border-radius: 50%;
  animation: pulse-ring 2s ease-out infinite;
  animation-delay: 1s;
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}

.solution-card h4 {
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.solution-card p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.solution-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.solution-features li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  color: var(--text-primary);
}

.solution-features li i {
  color: #28a745;
}

/* Revenue Section - Uses gradient so stays same */
.revenue-section {
  padding: 6rem 0;
  background: var(--accent-gradient);
  color: white;
}

.revenue-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.revenue-subtitle {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: 2rem;
}

.revenue-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.pie-chart {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  position: relative;
}

.pie-chart::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: var(--accent-gradient);
  border-radius: 50%;
}

.pie-legend {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.creator { background: #28a745; }
.legend-color.foundation { background: #667eea; }
.legend-color.gateway { background: #9b59b6; }
.legend-color.pm { background: #ffc107; }

/* PM Phase Toggle */
.pm-phase-toggle {
  display: flex;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.toggle-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
  font-size: 0.875rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  color: white;
}

.toggle-btn.active {
  background: white;
  color: var(--primary);
}

.phase-description {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.85);
  max-width: 280px;
  min-height: 4.5em;
  display: flex;
  align-items: center;
  justify-content: center;
}

.revenue-features {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.revenue-feature {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.revenue-feature .feature-icon {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.revenue-feature h5 {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.revenue-feature p {
  opacity: 0.85;
  font-size: 0.9rem;
}

/* How It Works */
.how-it-works {
  padding: 6rem 0;
  background: var(--bg-secondary);
}

.steps-container {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  flex-wrap: wrap;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 200px;
}

.step-number {
  width: 48px;
  height: 48px;
  background: var(--accent-gradient);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.step-content h4 {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.step-content p {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.step-connector {
  width: 60px;
  height: 2px;
  background: var(--accent-gradient);
  margin: 24px 1rem 0;
  flex-shrink: 0;
}

/* CTA Section */
.cta-section {
  padding: 6rem 0;
  background: var(--accent-gradient);
  color: white;
}

.cta-content h2 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.cta-content p {
  font-size: 1.25rem;
  opacity: 0.9;
  margin-bottom: 2rem;
}

.cta-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-primary-cta {
  background: white;
  color: var(--primary);
  font-weight: 600;
  padding: 0.875rem 2rem;
  border-radius: 0.5rem;
  border: none;
  transition: all 0.3s ease;
}

.btn-primary-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  color: var(--primary);
}

.btn-outline-cta {
  background: transparent;
  color: white;
  font-weight: 600;
  padding: 0.875rem 2rem;
  border-radius: 0.5rem;
  border: 2px solid white;
  transition: all 0.3s ease;
}

.btn-outline-cta:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Featured dApps */
.featured-dapps {
  padding: 5rem 0;
  background: var(--bg-primary);
}

.featured-dapps h2 {
  font-weight: 700;
  color: var(--text-primary);
}

/* Responsive */
@media (max-width: 991px) {
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-visual {
    display: none;
  }
  
  .solution-grid {
    grid-template-columns: 1fr;
  }
  
  .revenue-section .row {
    flex-direction: column-reverse;
  }
  
  .revenue-visual {
    margin-bottom: 2rem;
  }
  
  .steps-container {
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  
  .step-connector {
    width: 2px;
    height: 40px;
    background: var(--accent-gradient);
    margin: 0;
  }
}

@media (max-width: 575px) {
  .hero-title {
    font-size: 2rem;
  }
  
  .section-title {
    font-size: 1.75rem;
  }
  
  .solution-title {
    font-size: 1.75rem;
  }
  
  .cta-content h2 {
    font-size: 1.75rem;
  }
}
</style>

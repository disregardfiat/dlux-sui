<template>
  <div
    v-if="visible"
    class="ad-overlay ad-gate"
    data-ad-overlay
    data-ad-gate
    data-testid="ad-gate"
    role="dialog"
    aria-label="Ad-supported content"
  >
    <div class="ad-overlay-backdrop"></div>
    <div class="ad-overlay-content">
      <!-- Fetched ad creative -->
      <div v-if="activeAd" class="ad-creative-section">
        <small class="ad-label">
          <i class="bi bi-megaphone me-1"></i>Sponsored
        </small>
        <div class="ad-creative" @click="handleAdClick">
          <img
            v-if="activeAd.imageUrl"
            :src="activeAd.imageUrl"
            :alt="activeAd.title || 'Advertisement'"
            class="ad-image"
          />
          <div class="ad-text">
            <h5 v-if="activeAd.title" class="ad-title">{{ activeAd.title }}</h5>
            <p v-if="activeAd.description" class="ad-description">{{ activeAd.description }}</p>
            <a
              v-if="activeAd.targetUrl"
              :href="activeAd.targetUrl"
              target="_blank"
              rel="noopener sponsored"
              class="btn btn-sm btn-outline-primary"
              @click.stop="handleAdClick"
            >
              Learn more <i class="bi bi-box-arrow-up-right ms-1"></i>
            </a>
          </div>
        </div>
      </div>

      <!-- Fallback message when no ad is fetched -->
      <div v-else>
        <p class="ad-overlay-message">
          <i class="bi bi-megaphone me-2"></i>
          Ad-supported content. Subscribers can skip.
        </p>
      </div>

      <p v-if="countdown > 0" class="ad-overlay-countdown">
        Continue in {{ countdown }}s
      </p>
      <div class="ad-overlay-actions">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="countdown > 0"
          @click="handleContinue"
        >
          Continue
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary ms-2"
          aria-label="Skip ad"
          @click="handleSkip"
        >
          Skip
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { getDgraphServiceUrl } from '@/config/links';

type ActiveAd = {
  id: string;
  campaignId: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  targetUrl?: string;
};

const props = withDefaults(
  defineProps<{
    /** Show overlay for this many seconds before allowing continue (0 = allow immediately) */
    countdownSeconds?: number;
    /** Start visible (caller can set to false to hide when e.g. user is subscriber) */
    show?: boolean;
    /** dApp ID for ad targeting */
    dappId?: string;
    /** Ad placement (e.g. 'detail', 'sandbox') */
    placement?: string;
  }>(),
  { countdownSeconds: 5, show: true, dappId: '', placement: 'detail' }
);

const emit = defineEmits<{
  (e: 'skip'): void;
}>();

const DGRAPH_SERVICE = getDgraphServiceUrl();
const visible = ref(props.show);
const countdown = ref(props.countdownSeconds);
const activeAd = ref<ActiveAd | null>(null);

let timer: ReturnType<typeof setInterval> | null = null;

function handleContinue() {
  if (countdown.value > 0) return;
  dismiss();
}

function handleSkip() {
  dismiss();
}

function dismiss() {
  visible.value = false;
  stopTimer();
  emit('skip');
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function startCountdown() {
  if (props.countdownSeconds <= 0) {
    countdown.value = 0;
    return;
  }
  countdown.value = props.countdownSeconds;
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      stopTimer();
    }
  }, 1000);
}

async function fetchAd() {
  try {
    const res = await axios.get(`${DGRAPH_SERVICE}/ads/active`, {
      params: {
        placement: props.placement,
        dappId: props.dappId || undefined
      }
    });
    if (res.data?.ad) {
      activeAd.value = res.data.ad;
      trackImpression();
    }
  } catch {
    // No ad available — show placeholder message
    activeAd.value = null;
  }
}

async function trackImpression() {
  if (!activeAd.value) return;
  try {
    await axios.post(`${DGRAPH_SERVICE}/impressions`, {
      campaignId: activeAd.value.campaignId,
      adId: activeAd.value.id,
      placement: props.placement,
      dappId: props.dappId || undefined,
      timestamp: new Date().toISOString()
    });
  } catch {
    // Impression tracking is best-effort
  }
}

async function handleAdClick() {
  if (!activeAd.value) return;
  try {
    await axios.post(`${DGRAPH_SERVICE}/ads/clicks`, {
      campaignId: activeAd.value.campaignId,
      adId: activeAd.value.id,
      placement: props.placement,
      dappId: props.dappId || undefined,
      timestamp: new Date().toISOString()
    });
  } catch {
    // Click tracking is best-effort
  }
}

onMounted(() => {
  startCountdown();
  fetchAd();
});

onUnmounted(() => stopTimer());

watch(
  () => props.show,
  (newVal) => {
    visible.value = newVal;
    if (newVal) {
      startCountdown();
      fetchAd();
    }
  }
);
</script>

<style scoped>
.ad-overlay {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ad-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
}

.ad-overlay-content {
  position: relative;
  background: var(--bs-body-bg, #fff);
  color: var(--bs-body-color, #212529);
  padding: 1.5rem 2rem;
  border-radius: 12px;
  text-align: center;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.ad-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}

.ad-creative {
  cursor: pointer;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s;
}

.ad-creative:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ad-image {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
}

.ad-text {
  padding: 0.75rem;
  text-align: left;
}

.ad-title {
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.ad-description {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.ad-overlay-message {
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.ad-overlay-countdown {
  margin-bottom: 1rem;
  font-weight: 600;
  color: var(--bs-primary);
}

.ad-overlay-actions .btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>

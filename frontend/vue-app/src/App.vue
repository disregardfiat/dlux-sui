<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg" :class="effectiveTheme === 'dark' ? 'navbar-dark bg-dark' : 'navbar-light bg-light'">
      <div class="container">
        <router-link class="navbar-brand d-flex align-items-center gap-2" to="/">
          <img
            v-if="brandLogo"
            :src="brandLogo"
            :alt="brandName"
            class="brand-logo"
          />
          <i v-else class="bi bi-diamond"></i>
          <span>{{ brandName }}</span>
        </router-link>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div id="navbarNav" class="collapse navbar-collapse">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <router-link class="nav-link" to="/dapps">Hub</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/feed">Feed</router-link>
            </li>
            <li v-if="isAuthenticated" class="nav-item">
              <router-link class="nav-link" to="/post">
                <i class="bi bi-plus-circle"></i> Post dApp
              </router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/governance">
                <i class="bi bi-bank"></i> Governance
              </router-link>
            </li>
          </ul>

          <ul class="navbar-nav">
            <li class="nav-item" :class="effectiveTheme === 'dark' ? 'text-light' : 'text-dark'">
              <ThemeToggle :theme-class="effectiveTheme" />
            </li>
            <li v-if="!isAuthenticated" class="nav-item">
              <button 
                class="btn btn-connect-wallet"
                @click="showLoginModal = true"
              >
                <i class="bi bi-wallet2"></i>
                Connect Wallet
              </button>
            </li>
            <li v-else class="nav-item dropdown">
              <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                <i class="bi bi-person-circle"></i>
                {{ walletLabel }}
              </a>
              <ul class="dropdown-menu">
                <li>
                  <router-link 
                    class="dropdown-item" 
                    :to="`/@${user?.suinsName || user?.suiAddress}`"
                  >
                    My Account
                  </router-link>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item" @click="logout">Logout</button></li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <main class="container mt-4">
      <router-view />
    </main>

    <WalletLoginModal
      :show="showLoginModal"
      @close="showLoginModal = false"
    />

    <footer class="bg-light mt-5 py-4">
      <div class="container">
        <div class="row">
          <div class="col-md-6 text-center text-md-start">
            <p class="mb-0 text-muted">
              {{ brandName }} - {{ brandTagline }}
            </p>
          </div>
          <div class="col-md-6 text-center text-md-end mt-3 mt-md-0">
            <router-link to="/terms" class="text-muted text-decoration-none me-3">Terms & Disclaimer</router-link>
            <router-link to="/privacy" class="text-muted text-decoration-none">Privacy Policy</router-link>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme, initTheme } from '@/composables/useTheme'
import WalletLoginModal from '@/components/WalletLoginModal.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { BRAND_LOGO_URL, BRAND_LOGO_MARK_URL, BRAND_LONG_NAME, BRAND_NAME, BRAND_TAGLINE, getSuiServiceUrl } from '@/config/links'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const showLoginModal = ref(false)

// Initialize theme
const { theme, resolvedTheme } = useTheme()

// Helper to get the actual theme (resolves 'system' to actual dark/light)
const effectiveTheme = computed(() => {
  if (theme.value === 'system') {
    return resolvedTheme.value
  }
  return theme.value
})

const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)
const walletName = computed(() => authStore.walletName)

const walletLabel = computed(() => {
  const suins = user.value?.suinsName?.replace(/\.sui$/, '');
  const identity = suins || (user.value?.suiAddress ? user.value.suiAddress.substring(0, 6) + '...' : '...');
  return walletName.value ? `${walletName.value} • ${identity}` : identity
})

const brandName = BRAND_NAME
const brandLongName = BRAND_LONG_NAME
const brandTagline = BRAND_TAGLINE
const brandLogo = BRAND_LOGO_URL || BRAND_LOGO_MARK_URL

// Function to backfill SuiNS name
function backfillSuinsName() {
  const u = authStore.user
  if (u?.suiAddress && !u?.suinsName) {
    fetch(`${getSuiServiceUrl()}/suins/reverse/${encodeURIComponent(u.suiAddress)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { name?: string } | null) => {
        if (data?.name) authStore.setSuinsName(data.name)
      })
      .catch(() => { /* non-fatal */ })
  }
}

onMounted(() => {
  // Initialize theme system once on app mount
  initTheme()
  
  authStore.initializeAuth()
  backfillSuinsName()
  if (brandLongName) {
    document.title = brandLongName
  }
})

// Watch for user changes to backfill SuiNS name when user logs in
watch(() => authStore.user, (newUser) => {
  if (newUser) {
    backfillSuinsName()
  }
}, { immediate: true })

watch(() => route.query.login, (login) => {
  if (login === '1') {
    showLoginModal.value = true
    const { login: _, ...rest } = route.query
    router.replace({ path: route.path, query: rest })
  }
})

watch(() => authStore.requestLoginModal, (requested) => {
  if (requested) {
    showLoginModal.value = true
    authStore.clearLoginModalRequest()
  }
})

const logout = () => {
  authStore.logout()
}
</script>

<style scoped>
.navbar-brand {
  font-weight: bold;
}

.nav-link {
  font-weight: 500;
}

.brand-logo {
  height: 28px;
  width: auto;
  display: inline-block;
}

/* Animated Connect Wallet Button */
.btn-connect-wallet {
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  border: none;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  animation: glow-pulse 2s ease-in-out infinite;
}

.btn-connect-wallet:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
  background: linear-gradient(135deg, #7c8ff0 0%, #8b5fc0 100%);
}

.btn-connect-wallet:active {
  transform: translateY(0);
}

.btn-connect-wallet i {
  margin-right: 0.4rem;
}

/* Animated glow effect */
@keyframes glow-pulse {
  0%, 100% {
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }
  50% {
    box-shadow: 0 4px 25px rgba(102, 126, 234, 0.7), 0 0 15px rgba(118, 75, 162, 0.3);
  }
}

/* Shimmer overlay effect */
.btn-connect-wallet::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Dark mode specific - slightly brighter for better contrast */
[data-theme="dark"] .btn-connect-wallet {
  background: linear-gradient(135deg, #7c8ff0 0%, #9b6fd0 100%);
  box-shadow: 0 4px 20px rgba(124, 143, 240, 0.5);
}

[data-theme="dark"] .btn-connect-wallet:hover {
  box-shadow: 0 6px 30px rgba(124, 143, 240, 0.7);
}
</style>

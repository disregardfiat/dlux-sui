<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
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
              <router-link class="nav-link" to="/">Home</router-link>
            </li>
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
            <li v-if="!isAuthenticated" class="nav-item">
              <button class="btn btn-outline-light" @click="showLoginModal = true">
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
import WalletLoginModal from '@/components/WalletLoginModal.vue'
import { BRAND_LOGO_URL, BRAND_LOGO_MARK_URL, BRAND_LONG_NAME, BRAND_NAME, BRAND_TAGLINE, getSuiServiceUrl } from '@/config/links'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const showLoginModal = ref(false)

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
</style>
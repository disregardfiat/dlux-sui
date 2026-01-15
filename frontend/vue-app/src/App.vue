<template>
  <div id="app">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container">
        <router-link class="navbar-brand" to="/">
          <i class="bi bi-diamond"></i>
          DLUX-SUI
        </router-link>

        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <router-link class="nav-link" to="/">Home</router-link>
            </li>
            <li class="nav-item">
              <router-link class="nav-link" to="/dapps">dApps</router-link>
            </li>
            <li v-if="isAuthenticated" class="nav-item">
              <router-link class="nav-link" to="/post">
                <i class="bi bi-plus-circle"></i> Post dApp
              </router-link>
            </li>
          </ul>

          <ul class="navbar-nav">
            <li class="nav-item" v-if="!isAuthenticated">
              <button class="btn btn-outline-light" @click="login">
                <i class="bi bi-wallet2"></i>
                Connect Wallet
              </button>
            </li>
            <li class="nav-item dropdown" v-else>
              <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                <i class="bi bi-person-circle"></i>
                {{ user?.vanityAddress || user?.suiAddress?.substring(0, 6) + '...' }}
              </a>
              <ul class="dropdown-menu">
                <li>
                  <router-link 
                    class="dropdown-item" 
                    :to="`/@${user?.vanityAddress || user?.suiAddress}`"
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

    <footer class="bg-light mt-5 py-4">
      <div class="container text-center">
        <p class="mb-0 text-muted">
          DLUX-SUI - Decentralized Metaverse Platform
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)

const login = async () => {
  await authStore.login()
}

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
</style>
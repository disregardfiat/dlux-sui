<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="hero bg-primary text-white rounded p-5 mb-5">
      <div class="container">
        <h1 class="display-4 fw-bold">Welcome to DLUX-SUI</h1>
        <p class="lead">
          Discover and interact with decentralized applications in the metaverse.
          Built on SUI blockchain with WebRTC-powered real-time communication.
        </p>
        <router-link to="/dapps" class="btn btn-light btn-lg">
          <i class="bi bi-grid"></i>
          Explore dApps
        </router-link>
      </div>
    </section>

    <!-- Featured dApps -->
    <section class="featured-dapps mb-5">
      <h2 class="mb-4">Featured dApps</h2>
      <div class="row">
        <div v-for="dapp in featuredDApps" :key="dapp.id" class="col-md-4 mb-4">
          <div class="card h-100">
            <div class="card-body">
              <h5 class="card-title">{{ dapp.name }}</h5>
              <p class="card-text">{{ dapp.description }}</p>
              <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">
                  <i class="bi bi-star-fill text-warning"></i>
                  {{ dapp.rating.toFixed(1) }}
                </small>
                <router-link :to="`/dapps/${dapp.id}`" class="btn btn-primary btn-sm">
                  View Details
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="stats bg-light rounded p-4">
      <div class="row text-center">
        <div class="col-md-3">
          <h3 class="text-primary">{{ stats.totalDApps }}</h3>
          <p class="mb-0">Total dApps</p>
        </div>
        <div class="col-md-3">
          <h3 class="text-primary">{{ stats.totalUsers }}</h3>
          <p class="mb-0">Active Users</p>
        </div>
        <div class="col-md-3">
          <h3 class="text-primary">{{ stats.totalTransactions }}</h3>
          <p class="mb-0">Transactions</p>
        </div>
        <div class="col-md-3">
          <h3 class="text-primary">{{ stats.totalStorage }}</h3>
          <p class="mb-0">Storage (GB)</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'
import { DApp } from '@dlux-sui/types'

// GraphQL query for featured dApps
const FEATURED_DAPPS_QUERY = gql`
  query GetFeaturedDApps {
    trendingDApps(limit: 6) {
      id
      name
      description
      rating
      downloadCount
    }
  }
`

const { result, loading, error } = useQuery(FEATURED_DAPPS_QUERY)

const featuredDApps = ref<DApp[]>([])
const stats = ref({
  totalDApps: 0,
  totalUsers: 0,
  totalTransactions: 0,
  totalStorage: 0
})

// Mock data for now
onMounted(() => {
  featuredDApps.value = [
    {
      id: '1',
      name: 'VR Chat Room',
      description: 'Real-time voice and video chat in virtual reality',
      rating: 4.8,
      downloadCount: 1250,
      owner: '',
      version: '',
      manifest: {} as any,
      blobIds: [],
      tags: [],
      category: 'social',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      name: 'Decentraland Game',
      description: 'Multiplayer game with blockchain assets',
      rating: 4.6,
      downloadCount: 890,
      owner: '',
      version: '',
      manifest: {} as any,
      blobIds: [],
      tags: [],
      category: 'gaming',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '3',
      name: 'NFT Marketplace',
      description: 'Trade digital assets securely',
      rating: 4.9,
      downloadCount: 2100,
      owner: '',
      version: '',
      manifest: {} as any,
      blobIds: [],
      tags: [],
      category: 'finance',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  stats.value = {
    totalDApps: 42,
    totalUsers: 15420,
    totalTransactions: 89450,
    totalStorage: 256
  }
})
</script>

<style scoped>
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.card {
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.stats h3 {
  font-size: 2.5rem;
  font-weight: bold;
}
</style>
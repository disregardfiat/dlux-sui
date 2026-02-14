<template>
  <div class="feed-view">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="h4 mb-0">Feed</h1>
      <router-link class="btn btn-sm btn-outline-primary" to="/">
        <i class="bi bi-house me-1"></i> Home
      </router-link>
    </div>

    <ul class="nav nav-tabs mb-4">
      <li class="nav-item">
        <button
          class="nav-link"
          :class="{ active: feedMode === 'recent' }"
          @click="feedMode = 'recent'; loadFeed()"
        >
          Recent
        </button>
      </li>
      <li class="nav-item">
        <button
          class="nav-link"
          :class="{ active: feedMode === 'popular' }"
          @click="feedMode = 'popular'; loadFeed()"
        >
          Popular
        </button>
      </li>
      <li class="nav-item">
        <button
          class="nav-link"
          :class="{ active: feedMode === 'foryou' }"
          @click="feedMode = 'foryou'; loadFeed()"
        >
          For you
        </button>
      </li>
    </ul>

    <div v-if="feedError" class="alert alert-warning d-flex align-items-center justify-content-between">
      <span><i class="bi bi-exclamation-triangle me-2"></i>{{ feedError }}</span>
      <button class="btn btn-sm btn-outline-warning" :disabled="feedLoading" @click="loadFeed">
        Retry
      </button>
    </div>

    <div v-if="feedLoading && posts.length === 0" class="text-center py-5">
      <div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div>
    </div>

    <div v-else-if="posts.length === 0" class="text-center py-5 text-muted">
      <i class="bi bi-chat-dots display-4"></i>
      <p class="mt-3 mb-0">No posts yet. Post from your account page or from a dApp's discussion.</p>
      <router-link class="btn btn-outline-primary mt-3" to="/dapps">Explore dApps</router-link>
    </div>

    <div v-else class="feed-list">
      <article
        v-for="post in posts"
        :key="post.id"
        class="post-card card mb-3"
      >
        <div class="card-body">
          <div class="d-flex align-items-center gap-2 mb-2">
            <div class="post-avatar">
              {{ getInitials((post as any).authorName || post.author) }}
            </div>
            <div>
              <router-link
                :to="`/@${(post as any).authorName || post.author}`"
                class="fw-bold text-decoration-none"
              >
                {{ (post as any).authorName || truncateAddress(post.author) }}
              </router-link>
              <small class="text-muted d-block">{{ formatDate(post.createdAt) }}</small>
            </div>
          </div>
          <p class="post-content mb-2">{{ post.content || '(no content)' }}</p>
          <div v-if="post.tags?.length" class="mb-2">
            <span v-for="tag in post.tags" :key="tag" class="badge bg-secondary me-1">#{{ tag }}</span>
          </div>
          <div class="d-flex gap-3 small text-muted">
            <span><i class="bi bi-heart me-1"></i>{{ post.likes ?? 0 }}</span>
            <span><i class="bi bi-chat me-1"></i>{{ post.replies ?? 0 }}</span>
          </div>
        </div>
      </article>

      <div v-if="hasMore" class="text-center py-3">
        <button
          class="btn btn-outline-primary"
          :disabled="feedLoading"
          @click="loadMore"
        >
          <span v-if="feedLoading" class="spinner-border spinner-border-sm me-2"></span>
          Load more
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { SocialPost } from '@dlux-sui/types'
import { useSocial } from '@/composables/useSocial'

const social = useSocial()
const feedMode = ref<'recent' | 'popular' | 'foryou'>('recent')
const posts = ref<SocialPost[]>([])
const feedLoading = ref(false)
const feedError = ref('')
const offset = ref(0)
const limit = 20
const hasMore = ref(false)

onMounted(() => loadFeed())

function getQuery() {
  const order: 'asc' | 'desc' = 'desc'
  if (feedMode.value === 'popular') {
    return { limit, offset: 0, sortBy: 'likes' as const, sortOrder: order }
  }
  if (feedMode.value === 'foryou') {
    return { limit, offset: 0, sortBy: 'created' as const, sortOrder: order }
  }
  return { limit, offset: 0, sortBy: 'created' as const, sortOrder: order }
}

async function loadFeed() {
  feedLoading.value = true
  feedError.value = ''
  offset.value = 0
  try {
    const result = await social.getFeed(getQuery())
    posts.value = result.posts || []
    hasMore.value = result.hasMore ?? false
    offset.value = posts.value.length
  } catch (err: any) {
    feedError.value = err?.message || 'Failed to load feed'
  } finally {
    feedLoading.value = false
  }
}

async function loadMore() {
  feedLoading.value = true
  feedError.value = ''
  try {
    const result = await social.getFeed({
      ...getQuery(),
      offset: offset.value
    })
    posts.value.push(...(result.posts || []))
    hasMore.value = result.hasMore ?? false
    offset.value = posts.value.length
  } catch (err: any) {
    feedError.value = err?.message || 'Failed to load more'
  } finally {
    feedLoading.value = false
  }
}

function truncateAddress(addr: string): string {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

function getInitials(value: string): string {
  if (!value) return '?'
  const parts = String(value).replace(/^@/, '').trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?'
}
</script>

<style scoped>
.post-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.post-content {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

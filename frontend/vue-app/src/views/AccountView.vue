<template>
  <div class="account-page">
    <div v-if="showPostedSuccessBanner && postedSuccessDappId && isOwnProfile" class="alert alert-success alert-dismissible fade show mx-3 mt-3 mb-0" role="alert">
      <i class="bi bi-check-circle me-2"></i>
      <strong>dApp posted!</strong>
      <router-link :to="`/dapps/${postedSuccessDappId}`" class="alert-link ms-2">View your dApp</router-link>
      <button type="button" class="btn-close" aria-label="Close" @click="dismissPostedSuccess"></button>
    </div>
    <!-- Profile hero (Twitter-style) -->
    <header class="profile-hero">
      <div
        class="profile-hero-banner"
        :style="{ backgroundImage: profile?.banner ? `url(${profile.banner})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }"
      >
        <div class="profile-hero-banner-overlay"></div>
      </div>
      <div class="profile-hero-body container">
        <div class="profile-hero-avatar-wrap">
          <img
            :src="profile?.avatar || '/default-avatar.svg'"
            :alt="displayName"
            class="profile-hero-avatar"
            @error="handleAvatarError"
          />
          <div v-if="profile?.verified" class="profile-hero-verified">
            <i class="bi bi-check-circle-fill"></i>
          </div>
        </div>
        <div class="profile-hero-main">
          <h1 class="profile-hero-name">{{ displayName }}</h1>
          <p class="profile-hero-handle">
            {{ suinsName ? `@${suinsName}` : (suiAddress ? `${suiAddress.slice(0, 6)}…${suiAddress.slice(-4)}` : '') }}
          </p>
          <p v-if="profile?.bio" class="profile-hero-bio">{{ profile.bio }}</p>
          <div v-if="profile?.location || profile?.website" class="profile-hero-meta">
            <span v-if="profile?.location" class="profile-hero-meta-item">
              <i class="bi bi-geo-alt"></i> {{ profile.location }}
            </span>
            <span v-if="profile?.website" class="profile-hero-meta-item">
              <i class="bi bi-link-45deg"></i>
              <a :href="profile.website" target="_blank" rel="noopener">{{ profile.website }}</a>
            </span>
          </div>
          <!-- PM market trust -->
          <div class="profile-hero-pm-trust">
            <i class="bi bi-graph-up-arrow"></i>
            <span v-if="pmTrustTotal > 0">
              {{ formatPmTrustProfit(pmTrustProfit) }} won, on {{ pmTrustWon }}/{{ pmTrustTotal }} PMs
              <span v-if="pmTrustTotal > 0" class="profile-hero-pm-pct">({{ Math.round((pmTrustWon / pmTrustTotal) * 100) }}% win rate)</span>
            </span>
            <span v-else class="profile-hero-pm-empty">No PM history</span>
          </div>
          <div class="profile-hero-actions">
            <div v-if="subscriberCount > 0" class="profile-hero-subscribers">
              <strong>{{ subscriberCount }}</strong> {{ subscriberCount === 1 ? 'subscriber' : 'subscribers' }}
            </div>
            <button v-if="isOwnProfile" class="btn btn-primary btn-account-action" @click="showEditModal = true">
              <i class="bi bi-pencil"></i> Edit Profile
            </button>
            <template v-else-if="suiAddress">
              <button class="btn btn-primary btn-account-action" @click="showSubscribeModal = true">
                <i class="bi bi-star"></i> Subscribe
              </button>
              <button
                v-if="isAuthenticated && !isOwnProfile"
                class="btn btn-account-action"
                :class="isFollowing ? 'btn-outline-secondary' : 'btn-outline-primary'"
                :disabled="followLoading"
                @click="toggleFollow"
              >
                <span v-if="followLoading" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else-if="isFollowing" class="bi bi-person-check me-1"></i>
                <i v-else class="bi bi-person-plus me-1"></i>
                {{ isFollowing ? 'Following' : 'Follow' }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </header>

    <!-- Tabs -->
    <div class="account-tabs-wrap">
      <div class="container">
        <nav class="account-tabs" role="tablist">
          <button
            v-for="t in accountTabs"
            :key="t.id"
            type="button"
            class="account-tab"
            :class="{ active: activeAccountTab === t.id }"
            role="tab"
            :aria-selected="activeAccountTab === t.id"
            @click="activeAccountTab = t.id"
          >
            {{ t.label }}
            <span v-if="t.count !== undefined" class="account-tab-count">{{ t.count }}</span>
          </button>
        </nav>
      </div>
    </div>

    <div class="container account-content">
      <!-- Tab: dApps -->
      <template v-if="activeAccountTab === 'dApps'">
      <!-- Published dApps -->
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
            :class="{ 'dapp-muted': dapp.muted }"
          >
            <div class="dapp-header">
              <h3 @click="navigateToDApp(dapp)" style="cursor: pointer;">{{ dapp.name || 'Untitled dApp' }}</h3>
              <span class="dapp-version">v{{ dapp.version || '—' }}</span>
            </div>
            <p class="dapp-description" @click="navigateToDApp(dapp)" style="cursor: pointer;">{{ dapp.description || '—' }}</p>
            <div class="dapp-tags">
              <span
                v-for="tag in (dapp.tags || [])"
                :key="tag"
                class="tag"
              >{{ tag }}</span>
            </div>
            <div class="dapp-footer d-flex justify-content-between align-items-center">
              <small class="text-muted">
                Updated {{ formatDate(dapp.updatedAt) }}
              </small>
              <div v-if="isOwnProfile" class="dapp-actions" @click.stop>
                <button
                  v-if="!dapp.muted"
                  class="btn btn-sm btn-warning"
                  :disabled="mutingDapp === dapp.id"
                  @click="pauseDapp(dapp)"
                  title="Pause dApp (hide from listings, reduce ads/slashing)"
                >
                  <span v-if="mutingDapp === dapp.id" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-pause-circle"></i> Pause
                </button>
                <button
                  v-else
                  class="btn btn-sm btn-success"
                  :disabled="mutingDapp === dapp.id"
                  @click="unpauseDapp(dapp)"
                  title="Unpause dApp (restore visibility)"
                >
                  <span v-if="mutingDapp === dapp.id" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-play-circle"></i> Unpause
                </button>
                <button
                  class="btn btn-sm btn-outline-danger ms-2"
                  :disabled="delistingDapp === dapp.id"
                  @click="delistDapp(dapp)"
                  title="Delist dApp (permanently remove from listings)"
                >
                  <span v-if="delistingDapp === dapp.id" class="spinner-border spinner-border-sm me-1"></span>
                  <i class="bi bi-trash"></i> Delist
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Premium Content (creator only) - inside dApps tab -->
      <div v-if="isOwnProfile && dapps.length > 0" class="section">
        <h2 class="section-title">
          <i class="bi bi-lock"></i> Premium Content
        </h2>
        <p class="text-muted mb-3">
          List Walrus Seal content for sale. Upload files, set prices, and manage access.
        </p>
        <div v-for="dapp in dapps" :key="dapp.id" class="card mb-3">
          <div class="card-header d-flex justify-content-between align-items-center">
            <strong>{{ dapp.name || 'Untitled dApp' }}</strong>
            <button
              class="btn btn-sm btn-primary"
              :disabled="premiumUploading"
              @click.stop="openUploadModal(dapp)"
            >
              <span v-if="premiumUploading && uploadTargetDapp?.id === dapp.id" class="spinner-border spinner-border-sm me-1"></span>
              <i class="bi bi-plus-lg"></i> Upload content
            </button>
          </div>
          <div class="card-body">
            <div v-if="premiumByDapp[dapp.id]?.length" class="premium-content-list">
              <div
                v-for="item in premiumByDapp[dapp.id]"
                :key="item.id"
                class="premium-item d-flex justify-content-between align-items-center py-2 border-bottom"
              >
                <div>
                  <strong>{{ item.name }}</strong>
                  <span class="text-muted ms-2">{{ item.price }} SUI</span>
                  <small v-if="item.description" class="d-block text-muted">{{ item.description }}</small>
                </div>
                <button
                  class="btn btn-sm btn-outline-danger"
                  :disabled="premiumDeleting === item.id"
                  @click.stop="deleteContent(item, dapp.id)"
                >
                  <span v-if="premiumDeleting === item.id" class="spinner-border spinner-border-sm"></span>
                  <i v-else class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <div v-else class="text-muted small">No premium content yet. Upload to sell.</div>
          </div>
        </div>
        <!-- Upload modal -->
        <div v-if="showUploadModal" class="modal show d-block" tabindex="-1" style="background: rgba(0,0,0,0.5)">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Upload premium content</h5>
                <button type="button" class="btn-close" @click="showUploadModal = false"></button>
              </div>
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label">File</label>
                  <input
                    ref="uploadFileInput"
                    type="file"
                    class="form-control"
                    accept="*/*"
                    @change="onFileSelect"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Name</label>
                  <input v-model="uploadForm.name" type="text" class="form-control" placeholder="Content name" />
                </div>
                <div class="mb-3">
                  <label class="form-label">Description</label>
                  <textarea v-model="uploadForm.description" class="form-control" rows="2" placeholder="Optional"></textarea>
                </div>
                <div class="mb-3">
                  <label class="form-label">Price (SUI)</label>
                  <input v-model.number="uploadForm.price" type="number" step="0.01" min="0" class="form-control" placeholder="0.5" />
                </div>
                <div v-if="uploadError" class="alert alert-danger py-2">{{ uploadError }}</div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" @click="showUploadModal = false">Cancel</button>
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="!canUpload"
                  @click="submitUpload"
                >
                  <span v-if="premiumUploading" class="spinner-border spinner-border-sm me-1"></span>
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </template>

      <!-- Tab: Posts -->
      <template v-if="activeAccountTab === 'posts'">
      <div class="section">
        <h2 class="section-title">Posts</h2>
        <div v-if="loadingPosts" class="text-muted">Loading...</div>
        <div v-else-if="posts.length === 0" class="empty-state">
          <p>No posts yet</p>
        </div>
        <div v-else class="social-list">
          <div v-for="post in posts" :key="post.id" class="social-card">
            <p class="mb-2">{{ post.content || '(no content)' }}</p>
            <small class="text-muted">{{ formatDate(post.createdAt) }}</small>
          </div>
        </div>
      </div>
      </template>

      <!-- Tab: Replies -->
      <template v-if="activeAccountTab === 'replies'">
      <div class="section">
        <h2 class="section-title">Replies</h2>
        <div v-if="loadingReplies" class="text-muted">Loading...</div>
        <div v-else-if="replies.length === 0" class="empty-state">
          <p>No replies yet</p>
        </div>
        <div v-else class="social-list">
          <div v-for="reply in replies" :key="reply.id" class="social-card">
            <p class="mb-2">{{ reply.content || '(no content)' }}</p>
            <small class="text-muted">{{ formatDate(reply.createdAt) }}</small>
          </div>
        </div>
      </div>
      </template>

      <!-- Tab: Misc -->
      <template v-if="activeAccountTab === 'misc'">
      <!-- SuiNS Registration -->
      <div v-if="isOwnProfile && !suinsName" class="section">
        <h2 class="section-title">Register SuiNS</h2>
        <div class="card p-3">
          <p class="text-muted mb-3">
            Claim a SuiNS name to get a readable profile URL and dApp subdomain.
          </p>
          <div class="input-group mb-2">
            <span class="input-group-text">@</span>
            <input
              v-model="suinsDesired"
              type="text"
              class="form-control"
              placeholder="yourname or yourname.sui"
              :class="{ 'is-invalid': suinsDesired.length > 0 && !suinsNameValid }"
            />
            <button
              class="btn btn-outline-primary"
              type="button"
              :disabled="!suinsNameValid || suinsAvailability === 'checking'"
              @click="checkSuinsAvailability"
            >
              <span v-if="suinsAvailability === 'checking'" class="spinner-border spinner-border-sm me-2"></span>
              Check availability
            </button>
          </div>
          <small v-if="suinsDesired.length > 0" :class="suinsAvailabilityClass">
            {{ suinsAvailabilityMessage }}
          </small>
          <div class="mt-3 d-flex align-items-center">
            <button
              class="btn btn-primary"
              type="button"
              :disabled="!canRegisterSuins || suinsRegistering"
              @click="startSuinsRegistration"
            >
              <span v-if="suinsRegistering" class="spinner-border spinner-border-sm me-2"></span>
              Continue to SuiNS registration
            </button>
            <small class="text-muted ms-3">
              Registration opens in a new tab.
            </small>
          </div>
          <div v-if="suinsError" class="alert alert-danger mt-3 mb-0">
            {{ suinsError }}
          </div>
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

      <!-- Social Links -->
      <div class="section">
        <h2 class="section-title">Social Links</h2>
        <div v-if="socialLinks.length > 0" class="linked-accounts">
          <div
            v-for="(link, idx) in socialLinks"
            :key="`${link?.label ?? ''}-${link?.url ?? ''}-${idx}`"
            class="linked-account-card"
          >
            <div class="account-icon">
              <i class="bi bi-link-45deg"></i>
            </div>
            <div class="account-info">
              <strong>{{ link?.label || 'Link' }}</strong>
              <small>
                <a v-if="link?.url" :href="link.url" target="_blank" rel="noopener">{{ link.url }}</a>
                <span v-else class="text-muted">—</span>
              </small>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>No social links</p>
        </div>
      </div>

      <!-- NFTs -->
      <div class="section">
        <h2 class="section-title">NFTs</h2>
        <div v-if="loadingNfts" class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div v-else-if="nfts.length === 0" class="empty-state">
          <p>No NFTs found</p>
        </div>
        <div v-else class="nft-grid">
          <div v-for="nft in nfts" :key="nft.objectId" class="nft-card">
            <div v-if="nft.imageUrl" class="nft-image">
              <img :src="nft.imageUrl" :alt="nft.name || nft.objectId" />
            </div>
            <div class="nft-body">
              <h3 class="h6 mb-1">{{ nft.name || 'Untitled NFT' }}</h3>
              <p class="text-muted mb-0">{{ nft.collection || nft.type }}</p>
              <small class="text-muted">{{ nft.objectId }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Profile Metadata -->
      <div class="section">
        <h2 class="section-title">Profile Metadata</h2>
        <div v-if="metadataPreview" class="metadata-preview">
          <pre>{{ metadataPreview }}</pre>
        </div>
        <div v-else class="empty-state">
          <p>No metadata</p>
        </div>
      </div>

      <!-- Social Stats -->
      <div class="section">
        <h2 class="section-title">Social Stats</h2>
        <div v-if="socialStats" class="stats-grid">
          <div class="stat">
            <strong>{{ socialStats.posts ?? 0 }}</strong>
            <small>Posts</small>
          </div>
          <div class="stat">
            <strong>{{ socialStats.replies ?? 0 }}</strong>
            <small>Replies</small>
          </div>
          <div class="stat">
            <strong>{{ socialStats.likes ?? 0 }}</strong>
            <small>Likes</small>
          </div>
          <div class="stat">
            <strong>{{ socialStats.followers ?? 0 }}</strong>
            <small>Followers</small>
          </div>
          <div class="stat">
            <strong>{{ socialStats.following ?? 0 }}</strong>
            <small>Following</small>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>No social stats available</p>
        </div>
      </div>

      <!-- Mentions (in Misc) -->
      <div class="section">
        <h2 class="section-title">Mentions</h2>
        <div v-if="loadingMentions" class="text-muted">Loading...</div>
        <div v-else-if="mentions.length === 0" class="empty-state">
          <p>No mentions yet</p>
        </div>
        <div v-else class="social-list">
          <div v-for="mention in mentions" :key="mention.id" class="social-card">
            <p class="mb-2">{{ mention.content || '(no content)' }}</p>
            <small class="text-muted">{{ formatDate(mention.createdAt) }}</small>
          </div>
        </div>
      </div>

      <!-- Billing & Monetization -->
      <div v-if="isOwnProfile" class="section">
        <h2 class="section-title">Billing & Monetization</h2>
        <div v-if="billingLoading" class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div v-else-if="billingError" class="alert alert-danger">
          {{ billingError }}
        </div>
        <div v-else-if="billingOverview">
          <!-- Subscription Status -->
          <div class="billing-card">
            <h3 class="billing-card-title">
              <i class="bi bi-star"></i> Subscription
            </h3>
            <div class="billing-card-content">
              <div class="billing-status" :class="`status-${billingOverview.subscription.active ? 'active' : 'inactive'}`">
                {{ billingOverview.subscription.active ? 'Active' : 'Inactive' }}
                <span v-if="billingOverview.subscription.level">({{ billingOverview.subscription.level }})</span>
              </div>
              <div v-if="billingOverview.subscription.expiresAt" class="billing-detail">
                Expires: {{ formatDate(billingOverview.subscription.expiresAt) }}
              </div>
              <div class="billing-balance">
                Balance: {{ formatSui(billingOverview.subscription.suiBalance) }}
              </div>
            </div>
          </div>

          <!-- SuiNS Term -->
          <div class="billing-card">
            <h3 class="billing-card-title">
              <i class="bi bi-tag"></i> SuiNS Domain
            </h3>
            <div class="billing-card-content">
              <div class="billing-status" :class="`status-${billingOverview.suins.active ? 'active' : 'inactive'}`">
                {{ billingOverview.suins.active ? 'Active' : 'Inactive' }}
                <span v-if="billingOverview.suins.domain">({{ billingOverview.suins.domain }})</span>
              </div>
              <div v-if="billingOverview.suins.expiresAt" class="billing-detail">
                Expires: {{ formatDate(billingOverview.suins.expiresAt) }}
                <span v-if="billingOverview.suins.daysRemaining" class="text-muted">({{ billingOverview.suins.daysRemaining }} days)</span>
              </div>
              <div class="billing-balance">
                Balance: {{ formatSui(billingOverview.suins.suiBalance) }}
              </div>
            </div>
          </div>

          <!-- Storage Funding -->
          <div v-if="billingOverview.storageFunding.length > 0" class="storage-funding-section">
            <h3 class="billing-section-title">Storage Funding</h3>
            <div class="storage-cards">
              <div
                v-for="funding in billingOverview.storageFunding"
                :key="`${funding.dappId}-${funding.blobId}`"
                class="storage-card"
                :class="{ 'precarious': funding.precarious }"
              >
                <div class="storage-header">
                  <h4>{{ funding.dappName }}</h4>
                  <div class="storage-status" :class="getStorageStatusClass(funding)">
                    {{ getStorageStatusText(funding) }}
                  </div>
                </div>
                <div class="storage-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: `${funding.coveragePercent}%` }"
                    ></div>
                  </div>
                  <small class="progress-text">
                    {{ funding.coveragePercent.toFixed(1) }}% funded
                    ({{ formatSui(funding.funded) }} / {{ formatSui(funding.storageCost) }})
                  </small>
                </div>
                <div class="storage-details">
                  <div class="detail-row">
                    <span>Term Progress:</span>
                    <span>{{ funding.termProgressPercent.toFixed(1) }}%</span>
                  </div>
                  <div class="detail-row">
                    <span>Term Ends:</span>
                    <span>{{ formatDate(funding.termEnd) }}</span>
                  </div>
                  <div class="detail-row">
                    <span>Funding Source:</span>
                    <span>{{ formatFundingSource(funding.fundingSource) }}</span>
                  </div>
                  <div v-if="funding.pmContribution > 0" class="detail-row">
                    <span>PM Fees:</span>
                    <span>{{ formatSui(funding.pmContribution) }}</span>
                  </div>
                  <div v-if="funding.adContribution > 0" class="detail-row">
                    <span>Ad Revenue:</span>
                    <span>{{ formatSui(funding.adContribution) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Payout Balances -->
          <div class="payouts-section">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
              <h3 class="billing-section-title mb-0">Available Payouts</h3>
              <div class="d-flex gap-2">
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="showLocationModal = true">
                  <i class="bi bi-geo-alt"></i> Location
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" @click="openGovernanceModal">
                  <i class="bi bi-bank"></i> Governance
                </button>
              </div>
            </div>
            <div class="payout-cards">
              <div class="payout-card">
                <div class="payout-header">
                  <h4>Ad Share</h4>
                  <div class="payout-amount">{{ formatSui(billingOverview.payouts.adShare) }}</div>
                </div>
                <button
                  class="btn btn-sm btn-outline-primary"
                  :disabled="billingOverview.payouts.adShare <= 0 || claiming"
                  @click="openClaimModal('adShare', billingOverview.payouts.adShare)"
                >
                  <span v-if="claiming" class="spinner-border spinner-border-sm me-2"></span>
                  Claim SUI
                </button>
              </div>
              <div class="payout-card">
                <div class="payout-header">
                  <h4>Subscription Share</h4>
                  <div class="payout-amount">{{ formatSui(billingOverview.payouts.subscriptionShare) }}</div>
                </div>
                <button
                  class="btn btn-sm btn-outline-primary"
                  :disabled="billingOverview.payouts.subscriptionShare <= 0 || claiming"
                  @click="openClaimModal('subscriptionShare', billingOverview.payouts.subscriptionShare)"
                >
                  <span v-if="claiming" class="spinner-border spinner-border-sm me-2"></span>
                  Claim SUI
                </button>
              </div>
              <div class="payout-card">
                <div class="payout-header">
                  <h4>PM Share</h4>
                  <div class="payout-amount">{{ formatSui(billingOverview.payouts.pmShare) }}</div>
                </div>
                <button
                  class="btn btn-sm btn-outline-primary"
                  :disabled="billingOverview.payouts.pmShare <= 0 || claiming"
                  @click="openClaimModal('pmShare', billingOverview.payouts.pmShare)"
                >
                  <span v-if="claiming" class="spinner-border spinner-border-sm me-2"></span>
                  Claim SUI
                </button>
              </div>
              <div class="payout-card">
                <div class="payout-header">
                  <h4>Premium Content</h4>
                  <div class="payout-amount">{{ formatSui(billingOverview.payouts.premiumShare) }}</div>
                </div>
                <button
                  class="btn btn-sm btn-outline-primary"
                  :disabled="billingOverview.payouts.premiumShare <= 0 || claiming"
                  @click="openClaimModal('premiumShare', billingOverview.payouts.premiumShare)"
                >
                  <span v-if="claiming" class="spinner-border spinner-border-sm me-2"></span>
                  Claim SUI
                </button>
              </div>
            </div>
            <div class="payout-total">
              <strong>Total Available: {{ formatSui(billingOverview.payouts.total) }}</strong>
            </div>
            <!-- Recent transactions (explorer links) -->
            <div class="mt-3">
              <h4 class="h6 text-muted mb-2">Recent transactions</h4>
              <div v-if="transactionsLoading" class="text-muted small">Loading...</div>
              <div v-else-if="transactions.length === 0" class="empty-state compact">
                <p class="mb-0 small text-muted">No recent transactions</p>
              </div>
              <ul v-else class="list-unstyled mb-0 small">
                <li v-for="tx in transactions" :key="tx.digest" class="d-flex align-items-center gap-2 py-1">
                  <a :href="buildExplorerTxUrl(tx.digest)" target="_blank" rel="noopener noreferrer" class="text-break">
                    {{ tx.digest.slice(0, 10) }}…{{ tx.digest.slice(-8) }}
                  </a>
                  <span v-if="tx.timestampMs" class="text-muted">{{ formatTxDate(tx.timestampMs) }}</span>
                  <i class="bi bi-box-arrow-up-right text-muted"></i>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-4">
          <button class="btn btn-primary" :disabled="billingLoading" @click="loadBillingData">
            <span v-if="billingLoading" class="spinner-border spinner-border-sm me-2"></span>
            Load Billing Data
          </button>
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
              <span class="market-metric">{{ formatMetric(market.safetyMetric ?? '') }}</span>
              <span 
                class="market-status"
                :class="`status-${getMarketColor(market)}`"
              >
                {{ market.status || '—' }}
              </span>
            </div>
            <p class="market-description">{{ market.description || '—' }}</p>
            <div class="market-stats">
              <div class="stat">
                <strong>{{ market.totalPool ?? '—' }}</strong>
                <small>SUI Pool</small>
              </div>
              <div class="stat">
                <strong>{{ (market.bets?.length ?? 0) }}</strong>
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
      </template>
    </div>

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
              <div class="mb-3">
                <label class="form-label">Social Links (JSON)</label>
                <textarea
                  v-model="socialLinksInput"
                  class="form-control"
                  rows="4"
                  placeholder="[{&quot;label&quot;:&quot;GitHub&quot;,&quot;url&quot;:&quot;https://github.com/name&quot;}]"
                ></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Metadata (JSON)</label>
                <textarea
                  v-model="metadataInput"
                  class="form-control"
                  rows="4"
                  placeholder="{&quot;role&quot;:&quot;builder&quot;,&quot;interests&quot;:[&quot;sui&quot;,&quot;dapps&quot;]}"
                ></textarea>
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

    <SubscribeModal
      :show="showSubscribeModal"
      :subscription-price-sui="subscriptionPriceSui"
      :loading="subscribing"
      @close="showSubscribeModal = false"
      @subscribe="startSubscribe"
    />
    <ClaimPayoutModal
      :show="showClaimPayoutModal"
      :bucket-type="claimBucketType"
      :amount="claimAmount"
      :default-recipient="authStore.user?.suiAddress ?? ''"
      @close="showClaimPayoutModal = false"
      @confirm="onConfirmClaim"
    />
    <LocationPreferencesModal
      :show="showLocationModal"
      :initial-regions="locationRegions"
      :initial-notify-new-spots="locationNotifyNewSpots"
      @close="showLocationModal = false"
      @save="onSaveLocationPrefs"
    />
    <GovernanceModal
      :show="showGovernanceModal"
      @close="showGovernanceModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';
import { buildDappUrl, buildSandboxUrl, buildExplorerTxUrl, getDgraphServiceUrl, getSuiServiceUrl, getWalrusServiceUrl } from '@/config/links';
import { useBilling } from '../composables/useBilling';
import { usePremiumContent } from '../composables/usePremiumContent';
import { useSuiWallet } from '../composables/useSuiWallet';
import { useSocial } from '../composables/useSocial';
import { buildSuiTransferTransaction } from '../composables/useSuiTransfer';
import type { UserProfile, ZKLink, SUIdApp, PredictionMarket, UserSocialStats, SocialLink, SocialPost, SUINft, BillingOverview } from '@dlux-sui/types';
import type { PremiumContent } from '../composables/usePremiumContent';
import SubscribeModal from '@/components/modals/SubscribeModal.vue';
import ClaimPayoutModal from '@/components/modals/ClaimPayoutModal.vue';
import LocationPreferencesModal from '@/components/modals/LocationPreferencesModal.vue';
import GovernanceModal from '@/components/modals/GovernanceModal.vue';

const route = useRoute();
const authStore = useAuthStore();
const { billingOverview, transactions, loading: billingLoading, transactionsLoading, error: billingError, loadBillingOverview, loadTransactions, claimPayouts } = useBilling();
const { signAndExecuteTransactionBlock, signMessage } = useSuiWallet();
const { followUser, unfollowUser } = useSocial();
const isAuthenticated = computed(() => authStore.isAuthenticated);
const {
  loadPremiumContent,
  createPremiumContent,
  deletePremiumContent,
  loading: premiumLoading
} = usePremiumContent();

const identifier = computed(() => route.params.identifier as string);
const isOwnProfile = computed(() => {
  const user = authStore.user;
  return user && suiAddress.value && user.suiAddress === suiAddress.value;
});

const showPostedSuccessBanner = ref(true);
const postedSuccessDappId = computed(() => {
  if (route.query?.posted !== '1') return '';
  const q = route.query as Record<string, string>;
  if (q.dappId) return q.dappId;
  const permlink = q.permlink;
  const owner = suiAddress.value || authStore.user?.suiAddress;
  if (permlink && owner) return `${String(owner).toLowerCase()}_${permlink}`;
  return '';
});
function dismissPostedSuccess() {
  showPostedSuccessBanner.value = false;
}

const profile = ref<UserProfile | null>(null);
const suinsName = ref<string | null>(null);
const suiAddress = ref<string>('');
const linkedZKPs = ref<ZKLink[]>([]);
const dapps = ref<SUIdApp[]>([]);
const markets = ref<PredictionMarket[]>([]);
const socialStats = ref<UserSocialStats | null>(null);
const nfts = ref<SUINft[]>([]);
const loadingNfts = ref(false);
const posts = ref<SocialPost[]>([]);
const replies = ref<SocialPost[]>([]);
const mentions = ref<SocialPost[]>([]);
const loadingPosts = ref(false);
const loadingReplies = ref(false);
const loadingMentions = ref(false);
const loadingDApps = ref(false);
const loadingMarkets = ref(false);
const showEditModal = ref(false);
const showSubscribeModal = ref(false);
const editProfile = ref<Partial<UserProfile>>({});
const socialLinksInput = ref('[]');
const metadataInput = ref('{}');
const suinsDesired = ref('');
const suinsAvailability = ref<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
const suinsError = ref('');
const suinsRegistering = ref(false);
const claiming = ref(false);
const subscriberCount = ref(0);
const isFollowing = ref(false);
const followLoading = ref(false);

// Premium content
const premiumByDapp = ref<Record<string, PremiumContent[]>>({});
const showUploadModal = ref(false);
const uploadTargetDapp = ref<SUIdApp | null>(null);
const uploadForm = ref({ name: '', description: '', price: 0.5 });
const selectedFile = ref<File | null>(null);
const premiumUploading = ref(false);
const premiumDeleting = ref<string | null>(null);
const uploadError = ref('');
const uploadFileInput = ref<HTMLInputElement | null>(null);
const subscribing = ref(false);

const showClaimPayoutModal = ref(false);
const claimBucketType = ref<'adShare' | 'subscriptionShare' | 'pmShare' | 'premiumShare'>('adShare');
const claimAmount = ref(0);

const showLocationModal = ref(false);
const locationRegions = ref('');
const locationNotifyNewSpots = ref(false);

const showGovernanceModal = ref(false);

// dApp management
const mutingDapp = ref<string | null>(null);
const delistingDapp = ref<string | null>(null);

// Tabs: dApps | posts | replies | misc
const activeAccountTab = ref<'dApps' | 'posts' | 'replies' | 'misc'>('dApps');
const accountTabs = computed(() => [
  { id: 'dApps' as const, label: 'dApps', count: dapps.value.length },
  { id: 'posts' as const, label: 'Posts', count: posts.value.length },
  { id: 'replies' as const, label: 'Replies', count: replies.value.length },
  { id: 'misc' as const, label: 'Misc' }
]);

// PM market trust (profit won, win count)
const pmTrustProfit = ref(0);
const pmTrustWon = ref(0);
const pmTrustTotal = ref(0);
function formatPmTrustProfit(sui: number): string {
  if (sui === 0) return '$0';
  return sui > 0 ? `+${sui.toFixed(2)} SUI` : `${sui.toFixed(2)} SUI`;
}

const canUpload = computed(() => {
  return selectedFile.value && uploadForm.value.name.trim() && uploadForm.value.price >= 0;
});

const displayName = computed(() => {
  if (profile.value?.displayName) return profile.value.displayName;
  if (suinsName.value) return suinsName.value.replace(/\.sui$/, '');
  const addr = suiAddress.value || identifier.value;
  if (!addr) return '—';
  // Only truncate hex addresses, not human-readable names
  if (addr.startsWith('0x') && addr.length > 10) {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  }
  return addr;
});

const socialLinks = computed<SocialLink[]>(() => profile.value?.socialLinks || []);
const metadataPreview = computed(() => {
  const metadata = profile.value?.metadata;
  if (!metadata || Object.keys(metadata).length === 0) {
    return '';
  }
  return JSON.stringify(metadata, null, 2);
});

const normalizedSuinsName = computed(() => suinsDesired.value.trim().toLowerCase());
const suinsNameValid = computed(() => {
  if (!normalizedSuinsName.value) return false;
  return /^[a-z0-9-]+(\.sui)?$/.test(normalizedSuinsName.value);
});
const suinsAvailabilityMessage = computed(() => {
  if (!suinsNameValid.value && suinsDesired.value.length > 0) {
    return 'Invalid format. Use letters, numbers, and hyphens.';
  }
  switch (suinsAvailability.value) {
    case 'checking':
      return 'Checking availability...';
    case 'available':
      return 'Available';
    case 'taken':
      return 'Not available';
    case 'error':
      return 'Availability check failed';
    default:
      return '';
  }
});
const suinsAvailabilityClass = computed(() => {
  switch (suinsAvailability.value) {
    case 'available':
      return 'text-success';
    case 'taken':
    case 'error':
      return 'text-danger';
    case 'checking':
      return 'text-muted';
    default:
      return 'text-muted';
  }
});
const canRegisterSuins = computed(() => suinsAvailability.value === 'available' && suinsNameValid.value);

const SUI_SERVICE = getSuiServiceUrl();
const DGRAPH_SERVICE = getDgraphServiceUrl();

// Platform subscription price - low for testnet (e.g. 0.01)
const subscriptionPriceSui = Number(import.meta.env.VITE_SUBSCRIPTION_PRICE_SUI || '0.01');

onMounted(async () => {
  await loadUserData();
  await Promise.all([
    loadSocialStats(),
    loadSocialActivity(),
    loadNfts(),
    loadDApps(),
    loadSubscriberCount(),
    loadLocationPreferences(),
    checkFollowStatus(),
  ]);
  await loadMarkets();
  await loadBillingData();
  loadPmTrust();
});

async function loadPmTrust() {
  if (!suiAddress.value) return;
  try {
    const res = await axios.get(`${DGRAPH_SERVICE}/markets/payouts/${encodeURIComponent(suiAddress.value)}`);
    const total = Number(res.data?.total) || 0;
    // When backend adds per-market or win stats, set pmTrustWon / pmTrustTotal here
    pmTrustProfit.value = total;
    if (total > 0) {
      pmTrustTotal.value = 1;
      pmTrustWon.value = 1;
    } else {
      pmTrustTotal.value = 0;
      pmTrustWon.value = 0;
    }
  } catch {
    pmTrustProfit.value = 0;
    pmTrustWon.value = 0;
    pmTrustTotal.value = 0;
  }
}

watch(suinsDesired, () => {
  suinsAvailability.value = 'idle';
  suinsError.value = '';
});

async function loadUserData() {
  try {
    // Try to get user by SuiNS name or SUI address
    const response = await axios.get(`${SUI_SERVICE}/suins/profile/${identifier.value}`);
    const userData = response.data;
    
    suiAddress.value = userData.owner || identifier.value;
    suinsName.value = userData.suinsName || null;
    profile.value = userData.profile || {};
    editProfile.value = { ...profile.value };
    socialLinksInput.value = JSON.stringify(profile.value?.socialLinks || [], null, 2);
    metadataInput.value = JSON.stringify(profile.value?.metadata || {}, null, 2);
  } catch (error) {
    console.error('Error loading user profile:', error);
    // Fallback to SUI address
    suiAddress.value = identifier.value;
    suinsName.value = null;
    editProfile.value = {};
    socialLinksInput.value = '[]';
    metadataInput.value = '{}';
  }

  // Load linked ZKPs (non-fatal; don't reset profile on failure)
  if (suiAddress.value) {
    try {
      const zkpResponse = await axios.get(`${SUI_SERVICE}/auth/profile/${suiAddress.value}`);
      linkedZKPs.value = zkpResponse.data.linkedZKPs || [];
    } catch {
      // ZKP data unavailable -- not fatal
    }
  }
}

async function checkSuinsAvailability() {
  suinsError.value = '';
  if (!suinsNameValid.value) {
    suinsAvailability.value = 'error';
    return;
  }

  const name = normalizedSuinsName.value;
  suinsAvailability.value = 'checking';
  try {
    const response = await axios.get(`${SUI_SERVICE}/suins/availability/${encodeURIComponent(name)}`);
    suinsAvailability.value = response.data.available ? 'available' : 'taken';
  } catch (error: any) {
    suinsAvailability.value = 'error';
    suinsError.value = error.response?.data?.error || 'Failed to check availability';
  }
}

async function startSuinsRegistration() {
  suinsError.value = '';
  if (!canRegisterSuins.value) {
    suinsError.value = 'Check availability before registering.';
    return;
  }

  suinsRegistering.value = true;
  try {
    const response = await axios.post(`${SUI_SERVICE}/suins/register-intent`, {
      name: normalizedSuinsName.value,
      suiAddress: authStore.user?.suiAddress
    });
    const registrationUrl = response.data.registrationUrl;
    if (!registrationUrl) {
      throw new Error('Registration URL not available');
    }
    window.open(registrationUrl, '_blank', 'noopener');
  } catch (error: any) {
    suinsError.value = error.response?.data?.error || error.message || 'Failed to start registration';
  } finally {
    suinsRegistering.value = false;
  }
}

async function toggleFollow() {
  if (!authStore.user?.suiAddress || !suiAddress.value) return;
  followLoading.value = true;
  try {
    if (isFollowing.value) {
      await unfollowUser(suiAddress.value);
      isFollowing.value = false;
      if (socialStats.value) {
        socialStats.value.followers = Math.max(0, (socialStats.value.followers || 0) - 1);
      }
    } else {
      await followUser(suiAddress.value);
      isFollowing.value = true;
      if (socialStats.value) {
        socialStats.value.followers = (socialStats.value.followers || 0) + 1;
      }
    }
  } catch (err: any) {
    console.error('Follow/unfollow failed:', err);
    alert(err?.message || 'Failed to update follow status');
  } finally {
    followLoading.value = false;
  }
}

async function checkFollowStatus() {
  if (!authStore.user?.suiAddress || !suiAddress.value || isOwnProfile.value) return;
  try {
    const res = await axios.get(`${DGRAPH_SERVICE}/social/users/${authStore.user.suiAddress}/stats`);
    // Check if user's following list includes this profile
    // This is a simplistic approach — may need a dedicated API endpoint
    isFollowing.value = false; // Default
  } catch {
    isFollowing.value = false;
  }
}

async function loadLocationPreferences() {
  if (!isOwnProfile.value || !authStore.token) return;
  try {
    const headers: Record<string, string> = {};
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
    const res = await axios.get(`${DGRAPH_SERVICE}/location/preferences`, { params: { user: suiAddress.value }, headers });
    if (res.data) {
      locationRegions.value = Array.isArray(res.data.regions) ? res.data.regions.join(', ') : (res.data.regions || '');
      locationNotifyNewSpots.value = res.data.notifyNewSpots ?? false;
    }
  } catch {
    // Location preferences API may not exist yet
  }
}

async function loadSubscriberCount() {
  if (!suiAddress.value) return;
  try {
    const response = await axios.get(`${DGRAPH_SERVICE}/subscription/status`, {
      params: { subscriber: suiAddress.value }
    });
    subscriberCount.value = response.data?.subscriberCount ?? response.data?.count ?? (response.data?.active ? 1 : 0);
  } catch {
    // Subscriber count API may not exist yet
    subscriberCount.value = 0;
  }
}

async function loadSocialStats() {
  if (!suiAddress.value) return;
  try {
    const response = await axios.get(`${DGRAPH_SERVICE}/social/users/${suiAddress.value}/stats`);
    socialStats.value = response.data || null;
  } catch (error) {
    console.error('Error loading social stats:', error);
    socialStats.value = null;
  }
}

async function loadSocialActivity() {
  if (!suiAddress.value) return;
  loadingPosts.value = true;
  loadingReplies.value = true;
  loadingMentions.value = true;

  try {
    const [postsRes, repliesRes] = await Promise.all([
      axios.get(`${DGRAPH_SERVICE}/social/posts`, {
        params: { author: suiAddress.value, limit: 5, offset: 0 }
      }),
      axios.get(`${DGRAPH_SERVICE}/social/posts`, {
        params: { author: suiAddress.value, type: 'reply', limit: 5, offset: 0 }
      })
    ]);
    posts.value = postsRes.data.posts || [];
    replies.value = repliesRes.data.posts || [];
  } catch (error) {
    console.error('Error loading posts/replies:', error);
    posts.value = [];
    replies.value = [];
  } finally {
    loadingPosts.value = false;
    loadingReplies.value = false;
  }

  if (!suinsName.value) {
    loadingMentions.value = false;
    mentions.value = [];
    return;
  }

  try {
    const mentionsRes = await axios.get(`${DGRAPH_SERVICE}/social/posts`, {
      params: { mentions: suinsName.value, limit: 5, offset: 0 }
    });
    mentions.value = mentionsRes.data.posts || [];
  } catch (error) {
    console.error('Error loading mentions:', error);
    mentions.value = [];
  } finally {
    loadingMentions.value = false;
  }
}

async function loadDApps() {
  loadingDApps.value = true;
  try {
    const response = await axios.get(`${SUI_SERVICE}/dapps/owner/${suiAddress.value}`);
    dapps.value = response.data.dapps || [];
    if (isOwnProfile.value && dapps.value.length > 0) {
      await loadPremiumContentForDapps();
    }
  } catch (error) {
    console.error('Error loading dApps:', error);
  } finally {
    loadingDApps.value = false;
  }
}

async function pauseDapp(dapp: SUIdApp) {
  if (!dapp.owner || !dapp.permlink) {
    alert('Cannot pause: missing owner or permlink');
    return;
  }
  mutingDapp.value = dapp.id;
  try {
    await setDappMuted(dapp, true);
    // Reload dApps to get updated muted status
    await loadDApps();
  } catch (error: any) {
    console.error('Error pausing dApp:', error);
    alert(error.message || 'Failed to pause dApp');
  } finally {
    mutingDapp.value = null;
  }
}

async function unpauseDapp(dapp: SUIdApp) {
  if (!dapp.owner || !dapp.permlink) {
    alert('Cannot unpause: missing owner or permlink');
    return;
  }
  mutingDapp.value = dapp.id;
  try {
    await setDappMuted(dapp, false);
    // Reload dApps to get updated muted status
    await loadDApps();
  } catch (error: any) {
    console.error('Error unpausing dApp:', error);
    alert(error.message || 'Failed to unpause dApp');
  } finally {
    mutingDapp.value = null;
  }
}

async function delistDapp(dapp: SUIdApp) {
  if (!confirm(`Are you sure you want to delist "${dapp.name}"? This will permanently remove it from listings.`)) {
    return;
  }
  if (!dapp.owner || !dapp.permlink) {
    alert('Cannot delist: missing owner or permlink');
    return;
  }
  delistingDapp.value = dapp.id;
  try {
    // Delist = pause + mark for deletion (or just pause permanently)
    // For now, we'll just pause it - actual deletion would require on-chain support
    await setDappMuted(dapp, true);
    alert('dApp delisted (paused). It will no longer appear in listings.');
    await loadDApps();
  } catch (error: any) {
    console.error('Error delisting dApp:', error);
    alert(error.message || 'Failed to delist dApp');
  } finally {
    delistingDapp.value = null;
  }
}

async function setDappMuted(dapp: SUIdApp, muted: boolean) {
  const sender = authStore.user?.suiAddress;
  if (!sender) {
    throw new Error('Wallet not connected');
  }

  // Build transaction via API
  const response = await axios.post(`${SUI_SERVICE}/dapps/build-set-muted-tx`, {
    sender,
    owner: dapp.owner,
    permlink: dapp.permlink,
    muted
  });

  const { txBytes } = response.data;
  const txBytesBuffer = Buffer.from(txBytes, 'base64');

  // Sign and execute
  const result = await signAndExecuteTransactionBlock(txBytesBuffer, { showEffects: true }, 'WaitForEffectsCert');
  
  console.log(`dApp ${muted ? 'paused' : 'unpaused'} on-chain:`, result.digest);
  console.log('Explorer:', buildExplorerTxUrl(result.digest));
  return result;
}

const WALRUS_SERVICE = getWalrusServiceUrl();

async function loadPremiumContentForDapps() {
  for (const dapp of dapps.value) {
    try {
      const res = await axios.get(`${WALRUS_SERVICE}/premium/content/${dapp.id}?user=${suiAddress.value}`);
      premiumByDapp.value[dapp.id] = res.data.contents || [];
    } catch {
      premiumByDapp.value[dapp.id] = [];
    }
  }
}

function openUploadModal(dapp: SUIdApp) {
  uploadTargetDapp.value = dapp;
  uploadForm.value = { name: '', description: '', price: 0.5 };
  selectedFile.value = null;
  uploadError.value = '';
  showUploadModal.value = true;
  nextTick(() => uploadFileInput.value?.focus());
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] || null;
  if (selectedFile.value && !uploadForm.value.name) {
    uploadForm.value.name = selectedFile.value.name;
  }
}

async function submitUpload() {
  if (!uploadTargetDapp.value || !selectedFile.value || !suiAddress.value) return;
  premiumUploading.value = true;
  uploadError.value = '';
  try {
    await createPremiumContent(selectedFile.value, {
      name: uploadForm.value.name.trim(),
      description: uploadForm.value.description.trim(),
      price: uploadForm.value.price,
      owner: suiAddress.value,
      dappId: uploadTargetDapp.value.id
    });
    await loadPremiumContentForDapps();
    showUploadModal.value = false;
  } catch (err: any) {
    uploadError.value = err.message || 'Upload failed';
  } finally {
    premiumUploading.value = false;
  }
}

async function startSubscribe(payload?: { tier: 'monthly' | 'annual' }) {
  const subscriber = authStore.user?.suiAddress;
  if (!subscriber) {
    alert('Connect your wallet to subscribe.');
    return;
  }
  const isAnnual = payload?.tier === 'annual';
  const amount = isAnnual ? subscriptionPriceSui * 10 : subscriptionPriceSui;
  const foundationAddress = import.meta.env.VITE_FOUNDATION_ADDRESS || '0x3d4e565f798ad88b8e99882f37ab1198430c58ff0ecdca70c57cf16bc9fd84ec';
  subscribing.value = true;
  try {
    const txBytes = await buildSuiTransferTransaction(subscriber, foundationAddress, amount);
    const result = await signAndExecuteTransactionBlock(txBytes, { showEffects: true }, 'WaitForEffectsCert');
    const digest = result?.digest ?? result?.effects?.transactionDigest;
    if (!digest) {
      throw new Error('No transaction digest returned from wallet');
    }

    const DGRAPH = getDgraphServiceUrl();
    const days = isAnnual ? 365 : 30;
    const headers: Record<string, string> = {};
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
    const res = await axios.post(
      `${DGRAPH}/subscription`,
      {
        subscriber,
        paymentTxId: digest,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      },
      { headers }
    );
    if (res.data?.success) {
      showSubscribeModal.value = false;
      if (isOwnProfile.value) {
        await loadBillingData(); // refreshes Recent transactions so the new tx appears with explorer link
      }
      alert('Subscription created! You now have platform-wide ad-free access. View your transaction in Recent transactions below.');
    } else {
      alert('Failed to create subscription.');
    }
  } catch (err: any) {
    alert(`Subscribe failed: ${err.response?.data?.error || err.message}`);
  } finally {
    subscribing.value = false;
  }
}

async function deleteContent(item: PremiumContent, dappId: string) {
  if (!suiAddress.value) return;
  premiumDeleting.value = item.id;
  try {
    await deletePremiumContent(item.id, suiAddress.value);
    await loadPremiumContentForDapps();
  } catch (err: any) {
    alert(`Failed to delete: ${err.message}`);
  } finally {
    premiumDeleting.value = null;
  }
}

async function loadNfts() {
  if (!suiAddress.value) return;
  loadingNfts.value = true;
  try {
    const response = await axios.get(`${SUI_SERVICE}/nfts/owner/${suiAddress.value}`);
    nfts.value = response.data.nfts || [];
  } catch (error) {
    console.error('Error loading NFTs:', error);
    nfts.value = [];
  } finally {
    loadingNfts.value = false;
  }
}

async function loadMarkets() {
  loadingMarkets.value = true;
  try {
    // Get markets for all user's dApps
    const allMarkets: PredictionMarket[] = [];
    for (const dapp of dapps.value) {
      try {
        const response = await axios.get(`${DGRAPH_SERVICE}/markets/dapp/${dapp.id}`);
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
  if (!authStore.user) return;
  
  try {
    const parsedLinks = parseJsonInput<SocialLink[]>(socialLinksInput.value, []);
    const parsedMetadata = parseJsonInput<Record<string, unknown>>(metadataInput.value, {});

    const nextProfile: Partial<UserProfile> = {
      ...editProfile.value,
      socialLinks: parsedLinks,
      metadata: parsedMetadata
    };

    const message = `dlux-profile-update:${identifier.value}:${JSON.stringify(nextProfile)}`;
    const signature = await signMessage(message);
    
    await axios.put(`${SUI_SERVICE}/suins/profile/${identifier.value}`, {
      suiAddress: authStore.user.suiAddress,
      signature,
      profile: nextProfile
    });
    
    profile.value = { ...profile.value, ...nextProfile };
    showEditModal.value = false;
  } catch (error: any) {
    console.error('Error saving profile:', error);
    alert(error?.message?.includes('reject') ? 'Profile update cancelled.' : 'Failed to save profile.');
  }
}

function navigateToDApp(dapp: SUIdApp & { ownerSuinsName?: string; subdomain?: string }) {
  const permlink = dapp.permlink || (dapp.name || 'dapp').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  // Prefer SuiNS name for the owner slug in the URL
  const suins = (dapp as any).ownerSuinsName?.replace(/\.sui$/, '') || suinsName.value?.replace(/\.sui$/, '');
  const owner = suins || dapp.owner || '';
  if (!owner) {
    window.location.href = buildDappUrl('dapp', permlink);
    return;
  }
  // Use SuiNS name as subdomain if available
  const subdomain = suins || (dapp as any).subdomain;
  window.location.href = buildSandboxUrl(owner, permlink, subdomain);
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString();
}

function formatMetric(metric: string): string {
  if (!metric || metric === '—') return metric || '—';
  return metric.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getMarketColor(market: PredictionMarket): string {
  if (market.status === 'resolved') {
    return market.resolution === 'safe' ? 'green' : 'red';
  }
  const safe = market.safePool ?? 0;
  const unsafe = market.unsafePool ?? 0;
  const total = safe + unsafe;
  if (total === 0) return 'yellow';
  const safeOdds = safe / total;
  if (safeOdds > 0.6) return 'green';
  if (safeOdds < 0.4) return 'red';
  return 'yellow';
}

function getDaysRemaining(market: PredictionMarket): number {
  if (!market.expiresAt) return 0;
  const now = new Date();
  const expires = new Date(market.expiresAt);
  if (isNaN(expires.getTime())) return 0;
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
  img.src = '/default-avatar.svg';
}

function parseJsonInput<T>(value: string, fallback: T): T {
  if (!value || !value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    alert('Invalid JSON input. Please fix and try again.');
    throw error;
  }
}

async function loadBillingData() {
  if (!isOwnProfile.value || !suiAddress.value) return;
  await loadBillingOverview(suiAddress.value, authStore.token);
  await loadTransactions(suiAddress.value, 15);
}

function openClaimModal(type: 'adShare' | 'subscriptionShare' | 'pmShare' | 'premiumShare', amount: number) {
  claimBucketType.value = type;
  claimAmount.value = amount;
  showClaimPayoutModal.value = true;
}

function looksLikeTxDigest(id: string): boolean {
  return /^0x[a-fA-F0-9]{64,}$/.test(id);
}

async function onConfirmClaim(payload: { bucketType: 'adShare' | 'subscriptionShare' | 'pmShare' | 'premiumShare'; amount: number; recipientAddress: string }) {
  if (!authStore.user?.suiAddress) {
    alert('Please connect your wallet first');
    return;
  }
  claiming.value = true;
  try {
    const result = await claimPayouts(suiAddress.value, [{ type: payload.bucketType, amount: payload.amount }], payload.recipientAddress);
    showClaimPayoutModal.value = false;
    await loadBillingData();
    const msg = looksLikeTxDigest(result.transactionId)
      ? `Successfully claimed ${formatSui(payload.amount)} SUI! View your transaction in Recent transactions below.`
      : `Successfully claimed ${formatSui(payload.amount)} SUI!`;
    alert(msg);
  } catch (error: any) {
    alert(`Failed to claim payout: ${error.message}`);
  } finally {
    claiming.value = false;
  }
}

function openGovernanceModal() {
  showGovernanceModal.value = true;
}

async function onSaveLocationPrefs(payload: { regions: string; notifyNewSpots: boolean }) {
  locationRegions.value = payload.regions;
  locationNotifyNewSpots.value = payload.notifyNewSpots;
  showLocationModal.value = false;

  // Save to DGraph location preferences API
  if (!authStore.user?.suiAddress) return;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`;
    await axios.post(`${DGRAPH_SERVICE}/location/preferences`, {
      regions: payload.regions.split(',').map(r => r.trim()).filter(Boolean),
      notifyNewSpots: payload.notifyNewSpots
    }, { headers });
  } catch (err: any) {
    console.error('Failed to save location preferences:', err);
    // Don't alert — preferences are saved locally either way
  }
}

function formatSui(amount: number): string {
  return `${amount.toFixed(4)} SUI`;
}

function formatTxDate(timestampMs: string): string {
  const ms = parseInt(timestampMs, 10);
  if (Number.isNaN(ms)) return '';
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

function getStorageStatusClass(funding: any): string {
  if (funding.precarious) return 'status-red';
  if (funding.coveragePercent >= 100) return 'status-green';
  if (funding.coveragePercent >= 50) return 'status-yellow';
  return 'status-red';
}

function getStorageStatusText(funding: any): string {
  if (funding.precarious) return 'At Risk';
  if (funding.coveragePercent >= 100) return 'Fully Funded';
  if (funding.coveragePercent >= 50) return 'Partially Funded';
  return 'Underfunded';
}

function formatFundingSource(source: string): string {
  switch (source) {
    case 'pm': return 'PM Fees';
    case 'ads': return 'Ad Revenue';
    case 'mixed': return 'Mixed';
    case 'manual': return 'Manual';
    default: return source;
  }
}
</script>

<style scoped>
.account-page {
  min-height: 100vh;
  background: var(--bg-secondary);
}

/* ----- Profile hero (Twitter-style) ----- */
.profile-hero {
  position: relative;
  margin-bottom: 0;
}

.profile-hero-banner {
  height: 200px;
  width: 100%;
  background-size: cover;
  background-position: center;
  background-color: var(--primary);
}

.profile-hero-banner-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.25), transparent 60%);
}

.profile-hero-body {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  padding-top: 0;
  padding-bottom: 1rem;
  margin-top: -64px;
  margin-bottom: 0;
}

.profile-hero-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.profile-hero-avatar {
  width: 128px;
  height: 128px;
  border-radius: 50%;
  border: 4px solid var(--bg-card);
  background: var(--bg-card);
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.profile-hero-verified {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: var(--primary);
  color: #fff;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-card);
  font-size: 0.9rem;
}

.profile-hero-main {
  flex: 1;
  min-width: 0;
}

.profile-hero-name {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.15rem 0;
  color: var(--text-primary);
  line-height: 1.2;
}

.profile-hero-handle {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0 0 0.5rem 0;
}

.profile-hero-bio {
  font-size: 0.95rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
  white-space: pre-wrap;
}

.profile-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.profile-hero-meta-item {
  font-size: 0.9rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.profile-hero-meta-item a {
  color: var(--primary);
  text-decoration: none;
}

.profile-hero-meta-item a:hover {
  text-decoration: underline;
}

.profile-hero-pm-trust {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.profile-hero-pm-trust i {
  color: var(--primary);
}

.profile-hero-pm-pct {
  color: var(--text-primary);
  font-weight: 500;
}

.profile-hero-pm-empty {
  font-style: italic;
}

.profile-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.profile-hero-subscribers {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-right: 0.5rem;
}

.btn-account-action {
  border-radius: 9999px;
  font-weight: 600;
  padding: 0.4rem 1rem;
}

/* ----- Tabs ----- */
.account-tabs-wrap {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-primary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.account-tabs {
  display: flex;
  gap: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.account-tabs::-webkit-scrollbar {
  display: none;
}

.account-tab {
  flex: 1;
  min-width: 80px;
  padding: 1rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  white-space: nowrap;
}

.account-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.account-tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.account-tab-count {
  margin-left: 0.25rem;
  font-weight: 600;
  color: inherit;
}

.account-content {
  padding-top: 1rem;
  padding-bottom: 2rem;
}

/* ----- Responsive: mobile ----- */
@media (max-width: 767px) {
  .profile-hero-banner {
    height: 150px;
  }

  .profile-hero-body {
    flex-direction: column;
    align-items: flex-start;
    margin-top: -48px;
    gap: 0.75rem;
    padding-bottom: 1rem;
  }

  .profile-hero-avatar {
    width: 96px;
    height: 96px;
    border-width: 3px;
  }

  .profile-hero-name {
    font-size: 1.35rem;
  }

  .profile-hero-handle {
    font-size: 0.9rem;
  }

  .profile-hero-bio {
    font-size: 0.9rem;
  }

  .profile-hero-pm-trust {
    font-size: 0.85rem;
  }

  .account-tabs {
    flex: none;
    justify-content: flex-start;
  }

  .account-tab {
    flex: 0 0 auto;
  }
}

/* ----- Desktop: wider layout ----- */
@media (min-width: 768px) {
  .profile-hero-body {
    margin-top: -80px;
  }

  .profile-hero-avatar {
    width: 140px;
    height: 140px;
  }

  .profile-hero-name {
    font-size: 1.75rem;
  }
}

.section {
  background: var(--bg-card);
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
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
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-tertiary);
}

.account-icon {
  font-size: 2rem;
  color: var(--primary);
}

.verified-badge-small {
  color: var(--safe-color);
  margin-left: auto;
}

.dapps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.dapp-card {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--bg-card);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.dapp-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.dapp-card.dapp-muted {
  opacity: 0.6;
  background: var(--bg-tertiary);
  border-color: var(--status-warning-text);
}

.dapp-card.dapp-muted .dapp-header h3::after {
  content: ' (Paused)';
  color: var(--status-warning-text);
  font-size: 0.8em;
  font-weight: normal;
}

.dapp-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.dapp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.dapp-version {
  font-size: 0.8rem;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.dapp-description {
  color: var(--text-muted);
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
  background: var(--primary);
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
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  background: var(--bg-tertiary);
}

.market-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.market-metric {
  font-weight: bold;
  color: var(--primary);
}

.market-status {
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

.status-green {
  background: var(--status-success-bg);
  color: var(--status-success-text);
}

.status-yellow {
  background: var(--status-warning-bg);
  color: var(--status-warning-text);
}

.status-red {
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
}

.market-stats {
  display: flex;
  gap: 2rem;
  margin-top: 1rem;
}

.social-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
}

.social-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.75rem;
}

.social-card {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 0.75rem;
  background: var(--bg-card);
}

.empty-state.compact {
  padding: 1rem 0;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.nft-card {
  border: 1px solid var(--border-primary);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-card);
}

.nft-image img {
  width: 100%;
  height: 140px;
  object-fit: cover;
}

.nft-body {
  padding: 0.75rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1.5rem;
}

.stat {
  text-align: center;
}

.stat strong {
  display: block;
  font-size: 1.2rem;
  color: var(--primary);
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--text-muted);
}

.metadata-preview {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1rem;
  overflow: auto;
}

.metadata-preview pre {
  margin: 0;
  font-size: 0.85rem;
}

.modal.show {
  background: rgba(0,0,0,0.5);
}

/* Billing & Monetization Styles */
.billing-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.billing-card-title {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.billing-card-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.billing-status {
  font-weight: bold;
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.9rem;
  display: inline-block;
}

.status-active {
  background: var(--status-success-bg);
  color: var(--status-success-text);
}

.status-inactive {
  background: var(--status-danger-bg);
  color: var(--status-danger-text);
}

.billing-detail, .billing-balance {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.billing-section-title {
  font-size: 1.2rem;
  font-weight: bold;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

.storage-funding-section, .payouts-section {
  margin-top: 2rem;
}

.storage-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.storage-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  transition: border-color 0.2s;
}

.storage-card.precarious {
  border-color: var(--status-danger-text);
  background: var(--status-danger-bg);
}

.storage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.storage-header h4 {
  margin: 0;
  font-size: 1.1rem;
}

.storage-status {
  padding: 0.2rem 0.6rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: bold;
}

.storage-progress {
  margin-bottom: 1rem;
}

.progress-bar {
  background: var(--progress-bg);
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  background: linear-gradient(90deg, var(--safe-color) 0%, var(--status-warning-text) 50%, var(--unsafe-color) 100%);
  height: 100%;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.storage-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.detail-row span:first-child {
  color: var(--text-muted);
}

.payout-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.payout-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
}

.payout-header {
  margin-bottom: 1rem;
}

.payout-header h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

.payout-amount {
  font-size: 1.2rem;
  font-weight: bold;
  color: var(--primary);
}

.payout-total {
  text-align: center;
  padding: 1rem;
  background: var(--status-info-bg);
  color: var(--status-info-text);
  border-radius: 8px;
  margin-top: 1rem;
}
</style>

<template>
  <div class="post-dapp-page">
    <div class="container py-4">
      <div class="row">
        <div class="col-lg-8 mx-auto">
          <!-- Header -->
          <div class="page-header mb-4">
            <h1 class="display-5">{{ isEditMode ? 'Update dApp' : 'Post a dApp' }}</h1>
            <p class="text-muted">
              {{ isEditMode
                ? 'Replace changed files, bump the version, add a release note, and publish. A new prediction market will be created if you set a posting fee.'
                : 'Share your decentralized application, content, or media with the ' + brandName + ' community'
              }}
            </p>
          </div>

          <!-- SuiNS Notice (keyed so we always show current user's address, not stale) -->
          <div v-if="!hasSuinsName" :key="'suins-' + (user?.suiAddress ?? '')" class="alert alert-info">
            <i class="bi bi-info-circle"></i>
            <strong>Get a SuiNS name!</strong> Use SuiNS for ecosystem-wide identity. Your dApp will be at
            <code>{{ defaultDappHostPreview }}/@your-address/your-permlink</code>
            <router-link 
              :to="`/@${user?.suinsName || user?.suiAddress || 'account'}`" 
              class="alert-link ms-2"
            >
              Manage your SuiNS name for a cleaner URL
            </router-link>
          </div>

          <!-- Permlink Preview (keyed so we always show current user, not old permlink/address) -->
          <div v-if="hasSuinsName || user" :key="'preview-' + (user?.suiAddress ?? '')" class="permlink-preview mb-4">
            <label class="form-label">Your dApp URL</label>
            <div class="input-group">
              <span class="input-group-text">https://</span>
              <input 
                type="text" 
                class="form-control" 
                :value="permlinkPreview"
                readonly
                :style="{ background: 'var(--bg-tertiary)' }"
              />
            </div>
            <small class="text-muted">
              The permlink will be generated from your title (or you can customize it)
            </small>
          </div>

          <!-- Post Form -->
          <form class="dapp-form" @submit.prevent="submitDApp">
            <!-- Basic Information -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Basic Information</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label required">Title</label>
                  <input 
                    v-model="formData.name" 
                    type="text" 
                    class="form-control"
                    placeholder="My Awesome dApp"
                    required
                    @input="updatePermlink"
                  />
                </div>

                <div class="mb-3">
                  <label class="form-label">Permlink (URL identifier)</label>
                  <input 
                    v-model="formData.permlink" 
                    type="text" 
                    class="form-control"
                    placeholder="my-awesome-dapp"
                    pattern="[a-z0-9\-]+"
                    :disabled="autoPermlink || isEditMode"
                  />
                  <div v-if="!isEditMode" class="form-check mt-2">
                    <input 
                      id="autoPermlink" 
                      v-model="autoPermlink" 
                      class="form-check-input" 
                      type="checkbox"
                    />
                    <label class="form-check-label" for="autoPermlink">
                      Auto-generate from title
                    </label>
                  </div>
                  <small v-if="isEditMode" class="text-muted">Permlink is fixed when updating so the dApp URL stays the same.</small>
                </div>

                <div class="mb-3">
                  <label class="form-label required">Description</label>
                  <textarea 
                    v-model="formData.description" 
                    class="form-control" 
                    rows="4"
                    placeholder="Describe your dApp, what it does, and how to use it..."
                    required
                  ></textarea>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Version</label>
                    <div class="d-flex gap-2 align-items-center">
                      <input 
                        v-model="formData.version" 
                        type="text" 
                        class="form-control"
                        placeholder="1.0.0"
                      />
                      <button v-if="isEditMode" type="button" class="btn btn-outline-secondary btn-sm" @click="bumpVersion">
                        Bump
                      </button>
                    </div>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Category</label>
                    <select v-model="formData.category" class="form-select">
                      <option value="">Select category</option>
                      <option value="gaming">Gaming</option>
                      <option value="social">Social</option>
                      <option value="finance">Finance</option>
                      <option value="art">Art</option>
                      <option value="music">Music</option>
                      <option value="video">Video</option>
                      <option value="podcast">Podcast</option>
                      <option value="livestream">Livestream</option>
                      <option value="utility">Utility</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Tags</label>
                  <input 
                    v-model="tagsInput" 
                    type="text" 
                    class="form-control"
                    placeholder="tag1, tag2, tag3"
                    @input="updateTags"
                  />
                  <small class="text-muted">Separate tags with commas</small>
                  <div v-if="formData.tags.length > 0" class="mt-2">
                    <span 
                      v-for="(tag, idx) in formData.tags" 
                      :key="idx"
                      class="badge bg-primary me-1"
                    >
                      {{ tag }}
                      <button 
                        type="button" 
                        class="btn-close btn-close-white ms-1" 
                        style="font-size: 0.7rem;"
                        @click="removeTag(idx)"
                      ></button>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Content Upload -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Content</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">Content Type</label>
                  <select v-model="contentType" class="form-select" @change="resetUploads">
                    <option value="webapp">Web App (HTML/JS/WASM)</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio / Podcast</option>
                    <option value="livestream">Livestream</option>
                    <option value="mixed">Mixed Content</option>
                  </select>
                </div>

                <!-- Web App Upload -->
                <div v-if="contentType === 'webapp'" class="upload-section">
                  <div v-if="isEditMode" class="mb-3">
                    <label class="form-label">Current files / directory</label>
                    <p v-if="existingPathMapEntries.length > 0" class="small text-muted">Path → blob. Upload new files below to <strong>replace</strong> (same path) or <strong>add</strong> paths.</p>
                    <p v-else-if="editBlobIds.length > 0" class="small text-muted">No path map (single-file or legacy). Blob IDs below. Upload files to replace or add.</p>
                    <p v-else class="small text-muted">No file list yet. Add files below.</p>
                    <ul v-if="existingPathMapEntries.length > 0" class="list-group list-group-flush">
                      <li
                        v-for="(blobId, path) in existingPathMap"
                        :key="path"
                        class="list-group-item d-flex justify-content-between align-items-center py-2 small"
                      >
                        <code class="text-break">{{ path }}</code>
                        <code class="text-muted ms-2" style="font-size: 0.75rem;">{{ blobId }}</code>
                      </li>
                    </ul>
                    <ul v-else-if="editBlobIds.length > 0" class="list-group list-group-flush">
                      <li
                        v-for="(blobId, idx) in editBlobIds"
                        :key="idx"
                        class="list-group-item py-2 small"
                      >
                        <code class="text-break">{{ blobId }}</code>
                      </li>
                    </ul>
                  </div>
                  <div class="alert alert-warning mb-3" role="alert">
                    <strong>HTML required.</strong> Web apps must include at least one <code>.html</code> or <code>.htm</code> file as the entry point. The sandbox injects wallet and nav scripts into HTML—images or other non-HTML will not work.
                  </div>
                  <div class="mb-3">
                    <label class="form-label">{{ isEditMode ? 'Add or replace files' : 'Upload Files' }}</label>
                    <div class="d-flex gap-2 flex-wrap align-items-center">
                      <div>
                        <label class="form-label small mb-0">Files</label>
                        <input 
                          ref="fileInput"
                          type="file" 
                          class="form-control form-control-sm"
                          style="max-width: 14rem;"
                          multiple
                          accept=".html,.htm,.js,.wasm,.css,.json,.png,.jpg,.jpeg,.svg,.woff,.woff2,.ttf"
                          @change="handleFileUpload"
                        />
                      </div>
                      <div>
                        <label class="form-label small mb-0">Folder</label>
                        <input 
                          ref="folderInput"
                          type="file"
                          class="form-control form-control-sm"
                          style="max-width: 14rem;"
                          webkitdirectory
                          directory
                          multiple
                          @change="handleFolderUpload"
                        />
                      </div>
                    </div>
                    <small class="text-muted d-block mt-1">
                      Select individual files or <strong>choose a folder</strong> to upload an entire app directory (preserves paths for assets).
                    </small>
                  </div>

                  <div v-if="!hasHtmlInUploadedFiles && uploadedFiles.length > 0" class="alert alert-danger mb-3" role="alert">
                    No HTML file found. Web apps require at least one <code>.html</code> or <code>.htm</code> file.
                  </div>

                  <div v-if="uploadedFiles.length > 0" class="uploaded-files mb-3">
                    <h6>Uploaded Files:</h6>
                    <ul class="list-group">
                      <li 
                        v-for="(file, idx) in uploadedFiles" 
                        :key="idx"
                        class="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <span>
                          <i :class="getFileIcon(file.type)"></i>
                          {{ (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }} ({{ formatFileSize(file.size) }})
                        </span>
                        <button 
                          type="button" 
                          class="btn btn-sm btn-outline-danger"
                          @click="removeFile(idx)"
                        >
                          Remove
                        </button>
                      </li>
                    </ul>
                  </div>

                  <div v-if="htmlEntryPointOptions.length > 0" class="mb-3">
                    <label class="form-label">Entry Point</label>
                    <select
                      v-model="entryPointFileKey"
                      class="form-select"
                      aria-describedby="entry-point-help"
                    >
                      <option value="">Select main HTML file…</option>
                      <option
                        v-for="opt in htmlEntryPointOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </option>
                    </select>
                    <small id="entry-point-help" class="text-muted">Main HTML file (required). The sandbox loads this file first.</small>
                  </div>
                </div>

                <!-- Video Upload -->
                <div v-if="contentType === 'video'" class="upload-section">
                  <div class="mb-3">
                    <label class="form-label">Video File</label>
                    <input 
                      ref="videoInput"
                      type="file" 
                      class="form-control"
                      accept="video/*"
                      @change="handleVideoUpload"
                    />
                  </div>
                  <div v-if="videoFile" class="mb-3">
                    <video 
                      :src="videoPreview" 
                      controls 
                      class="w-100"
                      style="max-height: 400px;"
                    ></video>
                    <p class="mt-2">
                      <strong>{{ videoFile.name }}</strong> 
                      ({{ formatFileSize(videoFile.size) }})
                    </p>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Video URL (Alternative)</label>
                    <input 
                      v-model="formData.manifest.videoUrl" 
                      type="url" 
                      class="form-control"
                      placeholder="https://..."
                    />
                    <small class="text-muted">Or provide a URL to an existing video</small>
                  </div>
                </div>

                <!-- Audio Upload -->
                <div v-if="contentType === 'audio'" class="upload-section">
                  <div class="mb-3">
                    <label class="form-label">Audio File</label>
                    <input 
                      ref="audioInput"
                      type="file" 
                      class="form-control"
                      accept="audio/*"
                      @change="handleAudioUpload"
                    />
                  </div>
                  <div v-if="audioFile" class="mb-3">
                    <audio :src="audioPreview" controls class="w-100"></audio>
                    <p class="mt-2">
                      <strong>{{ audioFile.name }}</strong> 
                      ({{ formatFileSize(audioFile.size) }})
                    </p>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Audio URL (Alternative)</label>
                    <input 
                      v-model="formData.manifest.audioUrl" 
                      type="url" 
                      class="form-control"
                      placeholder="https://..."
                    />
                    <small class="text-muted">Or provide a URL to an existing audio file</small>
                  </div>
                </div>

                <!-- Livestream -->
                <div v-if="contentType === 'livestream'" class="upload-section">
                  <div class="mb-3">
                    <label class="form-label">Stream URL</label>
                    <input 
                      v-model="formData.manifest.streamUrl" 
                      type="url" 
                      class="form-control"
                      placeholder="rtmp://... or https://..."
                      required
                    />
                    <small class="text-muted">RTMP, HLS, or WebRTC stream URL</small>
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Stream Type</label>
                    <select v-model="formData.manifest.streamType" class="form-select">
                      <option value="rtmp">RTMP</option>
                      <option value="hls">HLS</option>
                      <option value="webrtc">WebRTC</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <!-- Mixed Content -->
                <div v-if="contentType === 'mixed'" class="upload-section">
                  <div class="mb-3">
                    <label class="form-label">Upload Multiple Files</label>
                    <input 
                      ref="mixedInput"
                      type="file" 
                      class="form-control"
                      multiple
                      @change="handleMixedUpload"
                    />
                  </div>
                  <div v-if="uploadedFiles.length > 0" class="uploaded-files mb-3">
                    <h6>Uploaded Files:</h6>
                    <ul class="list-group">
                      <li 
                        v-for="(file, idx) in uploadedFiles" 
                        :key="idx"
                        class="list-group-item"
                      >
                        {{ file.name }} ({{ formatFileSize(file.size) }})
                        <button 
                          type="button" 
                          class="btn btn-sm btn-outline-danger float-end"
                          @click="removeFile(idx)"
                        >
                          Remove
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- Metadata & Manifest -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Metadata & Manifest</h5>
              </div>
              <div class="card-body">
                <div class="mb-3">
                  <label class="form-label">App Icon</label>
                  <input 
                    ref="iconInput"
                    type="file" 
                    class="form-control"
                    accept="image/*"
                    @change="handleIconUpload"
                  />
                  <small class="text-muted">Square icon (recommended: 512x512px)<span v-if="isEditMode && iconPreview"> · Current icon below; upload to replace.</span></small>
                  <div v-if="iconPreview" class="mt-2">
                    <img :src="iconPreview" alt="Icon preview" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px;">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Thumbnail</label>
                  <input 
                    ref="thumbnailInput"
                    type="file" 
                    class="form-control"
                    accept="image/*"
                    @change="handleThumbnailUpload"
                  />
                  <small class="text-muted">Preview image (recommended: 1200x630px)<span v-if="isEditMode && thumbnailPreview"> · Current thumbnail below; upload to replace.</span></small>
                  <div v-if="thumbnailPreview" class="mt-2">
                    <img :src="thumbnailPreview" alt="Thumbnail preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                  </div>
                </div>

                <div v-if="isEditMode" class="mb-3">
                  <label class="form-label">Release note (optional)</label>
                  <textarea 
                    v-model="releaseNote" 
                    class="form-control" 
                    rows="2"
                    placeholder="What's new in this version..."
                  />
                  <small class="text-muted">Shown with this version; stored in manifest metadata.</small>
                </div>

                <div class="mb-3">
                  <label class="form-label">License</label>
                  <select
                    v-model="licenseSelection"
                    class="form-select"
                    @change="updateLicense"
                  >
                    <option value="">Select a license (recommended for remixable dApps)</option>
                    <optgroup label="Creative Commons (remixable)">
                      <option value="CC0-1.0">CC0 1.0 — Public Domain</option>
                      <option value="CC-BY-4.0">CC BY 4.0 — Attribution</option>
                      <option value="CC-BY-SA-4.0">CC BY-SA 4.0 — Attribution-ShareAlike</option>
                      <option value="CC-BY-NC-4.0">CC BY-NC 4.0 — Attribution-NonCommercial</option>
                      <option value="CC-BY-NC-SA-4.0">CC BY-NC-SA 4.0 — Attribution-NonCommercial-ShareAlike</option>
                    </optgroup>
                    <optgroup label="Open source">
                      <option value="MIT">MIT</option>
                      <option value="Apache-2.0">Apache 2.0</option>
                    </optgroup>
                    <option value="All Rights Reserved">All Rights Reserved</option>
                  </select>
                  <small class="text-muted">Choose a license that matches how others may use and remix your dApp</small>
                </div>

                <div class="mb-3">
                  <label class="form-label">Additional Metadata (JSON)</label>
                  <textarea 
                    v-model="metadataJson" 
                    class="form-control font-monospace" 
                    rows="6"
                    placeholder="{&quot;author&quot;: &quot;Your Name&quot;, ...}"
                    @input="updateMetadata"
                  ></textarea>
                  <small class="text-muted">Optional: Additional metadata as JSON (license is set above)</small>
                </div>
              </div>
            </div>

            <!-- Posting Fee (auto-calculated) -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Posting Fee</h5>
              </div>
              <div class="card-body">
                <div class="alert alert-info mb-0">
                  <i class="bi bi-info-circle me-1"></i>
                  <strong>{{ minPostingFee.toFixed(4) }} SUI</strong> &mdash;
                  computed as 2 &times; storage cost + {{ govConfig?.votablePostingFeeSui?.toFixed(2) ?? '1.00' }} SUI votable fee.
                  <br>
                  <small class="text-muted">50 % to the Foundation &middot; 50 % buys you a YES vote in the prediction market</small>
                </div>
              </div>
            </div>

            <!-- Preview Card -->
            <div v-if="formData.name || formData.description" class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0"><i class="bi bi-eye me-2"></i>Preview</h5>
              </div>
              <div class="card-body">
                <p class="text-muted small mb-3">This is how your dApp will appear in the Hub:</p>
                <div class="preview-card">
                  <div class="preview-banner">
                    <img
                      v-if="thumbnailPreview"
                      :src="thumbnailPreview"
                      alt="Preview banner"
                    />
                    <div v-else class="preview-banner-placeholder">
                      {{ getPreviewInitials(formData.name) }}
                    </div>
                  </div>
                  <div class="preview-body">
                    <div class="preview-header">
                      <img
                        v-if="iconPreview"
                        :src="iconPreview"
                        alt="Preview icon"
                        class="preview-icon"
                      />
                      <div v-else class="preview-icon-placeholder">
                        {{ getPreviewInitials(formData.name) }}
                      </div>
                    </div>
                    <h3 class="preview-title">{{ formData.name || 'Your dApp Title' }}</h3>
                    <p class="preview-description">{{ formData.description || 'Your dApp description will appear here...' }}</p>
                    <div class="preview-author">
                      <span class="small text-muted">
                        by {{ user?.suinsName?.replace(/\.sui$/, '') || truncateAddr(user?.suiAddress) || 'you' }}
                        <span v-if="formData.permlink"> · {{ formData.permlink }}</span>
                      </span>
                    </div>
                    <div v-if="formData.tags.length > 0" class="preview-tags mt-2">
                      <span
                        v-for="tag in formData.tags"
                        :key="tag"
                        class="badge bg-primary me-1"
                      >{{ tag }}</span>
                    </div>
                    <div class="preview-fee mt-2">
                      <small class="text-muted">
                        <i class="bi bi-coin me-1"></i>
                        Posting fee: {{ effectivePostingFee }} SUI
                        ({{ (effectivePostingFee * 0.5).toFixed(4) }} SUI to PM)
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Submit -->
            <div class="d-flex justify-content-between align-items-center">
              <router-link to="/" class="btn btn-secondary">
                Cancel
              </router-link>
              <button 
                type="submit" 
                class="btn btn-primary btn-lg"
                :disabled="submitting || !canSubmit"
              >
                <span v-if="submitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-upload me-2"></i>
                {{ submitting ? (isEditMode ? 'Updating...' : 'Posting...') : (isEditMode ? 'Update dApp' : 'Post dApp') }}
              </button>
            </div>

            <!-- Upload progress (when submitting and uploading to Walrus) -->
            <div v-if="uploadProgress.phase !== 'idle'" class="alert alert-info mt-3">
              <div class="d-flex align-items-center gap-2 mb-2">
                <div class="spinner-border spinner-border-sm" role="status"></div>
                <span>{{ uploadProgress.label }}</span>
              </div>
              <div class="progress" style="height: 8px;">
                <div
                  class="progress-bar progress-bar-striped progress-bar-animated"
                  role="progressbar"
                  :style="{ width: uploadProgressPercent + '%' }"
                  :aria-valuenow="uploadProgress.current"
                  :aria-valuemin="0"
                  :aria-valuemax="uploadProgress.total"
                ></div>
              </div>
              <small class="text-muted">{{ uploadProgress.current }} of {{ uploadProgress.total }}</small>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="alert alert-danger mt-3">
              <i class="bi bi-exclamation-triangle"></i>
              {{ error }}
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useSuiWallet } from '../composables/useSuiWallet';
import { buildPostDappTransaction, executeSignedTransaction, isOnChainPostingAvailable } from '../composables/useDappPostingOnChain';
import { useGovernanceConfig } from '../composables/useGovernanceConfig';
import axios from 'axios';
import { BRAND_NAME, buildAccountPath, buildDappHost, buildSandboxUrl, getSuiServiceUrl, getWalrusServiceUrl, resolveWalrusUrl, SUI_NETWORK, buildExplorerTxUrl } from '@/config/links';
import type { SUIdApp, DAppManifest } from '@dlux-sui/types';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { signTransactionBlockForExecute } = useSuiWallet();
const { config: govConfig, fetchConfig: fetchGovConfig } = useGovernanceConfig();

// On-chain posting availability
const onChainAvailable = computed(() => isOnChainPostingAvailable());

const initialFormData = (): {
  name: string;
  permlink: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  manifest: DAppManifest;
  blobIds: string[];
} => ({
  name: '',
  permlink: '',
  description: '',
  version: '1.0.0',
  category: '',
  tags: [] as string[],
  manifest: {
    entryPoint: '/index.html',
    assets: [] as string[],
    metadata: {
      title: '',
      description: '',
      author: '',
      version: '1.0.0'
    } as { [key: string]: unknown },
    videoUrl: '',
    audioUrl: '',
    streamUrl: '',
    streamType: 'hls'
  },
  blobIds: [] as string[]
});

/** Edit mode: pre-filled from existing dApp (query edit=dappId). */
const editDappId = ref<string | null>(null);
/** In edit mode, path → blobId from current manifest.pathMap (unchanged files). */
const existingPathMap = ref<Record<string, string>>({});
/** Release note for this version (stored in manifest.metadata.releaseNote). */
const releaseNote = ref('');

const isEditMode = computed(() => !!editDappId.value);
const existingPathMapEntries = computed(() => Object.entries(existingPathMap.value));
/** In edit mode, blob IDs from the loaded dApp (when no pathMap, we still show these). */
const editBlobIds = computed(() => (isEditMode.value ? formData.value.blobIds : []));
const existingPathMapHasHtml = computed(() =>
  Object.keys(existingPathMap.value).some(
    (k) => k.toLowerCase().endsWith('.html') || k.toLowerCase().endsWith('.htm')
  )
);

/** Bump semver patch (e.g. 1.0.0 → 1.0.1). */
function bumpVersionPatch(v: string): string {
  const match = String(v || '1.0.0').match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (match && match[3] !== undefined) {
    const patch = parseInt(match[3], 10) + 1;
    return `${match[1]}.${match[2]}.${patch}${match[4] || ''}`;
  }
  return '1.0.1';
}

function bumpVersion() {
  formData.value.version = bumpVersionPatch(formData.value.version);
}

// Redirect if not authenticated; when edit=id load dApp and pre-fill, otherwise reset form
onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/');
    return;
  }
  const editId = route.query.edit as string | undefined;
  if (editId?.trim()) {
    try {
      const editIdStr = editId.trim();
      const res = await fetch(`${getSuiServiceUrl()}/dapps/${encodeURIComponent(editIdStr)}`);
      if (!res.ok) throw new Error('dApp not found');
      const d = await res.json();
      const owner = String(d.owner || '').toLowerCase();
      const userAddr = String(authStore.user?.suiAddress || '').toLowerCase();
      if (owner !== userAddr) {
        error.value = 'You can only edit your own dApps.';
        editDappId.value = null;
        return;
      }
      editDappId.value = d.id;
      existingPathMap.value = (d.manifest?.pathMap && typeof d.manifest.pathMap === 'object') ? { ...d.manifest.pathMap } : {};
      const meta = (d.manifest?.metadata && typeof d.manifest.metadata === 'object') ? { ...d.manifest.metadata } : {};
      formData.value = {
        name: d.name || '',
        permlink: d.permlink || '',
        description: d.description || '',
        version: bumpVersionPatch(d.version || '1.0.0'),
        category: (d as any).category || meta.category || '',
        tags: Array.isArray(d.tags) ? [...d.tags] : [],
        manifest: {
          entryPoint: d.manifest?.entryPoint ?? '/index.html',
          assets: Array.isArray(d.manifest?.assets) ? [...d.manifest.assets] : [],
          metadata: meta,
          videoUrl: d.manifest?.videoUrl ?? undefined,
          audioUrl: d.manifest?.audioUrl ?? undefined,
          streamUrl: d.manifest?.streamUrl ?? undefined,
          streamType: d.manifest?.streamType ?? 'hls'
        },
        blobIds: Array.isArray(d.blobIds) ? [...d.blobIds] : []
      };
      releaseNote.value = (typeof meta.releaseNote === 'string') ? meta.releaseNote : '';
      tagsInput.value = formData.value.tags.join(', ');
      metadataJson.value = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
      licenseSelection.value = meta.license || '';
      entryPointFileKey.value = '';
      autoPermlink.value = false; // keep permlink fixed in edit mode
      uploadedFiles.value = [];
      videoFile.value = null;
      audioFile.value = null;
      iconFile.value = null;
      thumbnailFile.value = null;
      videoPreview.value = undefined;
      audioPreview.value = undefined;
      // Show current icon/thumbnail from manifest (resolved Walrus URLs)
      const iconUrl = resolveWalrusUrl(meta.icon);
      const thumbUrl = resolveWalrusUrl(meta.thumbnail);
      iconPreview.value = iconUrl !== undefined ? iconUrl : undefined;
      thumbnailPreview.value = thumbUrl !== undefined ? thumbUrl : undefined;
      error.value = '';
      contentType.value = d.manifest?.videoUrl ? 'video' : d.manifest?.audioUrl ? 'audio' : d.manifest?.streamUrl ? 'livestream' : 'webapp';
      return;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load dApp for editing.';
      editDappId.value = null;
      videoPreview.value = undefined;
      audioPreview.value = undefined;
      iconPreview.value = undefined;
      thumbnailPreview.value = undefined;
    }
  }
  formData.value = initialFormData();
  tagsInput.value = '';
  metadataJson.value = '';
  licenseSelection.value = '';
  entryPointFileKey.value = '';
  autoPermlink.value = true;
  uploadedFiles.value = [];
  existingPathMap.value = {};
  editDappId.value = null;
  releaseNote.value = '';
  videoFile.value = null;
  audioFile.value = null;
  iconFile.value = null;
  thumbnailFile.value = null;
  videoPreview.value = undefined;
  audioPreview.value = undefined;
  iconPreview.value = undefined;
  thumbnailPreview.value = undefined;
  error.value = '';
});

const SUI_SERVICE = getSuiServiceUrl();
const WALRUS_SERVICE = getWalrusServiceUrl();

// Form data (reset in onMounted so /post always shows current user, no stale permlink/address)
const formData = ref(initialFormData());

const tagsInput = ref('');
const metadataJson = ref('');
const licenseSelection = ref('');
const autoPermlink = ref(true);
const contentType = ref('webapp');
/** storageCost is set when blobs are uploaded; used to compute minPostingFee dynamically. */
const storageCostSui = ref(0);
const minPostingFee = computed(() => {
  const votableFee = govConfig.value?.votablePostingFeeSui ?? 1.0;
  // Contract: min = 2 × storage_cost + votable_posting_fee
  return storageCostSui.value > 0
    ? 2 * storageCostSui.value + votableFee
    : votableFee;
});

// File uploads
const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const videoInput = ref<HTMLInputElement | null>(null);
const audioInput = ref<HTMLInputElement | null>(null);
const iconInput = ref<HTMLInputElement | null>(null);
const thumbnailInput = ref<HTMLInputElement | null>(null);
const mixedInput = ref<HTMLInputElement | null>(null);

const uploadedFiles = ref<File[]>([]);
const videoFile = ref<File | null>(null);
const audioFile = ref<File | null>(null);
const iconFile = ref<File | null>(null);
const thumbnailFile = ref<File | null>(null);

const videoPreview = ref<string | undefined>(undefined);
const audioPreview = ref<string | undefined>(undefined);
const iconPreview = ref<string | undefined>(undefined);
const thumbnailPreview = ref<string | undefined>(undefined);

const submitting = ref(false);
const error = ref('');

/** Upload progress for Walrus uploads + manifest. */
const uploadProgress = ref<{ phase: 'idle' | 'files' | 'manifest' | 'posting'; current: number; total: number; label: string }>({
  phase: 'idle',
  current: 0,
  total: 0,
  label: ''
});
const uploadProgressPercent = computed(() => {
  const p = uploadProgress.value;
  if (p.total <= 0) return 0;
  return Math.round((p.current / p.total) * 100);
});

const user = computed(() => authStore.user);
const hasSuinsName = computed(() => !!user.value?.suinsName);
const brandName = BRAND_NAME;

// Subdomain: prefer SuiNS name (e.g. disregardfiat.walrus.dlux.io) over hex-based h<hex>
const defaultSubdomainPreview = computed(() => {
  const suins = user.value?.suinsName?.replace(/\.sui$/, '');
  if (suins) return suins;
  const hex = user.value?.suiAddress?.replace(/^0x/, '').toLowerCase().slice(0, 62);
  return hex ? `h${hex}` : 'h…';
});
const defaultDappHostPreview = computed(() => buildDappHost(defaultSubdomainPreview.value || ''));

const permlinkPreview = computed(() => {
  const suins = user.value?.suinsName?.replace(/\.sui$/, '');
  const owner = suins || user.value?.suiAddress || '';
  const permlink = formData.value.permlink || 'your-permlink';
  const subdomain = defaultSubdomainPreview.value;
  if (!owner) return `${defaultDappHostPreview.value}/@your-address/${permlink}`;
  return buildSandboxUrl(owner, permlink, subdomain).replace(/^https?:\/\//, '');
});

const effectivePostingFee = computed(() => minPostingFee.value);

function getPreviewInitials(value: string): string {
  if (!value) return 'DL';
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p.charAt(0).toUpperCase()).join('') || 'DL';
}

function truncateAddr(addr: string | undefined): string {
  if (!addr) return '';
  if (addr.length > 10) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  return addr;
}

/** True if uploaded webapp files include at least one .html/.htm file. */
const hasHtmlInUploadedFiles = computed(() =>
  contentType.value !== 'webapp' ||
  uploadedFiles.value.some(
    (f) => f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm')
  )
);

/** For webapp: list of HTML files to choose as entry point (path = value for pathToBlob at submit). */
const htmlEntryPointOptions = computed(() => {
  if (contentType.value !== 'webapp' || !uploadedFiles.value.length) return [];
  return uploadedFiles.value
    .filter((f) => f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm'))
    .map((f) => {
      const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      return { value: path, label: path };
    });
});

/** Selected entry point file path (resolved to blobId at submit via pathToBlob). */
const entryPointFileKey = ref<string | undefined>('');

// Auto-select entry point when there is exactly one HTML file
watch(htmlEntryPointOptions, (opts) => {
  if (opts.length === 1 && !entryPointFileKey.value) entryPointFileKey.value = opts[0]?.value ?? '';
  if (opts.length === 0) entryPointFileKey.value = '';
  const values = new Set(opts.map((o) => o.value));
  if (entryPointFileKey.value && !values.has(entryPointFileKey.value)) entryPointFileKey.value = opts[0]?.value ?? '';
}, { immediate: true });

const canSubmit = computed(() => {
  const hasContent =
    uploadedFiles.value.length > 0 ||
    videoFile.value ||
    audioFile.value ||
    formData.value.manifest.streamUrl ||
    formData.value.manifest.videoUrl ||
    formData.value.manifest.audioUrl ||
    (isEditMode.value && existingPathMapEntries.value.length > 0);
  const webappOk =
    contentType.value !== 'webapp' || (hasContent && (hasHtmlInUploadedFiles.value || (isEditMode.value && existingPathMapHasHtml.value)));
  return formData.value.name && formData.value.description && hasContent && webappOk;
});

function updatePermlink() {
  if (autoPermlink.value) {
    formData.value.permlink = formData.value.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

function updateTags() {
  formData.value.tags = tagsInput.value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

function removeTag(index: number) {
  formData.value.tags.splice(index, 1);
  tagsInput.value = formData.value.tags.join(', ');
}

function updateMetadata() {
  try {
    if (metadataJson.value.trim()) {
      const parsed = JSON.parse(metadataJson.value);
      formData.value.manifest.metadata = { ...parsed };
      if (parsed.license) licenseSelection.value = String(parsed.license);
    } else {
      formData.value.manifest.metadata = {};
    }
    if (licenseSelection.value) {
      formData.value.manifest.metadata.license = licenseSelection.value;
    }
  } catch (e) {
    // Invalid JSON, ignore for now
  }
}

function updateLicense() {
  if (!formData.value.manifest.metadata) formData.value.manifest.metadata = {};
  formData.value.manifest.metadata.license = licenseSelection.value || undefined;
}

function resetUploads() {
  uploadedFiles.value = [];
  videoFile.value = null;
  audioFile.value = null;
  videoPreview.value = undefined;
  audioPreview.value = undefined;
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    uploadedFiles.value = Array.from(input.files);
  }
  (folderInput.value as HTMLInputElement | null)?.setAttribute('value', '');
}

function handleFolderUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    uploadedFiles.value = Array.from(input.files);
  }
  (fileInput.value as HTMLInputElement | null)?.setAttribute('value', '');
}

function handleVideoUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    videoFile.value = input.files[0];
    videoPreview.value = URL.createObjectURL(input.files[0]);
  }
}

function handleAudioUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    audioFile.value = input.files[0];
    audioPreview.value = URL.createObjectURL(input.files[0]);
  }
}

function handleIconUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    iconFile.value = input.files[0];
    iconPreview.value = URL.createObjectURL(input.files[0]);
  }
}

function handleThumbnailUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    thumbnailFile.value = input.files[0];
    thumbnailPreview.value = URL.createObjectURL(input.files[0]);
  }
}

function handleMixedUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    uploadedFiles.value.push(...Array.from(input.files));
  }
}

function removeFile(index: number) {
  uploadedFiles.value.splice(index, 1);
}

function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return 'bi bi-file-image';
  if (type.startsWith('video/')) return 'bi bi-file-play';
  if (type.startsWith('audio/')) return 'bi bi-file-music';
  if (type.includes('javascript')) return 'bi bi-file-code';
  if (type.includes('html')) return 'bi bi-file-earmark-code';
  if (type.includes('css')) return 'bi bi-file-earmark-code';
  return 'bi bi-file';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function uploadToWalrus(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${WALRUS_SERVICE}/blobs/upload`, formData);

  return response.data.blobId;
}

/** Max concurrent Walrus uploads to avoid overwhelming the server. */
const WALRUS_UPLOAD_CONCURRENCY = 6;

/**
 * Run async tasks with a concurrency limit, preserving result order.
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onItemComplete?: (index: number, completed: number, total: number) => void
): Promise<R[]> {
  const results: (R | undefined)[] = new Array(items.length);
  let nextIndex = 0;
  let completedCount = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      const item = items[i];
      if (item === undefined) continue;
      const result = await fn(item, i);
      results[i] = result;
      completedCount++;
      onItemComplete?.(i, completedCount, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results as R[];
}

async function submitDApp() {
  if (!authStore.user) {
    error.value = 'You must be logged in to post a dApp';
    return;
  }

  submitting.value = true;
  error.value = '';

  const totalUploadSteps =
    uploadedFiles.value.length +
    (videoFile.value ? 1 : 0) +
    (audioFile.value ? 1 : 0) +
    (iconFile.value ? 1 : 0) +
    (thumbnailFile.value ? 1 : 0) +
    1; // manifest blob
  let uploadStep = 0;

  const setProgress = (phase: 'files' | 'manifest' | 'posting', label: string) => {
    uploadProgress.value = { phase, current: uploadStep, total: totalUploadSteps, label };
  };

  try {
    uploadProgress.value = { phase: 'files', current: 0, total: totalUploadSteps, label: 'Preparing uploads...' };

    // Persist release note into manifest metadata when provided
    if (releaseNote.value.trim()) {
      if (!formData.value.manifest.metadata) formData.value.manifest.metadata = {};
      formData.value.manifest.metadata.releaseNote = releaseNote.value.trim();
    }

    // Ensure manifest fields are initialized
    if (!formData.value.manifest.videoUrl) formData.value.manifest.videoUrl = undefined;
    if (!formData.value.manifest.audioUrl) formData.value.manifest.audioUrl = undefined;
    if (!formData.value.manifest.streamUrl) formData.value.manifest.streamUrl = undefined;
    if (!formData.value.manifest.streamType) formData.value.manifest.streamType = 'hls';

    // Upload all files to Walrus
    const blobIds: string[] = [];

    // Start with existing pathMap in edit mode so we can delta-update (replace/add only new uploads)
    const pathToBlob: Record<string, string> = isEditMode.value ? { ...existingPathMap.value } : {};
    let firstHtmlBlobId: string | null = null;
    let firstHtmlPath: string | null = null;

    // Upload web app files in parallel (concurrency-limited for server stability)
    const fileResults = await runWithConcurrencyLimit<File, string>(
      uploadedFiles.value,
      WALRUS_UPLOAD_CONCURRENCY,
      (file) => uploadToWalrus(file),
      (_idx, completed, total) => {
        uploadStep = completed;
        setProgress('files', `Uploading files (${completed} of ${total})…`);
      }
    );

    for (let i = 0; i < uploadedFiles.value.length; i++) {
      const file = uploadedFiles.value[i];
      if (!file) continue;
      const blobId = fileResults[i] as string | undefined;
      if (!blobId) continue;
      blobIds.push(blobId);
      formData.value.manifest.assets.push(`/walrus/${blobId}`);
      const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const key = relPath.replace(/^\.?\//, '');
      if (!firstHtmlBlobId && (file.type?.includes('text/html') || file.name.toLowerCase().endsWith('.html'))) {
        firstHtmlBlobId = blobId;
        firstHtmlPath = relPath;
      }
      if (key) pathToBlob[key] = blobId;
    }
    uploadStep = uploadedFiles.value.length;

    // In edit mode with no new uploads, use existing pathMap keys and pick first HTML blob from it for entry point
    if (isEditMode.value && Object.keys(pathToBlob).length > 0 && !firstHtmlBlobId) {
      const htmlKey = Object.keys(pathToBlob).find((k) => k.toLowerCase().endsWith('.html') || k.toLowerCase().endsWith('.htm'));
      if (htmlKey) {
        firstHtmlBlobId = pathToBlob[htmlKey] ?? null;
        firstHtmlPath = htmlKey;
      }
    }

    // Build final blobIds list: unique from pathToBlob (all paths) plus we'll add media below
    const pathBlobIds = [...new Set(Object.values(pathToBlob))];
    blobIds.length = 0;
    blobIds.push(...pathBlobIds);

    // Resolve entry point: user-selected file path → blobId, or first HTML blob, or existing manifest, or first blob
    const selectedBlobId: string | undefined = entryPointFileKey.value && pathToBlob[entryPointFileKey.value]
      ? pathToBlob[entryPointFileKey.value]
      : undefined;
    if (selectedBlobId) {
      formData.value.manifest.entryPoint = selectedBlobId;
    } else if (firstHtmlBlobId) {
      formData.value.manifest.entryPoint = firstHtmlBlobId;
    } else if (typeof formData.value.manifest.entryPoint === 'string' && pathBlobIds.includes(formData.value.manifest.entryPoint)) {
      // Keep existing entry point when in edit mode and no new HTML uploaded
    } else if (blobIds.length > 0 && blobIds[0]) {
      formData.value.manifest.entryPoint = blobIds[0];
    }

    // Build pathMap so sandbox can resolve paths (index.html, js/app.js, dir/file) to blobIds
    if (Object.keys(pathToBlob).length > 0) {
      const pathMap: Record<string, string> = {};
      for (const [fullPath, bid] of Object.entries(pathToBlob)) {
        const key = fullPath.replace(/^\.?\//, '');
        if (key) pathMap[key] = bid;
      }
      if (Object.keys(pathMap).length > 0) {
        (formData.value.manifest as Record<string, unknown>).pathMap = pathMap;
      }
    }

    // Upload video, audio, icon, thumbnail in parallel (independent assets; order preserved)
    if (videoFile.value || audioFile.value || iconFile.value || thumbnailFile.value) {
      setProgress('files', 'Uploading video, icon, thumbnail…');
    }
    const [videoBlobId, audioBlobId, iconBlobId, thumbnailBlobId] = await Promise.all([
      videoFile.value ? uploadToWalrus(videoFile.value) : Promise.resolve(null),
      audioFile.value ? uploadToWalrus(audioFile.value) : Promise.resolve(null),
      iconFile.value ? uploadToWalrus(iconFile.value) : Promise.resolve(null),
      thumbnailFile.value ? uploadToWalrus(thumbnailFile.value) : Promise.resolve(null)
    ]);
      if (videoBlobId) {
        blobIds.push(videoBlobId);
        formData.value.manifest.videoUrl = `/walrus/${videoBlobId}`;
        uploadStep++;
      }
      if (audioBlobId) {
        blobIds.push(audioBlobId);
        formData.value.manifest.audioUrl = `/walrus/${audioBlobId}`;
        uploadStep++;
      }
      if (iconBlobId) {
        blobIds.push(iconBlobId);
        formData.value.manifest.metadata.icon = `/walrus/${iconBlobId}`;
        uploadStep++;
      }
      if (thumbnailBlobId) {
        blobIds.push(thumbnailBlobId);
        formData.value.manifest.metadata.thumbnail = `/walrus/${thumbnailBlobId}`;
        uploadStep++;
      }

    // Upload manifest to Walrus (avoids on-chain tx size limit; no limit on file count)
    setProgress('manifest', 'Storing manifest…');
    const manifestBlob = new File(
      [JSON.stringify(formData.value.manifest)],
      'manifest.json',
      { type: 'application/json' }
    );
    const manifestBlobId = await uploadToWalrus(manifestBlob);
    uploadStep++;
    const manifestForChain = `walrus:${manifestBlobId}`;

    // Set blob IDs
    formData.value.blobIds = blobIds;

    // Validate: Web apps require at least one HTML file
    if (contentType.value === 'webapp' && !firstHtmlBlobId) {
      throw new Error('Web apps require at least one .html or .htm file. Upload an HTML file as the entry point.');
    }

    // Validate: dApps require at least one valid Walrus blob for the entry point
    if (blobIds.length === 0) {
      throw new Error('dApps require at least one valid Walrus blob. Upload your content (HTML, video, or audio) first.');
    }
    const entryBlobId = typeof formData.value.manifest.entryPoint === 'string' && /^[a-zA-Z0-9_-]+$/.test(formData.value.manifest.entryPoint.trim())
      ? formData.value.manifest.entryPoint.trim()
      : blobIds[0] ?? '';
    if (!blobIds.includes(entryBlobId)) {
      throw new Error('Entry point must reference a valid Walrus blob. Ensure your manifest entryPoint is set correctly.');
    }

    // Fetch governance config + storage cost → dynamic min fee
    // Contract: minFee = 2 × storage_cost + votable_posting_fee
    const govCfg = govConfig.value ?? await fetchGovConfig();
    const votableFeeSui = govCfg?.votablePostingFeeSui ?? 1.0;
    let computedMinFee = votableFeeSui;
    try {
      const batchRes = await axios.post(`${WALRUS_SERVICE}/blobs/billing/batch`, { blobIds }, { validateStatus: () => true });
      if (batchRes.status === 200 && batchRes.data?.storageCost != null) {
        const scSui = Number(batchRes.data.storageCost);
        storageCostSui.value = scSui;
        computedMinFee = 2 * scSui + votableFeeSui;
      } else if (batchRes.status === 200 && batchRes.data?.minPostingFee != null) {
        // Fallback: use Walrus-reported min (legacy path)
        computedMinFee = Number(batchRes.data.minPostingFee);
      }
    } catch { /* use default votable fee */ }
    const finalPostingFee = computedMinFee;

    // Post on-chain when available, otherwise fall back to API
    setProgress('posting', onChainAvailable.value ? 'Posting on-chain…' : 'Posting…');
    if (onChainAvailable.value) {
      await submitOnChain(blobIds, finalPostingFee, manifestForChain);
    } else {
      await submitViaAPI(blobIds, finalPostingFee, manifestForChain);
    }

  } catch (err: any) {
    console.error('Error posting dApp:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to post dApp';
  } finally {
    submitting.value = false;
    uploadProgress.value = { phase: 'idle', current: 0, total: 0, label: '' };
  }
}

/** On-chain path: build transaction → wallet signs → SUI chain → indexer picks up event. */
async function submitOnChain(blobIds: string[], finalPostingFee: number, manifestForChain: string) {
  const sender = authStore.user!.suiAddress;
  if (!sender) {
    throw new Error('Wallet address not found. Connect your wallet first.');
  }

  // Fetch blob sizes from Walrus service (for on-chain storage cost calculation)
  const blobSizes: number[] = [];
  try {
    for (const blobId of blobIds) {
      try {
        const blobRes = await axios.get(`${WALRUS_SERVICE}/blobs/${encodeURIComponent(blobId)}/info`, { validateStatus: () => true });
        if (blobRes.status === 200 && blobRes.data?.size != null) {
          blobSizes.push(Number(blobRes.data.size));
        } else {
          throw new Error(`Could not retrieve size for blob ${blobId}`);
        }
      } catch (err) {
        throw new Error(`Failed to get blob size for ${blobId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    throw new Error(`Failed to retrieve blob sizes: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (blobSizes.length !== blobIds.length) {
    throw new Error(`Mismatch: expected ${blobIds.length} blob sizes, got ${blobSizes.length}`);
  }

  // Build the on-chain transaction (manifestForChain is "walrus:blobId" so tx size stays small)
  const transaction = await buildPostDappTransaction({
    sender,
    name: formData.value.name,
    description: formData.value.description,
    permlink: formData.value.permlink,
    version: formData.value.version,
    manifest: manifestForChain,
    blobIds,
    blobSizes,
    tags: formData.value.tags,
    category: formData.value.category || '',
    postingFeeSui: finalPostingFee
  });

  // Sign via wallet, then execute via our RPC (avoids wallet's Enoki fetch which can fail after tx lands)
  const { transactionBlockBytes, signature } = await signTransactionBlockForExecute(transaction);
  const { digest } = await executeSignedTransaction(transactionBlockBytes, signature);

  console.log('dApp posted on-chain:', digest);
  console.log('Explorer:', buildExplorerTxUrl(digest));

  // Redirect to author profile after a short delay so the indexer can pick up the new dApp
  const authorId = authStore.user?.suinsName || authStore.user?.suiAddress || '';
  const targetPath = authorId ? buildAccountPath(authorId) : '/dapps';
  const query = { posted: '1', onchain: '1', tx: digest, permlink: formData.value.permlink };
  setTimeout(() => {
    router.push({ path: targetPath, query });
  }, 1800);
}

/** API path: POST to sui-service - automatically builds transaction if needed. */
async function submitViaAPI(blobIds: string[], finalPostingFee: number, manifestForChain: string) {
  const payload: Record<string, unknown> = {
    name: formData.value.name,
    description: formData.value.description,
    owner: authStore.user!.suiAddress,
    version: formData.value.version,
    manifest: manifestForChain,
    blobIds: formData.value.blobIds,
    tags: formData.value.tags,
    permlink: formData.value.permlink,
    category: formData.value.category,
    postingFee: finalPostingFee
  };
  if (editDappId.value) payload.existingId = editDappId.value;

  const response = await axios.post(`${SUI_SERVICE}/dapps`, payload, {
    headers: {
      'Authorization': `Bearer ${authStore.token}`
    }
  }).catch((error) => {
    // If transaction build failed, throw a clear error
    if (error.response?.status === 500) {
      const errorMsg = error.response?.data?.error || 'Failed to build transaction';
      throw new Error(`Transaction build failed: ${errorMsg}. Please try again or contact support.`);
    }
    throw error;
  });

  // If API returns transaction bytes, sign and execute it automatically
  if (response.data.requiresOnChainPosting && response.data.txBytes) {
    const { executeSignedTransaction } = await import('../composables/useDappPostingOnChain');
    const { signTransactionBlock } = useSuiWallet();
    
    // Decode base64 transaction bytes to Uint8Array
    const txBytes = Uint8Array.from(Buffer.from(response.data.txBytes, 'base64'));
    
    // Sign the transaction bytes
    const signature = await signTransactionBlock(txBytes);
    
    // Execute the signed transaction (txBytes as base64, signature as string)
    const { digest } = await executeSignedTransaction(
      response.data.txBytes, // Already base64
      signature
    );
    
    console.log('dApp posted on-chain:', digest);
    console.log('Explorer:', buildExplorerTxUrl(digest));
    
    const authorId = authStore.user?.suinsName || authStore.user?.suiAddress || '';
    const targetPath = authorId ? buildAccountPath(authorId) : '/dapps';
    const query = { posted: '1', onchain: '1', tx: digest, permlink: formData.value.permlink };
    setTimeout(() => {
      router.push({ path: targetPath, query });
    }, 1800);
    return;
  }

  // Legacy API response (shouldn't happen for new dApps)
  const dapp = response.data;
  const authorId = authStore.user?.suinsName || authStore.user?.suiAddress || '';
  const targetPath = authorId ? buildAccountPath(authorId) : '/dapps';
  setTimeout(() => {
    router.push({ path: targetPath, query: { posted: '1', dappId: dapp?.id || '' } });
  }, 1200);
}
</script>

<style scoped>
.post-dapp-page {
  min-height: 100vh;
  background: var(--bg-secondary);
}

.page-header {
  text-align: center;
}

.required::after {
  content: ' *';
  color: red;
}

.permlink-preview {
  background: var(--bg-card);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-primary);
}

.upload-section {
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.uploaded-files {
  max-height: 300px;
  overflow-y: auto;
}

.card {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-label {
  font-weight: 500;
}

/* Preview Card Styles */
.preview-card {
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-card);
  max-width: 320px;
  margin: 0 auto;
  box-shadow: var(--shadow-card);
}

.preview-banner {
  height: 120px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.25), rgba(118, 75, 162, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-banner-placeholder {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  opacity: 0.9;
}

.preview-body {
  padding: 1rem;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.preview-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
}

.preview-icon-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--accent-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
}

.preview-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
}

.preview-description {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 2;
}

.preview-author {
  margin-top: 0.5rem;
}

.preview-tags .badge {
  font-size: 0.7rem;
}

.preview-fee {
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-primary);
}
</style>

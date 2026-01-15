<template>
  <div class="post-dapp-page">
    <div class="container py-4">
      <div class="row">
        <div class="col-lg-8 mx-auto">
          <!-- Header -->
          <div class="page-header mb-4">
            <h1 class="display-5">Post a dApp</h1>
            <p class="text-muted">
              Share your decentralized application, content, or media with the DLUX-SUI community
            </p>
          </div>

          <!-- Vanity Address Notice -->
          <div v-if="!hasVanityAddress" class="alert alert-info">
            <i class="bi bi-info-circle"></i>
            <strong>Get a vanity address!</strong> Your dApp will be accessible at 
            <code>{{ user?.suiAddress?.substring(0, 8) }}...walrus.dlux.io/your-permlink</code>
            <router-link 
              :to="`/@${user?.suiAddress || 'account'}`" 
              class="alert-link ms-2"
            >
              Get a vanity address for a cleaner URL
            </router-link>
          </div>

          <!-- Permlink Preview -->
          <div v-if="hasVanityAddress || user" class="permlink-preview mb-4">
            <label class="form-label">Your dApp URL</label>
            <div class="input-group">
              <span class="input-group-text">https://</span>
              <input 
                type="text" 
                class="form-control" 
                :value="permlinkPreview"
                readonly
                style="background: #f5f5f5;"
              />
            </div>
            <small class="text-muted">
              The permlink will be generated from your title (or you can customize it)
            </small>
          </div>

          <!-- Post Form -->
          <form @submit.prevent="submitDApp" class="dapp-form">
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
                    pattern="[a-z0-9-]+"
                    :disabled="autoPermlink"
                  />
                  <div class="form-check mt-2">
                    <input 
                      v-model="autoPermlink" 
                      class="form-check-input" 
                      type="checkbox" 
                      id="autoPermlink"
                    />
                    <label class="form-check-label" for="autoPermlink">
                      Auto-generate from title
                    </label>
                  </div>
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
                    <input 
                      v-model="formData.version" 
                      type="text" 
                      class="form-control"
                      placeholder="1.0.0"
                      value="1.0.0"
                    />
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
                  <div class="mb-3">
                    <label class="form-label">Upload Files</label>
                    <input 
                      ref="fileInput"
                      type="file" 
                      class="form-control"
                      multiple
                      accept=".html,.htm,.js,.wasm,.css,.json,.png,.jpg,.jpeg,.svg,.woff,.woff2,.ttf"
                      @change="handleFileUpload"
                    />
                    <small class="text-muted">
                      Upload HTML, JavaScript, WASM, CSS, images, fonts, and other assets
                    </small>
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
                          {{ file.name }} ({{ formatFileSize(file.size) }})
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

                  <div class="mb-3">
                    <label class="form-label">Entry Point</label>
                    <input 
                      v-model="formData.manifest.entryPoint" 
                      type="text" 
                      class="form-control"
                      placeholder="/index.html"
                      value="/index.html"
                    />
                    <small class="text-muted">The main HTML file that loads your app</small>
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
                  <small class="text-muted">Square icon (recommended: 512x512px)</small>
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
                  <small class="text-muted">Preview image (recommended: 1200x630px)</small>
                  <div v-if="thumbnailPreview" class="mt-2">
                    <img :src="thumbnailPreview" alt="Thumbnail preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label">Additional Metadata (JSON)</label>
                  <textarea 
                    v-model="metadataJson" 
                    class="form-control font-monospace" 
                    rows="6"
                    placeholder='{"author": "Your Name", "license": "MIT", ...}'
                    @input="updateMetadata"
                  ></textarea>
                  <small class="text-muted">Optional: Additional metadata as JSON</small>
                </div>
              </div>
            </div>

            <!-- Posting Fee -->
            <div class="card mb-4">
              <div class="card-header">
                <h5 class="mb-0">Posting Fee</h5>
              </div>
              <div class="card-body">
                <div class="alert alert-info">
                  <i class="bi bi-info-circle"></i>
                  <strong>Posting Fee:</strong> {{ postingFee }} SUI
                  <br>
                  <small>50% of this fee ({{ postingFee * 0.5 }} SUI) will go to a prediction market for safety review</small>
                </div>
                <div class="mb-3">
                  <label class="form-label">Custom Posting Fee (Optional)</label>
                  <input 
                    v-model.number="customPostingFee" 
                    type="number" 
                    class="form-control"
                    :min="minPostingFee"
                    step="0.1"
                    placeholder="Leave empty for default"
                  />
                  <small class="text-muted">Minimum: {{ minPostingFee }} SUI</small>
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
                {{ submitting ? 'Posting...' : 'Post dApp' }}
              </button>
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import axios from 'axios';
import type { SUIdApp, DAppManifest } from '@dlux-sui/types';

const router = useRouter();
const authStore = useAuthStore();

// Redirect if not authenticated
onMounted(() => {
  if (!authStore.isAuthenticated) {
    router.push('/');
  }
});

const SUI_SERVICE = import.meta.env.VITE_SUI_SERVICE_URL || 'http://localhost:3001';
const WALRUS_SERVICE = import.meta.env.VITE_WALRUS_SERVICE_URL || 'http://localhost:3002';

// Form data
const formData = ref({
  name: '',
  permlink: '',
  description: '',
  version: '1.0.0',
  category: '',
  tags: [] as string[],
  manifest: {
    entryPoint: '/index.html',
    assets: [] as string[],
    metadata: {} as Record<string, any>,
    videoUrl: '',
    audioUrl: '',
    streamUrl: '',
    streamType: 'hls'
  } as DAppManifest,
  blobIds: [] as string[]
});

const tagsInput = ref('');
const metadataJson = ref('');
const autoPermlink = ref(true);
const contentType = ref('webapp');
const postingFee = ref(10); // Default posting fee in SUI
const customPostingFee = ref<number | null>(null);
const minPostingFee = 1;

// File uploads
const fileInput = ref<HTMLInputElement | null>(null);
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

const videoPreview = ref<string | null>(null);
const audioPreview = ref<string | null>(null);
const iconPreview = ref<string | null>(null);
const thumbnailPreview = ref<string | null>(null);

const submitting = ref(false);
const error = ref('');

const user = computed(() => authStore.user);
const hasVanityAddress = computed(() => !!user.value?.vanityAddress);

const permlinkPreview = computed(() => {
  if (!user.value) return 'your-vanity.walrus.dlux.io/your-permlink';
  const vanity = user.value.vanityAddress || user.value.suiAddress.substring(0, 8);
  const permlink = formData.value.permlink || 'your-permlink';
  return `${vanity}.walrus.dlux.io/${permlink}`;
});

const canSubmit = computed(() => {
  return formData.value.name && 
         formData.value.description && 
         (uploadedFiles.value.length > 0 || 
          videoFile.value || 
          audioFile.value || 
          formData.value.manifest.streamUrl ||
          formData.value.manifest.videoUrl ||
          formData.value.manifest.audioUrl);
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
      formData.value.manifest.metadata = JSON.parse(metadataJson.value);
    } else {
      formData.value.manifest.metadata = {};
    }
  } catch (e) {
    // Invalid JSON, ignore for now
  }
}

function resetUploads() {
  uploadedFiles.value = [];
  videoFile.value = null;
  audioFile.value = null;
  videoPreview.value = null;
  audioPreview.value = null;
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) {
    uploadedFiles.value.push(...Array.from(input.files));
  }
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
  
  const response = await axios.post(`${WALRUS_SERVICE}/blobs/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data.blobId;
}

async function submitDApp() {
  if (!authStore.user) {
    error.value = 'You must be logged in to post a dApp';
    return;
  }

  submitting.value = true;
  error.value = '';

  try {
    // Upload all files to Walrus
    const blobIds: string[] = [];

    // Upload web app files
    for (const file of uploadedFiles.value) {
      const blobId = await uploadToWalrus(file);
      blobIds.push(blobId);
      formData.value.manifest.assets.push(`/walrus/${blobId}`);
    }

    // Upload video
    if (videoFile.value) {
      const blobId = await uploadToWalrus(videoFile.value);
      blobIds.push(blobId);
      formData.value.manifest.videoUrl = `/walrus/${blobId}`;
    }

    // Upload audio
    if (audioFile.value) {
      const blobId = await uploadToWalrus(audioFile.value);
      blobIds.push(blobId);
      formData.value.manifest.audioUrl = `/walrus/${blobId}`;
    }

    // Upload icon
    if (iconFile.value) {
      const blobId = await uploadToWalrus(iconFile.value);
      blobIds.push(blobId);
      formData.value.manifest.metadata.icon = `/walrus/${blobId}`;
    }

    // Upload thumbnail
    if (thumbnailFile.value) {
      const blobId = await uploadToWalrus(thumbnailFile.value);
      blobIds.push(blobId);
      formData.value.manifest.metadata.thumbnail = `/walrus/${blobId}`;
    }

    // Set blob IDs
    formData.value.blobIds = blobIds;

    // Calculate posting fee
    const finalPostingFee = customPostingFee.value && customPostingFee.value >= minPostingFee
      ? customPostingFee.value
      : postingFee.value;

    // Submit to SUI service
    const response = await axios.post(`${SUI_SERVICE}/dapps`, {
      name: formData.value.name,
      description: formData.value.description,
      owner: authStore.user.suiAddress,
      version: formData.value.version,
      manifest: formData.value.manifest,
      blobIds: formData.value.blobIds,
      tags: formData.value.tags,
      permlink: formData.value.permlink,
      category: formData.value.category,
      postingFee: finalPostingFee
    }, {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    });

    // Redirect to account page or dApp page
    const dapp = response.data;
    router.push(`/@${authStore.user.vanityAddress || authStore.user.suiAddress}`);

  } catch (err: any) {
    console.error('Error posting dApp:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to post dApp';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.post-dapp-page {
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  text-align: center;
}

.required::after {
  content: ' *';
  color: red;
}

.permlink-preview {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.upload-section {
  padding: 1rem;
  background: #f8f9fa;
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
</style>

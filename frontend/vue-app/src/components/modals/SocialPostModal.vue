<template>
  <BaseModal
    :show="show"
    title="New post"
    size="md"
    primary-label="Post"
    :primary-disabled="!content.trim() || posting || props.loading"
    :primary-loading="posting || props.loading"
    @close="$emit('close')"
    @primary="submitPost"
  >
    <div class="social-post-modal-body">
      <textarea
        v-model="content"
        class="form-control"
        rows="4"
        placeholder="What are you shipping? Supports #hashtags and @mentions"
        :disabled="posting"
      />
      <p class="text-muted small mt-2 mb-0">
        Your post will be signed with your wallet and appear in the feed.
      </p>
      <p v-if="postError || props.error" class="text-danger small mb-0 mt-2">{{ postError || props.error }}</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import BaseModal from '@/components/BaseModal.vue';

const props = withDefaults(
  defineProps<{
    show: boolean;
    loading?: boolean;
    error?: string;
  }>(),
  { loading: false, error: '' }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'post', payload: { content: string }): void;
}>();

const content = ref('');
const posting = ref(false);
const postError = ref('');

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      content.value = '';
      postError.value = '';
    }
  }
);

async function submitPost() {
  const text = content.value.trim();
  if (!text || posting.value) return;
  posting.value = true;
  postError.value = '';
  try {
    emit('post', { content: text });
    // Parent closes modal on success; if parent sets error, we show it here
  } catch (e: any) {
    postError.value = e?.message || 'Failed to post';
  } finally {
    posting.value = false;
  }
}
</script>

<style scoped>
.social-post-modal-body {
  min-width: 360px;
}
</style>

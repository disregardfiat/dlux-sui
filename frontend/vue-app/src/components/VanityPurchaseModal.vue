<template>
  <div v-if="show" class="modal show d-block" @click.self="$emit('close')">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Purchase Vanity Address</h5>
          <button type="button" class="btn-close" @click="$emit('close')"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label class="form-label">Vanity Address</label>
            <div class="input-group">
              <span class="input-group-text">@</span>
              <input 
                v-model="vanityInput" 
                type="text" 
                class="form-control"
                placeholder="yourname"
                :class="{ 'is-invalid': !isValid && vanityInput.length > 0 }"
                @input="checkAvailability"
              />
            </div>
            <div v-if="vanityInput.length > 0" class="form-text">
              <span v-if="checking" class="text-muted">Checking availability...</span>
              <span v-else-if="isValid && available" class="text-success">
                ✓ Available
              </span>
              <span v-else-if="isValid && !available" class="text-danger">
                ✗ Not available
              </span>
              <span v-else class="text-danger">
                Invalid format (3-20 chars, alphanumeric, hyphen, underscore)
              </span>
            </div>
          </div>
          
          <div v-if="isValid && available" class="price-display">
            <h4>Price: {{ calculatedPrice }} SUI</h4>
            <small class="text-muted">
              Shorter addresses cost more. This address will be yours permanently.
            </small>
          </div>

          <div v-if="error" class="alert alert-danger">
            {{ error }}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button 
            type="button" 
            class="btn btn-primary" 
            :disabled="!isValid || !available || purchasing"
            @click="purchase"
          >
            <span v-if="purchasing" class="spinner-border spinner-border-sm me-2"></span>
            Purchase
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  purchased: [vanity: string];
}>();

const authStore = useAuthStore();
const vanityInput = ref('');
const available = ref(false);
const checking = ref(false);
const purchasing = ref(false);
const error = ref('');

const SUI_SERVICE = import.meta.env.VITE_SUI_SERVICE_URL || 'http://localhost:3001';

const isValid = computed(() => {
  const pattern = /^[a-zA-Z0-9_-]{3,20}$/;
  return pattern.test(vanityInput.value);
});

const calculatedPrice = computed(() => {
  if (!isValid.value) return 0;
  const length = vanityInput.value.length;
  const basePrice = Math.pow(10, 4 - length);
  return Math.max(1, Math.floor(basePrice));
});

watch(() => props.show, (newVal) => {
  if (newVal) {
    vanityInput.value = '';
    available.value = false;
    error.value = '';
  }
});

async function checkAvailability() {
  if (!isValid.value) {
    available.value = false;
    return;
  }

  checking.value = true;
  try {
    const response = await axios.get(`${SUI_SERVICE}/vanity/check/${vanityInput.value}`);
    available.value = response.data.available;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to check availability';
    available.value = false;
  } finally {
    checking.value = false;
  }
}

async function purchase() {
  if (!authStore.user || !isValid.value || !available.value) return;

  purchasing.value = true;
  error.value = '';

  try {
    // TODO: Sign transaction with wallet
    const signature = 'placeholder-signature';
    
    await axios.post(`${SUI_SERVICE}/vanity/purchase`, {
      vanity: vanityInput.value.toLowerCase(),
      suiAddress: authStore.user.suiAddress,
      signature,
      price: calculatedPrice.value
    });

    emit('purchased', vanityInput.value.toLowerCase());
    emit('close');
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to purchase vanity address';
  } finally {
    purchasing.value = false;
  }
}
</script>

<style scoped>
.modal.show {
  background: rgba(0,0,0,0.5);
}

.price-display {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 4px;
  margin-top: 1rem;
}

.price-display h4 {
  color: #667eea;
  margin-bottom: 0.5rem;
}
</style>

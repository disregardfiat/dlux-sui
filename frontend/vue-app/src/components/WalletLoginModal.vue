<template>
  <div v-if="show" class="modal show d-block" @click.self="close">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ accountStep ? 'Select account' : 'Connect Sui Wallet' }}</h5>
          <button type="button" class="btn-close" @click="close"></button>
        </div>
        <div class="modal-body">
          <div v-if="accountStep" class="account-picker">
            <p class="text-muted mb-2">Choose the account to sign in with:</p>
            <div v-if="connectingError" class="alert alert-danger mb-3">
              {{ connectingError }}
            </div>
            <button
              v-for="acc in pendingAccounts"
              :key="acc.address"
              class="btn btn-outline-primary w-100 mb-2 text-start d-flex align-items-center"
              :disabled="connecting"
              @click="selectAccountAndLogin(acc)"
            >
              <span v-if="connecting" class="spinner-border spinner-border-sm me-2"></span>
              <code class="small me-2">{{ shortenAddress(acc.address) }}</code>
              <span v-if="acc.label" class="text-muted small">{{ acc.label }}</span>
            </button>
            <button class="btn btn-link text-secondary mt-2" :disabled="connecting" @click="backToWallets">
              ← Back to wallets
            </button>
          </div>
          <div v-else>
            <div v-if="wallets.length === 0" class="empty-state">
              <p>No Sui wallets detected.</p>
              <p class="text-muted">
                Install a wallet like Slush or Sui Wallet, then refresh.
              </p>
            </div>
            <div v-else class="wallet-list">
              <div v-if="connectingError" class="alert alert-danger mb-3">
                {{ connectingError }}
              </div>
              <button
                v-for="wallet in wallets"
                :key="wallet.key"
                class="btn btn-outline-primary w-100 mb-2"
                :disabled="!hasConsent || connecting"
                @click="connect(wallet)"
              >
                <span v-if="connecting" class="spinner-border spinner-border-sm me-2"></span>
                {{ wallet.name }}
              </button>
            </div>
            <div class="form-check mt-3">
              <input
                id="privacy-consent"
                v-model="hasConsent"
                class="form-check-input"
                type="checkbox"
              />
              <label class="form-check-label" for="privacy-consent">
                I agree to the
                <a :href="privacyPolicyUrl" target="_blank" rel="noopener noreferrer">privacy policy</a>.
              </label>
            </div>
            <div class="mt-3">
              <small class="text-muted">
                Shared login cookies are scoped for subdomains when possible.
              </small>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <small v-if="!hasConsent && !accountStep" class="text-muted me-auto">
            Accept the privacy policy to continue.
          </small>
          <span v-else></span>
          <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSuiWallet, type WalletEntry } from '@/composables/useSuiWallet';
import { PRIVACY_POLICY_URL, getSuiServiceUrl, getWalrusConsentUrl } from '@/config/links';

type PendingAccount = { address: string; label?: string };

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const { wallets, connectWallet, signMessage, setActiveWallet } = useSuiWallet();
const SUI_SERVICE = getSuiServiceUrl();
const consentUrl = getWalrusConsentUrl();
const privacyPolicyUrl = PRIVACY_POLICY_URL;
const hasConsent = ref(false);
const connecting = ref(false);
const connectingError = ref('');
const accountStep = ref(false);
const pendingWallet = ref<WalletEntry | null>(null);
const pendingAccounts = ref<PendingAccount[]>([]);

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function backToWallets() {
  accountStep.value = false;
  pendingWallet.value = null;
  pendingAccounts.value = [];
  connectingError.value = '';
}

const close = () => {
  connectingError.value = '';
  accountStep.value = false;
  pendingWallet.value = null;
  pendingAccounts.value = [];
  emit('close');
};

const connect = async (wallet: WalletEntry) => {
  connecting.value = true;
  connectingError.value = '';
  try {
    const accounts = await connectWallet(wallet);
    const list: PendingAccount[] = accounts
      .filter((a) => a?.address && typeof a.address === 'string')
      .map((a) => ({
        address: a.address,
        label: (a as { label?: string }).label
      }));
    if (!list.length) {
      connectingError.value = 'No accounts returned from wallet.';
      return;
    }
    if (list.length === 1) {
      await loginWithAccount(wallet, list[0].address);
      return;
    }
    pendingWallet.value = wallet;
    pendingAccounts.value = list;
    accountStep.value = true;
  } catch (error: any) {
    handleError(error);
  } finally {
    connecting.value = false;
  }
};

const selectAccountAndLogin = async (acc: PendingAccount) => {
  const wallet = pendingWallet.value;
  if (!wallet) return;
  connecting.value = true;
  connectingError.value = '';
  try {
    await loginWithAccount(wallet, acc.address);
  } catch (error: any) {
    handleError(error);
  } finally {
    connecting.value = false;
  }
};

async function loginWithAccount(wallet: WalletEntry, address: string) {
  const challengeRes = await fetch(`${SUI_SERVICE}/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suiAddress: address })
  });
  if (!challengeRes.ok) {
    throw new Error(challengeRes.status === 502 || challengeRes.status === 503
      ? 'Service unavailable. The gateway may be down.'
      : 'Failed to fetch login challenge');
  }
  const challengeData = await challengeRes.json();
  const signature = await signMessage(challengeData.challenge, wallet, address);

  const loginRes = await fetch(`${SUI_SERVICE}/auth/zk-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suiAddress: address,
      signature,
      challengeId: challengeData.challengeId
    })
  });
  if (!loginRes.ok) {
    throw new Error(loginRes.status === 502 || loginRes.status === 503
      ? 'Service unavailable. The gateway may be down.'
      : 'Login failed');
  }
  const loginData = await loginRes.json();

  authStore.setSession({
    address,
    token: loginData.token,
    suinsName: loginData.user?.suinsName,
    walletName: wallet.name,
    walletIcon: wallet.provider?.icon
  });
  setActiveWallet(wallet);

  // Best-effort: record ad consent. Do not fail login if Walrus is unreachable.
  if (hasConsent.value) {
    try {
      await fetch(consentUrl, { method: 'POST', credentials: 'include' });
    } catch {
      // non-fatal: user is logged in; consent can be retried later
    }
  }
  close();
}

function handleError(error: any) {
  console.error('Wallet connection failed', error);
  const msg = error?.message?.toLowerCase?.().includes('fetch') || error?.code === 'ERR_NETWORK'
    ? 'Service unavailable. The gateway may be down.'
    : error?.message || 'Wallet connection failed. Please try again.';
  connectingError.value = msg;
}

</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 1rem 0;
}

.wallet-list button {
  text-align: left;
}

.account-picker code {
  font-size: 0.8rem;
}
</style>

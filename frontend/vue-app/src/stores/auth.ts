import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@dlux-sui/types'
import { authStorage } from '../utils/authStorage'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const walletName = ref<string | null>(null)
  const walletIcon = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  
  const accountUrl = computed(() => {
    if (!user.value) return null;
    return `/@${user.value.suinsName || user.value.suiAddress}`;
  })

  const setSession = (payload: {
    address: string;
    token: string;
    suinsName?: string;
    walletName?: string;
    walletIcon?: string;
  }) => {
    const address = payload?.address;
    if (!address || typeof address !== 'string') {
      console.error('setSession: address is required');
      return;
    }
    const nextUser: User = {
      suiAddress: address,
      suinsName: payload.suinsName,
      linkedZKPs: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    user.value = nextUser
    token.value = payload.token
    walletName.value = payload.walletName || null
    walletIcon.value = payload.walletIcon || null
    authStorage.save({
      token: payload.token,
      user: { suiAddress: address, suinsName: payload.suinsName },
      walletName: payload.walletName,
      walletIcon: payload.walletIcon
    })
  }

  const logout = () => {
    user.value = null
    token.value = null
    walletName.value = null
    walletIcon.value = null
    authStorage.clear()
  }

  const requestLoginModal = ref(false)

  const openLoginModal = () => {
    requestLoginModal.value = true
  }

  const clearLoginModalRequest = () => {
    requestLoginModal.value = false
  }

  /** Backfill SuiNS name for existing session (e.g. after login before backend returned it, or old session). */
  const setSuinsName = (suinsName: string) => {
    if (!user.value) return
    user.value = { ...user.value, suinsName }
    const saved = authStorage.load()
    if (saved) authStorage.save({ ...saved, user: { ...saved.user, suinsName } })
  }

  const initializeAuth = () => {
    const saved = authStorage.load()
    if (!saved) return
    token.value = saved.token
    walletName.value = saved.walletName || null
    walletIcon.value = saved.walletIcon || null
    user.value = {
      suiAddress: saved.user.suiAddress,
      suinsName: saved.user.suinsName,
      linkedZKPs: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  return {
    user,
    token,
    walletName,
    walletIcon,
    isAuthenticated,
    accountUrl,
    requestLoginModal,
    openLoginModal,
    clearLoginModalRequest,
    setSession,
    setSuinsName,
    logout,
    initializeAuth
  }
})
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { User } from '@dlux-sui/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)
  
  const accountUrl = computed(() => {
    if (!user.value) return null;
    return `/@${user.value.vanityAddress || user.value.suiAddress}`;
  })

  const login = async () => {
    try {
      // TODO: Implement SUI wallet connection and ZK login
      // This is a placeholder implementation

      // Simulate wallet connection
      const mockAddress = '0x1234567890abcdef'
      const mockUser: User = {
        suiAddress: mockAddress,
        linkedZKPs: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }

      user.value = mockUser
      token.value = 'mock-jwt-token'

      localStorage.setItem('auth_token', token.value)
      localStorage.setItem('user', JSON.stringify(mockUser))

    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const logout = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
  }

  const initializeAuth = () => {
    const savedToken = localStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('user')

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = JSON.parse(savedUser)
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    accountUrl,
    login,
    logout,
    initializeAuth
  }
})
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createApolloProvider } from '@vue/apollo-option'
import { apolloClient } from './apollo/client'
import router from './router'
import App from './App.vue'
import './style.css'
// Initialize theme before mounting app to prevent flash
function initTheme() {
  const STORAGE_KEY = 'dlux-theme'
  const stored = localStorage.getItem(STORAGE_KEY)
  const theme = stored && ['light', 'dark', 'system'].includes(stored) 
    ? stored 
    : 'system'
  
  const resolved = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  
  document.documentElement.setAttribute('data-bs-theme', resolved)
}

initTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(createApolloProvider({
  defaultClient: apolloClient
}))

app.mount('#app')
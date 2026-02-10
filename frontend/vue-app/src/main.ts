import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createApolloProvider } from '@vue/apollo-option'
import { apolloClient } from './apollo/client'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(createApolloProvider({
  defaultClient: apolloClient
}))

app.mount('#app')
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import DAppsView from '../views/DAppsView.vue'
import DAppDetailView from '../views/DAppDetailView.vue'
import AccountView from '../views/AccountView.vue'
import PostDAppView from '../views/PostDAppView.vue'
import FeedView from '../views/FeedView.vue'
import PrivacyView from '../views/PrivacyView.vue'
import TermsView from '../views/TermsView.vue'
import GovernanceView from '../views/GovernanceView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/feed',
      name: 'feed',
      component: FeedView
    },
    {
      path: '/dapps',
      name: 'dapps',
      component: DAppsView
    },
    {
      path: '/dapps/:id',
      name: 'dapp-detail',
      component: DAppDetailView,
      props: true
    },
    {
      path: '/post',
      name: 'post-dapp',
      component: PostDAppView,
      meta: { requiresAuth: true }
    },
    {
      path: '/@:identifier',
      name: 'account',
      component: AccountView,
      props: true
    },
    {
      path: '/governance',
      name: 'governance',
      component: GovernanceView
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: PrivacyView
    },
    {
      path: '/terms',
      name: 'terms',
      component: TermsView
    },
    {
      path: '/profile',
      redirect: (to) => {
        // Redirect to account page if user has SuiNS name
        const authStore = useAuthStore()
        if (authStore.user) {
          return `/@${authStore.user.suinsName || authStore.user.suiAddress}`
        }
        return '/@profile'
      }
    }
  ]
})

// Navigation guard for authenticated routes
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ path: '/', query: { login: '1' } })
  } else {
    next()
  }
})

export default router
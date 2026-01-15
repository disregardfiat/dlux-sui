import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import DAppsView from '../views/DAppsView.vue'
import DAppDetailView from '../views/DAppDetailView.vue'
import AccountView from '../views/AccountView.vue'
import PostDAppView from '../views/PostDAppView.vue'
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
      path: '/profile',
      redirect: (to) => {
        // Redirect to account page if user has vanity address
        return '/@profile' // Will be replaced with actual vanity or SUI address
      }
    }
  ]
})

// Navigation guard for authenticated routes
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
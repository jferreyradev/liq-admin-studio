import { createRouter, createWebHistory } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'

import LoginView from '@/views/LoginView.vue'
import ViewsView from '@/views/ViewsView.vue'
import ProceduresView from '@/views/ProceduresView.vue'
import SqlStudioView from '@/views/SqlStudioView.vue'
import ApiExplorerView from '@/views/ApiExplorerView.vue'
import ImporterView from '@/views/ImporterView.vue'
import HelpView from '@/views/HelpView.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { public: true }
  },
  {
    path: '/',
    redirect: '/views'
  },
  {
    path: '/views',
    name: 'views',
    component: ViewsView
  },
  {
    path: '/procedures',
    name: 'procedures',
    component: ProceduresView
  },
  {
    path: '/sql-studio',
    name: 'sql-studio',
    component: SqlStudioView
  },
  {
    path: '/explorer',
    name: 'explorer',
    component: ApiExplorerView
  },
  {
    path: '/importer',
    name: 'importer',
    component: ImporterView
  },
  {
    path: '/help',
    name: 'help',
    component: HelpView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/views'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const hostStore = useHostStore()
  const isPublic = to.meta.public === true

  if (!isPublic && !hostStore.isAuthenticated) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  if (to.path === '/login' && hostStore.isAuthenticated) {
    return next('/views')
  }

  next()
})

export default router

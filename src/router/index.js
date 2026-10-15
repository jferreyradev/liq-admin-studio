import { createRouter, createWebHistory } from 'vue-router'
import ViewsView from '@/views/ViewsView.vue'
import ProceduresView from '@/views/ProceduresView.vue'
import SqlStudioView from '@/views/SqlStudioView.vue'
import ApiExplorerView from '@/views/ApiExplorerView.vue'
import ImporterView from '@/views/ImporterView.vue'

const routes = [
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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

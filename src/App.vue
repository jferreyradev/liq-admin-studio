<template>
  <div class="app-layout">
    <AppHeader v-if="hostStore.isAuthenticated && route.name !== 'login'" />
    <div class="main-body">
      <AppSidebar v-if="hostStore.isAuthenticated && route.name !== 'login'" />
      <main class="workspace-area" :class="{ 'auth-mode': route.name === 'login' }">
        <router-view />
      </main>
    </div>

    <!-- Global Toast Notification -->
    <transition name="toast-fade">
      <div
        v-if="hostStore.toast.visible"
        class="global-toast"
        :class="`toast-${hostStore.toast.type}`"
        @click="hostStore.toast.visible = false"
      >
        <span class="toast-icon">
          {{ hostStore.toast.type === 'success' ? '✅' : hostStore.toast.type === 'error' ? '❌' : hostStore.toast.type === 'warning' ? '⚠️' : 'ℹ️' }}
        </span>
        <span class="toast-text">{{ hostStore.toast.message }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore } from '@/stores/catalogStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const route = useRoute()
const hostStore = useHostStore()
const catalogStore = useCatalogStore()

onMounted(() => {
  document.documentElement.style.setProperty('--color-primary', hostStore.activeHost.color)
  if (hostStore.isAuthenticated) {
    catalogStore.loadAllCatalogs()
  }
})

watch(
  () => [hostStore.isAuthenticated, hostStore.activeHostId],
  ([isAuth]) => {
    if (isAuth) {
      catalogStore.loadAllCatalogs(true)
    }
  }
)
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.workspace-area {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  background-color: var(--bg-app);
}

.workspace-area.auth-mode {
  width: 100vw;
  height: 100vh;
}

.global-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #FFFFFF;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 12px 18px;
  border-radius: var(--radius-md);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 9999;
  cursor: pointer;
  max-width: 460px;
}

.toast-success { border-left: 4px solid var(--color-success); }
.toast-error { border-left: 4px solid var(--color-error); }
.toast-warning { border-left: 4px solid var(--color-warning); }
.toast-info { border-left: 4px solid var(--color-info); }

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>

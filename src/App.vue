<template>
  <div class="app-layout">
    <AppHeader v-if="hostStore.isAuthenticated && route.name !== 'login'" />
    <div class="main-body">
      <AppSidebar v-if="hostStore.isAuthenticated && route.name !== 'login'" />
      <main class="workspace-area" :class="{ 'auth-mode': route.name === 'login' }">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const route = useRoute()
const hostStore = useHostStore()
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
</style>

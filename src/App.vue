<template>
  <div class="app-layout">
    <AppHeader />
    <div class="main-body">
      <AppSidebar />
      <main class="workspace-area">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
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
</style>

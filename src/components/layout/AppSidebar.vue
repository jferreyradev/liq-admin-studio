<template>
  <aside class="app-sidebar">
    <nav class="sidebar-nav">
      <router-link to="/views" class="nav-item" active-class="active">
        <span class="nav-icon">📋</span>
        <span class="nav-text">Vistas y Consultas</span>
        <span v-if="catalogStore.viewsCount > 0" class="nav-count">{{ catalogStore.viewsCount }}</span>
      </router-link>

      <router-link to="/procedures" class="nav-item" active-class="active">
        <span class="nav-icon">⚡</span>
        <span class="nav-text">Stored Procedures & FNs</span>
        <span v-if="catalogStore.spCount + catalogStore.fnCount > 0" class="nav-count">
          {{ catalogStore.spCount + catalogStore.fnCount }}
        </span>
      </router-link>

      <router-link to="/sql-studio" class="nav-item" active-class="active">
        <span class="nav-icon">✏️</span>
        <span class="nav-text">SQL Studio</span>
      </router-link>

      <router-link to="/explorer" class="nav-item" active-class="active">
        <span class="nav-icon">🌐</span>
        <span class="nav-text">API Explorer</span>
      </router-link>

      <router-link to="/importer" class="nav-item" active-class="active">
        <span class="nav-icon">📁</span>
        <span class="nav-text">Importador Excel/CSV</span>
        <span v-if="catalogStore.tablesCount > 0" class="nav-count">{{ catalogStore.tablesCount }}</span>
      </router-link>

      <div class="nav-divider"></div>

      <router-link to="/help" class="nav-item" active-class="active">
        <span class="nav-icon">📖</span>
        <span class="nav-text">Manual de Uso y Ayuda</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="footer-info">
        <div class="host-indicator">
          <span class="host-dot" :style="{ backgroundColor: hostStore.activeHost.color }"></span>
          <span class="host-name">{{ hostStore.activeHost.name }}</span>
        </div>
        <span class="version-tag">v2.1 • Oracle 11g Thick</span>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useHostStore } from '@/stores/hostStore'
import { useCatalogStore } from '@/stores/catalogStore'

const hostStore = useHostStore()
const catalogStore = useCatalogStore()
</script>

<style scoped>
.app-sidebar {
  width: 245px;
  min-width: 245px;
  background-color: var(--bg-surface);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.sidebar-nav {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-divider {
  height: 1px;
  background: var(--border-color);
  margin: 6px 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
}

.nav-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background-color: var(--bg-hover);
  color: var(--color-primary);
  border-left-color: var(--color-primary);
  font-weight: 700;
}

.nav-icon {
  font-size: 1.05rem;
}

.nav-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-count {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 9999px;
  background: var(--bg-active);
  color: var(--text-secondary);
}

.nav-item.active .nav-count {
  background: var(--color-primary);
  color: #FFFFFF;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: #FAFAFA;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.host-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.host-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.host-name {
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.version-tag {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 600;
}
</style>

<template>
  <aside class="app-sidebar">
    <nav class="sidebar-nav">
      <router-link to="/views" class="nav-item" active-class="active">
        <span class="nav-icon">📋</span>
        <span class="nav-text">Vistas y Consultas</span>
      </router-link>

      <router-link to="/procedures" class="nav-item" active-class="active">
        <span class="nav-icon">⚡</span>
        <span class="nav-text">Stored Procedures & FNs</span>
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
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="footer-info">
        <span class="version-tag">v2.0 • Oracle 11g Thick</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 240px;
  min-width: 240px;
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

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.86rem;
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
  font-size: 1.1rem;
}

.sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid var(--border-color);
  background: #FAFAFA;
}

.version-tag {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}
</style>

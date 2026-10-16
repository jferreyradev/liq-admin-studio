<template>
  <div class="login-wrapper">
    <div class="login-card card">
      <div class="login-header">
        <div class="brand-badge" :style="{ backgroundColor: hostStore.activeHost.color }">
          ⚡ Liquid Studio
        </div>
        <h1 class="login-title">Acceso de Administrador</h1>
        <p class="login-subtitle">
          Introspección y consola de operaciones para Oracle 11g
        </p>
      </div>

      <div v-if="errorMessage" class="error-alert">
        <span>❌ {{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <!-- Selector de Servidor Inicial -->
        <div class="form-group">
          <label class="form-label">Servidor / Municipio Destino:</label>
          <select
            class="form-control"
            v-model="selectedHostId"
            @change="hostStore.setHost(selectedHostId)"
          >
            <option v-for="h in hostStore.hosts" :key="h.id" :value="h.id">
              {{ h.name }} (Puerto {{ h.projectPort }})
            </option>
            <option value="custom">⚙️ Servidor Personalizado...</option>
          </select>
        </div>

        <!-- Campos de Servidor Personalizado si aplica -->
        <div v-if="selectedHostId === 'custom'" class="custom-host-box">
          <div class="form-group">
            <label class="form-label">URL Directa Opcional (ej. http://localhost:3005):</label>
            <input
              type="text"
              class="form-control"
              v-model="customDirectUrl"
              placeholder="Vacío para usar Deno Bridge"
              @input="syncCustomHost"
            />
          </div>
          <div class="custom-row" v-if="!customDirectUrl.trim()">
            <div class="form-group" style="flex: 2;">
              <label class="form-label">x-project-key:</label>
              <input type="text" class="form-control" v-model="customKey" placeholder="ServerTrancas" @input="syncCustomHost" />
            </div>
            <div class="form-group" style="flex: 1;">
              <label class="form-label">Puerto:</label>
              <input type="text" class="form-control" v-model="customPort" placeholder="3005" @input="syncCustomHost" />
            </div>
          </div>
        </div>

        <!-- Clave de Acceso -->
        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">Clave de Administración (X-Admin-Key):</label>
          <div class="input-with-button">
            <input
              :type="showPassword ? 'text' : 'password'"
              class="form-control"
              v-model="keyInput"
              placeholder="Ingresa la clave de admin..."
              ref="keyField"
              required
              autofocus
            />
            <button
              type="button"
              class="btn-toggle-eye"
              @click="showPassword = !showPassword"
              tabindex="-1"
            >
              {{ showPassword ? '👁️' : '🔒' }}
            </button>
          </div>
        </div>

        <!-- Recordar sesión -->
        <div class="form-check" style="margin-top: 12px;">
          <label class="check-label">
            <input type="checkbox" v-model="rememberMe" />
            <span>Recordar clave en este navegador</span>
          </label>
        </div>

        <!-- Botón de Ingreso -->
        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="loading || !keyInput.trim()"
          style="margin-top: 18px;"
        >
          <span v-if="loading" class="spinning">⏳</span>
          <span v-else>🔐 Ingresar a la Consola</span>
        </button>
      </form>

      <div class="login-footer">
        <span>Destino: <code>{{ hostStore.baseUrl }}</code></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useHostStore } from '@/stores/hostStore'

const router = useRouter()
const route = useRoute()
const hostStore = useHostStore()

const keyInput = ref('')
const rememberMe = ref(true)
const showPassword = ref(false)
const loading = ref(false)
const errorMessage = ref(null)
const selectedHostId = ref(hostStore.activeHostId)
const keyField = ref(null)

const customKey = ref(hostStore.customProjectKey)
const customPort = ref(hostStore.customPort)
const customDirectUrl = ref(hostStore.customDirectUrl)

function syncCustomHost() {
  hostStore.setCustomHost(customKey.value.trim(), customPort.value.trim(), customDirectUrl.value.trim())
}

onMounted(() => {
  if (hostStore.isAuthenticated) {
    router.replace('/views')
  } else if (keyField.value) {
    keyField.value.focus()
  }
})

async function handleLogin() {
  if (!keyInput.value.trim()) return
  loading.value = true
  errorMessage.value = null

  try {
    syncCustomHost()
    await hostStore.verifyAndLogin(keyInput.value, rememberMe.value)
    hostStore.showToast(`Bienvenido a ${hostStore.activeHost.name}`, 'success')
    const redirectPath = route.query.redirect ? String(route.query.redirect) : '/views'
    router.push(redirectPath)
  } catch (err) {
    errorMessage.value = err.message || 'Error de autenticación'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  background-color: var(--bg-app);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 32px 28px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 22px;
}

.brand-badge {
  display: inline-block;
  color: #FFFFFF;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 4px 14px;
  border-radius: 9999px;
  margin-bottom: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.login-title {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.login-subtitle {
  font-size: 0.82rem;
  color: var(--text-secondary);
}

.error-alert {
  background: var(--color-error-bg);
  border: 1px solid #FECACA;
  color: var(--color-error);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 0.84rem;
  font-weight: 600;
  margin-bottom: 16px;
}

.custom-host-box {
  margin-top: 10px;
  padding: 10px 12px;
  background: #F8FAFC;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.custom-row {
  display: flex;
  gap: 8px;
}

.input-with-button {
  display: flex;
  position: relative;
}
.input-with-button input {
  width: 100%;
}

.btn-toggle-eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  opacity: 0.7;
}
.btn-toggle-eye:hover {
  opacity: 1;
}

.form-check {
  display: flex;
  align-items: center;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
}

.btn-block {
  width: 100%;
  padding: 10px;
  font-size: 0.92rem;
  justify-content: center;
}

.login-footer {
  margin-top: 24px;
  padding-top: 14px;
  border-top: 1px solid var(--border-color);
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-muted);
}
.login-footer code {
  color: var(--text-secondary);
  font-family: var(--font-mono);
}
</style>

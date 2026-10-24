const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const SERVER_ERROR_MESSAGE = 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.'

async function request(path, options = {}) {
  // Accept va siempre (la API responde JSON). Content-Type solo cuando hay
  // cuerpo: sin él, los GET son peticiones "simples" y el navegador no hace la
  // consulta previa de CORS (preflight) antes de cada una.
  const headers = { Accept: 'application/json' }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })

  // Si el servidor responde algo que no es JSON (por ejemplo un 500 en HTML),
  // no se rompe con un error de parseo: se informa el estado HTTP.
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const isServerError = response.status >= 500

    // Ante un error 5xx no se muestra al usuario el detalle interno (puede
    // incluir SQL o datos de conexión): se muestra un mensaje genérico y el
    // detalle queda en error.detail para la consola.
    const error = new Error(
      isServerError ? SERVER_ERROR_MESSAGE : body.message || 'No se pudo completar la petición',
    )
    error.status = response.status
    error.detail = body.message || null
    // Errores de validación (422): { campo: ['mensaje', ...] }
    error.errors = body.errors || null
    throw error
  }

  return body
}

// options.signal permite cancelar la petición (AbortController).
export function getTasks(filters = {}, options = {}) {
  const query = new URLSearchParams()

  if (filters.search) {
    query.set('search', filters.search)
  }

  if (filters.status) {
    query.set('status', filters.status)
  }

  if (filters.priority) {
    query.set('priority', filters.priority)
  }

  const suffix = query.toString() ? `?${query.toString()}` : ''

  return request(`/tasks${suffix}`, options)
}

export function getTask(id) {
  return request(`/tasks/${id}`)
}

export function getUsers() {
  return request('/users')
}

export function createTask(payload) {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTask(id, payload) {
  return request(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateTaskStatus(id, status) {
  return request(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

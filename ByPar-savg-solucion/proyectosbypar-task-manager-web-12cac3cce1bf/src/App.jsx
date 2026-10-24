import { useCallback, useEffect, useState } from 'react'

import { getTasks, getUsers } from './api/client.js'
import TaskFilters from './components/TaskFilters.jsx'
import TaskFormModal from './components/TaskFormModal.jsx'
import TaskTable from './components/TaskTable.jsx'

const EMPTY_FILTERS = {
  search: '',
  status: '',
  priority: '',
}

const NOTICE_DURATION_MS = 3500

function describeError(error) {
  if (error.status) {
    return `El servidor respondió con un error (${error.status}). Intenta de nuevo.`
  }

  return 'No se pudo conectar con el servidor. Verifica tu conexión o que la API esté en funcionamiento.'
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [formOpen, setFormOpen] = useState(false)
  const [taskBeingEdited, setTaskBeingEdited] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Estado de la carga de la lista: carga / error / listo (con o sin resultados).
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState(null)

  // Confirmación visible tras guardar o cambiar el estado.
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    // Cada vez que cambian los filtros se cancela la petición anterior: así una
    // respuesta lenta y vieja nunca pisa el resultado de lo que se ve en pantalla.
    const controller = new AbortController()

    setLoading(true)
    setError(null)

    getTasks(filters, { signal: controller.signal })
      .then((body) => {
        setTasks(body.data)
        setHasLoaded(true)
        setLoading(false)
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') {
          return
        }

        console.error(requestError)
        setError(describeError(requestError))
        setLoading(false)
      })

    return () => controller.abort()
  }, [filters, reloadToken])

  useEffect(() => {
    getUsers()
      .then((body) => {
        setUsers(body.data)
      })
      .catch((requestError) => {
        console.error(requestError)
      })
  }, [])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timer = setTimeout(() => setNotice(null), NOTICE_DURATION_MS)

    return () => clearTimeout(timer)
  }, [notice])

  const reloadTasks = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const handleFilterChange = useCallback((name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
  }, [])

  const showNotice = useCallback((message, type = 'success') => {
    setNotice({ message, type })
  }, [])

  function openCreateForm() {
    setTaskBeingEdited(null)
    setFormOpen(true)
  }

  function openEditForm(task) {
    setTaskBeingEdited(task)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setTaskBeingEdited(null)
  }

  function handleSaved(message) {
    closeForm()
    showNotice(message)
    reloadTasks()
  }

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.priority)
  const isInitialLoading = loading && !hasLoaded
  const showEmpty = !loading && !error && tasks.length === 0
  const showTable = !error && !isInitialLoading && tasks.length > 0

  return (
    <div className="app">
      <div className="header">
        <h1>Gestor de Tareas</h1>
        <button type="button" className="button-primary" onClick={openCreateForm}>
          Nueva tarea
        </button>
      </div>

      <TaskFilters
        filters={filters}
        onChange={handleFilterChange}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {isInitialLoading && (
        <div className="state-box" role="status">
          Cargando tareas...
        </div>
      )}

      {error && (
        <div className="state-box state-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reloadTasks}>
            Reintentar
          </button>
        </div>
      )}

      {showEmpty && (
        <div className="state-box" role="status">
          {hasActiveFilters
            ? 'No se encontraron tareas con los filtros aplicados.'
            : 'Todavía no hay tareas. Crea la primera con "Nueva tarea".'}
        </div>
      )}

      {loading && hasLoaded && !error && (
        <div className="refreshing" role="status">
          Actualizando...
        </div>
      )}

      {showTable && (
        <div className={loading ? 'table-wrapper is-refreshing' : 'table-wrapper'}>
          <TaskTable
            tasks={tasks}
            onEdit={openEditForm}
            onChanged={reloadTasks}
            onNotify={showNotice}
          />
        </div>
      )}

      {formOpen && (
        <TaskFormModal
          task={taskBeingEdited}
          users={users}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      {notice && (
        <div className={`toast toast-${notice.type}`} role="status" aria-live="polite">
          {notice.message}
        </div>
      )}
    </div>
  )
}

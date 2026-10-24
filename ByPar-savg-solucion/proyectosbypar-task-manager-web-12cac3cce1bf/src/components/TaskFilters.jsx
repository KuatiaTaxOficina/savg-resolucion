import { useEffect, useState } from 'react'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../labels.js'

export default function TaskFilters({ filters, onChange, onClear }) {
  // Estado local para el input de búsqueda para aplicar debounce
  const [searchTerm, setSearchTerm] = useState(filters.search)

  // Sincronizar el estado local si los filtros externos cambian (ej. al presionar "Limpiar")
  useEffect(() => {
    setSearchTerm(filters.search)
  }, [filters.search])

  // Aplicar debounce al escribir en el buscador (espera 350ms antes de notificar al padre)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== filters.search) {
        onChange('search', searchTerm)
      }
    }, 350)

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm, filters.search, onChange])

  return (
    <div className="filters">
      <input
        type="text"
        placeholder="Buscar por título"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />

      <select
        value={filters.status}
        onChange={(event) => onChange('status', event.target.value)}
      >
        <option value="">Todos los estados</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        value={filters.priority}
        onChange={(event) => onChange('priority', event.target.value)}
      >
        <option value="">Todas las prioridades</option>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>

      <button type="button" onClick={onClear}>
        Limpiar
      </button>
    </div>
  )
}
import { useState } from 'react'

import { updateTaskStatus } from '../api/client.js'
import { PRIORITY_LABELS, STATUS_LABELS, STATUSES } from '../labels.js'
import TaskDetails from './TaskDetails.jsx'

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${now.getFullYear()}-${month}-${day}`
}

export default function TaskTable({ tasks, onEdit, onChanged, onNotify }) {
  const [openTaskId, setOpenTaskId] = useState(null)
  const today = todayIso()

  function handleStatusChange(task, status) {
    updateTaskStatus(task.id, status)
      .then(() => {
        onNotify?.('Estado actualizado correctamente.')
        onChanged()
      })
      .catch((error) => {
        console.error(error)
        onNotify?.(error.message || 'No se pudo cambiar el estado.', 'error')
        // Se recarga para que el selector vuelva al estado real de la tarea.
        onChanged()
      })
  }

  function toggleDetails(taskId) {
    setOpenTaskId(openTaskId === taskId ? null : taskId)
  }

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th scope="col">Título</th>
          <th scope="col">Estado</th>
          <th scope="col">Prioridad</th>
          <th scope="col">Asignada a</th>
          <th scope="col">Fecha límite</th>
          <th scope="col">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => {
          const isOverdue = Boolean(task.due_date) && task.due_date < today && task.status !== 'completed'

          return (
            <tr key={task.id}>
              <td data-label="Título" className="cell-title">
                <span className="task-title">{task.title}</span>
                {openTaskId === task.id && <TaskDetails taskId={task.id} />}
              </td>
              <td data-label="Estado">
                <select
                  className={`status-select status-${task.status}`}
                  aria-label={`Estado de la tarea: ${task.title}`}
                  value={task.status}
                  onChange={(event) => handleStatusChange(task, event.target.value)}
                >
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td data-label="Prioridad">
                <span className={`badge priority-${task.priority}`}>
                  {PRIORITY_LABELS[task.priority] || task.priority}
                </span>
              </td>
              <td data-label="Asignada a">{task.assigned_user ? task.assigned_user.name : '-'}</td>
              <td data-label="Fecha límite" className={isOverdue ? 'due-overdue' : undefined}>
                <span>
                  {task.due_date || '-'}
                  {isOverdue && <span className="overdue-tag"> (vencida)</span>}
                </span>
              </td>
              <td data-label="Acciones" className="cell-actions">
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  aria-label={`Editar la tarea: ${task.title}`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => toggleDetails(task.id)}
                  aria-expanded={openTaskId === task.id}
                  aria-label={`Ver el detalle de la tarea: ${task.title}`}
                >
                  Detalle
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

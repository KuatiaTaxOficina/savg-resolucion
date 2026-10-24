import { useEffect, useState } from 'react'

import { getTask } from '../api/client.js'
import { STATUS_LABELS } from '../labels.js'

export default function TaskDetails({ taskId }) {
  const [task, setTask] = useState(null)

  useEffect(() => {
    getTask(taskId)
      .then((body) => {
        setTask(body.data)
      })
      .catch((error) => {
        console.error(error)
      })
  }, [taskId])

  if (!task) {
    return null
  }

  return (
    <div className="task-details">
      <p>{task.description || 'Sin descripción'}</p>
      <p>Finalizada el: {task.completed_at || '-'}</p>
      <p>Historial:</p>
      <ul>
        {task.histories.map((history) => (
          <li key={history.id}>
            de {STATUS_LABELS[history.from_status] || history.from_status} a{' '}
            {STATUS_LABELS[history.to_status] || history.to_status} - {history.note}
          </li>
        ))}
      </ul>
      {task.histories.length === 0 && <p>Sin registros de historial.</p>}
    </div>
  )
}

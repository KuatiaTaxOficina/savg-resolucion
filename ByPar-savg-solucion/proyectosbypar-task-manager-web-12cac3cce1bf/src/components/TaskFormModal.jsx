import { useEffect, useRef, useState } from 'react'

import { createTask, updateTask } from '../api/client.js'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../labels.js'

const TITLE_MAX = 255
const DESCRIPTION_MAX = 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const FIELD_LABELS = {
  title: 'Título',
  description: 'Descripción',
  status: 'Estado',
  priority: 'Prioridad',
  due_date: 'Fecha límite',
  assigned_user_id: 'Asignada a',
}

function buildInitialForm(task) {
  return {
    title: task ? task.title : '',
    description: task && task.description ? task.description : '',
    status: task ? task.status : 'pending',
    priority: task ? task.priority : 'medium',
    due_date: task && task.due_date ? task.due_date : '',
    assigned_user_id: task && task.assigned_user_id ? String(task.assigned_user_id) : '',
  }
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

// Validación en el navegador: mejora la experiencia, pero la API valida igual.
function validate(form) {
  const errors = {}
  const title = form.title.trim()

  if (!title) {
    errors.title = 'El título es obligatorio.'
  } else if (title.length > TITLE_MAX) {
    errors.title = `El título no puede superar los ${TITLE_MAX} caracteres.`
  }

  if (form.description.trim().length > DESCRIPTION_MAX) {
    errors.description = `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres.`
  }

  if (form.due_date && !isValidDate(form.due_date)) {
    errors.due_date = 'La fecha límite no es válida. Usa el formato AAAA-MM-DD.'
  }

  return errors
}

// La API devuelve { campo: ['mensaje', ...] }: se muestra el primer mensaje de cada campo.
function normalizeServerErrors(serverErrors) {
  return Object.fromEntries(
    Object.entries(serverErrors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : String(messages),
    ]),
  )
}

function FieldError({ id, message }) {
  if (!message) {
    return null
  }

  return (
    <div id={id} className="field-error">
      {message}
    </div>
  )
}

export default function TaskFormModal({ task, users, onClose, onSaved }) {
  const [form, setForm] = useState(() => buildInitialForm(task))
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // El ref evita el doble envío aunque se haga clic dos veces antes de que
  // React alcance a volver a renderizar el botón deshabilitado.
  const submittingRef = useRef(false)
  const titleRef = useRef(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !submittingRef.current) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleChange(name, value) {
    setForm((current) => ({ ...current, [name]: value }))

    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: null }))
    }
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (submittingRef.current) {
      return
    }

    setGeneralError(null)

    const clientErrors = validate(form)

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setErrors({})

    const description = form.description.trim()

    const payload = {
      title: form.title.trim(),
      description: description === '' ? null : description,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date === '' ? null : form.due_date,
      assigned_user_id: form.assigned_user_id === '' ? null : Number(form.assigned_user_id),
    }

    submittingRef.current = true
    setIsSubmitting(true)

    const saving = task ? updateTask(task.id, payload) : createTask(payload)

    saving
      .then(() => {
        onSaved(task ? 'Tarea actualizada correctamente.' : 'Tarea creada correctamente.')
      })
      .catch((requestError) => {
        submittingRef.current = false
        setIsSubmitting(false)

        if (requestError.errors) {
          const serverErrors = normalizeServerErrors(requestError.errors)
          setErrors(serverErrors)

          const hasUnknownField = Object.keys(serverErrors).some((field) => !FIELD_LABELS[field])

          if (hasUnknownField) {
            setGeneralError(requestError.message)
          }
        } else {
          setGeneralError(requestError.message || 'Ocurrió un error al guardar la tarea.')
        }
      })
  }

  const invalidFields = Object.keys(errors)
    .filter((field) => errors[field] && FIELD_LABELS[field])
    .map((field) => FIELD_LABELS[field])

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
        <h2 id="task-form-title">{task ? 'Editar tarea' : 'Nueva tarea'}</h2>

        {invalidFields.length > 0 && (
          <div className="form-error" role="alert">
            Revisa los campos marcados: {invalidFields.join(', ')}.
          </div>
        )}

        {generalError && (
          <div className="form-error" role="alert">
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="task-title" className="field-label">
              Título
            </label>
            <input
              id="task-title"
              ref={titleRef}
              type="text"
              value={form.title}
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'task-title-error' : undefined}
              onChange={(event) => handleChange('title', event.target.value)}
            />
            <FieldError id="task-title-error" message={errors.title} />
          </div>

          <div className="field">
            <label htmlFor="task-description" className="field-label">
              Descripción
            </label>
            <textarea
              id="task-description"
              rows="4"
              value={form.description}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'task-description-error' : undefined}
              onChange={(event) => handleChange('description', event.target.value)}
            />
            <div className="field-hint">
              {form.description.length}/{DESCRIPTION_MAX}
            </div>
            <FieldError id="task-description-error" message={errors.description} />
          </div>

          <div className="field">
            <label htmlFor="task-status" className="field-label">
              Estado
            </label>
            <select
              id="task-status"
              value={form.status}
              aria-invalid={Boolean(errors.status)}
              aria-describedby={errors.status ? 'task-status-error' : undefined}
              onChange={(event) => handleChange('status', event.target.value)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <FieldError id="task-status-error" message={errors.status} />
          </div>

          <div className="field">
            <label htmlFor="task-priority" className="field-label">
              Prioridad
            </label>
            <select
              id="task-priority"
              value={form.priority}
              aria-invalid={Boolean(errors.priority)}
              aria-describedby={errors.priority ? 'task-priority-error' : undefined}
              onChange={(event) => handleChange('priority', event.target.value)}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
            <FieldError id="task-priority-error" message={errors.priority} />
          </div>

          <div className="field">
            <label htmlFor="task-due-date" className="field-label">
              Fecha límite
            </label>
            <input
              id="task-due-date"
              type="date"
              value={form.due_date}
              aria-invalid={Boolean(errors.due_date)}
              aria-describedby={errors.due_date ? 'task-due-date-error' : undefined}
              onChange={(event) => handleChange('due_date', event.target.value)}
            />
            <FieldError id="task-due-date-error" message={errors.due_date} />
          </div>

          <div className="field">
            <label htmlFor="task-assigned-user" className="field-label">
              Asignada a
            </label>
            <select
              id="task-assigned-user"
              value={form.assigned_user_id}
              aria-invalid={Boolean(errors.assigned_user_id)}
              aria-describedby={errors.assigned_user_id ? 'task-assigned-user-error' : undefined}
              onChange={(event) => handleChange('assigned_user_id', event.target.value)}
            >
              <option value="">Sin asignar</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name}
                </option>
              ))}
            </select>
            <FieldError id="task-assigned-user-error" message={errors.assigned_user_id} />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="button-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

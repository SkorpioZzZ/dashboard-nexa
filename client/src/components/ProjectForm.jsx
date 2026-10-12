import { useState } from 'react'

export function ProjectForm({
  onCreate,
  onCreated,
  onCancel,
  submitLabel = 'Créer le projet',
  autoFocus = false,
}) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const project = {
        name: name.trim(),
        client: client.trim(),
        due: due || null,
      }
      if (description.trim()) project.description = description.trim()
      const created = await onCreate(project)
      if (!created) {
        setError('Le projet n’a pas été créé. Vérifiez les informations et réessayez.')
        return
      }
      setName('')
      setClient('')
      setDescription('')
      setDue('')
      onCreated?.()
    } catch (requestError) {
      setError(requestError.message || 'Une erreur est survenue. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="shortcut-form project-form" onSubmit={submit}>
      <label>
        Nom
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus={autoFocus}
        />
      </label>
      <label>
        Client
        <input value={client} onChange={(event) => setClient(event.target.value)} />
      </label>
      <label>
        Description
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows="3"
          maxLength="2000"
        />
      </label>
      <label>
        Échéance
        <input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
      </label>
      <div className="project-form-actions">
        {onCancel && (
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={submitting}
          >
            Annuler
          </button>
        )}
        <button className="primary-button" disabled={submitting}>
          {submitting ? 'Création…' : submitLabel}
        </button>
      </div>
      {error && (
        <p className="project-form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

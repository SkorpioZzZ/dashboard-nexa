import { useEffect, useState } from 'react'
import { Avatar, Header } from '../components/shared.jsx'
import { api } from '../lib/api.js'

const TEAM_ROLES = [
  'Administrateur',
  'Responsable',
  'Développeur',
  'Contributeur',
  'Lecteur',
  'Membre',
]

export function TeamPage() {
  const [members, setMembers] = useState([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Membre')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [updatingRoleId, setUpdatingRoleId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let cancelled = false

    api('/team')
      .then((data) => {
        if (!cancelled) setMembers(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function save(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const member = await api('/team', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          role,
        }),
      })

      setMembers((current) => [...current, member])
      setEmail('')
      setRole('Membre')
      setSuccess(`${member.name} a été ajouté à votre équipe.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateRole(member, newRole) {
    if (member.role === newRole) return

    setError('')
    setSuccess('')
    setUpdatingRoleId(member.id)

    try {
      const updated = await api(`/team/${member.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      })

      setMembers((current) =>
        current.map((item) => (item.id === member.id ? { ...item, role: updated.role } : item))
      )

      setSuccess(`Le rôle de ${member.name} a été modifié.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingRoleId(null)
    }
  }

  async function remove(id) {
    setError('')
    setSuccess('')
    setRemovingId(id)

    try {
      await api(`/team/${id}`, { method: 'DELETE' })
      setMembers((current) => current.filter((member) => member.id !== id))
      setSuccess('Le membre a été retiré de votre équipe.')
    } catch (err) {
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Équipe" />

      <main className="page-content team-page">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Ajouter une personne</h2>
              <p>
                Saisissez l’adresse e-mail d’un compte Nexa existant pour l’ajouter à votre équipe.
              </p>
              <p>
                Les rôles sont informatifs : ils ne modifient pas les autorisations d’accès aux
                projets.
              </p>
            </div>
          </div>

          <form className="shortcut-form" onSubmit={save}>
            <label>
              E-mail du compte Nexa
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="exemple@domaine.fr"
                maxLength={254}
                required
              />
            </label>

            <label>
              Rôle
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                {TEAM_ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting ? 'Ajout en cours…' : 'Ajouter'}
            </button>
          </form>

          {error && (
            <p className="team-feedback team-feedback-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="team-feedback team-feedback-success" role="status">
              {success}
            </p>
          )}
        </section>

        <div className="team-grid">
          {loading ? (
            <p>Chargement de l’équipe…</p>
          ) : members.length === 0 ? (
            <p>Aucun membre dans votre équipe. Ajoutez un compte Nexa ci-dessus.</p>
          ) : (
            members.map((member) => {
              const initials = member.name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              const knownRole = member.role || 'Membre'

              return (
                <article className="team-card" key={member.id}>
                  <Avatar initials={initials} color="blue" />
                  <h2>{member.name}</h2>

                  <label>
                    Rôle
                    <select
                      value={knownRole}
                      disabled={updatingRoleId === member.id || removingId === member.id}
                      onChange={(event) => updateRole(member, event.target.value)}
                    >
                      {!TEAM_ROLES.includes(knownRole) && (
                        <option value={knownRole}>{knownRole}</option>
                      )}
                      {TEAM_ROLES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  {updatingRoleId === member.id && <p>Enregistrement du rôle…</p>}

                  <a href={`mailto:${member.email}`}>{member.email}</a>

                  <button
                    className="team-remove-button"
                    type="button"
                    disabled={removingId === member.id || updatingRoleId === member.id}
                    onClick={() => remove(member.id)}
                  >
                    {removingId === member.id ? 'Retrait…' : 'Retirer'}
                  </button>
                </article>
              )
            })
          )}
        </div>
      </main>
    </>
  )
}

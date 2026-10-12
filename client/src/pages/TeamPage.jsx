import { useState } from 'react'
import { Avatar, Header } from '../components/shared.jsx'
import { team as defaultTeam } from '../data/initialData.js'
import { readSaved } from '../lib/storage.js'

export function TeamPage() {
  const [members, setMembers] = useState(() =>
    readSaved('nexa-team', defaultTeam).map((member, index) => ({
      ...member,
      id: member.id || `local-${index}`,
    }))
  )
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Membre')
  function save(event) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (members.some((member) => member.email.toLowerCase() === cleanEmail))
      return window.alert('Cette adresse e-mail est déjà dans votre équipe.')
    const cleanName = name.trim()
    const next = [
      ...members,
      {
        id: `member-${Date.now()}`,
        name: cleanName,
        email: cleanEmail,
        role: role.trim(),
        initials: cleanName
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        color: 'blue',
      },
    ]
    setMembers(next)
    localStorage.setItem('nexa-team', JSON.stringify(next))
    setName('')
    setEmail('')
  }
  function remove(id) {
    const next = members.filter((member) => member.id !== id)
    setMembers(next)
    localStorage.setItem('nexa-team', JSON.stringify(next))
  }
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Équipe" />
      <main className="page-content">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Ajouter une personne</h2>
              <p>Ce carnet est enregistré dans ce navigateur.</p>
              <p>
                Les rôles indiqués ici sont informatifs et ne modifient pas les accès aux projets.
              </p>
            </div>
          </div>
          <form className="shortcut-form" onSubmit={save}>
            <label>
              Nom
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Rôle informatif
              <input value={role} onChange={(event) => setRole(event.target.value)} />
            </label>
            <button className="primary-button">Ajouter</button>
          </form>
        </section>
        <div className="team-grid">
          {members.map((member) => (
            <article className="team-card" key={member.id}>
              <Avatar initials={member.initials} color={member.color} />
              <h2>{member.name}</h2>
              <p>{member.role}</p>
              <a href={`mailto:${member.email}`}>{member.email}</a>
              <button className="team-remove-button" onClick={() => remove(member.id)}>
                Retirer
              </button>
            </article>
          ))}
        </div>
      </main>
    </>
  )
}

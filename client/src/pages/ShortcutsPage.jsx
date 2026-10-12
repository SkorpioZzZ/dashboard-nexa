import { useState } from 'react'
import { Header } from '../components/shared.jsx'
import { developmentApps } from '../data/initialData.js'
import { readSaved } from '../lib/storage.js'

export function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState(() =>
    readSaved(
      'nexa-shortcuts',
      developmentApps.map((item, index) => ({ ...item, id: `default-${index}` }))
    )
  )
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  function add(event) {
    event.preventDefault()
    const href = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`
    try {
      new URL(href)
    } catch {
      return
    }
    const next = [
      ...shortcuts,
      {
        id: `shortcut-${Date.now()}`,
        name: name.trim(),
        description: href,
        url: href,
        icon: name.trim()[0]?.toUpperCase(),
        tone: 'slate',
      },
    ]
    setShortcuts(next)
    localStorage.setItem('nexa-shortcuts', JSON.stringify(next))
    setName('')
    setUrl('')
  }
  function remove(id) {
    const next = shortcuts.filter((item) => item.id !== id)
    setShortcuts(next)
    localStorage.setItem('nexa-shortcuts', JSON.stringify(next))
  }
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Raccourcis" />
      <main className="page-content">
        <section className="panel shortcuts-panel">
          <form className="shortcut-form" onSubmit={add}>
            <label>
              Nom
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Adresse web
              <input value={url} onChange={(event) => setUrl(event.target.value)} required />
            </label>
            <button className="primary-button">Ajouter</button>
          </form>
          <div className="shortcut-grid">
            {shortcuts.map((item) => (
              <div className="app-shortcut" key={item.id}>
                <a className="shortcut-link" href={item.url} target="_blank" rel="noreferrer">
                  <span className={`app-icon ${item.tone}`}>{item.icon}</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                </a>
                <button
                  className="shortcut-remove"
                  onClick={() => remove(item.id)}
                  aria-label={`Retirer ${item.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

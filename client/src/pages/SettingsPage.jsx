import { useState } from 'react'
import { Header } from '../components/shared.jsx'
import { api } from '../lib/api.js'
import { readSaved } from '../lib/storage.js'

export function SettingsPage({ user, onUserUpdated, onAccountDeleted }) {
  const [settings, setSettings] = useState(() =>
    readSaved('nexa-settings', { general: {}, preferences: {} })
  )
  const [message, setMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  function save(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = {
      ...settings,
      general: {
        ...settings.general,
        timezone: data.get('timezone'),
        dateFormat: data.get('dateFormat'),
        weekStart: data.get('weekStart'),
        defaultPage: data.get('defaultPage'),
      },
    }
    localStorage.setItem('nexa-settings', JSON.stringify(next))
    setSettings(next)
    setMessage('Préférences enregistrées.')
  }
  async function updateProfile(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try {
      const result = await api('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: data.get('firstName'),
          lastName: data.get('lastName'),
          username: data.get('username'),
        }),
      })
      onUserUpdated(result.user)
      setMessage('Profil mis à jour.')
    } catch (error) {
      setMessage(error.message)
    }
  }
  async function updatePassword(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      setPasswordMessage('Les nouveaux mots de passe ne correspondent pas.')
      return
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: data.get('currentPassword'),
          newPassword: data.get('newPassword'),
        }),
      })
      form.reset()
      setPasswordMessage('Mot de passe modifié.')
    } catch (error) {
      setPasswordMessage(error.message)
    }
  }
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Paramètres" />
      <main className="page-content settings-page">
        <section className="panel">
          <h2>Préférences</h2>
          <form className="shortcut-form" onSubmit={save}>
            <label>
              Fuseau horaire
              <input name="timezone" defaultValue={settings.general?.timezone || 'Europe/Paris'} />
            </label>
            <label>
              Format de date
              <input name="dateFormat" defaultValue={settings.general?.dateFormat || 'fr-FR'} />
            </label>
            <label>
              Début de semaine
              <select name="weekStart" defaultValue={settings.general?.weekStart || 'monday'}>
                <option value="monday">Lundi</option>
                <option value="sunday">Dimanche</option>
              </select>
            </label>
            <label>
              Page d’accueil
              <select name="defaultPage" defaultValue={settings.general?.defaultPage || '/'}>
                <option value="/">Vue d’ensemble</option>
                <option value="/projets">Projets</option>
                <option value="/taches">Tâches</option>
              </select>
            </label>
            <button className="primary-button">Enregistrer</button>
          </form>
        </section>
        <section className="panel">
          <h2>Profil</h2>
          <form className="shortcut-form" onSubmit={updateProfile}>
            <label>
              Prénom
              <input
                name="firstName"
                defaultValue={user.firstName || user.name.split(' ')[0]}
                required
              />
            </label>
            <label>
              Nom
              <input
                name="lastName"
                defaultValue={user.lastName || user.name.split(' ').slice(1).join(' ')}
                required
              />
            </label>
            <label>
              Nom d’utilisateur
              <input name="username" defaultValue={user.username || ''} required />
            </label>
            <button className="primary-button">Mettre à jour</button>
          </form>
        </section>
        {message && <p role="status">{message}</p>}
        <section className="panel">
          <h2>Mot de passe</h2>
          <form className="shortcut-form" onSubmit={updatePassword}>
            <label>
              Mot de passe actuel
              <input name="currentPassword" type="password" required />
            </label>
            <label>
              Nouveau mot de passe
              <input name="newPassword" type="password" minLength="8" required />
            </label>
            <label>
              Confirmer le mot de passe
              <input name="confirmPassword" type="password" minLength="8" required />
            </label>
            <button className="primary-button">Changer le mot de passe</button>
          </form>
          {passwordMessage && <p role="status">{passwordMessage}</p>}
        </section>
        <section className="panel">
          <h2>Zone sensible</h2>
          <p>La suppression de votre compte efface vos projets et tâches associés.</p>
          <button
            className="danger-button"
            onClick={async () => {
              const password = window.prompt(
                'Saisissez votre mot de passe pour supprimer le compte.'
              )
              if (!password || !window.confirm('Confirmer la suppression définitive du compte ?'))
                return
              try {
                await api('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) })
                onAccountDeleted()
              } catch (error) {
                setMessage(error.message)
              }
            }}
          >
            Supprimer mon compte
          </button>
        </section>
      </main>
    </>
  )
}

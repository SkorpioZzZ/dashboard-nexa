import { useState } from 'react'

export function AuthPage({ onSubmit }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const data = Object.fromEntries(form.entries())
    const credentials =
      mode === 'register'
        ? {
            firstName: data.firstName,
            lastName: data.lastName,
            username: data.username,
            email: data.email,
            password: data.password,
          }
        : { email: data.email, password: data.password }
    setBusy(true)
    setError('')
    try {
      await onSubmit(credentials, mode)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="brand">
          <span className="brand-mark">N</span>
          <span>
            Nexa<span className="brand-dot">.</span>
          </span>
        </div>
        <h1>{mode === 'login' ? 'Bienvenue sur Nexa' : 'Créer un compte'}</h1>
        <p>Organisez vos projets et suivez vos tâches.</p>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label>
                Prénom
                <input name="firstName" autoComplete="given-name" required />
              </label>
              <label>
                Nom
                <input name="lastName" autoComplete="family-name" required />
              </label>
              <label>
                Nom d’utilisateur
                <input name="username" minLength="3" maxLength="30" required />
              </label>
            </>
          )}
          <label>
            Adresse e-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Mot de passe
            <input
              name="password"
              type="password"
              minLength="8"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
        <button
          className="text-link auth-toggle"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError('')
          }}
        >
          {mode === 'login' ? 'Nouveau sur Nexa ? Créer un compte' : 'Déjà inscrit ? Se connecter'}
        </button>
      </section>
    </main>
  )
}

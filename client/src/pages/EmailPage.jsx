import { EmailRows, Header } from '../components/shared.jsx'
import { recentEmails } from '../data/initialData.js'

export function EmailPage() {
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Email" />
      <main className="page-content">
        <section className="panel email-panel">
          <div className="panel-header">
            <div>
              <h2>Boîte de réception</h2>
              <p>Aperçu statique de messages récents</p>
            </div>
            <a
              className="text-link"
              href="https://mail.google.com"
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir Gmail ↗
            </a>
          </div>
          <EmailRows emails={recentEmails} />
          <small className="demo-note">
            Ces exemples ne sont pas synchronisés avec une boîte e-mail.
          </small>
        </section>
      </main>
    </>
  )
}

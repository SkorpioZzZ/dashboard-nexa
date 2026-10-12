import { useState } from 'react'
import { Header } from '../components/shared.jsx'

export function CalendarPage({ projects, tasks }) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const year = month.getFullYear()
  const index = month.getMonth()
  const offset = (new Date(year, index, 1).getDay() + 6) % 7
  const days = new Date(year, index + 1, 0).getDate()
  const events = [
    ...tasks.map((task) => ({ due: task.due, title: task.title })),
    ...projects.map((project) => ({ due: project.due, title: project.name })),
  ]
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Calendrier" />
      <main className="page-content">
        <section className="panel calendar-panel">
          <div className="calendar-heading">
            <button
              className="secondary-button"
              onClick={() => setMonth(new Date(year, index - 1, 1))}
            >
              ←
            </button>
            <h2>
              {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month)}
            </h2>
            <button
              className="secondary-button"
              onClick={() => setMonth(new Date(year, index + 1, 1))}
            >
              →
            </button>
          </div>
          <div className="calendar-grid">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div className="calendar-day blank" key={`blank-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const date = `${year}-${String(index + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
              return (
                <div className="calendar-day" key={date}>
                  <span>{i + 1}</span>
                  {events
                    .filter((event) => event.due === date)
                    .map((event, eventIndex) => (
                      <div
                        className="calendar-event task"
                        title={event.title}
                        key={`${date}-${eventIndex}`}
                      >
                        {event.title}
                      </div>
                    ))}
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </>
  )
}

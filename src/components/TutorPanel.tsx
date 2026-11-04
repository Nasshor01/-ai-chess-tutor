import { useEffect, useRef } from 'react'
import type { TutorMessage } from '../tutor/types'
import { CommentCard } from './CommentCard'
import { BookIcon, BulbIcon, SparkIcon } from './Icons'
import './TutorPanel.css'

interface Props {
  messages: TutorMessage[]
  plyLabel: (plyIndex: number) => string
}

export function TutorPanel({ messages, plyLabel }: Props) {
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const feed = feedRef.current
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <section className="card tutor" aria-label="AI trenér">
      <header className="tutor__header">
        <div className="tutor__avatar" aria-hidden="true">
          <SparkIcon />
        </div>
        <div>
          <h2 className="tutor__title">AI trenér</h2>
          <p className="tutor__subtitle">Komentuje každý tvůj tah</p>
        </div>
      </header>

      <div className="tutor__feed" ref={feedRef} aria-live="polite">
        {messages.map((message) => (
          <MessageView key={message.id} message={message} plyLabel={plyLabel} />
        ))}
      </div>
    </section>
  )
}

function MessageView({ message, plyLabel }: { message: TutorMessage; plyLabel: (i: number) => string }) {
  switch (message.kind) {
    case 'welcome':
      return <div className="bubble bubble--tutor">{message.text}</div>
    case 'info':
      return (
        <div className="bubble bubble--info">
          {message.title && <strong>{message.title}</strong>}
          <p>{message.text}</p>
        </div>
      )
    case 'thinking':
      return (
        <div className="bubble bubble--thinking">
          <span className="spinner" aria-hidden="true" />
          Trenér přemýšlí o tahu {plyLabel(message.plyIndex)}…
        </div>
      )
    case 'comment':
      return <CommentCard comment={message.comment} explain={message.explain} label={plyLabel(message.plyIndex)} />
    case 'opponent':
      return (
        <div className="bubble bubble--opponent">
          <span className="bubble__tag">Soupeř · {plyLabel(message.plyIndex)}</span>
          <p>{message.text}</p>
        </div>
      )
    case 'hint':
      return (
        <div className="bubble bubble--hint">
          <span className="bubble__tag">
            <BulbIcon width={14} height={14} /> Nápověda
          </span>
          <p>{message.text}</p>
          {message.line && <p className="bubble__line">Možné pokračování: {message.line}</p>}
        </div>
      )
    case 'opening':
      return (
        <div className={`bubble bubble--opening tone-${message.tone}`}>
          <span className="bubble__tag">
            <BookIcon width={14} height={14} /> {message.title}
          </span>
          <p>{message.text}</p>
        </div>
      )
  }
}

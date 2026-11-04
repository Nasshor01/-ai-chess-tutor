import type { TutorComment } from '../tutor/types'
import { QUALITY_LABEL, QUALITY_SYMBOL } from '../tutor/classify'
import './CommentCard.css'

interface Props {
  comment: TutorComment
  label: string
  explain?: boolean
}

export function CommentCard({ comment, label, explain }: Props) {
  const tone = comment.quality === 'book' ? 'book' : comment.verdict
  const explained = comment.concepts.filter((c) => c.showExplanation)
  const tags = comment.concepts.filter((c) => !c.showExplanation)

  return (
    <article className={`comment tone-${tone}`}>
      <header className="comment__header">
        <span className="comment__move">
          {explain ? 'Proč tento tah? ' : comment.byUser ? 'Tvůj tah ' : 'Tah soupeře '}
          <strong>{label}</strong>
        </span>
        <span className="comment__badge">
          <span className="comment__symbol">{QUALITY_SYMBOL[comment.quality]}</span>
          {QUALITY_LABEL[comment.quality]}
        </span>
      </header>

      <h3 className="comment__headline">{comment.headline}</h3>

      <ul className="comment__reasons">
        {comment.reasons.map((reason, i) => (
          <li key={i}>{reason}</li>
        ))}
      </ul>

      {comment.better && (
        <div className={`comment__better ${comment.better.minor ? 'is-minor' : ''}`}>
          <span className="comment__label">{comment.better.minor ? 'Ještě o něco přesnější' : 'Lepší alternativa'}</span>
          <p>
            <strong>{comment.better.san}</strong> – {comment.better.explanation}.
          </p>
          {comment.better.line && <p className="comment__line">{comment.better.line}</p>}
        </div>
      )}

      {(comment.threats.mine.length > 0 || comment.threats.against.length > 0) && (
        <div className="comment__threats">
          {comment.threats.mine.map((t, i) => (
            <p key={`m${i}`} className={comment.byUser ? 'threat threat--mine' : 'threat threat--against'}>
              {t}
            </p>
          ))}
          {comment.threats.against.map((t, i) => (
            <p key={`a${i}`} className={comment.byUser ? 'threat threat--against' : 'threat threat--mine'}>
              {t}
            </p>
          ))}
        </div>
      )}

      {explained.map(({ concept, isNew }) => (
        <div key={concept.id} className="concept">
          <span className="comment__label">{isNew ? 'Nový pojem' : 'Připomenutí'}: {concept.title}</span>
          <p>{concept.explanation}</p>
        </div>
      ))}

      {tags.length > 0 && (
        <div className="comment__tags">
          {tags.map(({ concept }) => (
            <span key={concept.id} className="tag" title={concept.short}>
              {concept.title}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

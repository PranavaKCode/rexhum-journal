import { type ComponentPropsWithoutRef, type ReactNode, useEffect, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { Info } from 'lucide-react'

interface AnnotationProps {
  children?: ReactNode
  'data-label'?: string
  'data-note'?: string
}

type AnnotationElementProps = AnnotationProps & ComponentPropsWithoutRef<'span'>

const contentCache = new Map<string, string>()

// expose svx annotations as touch-friendly inline notes
function Annotation({ 'data-label': label = 'note', 'data-note': note = '' }: AnnotationElementProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <span
      className="annotation"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={label}
        className="annotation-button"
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen((current) => !current)}
        onFocus={() => setIsOpen(true)}
      >
        <Info aria-hidden="true" size={13} strokeWidth={1.8} />
      </button>
      {isOpen ? (
        <span className="annotation-note" role="note">
          {note}
        </span>
      ) : null}
    </span>
  )
}

// keep markdown output aligned with the reader's restrained typography
const markdownComponents = {
  annotation: Annotation,
  h3: ({ children }: ComponentPropsWithoutRef<'h3'>) => <h2 className="entry-section">{children}</h2>,
  a: ({ children, ...props }: ComponentPropsWithoutRef<'a'>) => (
    <a {...props} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
} as Components

// render the selected body after the markdown chunk loads
function EntryMarkdown({ entryId }: { entryId: string }) {
  const [content, setContent] = useState(() => contentCache.get(entryId))

  // load the full prose only when the reader needs it
  useEffect(() => {
    let isCurrent = true
    const cachedContent = contentCache.get(entryId)

    if (cachedContent) {
      return () => {
        isCurrent = false
      }
    }

    import('../data/entryContent').then(({ entryContentById }) => {
      const nextContent = entryContentById[entryId]

      if (nextContent) {
        contentCache.set(entryId, nextContent)
      }

      if (isCurrent) {
        setContent(nextContent)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [entryId])

  if (!content) {
    return <p className="reader-fallback">Loading entry text...</p>
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}

export default EntryMarkdown

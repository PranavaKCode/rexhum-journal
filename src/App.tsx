import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BookOpen, Search } from 'lucide-react'
import { journalEntries, type JournalEntry } from './data/entries'
import './App.css'

const EntryMarkdown = lazy(() => import('./components/EntryMarkdown'))

const coverCreditUrl = 'https://www.wikiart.org/en/joseph-wright/arkwright-s-cotton-mills-by-night'
const sourceFolderUrl =
  'https://pranavakumar-iota.vercel.app/posts/folder/research-experience-in-humanities'

const colorMap: Record<string, string> = {
  'text-lavender': 'var(--lavender)',
  'text-peach': 'var(--peach)',
  'text-text': 'var(--text)',
  'text-subtext1': 'var(--muted)',
  'text-subtext0': 'var(--muted-strong)',
  'text-overlay2': 'var(--line-strong)',
}

interface TitleToken {
  color?: string
  italic: boolean
  size: number
}

// keep date labels compact and predictable across archive rows
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

// convert the old title config into local style tokens
function parseTitleConfig(config: string, wordCount: number) {
  const tokens = config.split(/\s+/).filter(Boolean)

  return Array.from({ length: wordCount }, (_item, index): TitleToken => {
    const token = tokens[index] ?? ''
    const colorToken = token.match(/\[([^\]]+)\]/)?.[1]
    const sizeToken = token.match(/^([\d.]+)/)?.[1]

    return {
      color: colorToken ? (colorMap[colorToken] ?? colorToken) : undefined,
      italic: token.includes('i'),
      size: sizeToken ? Number.parseFloat(sizeToken) : index < 2 ? 3.8 : 2.85,
    }
  })
}

// make the selected entry shareable through the hash
function readEntryFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '')
  return journalEntries.find((entry) => entry.id === id) ?? journalEntries[0]
}

// render the portfolio-style slab title without bringing over the old app shell
function SlabTitle({ entry }: { entry: JournalEntry }) {
  const words = entry.title.split(' ')
  const tokens = parseTitleConfig(entry.titleConfig, words.length)

  return (
    <h1 id="entry-title" className="slab-title" aria-label={entry.title}>
      {words.map((word, index) => {
        const token = tokens[index]

        return (
          <span
            key={`${word}-${index}`}
            className={token.italic ? 'slab-word italic' : 'slab-word'}
            style={{
              color: token.color,
              fontSize: `clamp(1.9rem, ${token.size * 0.72}vw, ${token.size}rem)`,
              fontWeight: token.italic ? 400 : 800,
            }}
          >
            {word}
          </span>
        )
      })}
    </h1>
  )
}

// match title, description, and tags without loading full entry bodies
function entryMatches(entry: JournalEntry, query: string) {
  const needle = query.trim().toLowerCase()

  if (!needle) {
    return true
  }

  return [entry.title, entry.description, entry.tags.join(' ')]
    .join(' ')
    .toLowerCase()
    .includes(needle)
}

// track reader scroll without storing per-paragraph state
function useReaderProgress(selectedId: string) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const nextProgress = scrollable > 0 ? window.scrollY / scrollable : 0
      setProgress(Math.min(1, Math.max(0, nextProgress)))
    }

    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)

    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [selectedId])

  return progress
}

function App() {
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry>(() => readEntryFromHash())
  const [query, setQuery] = useState('')
  const progress = useReaderProgress(selectedEntry.id)

  const filteredEntries = useMemo(
    () => journalEntries.filter((entry) => entryMatches(entry, query)),
    [query],
  )

  // keep back and forward navigation in sync with selected entries
  useEffect(() => {
    const handleHashChange = () => setSelectedEntry(readEntryFromHash())
    window.addEventListener('hashchange', handleHashChange)
    window.addEventListener('popstate', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
      window.removeEventListener('popstate', handleHashChange)
    }
  }, [])

  // update browser chrome when the reader changes entries
  useEffect(() => {
    document.title = `${selectedEntry.title} | Rexhum Journal`
  }, [selectedEntry])

  // switch entries and preserve a direct link for sharing
  function selectEntry(entry: JournalEntry) {
    setSelectedEntry(entry)
    window.history.pushState(null, '', `#${entry.id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="app-shell">
      <aside className="archive-panel" aria-label="journal archive">
        <header className="archive-header">
          <div>
            <p className="archive-kicker">Research Experience in Humanities</p>
            <h2>Rexhum Journal</h2>
          </div>
          <a className="source-link" href={sourceFolderUrl} target="_blank" rel="noreferrer">
            <ArrowUpRight aria-hidden="true" size={16} />
            source
          </a>
        </header>

        <figure className="cover-figure">
          <img
            src="/arkwright-cotton-mills-by-night.jpg"
            alt="Arkwright's Cotton Mills by Night by Joseph Wright"
          />
          <figcaption>
            Joseph Wright, <a href={coverCreditUrl}>Arkwright's Cotton Mills by Night</a>
          </figcaption>
        </figure>

        <label className="search-field">
          <Search aria-hidden="true" size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search entries"
          />
        </label>

        <div className="archive-meta">
          <span>{filteredEntries.length} shown</span>
          <span>{journalEntries.length} total</span>
        </div>

        <nav className="entry-list" aria-label="entries">
          {filteredEntries.map((entry) => {
            const isSelected = entry.id === selectedEntry.id

            return (
              <button
                type="button"
                key={entry.id}
                className={isSelected ? 'entry-button selected' : 'entry-button'}
                aria-current={isSelected ? 'page' : undefined}
                onClick={() => selectEntry(entry)}
              >
                <span className="entry-button-date">{formatDate(entry.publishedAt)}</span>
                <span className="entry-button-title">{entry.title}</span>
                <span className="entry-button-description">{entry.description}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <article className="reader-panel" aria-labelledby="entry-title">
        <div className="reader-progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>

        <header className="reader-header">
          <div className="reader-meta">
            <span>{formatDate(selectedEntry.publishedAt)}</span>
            <span>{selectedEntry.readingMinutes} min read</span>
            <span>{selectedEntry.wordCount.toLocaleString()} words</span>
          </div>
          <SlabTitle entry={selectedEntry} />
          <p className="reader-description">{selectedEntry.description}</p>
          <div className="tag-line" aria-label="tags">
            {selectedEntry.tags.map((tag, index) => (
              <span key={tag}>
                {index > 0 ? ' / ' : ''}
                {tag}
              </span>
            ))}
          </div>
          <a className="original-link" href={selectedEntry.sourceUrl} target="_blank" rel="noreferrer">
            <BookOpen aria-hidden="true" size={16} />
            original post
          </a>
        </header>

        <div className="entry-content">
          <Suspense fallback={<p className="reader-fallback">Loading entry text...</p>}>
            <EntryMarkdown key={selectedEntry.id} entryId={selectedEntry.id} />
          </Suspense>
        </div>
      </article>
    </main>
  )
}

export default App

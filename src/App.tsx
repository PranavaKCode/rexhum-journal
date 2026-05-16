import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Search,
  Tag,
  X,
} from 'lucide-react'
import { journalEntries, type JournalEntry } from './data/entries'
import './App.css'

const EntryMarkdown = lazy(() => import('./components/EntryMarkdown'))

const sourceFolderUrl =
  'https://pranavakumar-iota.vercel.app/posts/folder/research-experience-in-humanities'

const collapseHintStorageKey = 'rexhum-collapse-hint-seen'
const paletteStorageKey = 'rexhum-palette'
const paletteTouchedStorageKey = 'rexhum-palette-touched'
const paletteNames = ['latte', 'frappe', 'macchiato', 'mocha'] as const
const accentColorNames = [
  'rosewater',
  'flamingo',
  'pink',
  'mauve',
  'red',
  'maroon',
  'peach',
  'yellow',
  'green',
  'teal',
  'sky',
  'sapphire',
  'blue',
  'lavender',
] as const

type PaletteName = (typeof paletteNames)[number]
type AccentColorName = (typeof accentColorNames)[number]

const colorMap: Record<string, string> = {
  'text-lavender': 'var(--lavender)',
  'text-peach': 'var(--peach)',
  'text-text': 'var(--text)',
  'text-subtext1': 'var(--muted)',
  'text-subtext0': 'var(--muted-strong)',
  'text-overlay2': 'var(--line-strong)',
}

const titleFallbackColors = ['var(--text)', 'var(--muted-strong)', 'var(--muted)', 'var(--line-strong)']

interface TitleToken {
  color?: string
  italic: boolean
  size: number
}

// keep saved preferences small and local
function readStoredValue<T extends string>(key: string, fallback: T, validValues: readonly T[]) {
  const storedValue = window.localStorage.getItem(key)
  return validValues.includes(storedValue as T) ? (storedValue as T) : fallback
}

// keep sidebar preference stable between visits
function readStoredBoolean(key: string, fallback: boolean) {
  const storedValue = window.localStorage.getItem(key)
  return storedValue === null ? fallback : storedValue === 'true'
}

// upgrade the old automatic light default without erasing a deliberate dark choice
function readInitialPalette() {
  const storedPalette = window.localStorage.getItem(paletteStorageKey)
  const hasChosenPalette = window.localStorage.getItem(paletteTouchedStorageKey) === 'true'

  if (!hasChosenPalette && (!storedPalette || storedPalette === 'latte')) {
    return 'mocha'
  }

  return readStoredValue(paletteStorageKey, 'mocha', paletteNames)
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
      size: sizeToken ? Number.parseFloat(sizeToken) : 3,
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
              color: token.color ?? titleFallbackColors[hashCode(`${entry.hash}-${word}-${index}`) % titleFallbackColors.length],
              fontSize: `clamp(2rem, ${token.size * 1.08}vw, ${token.size}rem)`,
              fontWeight: token.italic ? 400 : 900,
            }}
          >
            {word}
          </span>
        )
      })}
    </h1>
  )
}

// hash tags into the same accent family as the portfolio tags
function hashCode(value: string) {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function EntryTags({ entry }: { entry: JournalEntry }) {
  return (
    <div className="tag-list" aria-label="tags">
      <Tag aria-hidden="true" size={16} strokeWidth={1.8} />
      {entry.tags.map((tagName) => {
        const colorName = accentColorNames[hashCode(`${entry.id}-${tagName}`) % accentColorNames.length]

        return (
          <span className="tag-chip" key={tagName} style={{ color: `var(--accent-${colorName})` }}>
            {tagName}
          </span>
        )
      })}
    </div>
  )
}

// group reader display preferences in one compact toolbar
function ThemeControls({
  accent,
  isArchiveOpen,
  palette,
  showArchiveHint,
  onDismissArchiveHint,
  setAccent,
  setIsArchiveOpen,
  setPalette,
}: {
  accent: AccentColorName
  isArchiveOpen: boolean
  palette: PaletteName
  showArchiveHint: boolean
  onDismissArchiveHint: () => void
  setAccent: (accent: AccentColorName) => void
  setIsArchiveOpen: (isOpen: boolean) => void
  setPalette: (palette: PaletteName) => void
}) {
  return (
    <div className="reader-controls" aria-label="reader controls">
      <div className="collapse-control">
        <button
          type="button"
          className="icon-control"
          aria-label={isArchiveOpen ? 'Collapse archive' : 'Show archive'}
          title={isArchiveOpen ? 'Collapse archive' : 'Show archive'}
          onClick={() => {
            setIsArchiveOpen(!isArchiveOpen)
            onDismissArchiveHint()
          }}
        >
          {isArchiveOpen ? (
            <PanelLeftClose aria-hidden="true" size={17} />
          ) : (
            <PanelLeftOpen aria-hidden="true" size={17} />
          )}
        </button>

        {isArchiveOpen && showArchiveHint ? (
          <div className="collapse-hint" role="status">
            <span>collapse the archive for a full-width reader</span>
            <button
              type="button"
              className="hint-dismiss"
              aria-label="Dismiss collapse hint"
              title="Dismiss"
              onClick={onDismissArchiveHint}
            >
              <X aria-hidden="true" size={13} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="palette-control" aria-label="theme">
        <Palette aria-hidden="true" size={16} />
        {paletteNames.map((paletteName) => (
          <button
            type="button"
            key={paletteName}
            className={paletteName === palette ? 'palette-button selected' : 'palette-button'}
            aria-pressed={paletteName === palette}
            onClick={() => {
              window.localStorage.setItem(paletteTouchedStorageKey, 'true')
              setPalette(paletteName)
            }}
          >
            {paletteName}
          </button>
        ))}
      </div>

      <div className="accent-control" aria-label="accent color">
        {accentColorNames.map((accentName) => (
          <button
            type="button"
            key={accentName}
            className={accentName === accent ? 'accent-swatch selected' : 'accent-swatch'}
            style={{ backgroundColor: `var(--accent-${accentName})` }}
            aria-label={`Use ${accentName} accent`}
            aria-pressed={accentName === accent}
            onClick={() => setAccent(accentName)}
            title={accentName}
          >
            {accentName === accent ? <Check aria-hidden="true" size={11} strokeWidth={3} /> : null}
          </button>
        ))}
      </div>
    </div>
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
  const [palette, setPalette] = useState<PaletteName>(() => readInitialPalette())
  const [accent, setAccent] = useState<AccentColorName>(() =>
    readStoredValue('rexhum-accent', 'peach', accentColorNames),
  )
  const [isArchiveOpen, setIsArchiveOpen] = useState(() => readStoredBoolean('rexhum-archive-open', true))
  const [showArchiveHint, setShowArchiveHint] = useState(() => !readStoredBoolean(collapseHintStorageKey, false))
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

  // apply reader theme to css variables and persist it
  useEffect(() => {
    document.documentElement.dataset.theme = palette
    window.localStorage.setItem(paletteStorageKey, palette)
  }, [palette])

  // apply accent independently from the palette
  useEffect(() => {
    document.documentElement.dataset.accent = accent
    window.localStorage.setItem('rexhum-accent', accent)
  }, [accent])

  // remember whether the archive is hidden
  useEffect(() => {
    window.localStorage.setItem('rexhum-archive-open', String(isArchiveOpen))
  }, [isArchiveOpen])

  // switch entries and preserve a direct link for sharing
  function selectEntry(entry: JournalEntry) {
    setSelectedEntry(entry)
    window.history.pushState(null, '', `#${entry.id}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // only show the collapse hint until the reader acknowledges it
  function dismissArchiveHint() {
    if (!showArchiveHint) {
      return
    }

    setShowArchiveHint(false)
    window.localStorage.setItem(collapseHintStorageKey, 'true')
  }

  return (
    <main className={isArchiveOpen ? 'app-shell' : 'app-shell archive-collapsed'}>
      {isArchiveOpen ? (
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
                  <EntryTags entry={entry} />
                  <span className="entry-button-description">{entry.description}</span>
                </button>
              )
            })}
          </nav>
        </aside>
      ) : null}

      <article className="reader-panel" aria-labelledby="entry-title">
        <div className="reader-progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>

        <header className="reader-header">
          <ThemeControls
            accent={accent}
            isArchiveOpen={isArchiveOpen}
            showArchiveHint={showArchiveHint}
            onDismissArchiveHint={dismissArchiveHint}
            palette={palette}
            setAccent={setAccent}
            setIsArchiveOpen={setIsArchiveOpen}
            setPalette={setPalette}
          />
          <div className="reader-meta">
            <span>{formatDate(selectedEntry.publishedAt)}</span>
            <span>{selectedEntry.readingMinutes} min read</span>
            <span>{selectedEntry.wordCount.toLocaleString()} words</span>
          </div>
          <SlabTitle entry={selectedEntry} />
          <p className="reader-description">{selectedEntry.description}</p>
          <EntryTags entry={selectedEntry} />
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

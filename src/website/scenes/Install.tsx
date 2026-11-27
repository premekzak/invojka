import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronRight, Download, FileText, FolderOpen, House, Image, Monitor, Plus, Search, X } from 'lucide-react'
import cs from '@/i18n/cs'
import { Logo, WORDMARK } from '@/ui/Logo'
import { Button, Card, Choice, cn } from '@/ui/primitives'
import { click, Stage, useScene, type Frame } from '../scene/Stage'

/* The scene "no installation": download one file and open it, choose the data folder, say how you start, and the
   Home tile for the first invoice is there. It follows the welcome screen (src/features/onboarding/Welcome.tsx), the
   first step of onboarding (Onboarding.tsx) and Home's "Nová faktura" tile; when they change, change this with them.
   The download page is drawn plainly (it stands for this website and copies no browser); the folder window is the
   system's own, as Windows 11 shows it. The scene cuts from the first onboarding step to Home; the steps
   between (your details, VAT, taxes) are left out. */

const SOURCES = ['new', 'fakturoid', 'idoklad', 'other'] as const
const FOLDERS = [
  { name: 'Daně', changed: '14. 01. 2026 9:12' },
  { name: 'Smlouvy', changed: '03. 09. 2026 16:05' },
  { name: 'Účetnictví', changed: '22. 10. 2026 11:31' },
]
/** The folder the scene makes: a new user has none for the data yet, so the window can't offer one. */
const NEW_FOLDER = 'Faktury'
/** What the system calls a folder until it gets a name. */
const UNNAMED = 'Nová složka'
const noop = () => {}

type State = {
  phase: number
  screen: 'site' | 'welcome' | 'start' | 'home'
  file: boolean
  picker: boolean
  /** The name of the folder being made in the window (null: not made yet); `folder`: it has its name and is chosen. */
  newFolder: string | null; folder: boolean
  source: boolean
  cursor: string | null; press: boolean
}

const INITIAL: State = { phase: 0, screen: 'site', file: false, picker: false, newFolder: null, folder: false, source: false, cursor: null, press: false }

const FRAMES: Frame<State>[] = [
  // 1 Download the file and open it.
  { wait: 2800, set: INITIAL },
  ...click<State>('download', 700),
  { wait: 250, set: { file: true } },
  ...click<State>('file', 1100),
  // 2 The app opens; make a folder for the data and choose it.
  { wait: 120, set: { phase: 1, screen: 'welcome' } },
  ...click<State>('pick', 1300),
  { wait: 0, set: { picker: true } },
  // Nobody has made a folder for the data yet, so the scene makes one: "Nová složka", its name, Enter.
  ...click<State>('newfolder', 900),
  { wait: 0, set: { newFolder: UNNAMED } },
  ...[...NEW_FOLDER].map((_, i) => ({ wait: i === 0 ? 800 : 110, set: { newFolder: NEW_FOLDER.slice(0, i + 1) } })),
  { wait: 600, set: { folder: true } },
  ...click<State>('choose', 700),
  // 3 Say how you start; then Home.
  { wait: 120, set: { phase: 2, screen: 'start', picker: false } },
  ...click<State>('new', 1700),
  { wait: 0, set: { source: true } },
  { wait: 1300, set: { screen: 'home', cursor: 'tile' } },
]

function SiteScreen({ s }: { s: State }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <Card className="flex w-full max-w-md flex-col items-center gap-5 p-8 text-center">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="font-display text-xl font-semibold">{WORDMARK}</span>
        </div>
        <p className="text-base text-fg-muted">{cs.app.tagline}</p>
        <Button size="lg" data-cue="download"><Download className="size-5" /> Stáhnout zdarma</Button>
      </Card>
      {/* The downloaded file; the space is kept so the card doesn't jump when it appears. */}
      <div className="h-16 w-full max-w-md">
        {s.file && (
          <Card data-cue="file" className="animate-rise flex items-center gap-3 px-4 py-3">
            <FileText className="size-8 shrink-0 text-fg-muted" strokeWidth={1.5} />
            <div className="min-w-0">
              <div className="text-sm font-medium">invojka.html</div>
              <div className="text-xs text-fg-muted">Staženo. Otevřete dvojklikem.</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

/** A folder as the system draws it; our own drawing, in the window's colours. */
export function WinFolder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('size-4 shrink-0', className)}>
      <path d="M1 3.5a1 1 0 0 1 1-1h3.6l1.5 1.5H14a1 1 0 0 1 1 1V6H1z" fill="var(--win-folder-back)" />
      <rect x="1" y="5" width="14" height="8.5" rx="1" fill="var(--win-folder)" />
    </svg>
  )
}

const WIN_NAV: { name: string; icon: typeof Monitor | null; current?: boolean }[] = [
  { name: 'Domů', icon: House }, { name: 'Galerie', icon: Image },
  { name: 'Plocha', icon: Monitor }, { name: 'Stažené soubory', icon: ArrowDownToLine },
  { name: 'Dokumenty', icon: null, current: true }, { name: 'Obrázky', icon: Image },
]

/**
 * The system's "Vybrat složku" window as Windows 11 shows it (the owner, 2026-11-27: "aby ten výběr složky byl
 * opravdový, třeba z windows 11"), because that is what the visitor will meet. It is the one part of a scene that is
 * not built from the app's components or its colour roles: its colours are the `--win-*` values in site.css.
 */
function FolderWindow({ s }: { s: State }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center">
      <div className="win11 animate-rise flex h-[23.5rem] w-[39rem] flex-col overflow-hidden">
        <div className="flex h-8 items-center justify-between pr-2 pl-3">
          <span>Vybrat složku</span>
          <X className="size-4" strokeWidth={1.5} />
        </div>
        <div className="flex h-9 items-center gap-2 px-3">
          <ArrowLeft className="win-dim size-4" strokeWidth={1.5} /><ArrowRight className="win-dim size-4 opacity-40" strokeWidth={1.5} /><ArrowUp className="win-dim size-4" strokeWidth={1.5} />
          <div className="win-field flex h-7 flex-1 items-center gap-1 px-2">
            <WinFolder /><ChevronRight className="win-dim size-3" /> Tento počítač <ChevronRight className="win-dim size-3" /> Dokumenty
          </div>
          <div className="win-field win-dim flex h-7 w-40 items-center justify-between px-2">Prohledat: Dokumenty <Search className="size-3.5" /></div>
        </div>
        <div className="flex h-9 items-center gap-5 px-4">
          <span>Uspořádat <ChevronDown className="inline size-3" /></span><span data-cue="newfolder">{UNNAMED}</span>
        </div>
        <div className="win-pane flex min-h-0 flex-1">
          <div className="win-rule w-40 shrink-0 space-y-px border-r py-1.5 pr-1 pl-2">
            {WIN_NAV.map((n) => (
              <div key={n.name} className={cn('flex h-6 items-center gap-2 rounded px-2', n.current && 'win-current')}>
                {n.icon ? <n.icon className="win-dim size-4 shrink-0" strokeWidth={1.5} /> : <WinFolder />} {n.name}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 px-1 py-1">
            <div className="win-dim win-rule grid h-6 grid-cols-[1fr_7.5rem_6.5rem] items-center border-b px-2">
              <span>Název</span><span>Datum změny</span><span>Typ</span>
            </div>
            {FOLDERS.map((f) => (
              <div key={f.name} className="grid h-7 grid-cols-[1fr_7.5rem_6.5rem] items-center rounded px-2">
                <span className="flex items-center gap-2"><WinFolder /> {f.name}</span>
                <span className="win-dim tabular-nums">{f.changed}</span><span className="win-dim">Složka souborů</span>
              </div>
            ))}
            {s.newFolder !== null && (
              <div className={cn('grid h-7 grid-cols-[1fr_7.5rem_6.5rem] items-center rounded px-2', s.folder && 'win-selected')}>
                <span className="flex items-center gap-2">
                  <WinFolder />
                  {/* Being named: the system's edit box, with the placeholder name selected until the first letter. */}
                  {s.folder ? s.newFolder : (
                    <span className="win-edit">
                      <span className={cn(s.newFolder === UNNAMED && 'win-marked')}>{s.newFolder}</span>
                      {s.newFolder !== UNNAMED && <span className="scene-caret" />}
                    </span>
                  )}
                </span>
                <span className="win-dim tabular-nums">27. 11. 2026 19:40</span><span className="win-dim">Složka souborů</span>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2.5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="w-24 text-right">Složka:</span>
            <div className="win-field flex h-6 flex-1 items-center px-2">{s.folder && s.newFolder}</div>
          </div>
          <div className="flex justify-end gap-2">
            <span data-cue="choose" className={cn('win-button win-default', !s.folder && 'win-dim')}>Vybrat složku</span>
            <span className="win-button">Zrušit</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen() {
  return (
    <div className="grid h-full place-items-center">
      <Card className="animate-rise w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="size-10" />
          <div>
            <div className="font-sans text-4xl font-bold tracking-[-0.02em]">{WORDMARK}</div>
            <p className="text-sm text-fg-muted">{cs.app.tagline}</p>
          </div>
        </div>
        <div className="space-y-3">
          <Button size="lg" className="w-full" data-cue="pick"><FolderOpen className="size-5" /> {cs.welcome.pick}</Button>
          <p className="text-xs text-fg-muted">{cs.welcome.pickHint}</p>
        </div>
      </Card>
    </div>
  )
}

function StartScreen({ s }: { s: State }) {
  const o = cs.onboarding
  return (
    <Card className="animate-rise mx-auto w-full max-w-2xl px-8 py-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-fg-subtle">{o.step.replace('{{n}}', '1').replace('{{total}}', '4')}</p>
          <div className="mt-1 font-display text-4xl font-semibold">{o.start}</div>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => <div key={i} className={cn('h-1 w-8 rounded-sm', i === 0 ? 'bg-accent' : 'bg-surface-3')} />)}
        </div>
      </div>
      <div className="space-y-2">
        {SOURCES.map((key) => (
          <div key={key} data-cue={key === 'new' ? 'new' : undefined}>
            <Choice selected={s.source && key === 'new'} onClick={noop} title={o.sources[key]} hint={o.sources[`${key}Hint`]} />
          </div>
        ))}
      </div>
    </Card>
  )
}

function HomeScreen() {
  return (
    <div className="grid h-full place-items-center">
      <div data-cue="tile" className="scheme-feature animate-rise flex size-[17.5rem] flex-col justify-between gap-4 rounded-2xl bg-accent px-6 py-5 text-feature-fg">
        <Plus className="size-11" strokeWidth={2.25} />
        <div>
          <div className="text-lg font-semibold">{cs.nav.newInvoice}</div>
          <div className="mt-0.5 text-xs text-feature-fg/90">{cs.home.tileNewHint}</div>
        </div>
      </div>
    </div>
  )
}

export function InstallScene({ scene }: { scene: ReturnType<typeof useInstallScene> }) {
  const s = scene.state
  return (
    <Stage width={720} height={480} cursor={s.cursor} press={s.press} sceneKey={`${s.screen}${s.file}${s.picker}`}>
      <div className={cn('relative h-full p-6', s.screen === 'site' ? 'bg-surface-2' : 'bg-bg')}>
        {/* Over the whole stage, like the system's window over the browser. */}
        {s.picker && <FolderWindow s={s} />}
        {s.screen === 'site' && <SiteScreen s={s} />}
        {s.screen === 'welcome' && <WelcomeScreen />}
        {s.screen === 'start' && <StartScreen s={s} />}
        {s.screen === 'home' && <HomeScreen />}
      </div>
    </Stage>
  )
}

export const useInstallScene = () => useScene('install', INITIAL, FRAMES)

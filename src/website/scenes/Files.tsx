import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, CircleCheck, File, FileText, RefreshCw, Search, Send, X } from 'lucide-react'
import { Button, Card, cn } from '@/ui/primitives'
import { app, fileDate, money, tr } from '../locale'
import { click, Stage, useScene, type Frame } from '../scene/Stage'
import { WinFolder } from './Install'

/* The scene "your data are your files": issue an invoice in the app, its PDF appears in the data folder beside it, the
   drive the folder lives on syncs it, and the folder's top level shows the plain files Invojka keeps
   (docs/data-model.md: settings.json, customers.json, invoices.json, pdf/<year>/<number>.pdf, AGENTS.md). When those
   files change, change the lists here. The folder is the system's file window in the Windows 11 look of the
   installation scene (`.win11` in site.css); the drive is named in words, with no service's logo, and the sync marks
   are plain icons. All names and numbers are made up. */

const NUMBER = '2026-0042'
const TOTAL = money(1_290_000)
/** The data folder, named as the installation scene names it, on a drive named in words. */
const FOLDER = tr('Faktury', 'Invoices')
const DRIVE = tr('Disk Google', 'Google Drive')
const cols = 'grid grid-cols-[1fr_3.5rem_7.5rem] items-center'

const PDFS = [
  { name: '2026-0039.pdf', changed: '02. 10. 2026 10:14' },
  { name: '2026-0040.pdf', changed: '21. 10. 2026 15:02' },
  { name: '2026-0041.pdf', changed: '03. 11. 2026 9:47' },
]
const ROOT = [
  { name: 'pdf', folder: true, changed: '27. 11. 2026 19:52' },
  { name: 'AGENTS.md', changed: '27. 11. 2026 19:40' },
  { name: 'customers.json', changed: '21. 10. 2026 15:01' },
  { name: 'invoices.json', changed: '27. 11. 2026 19:52' },
  { name: 'settings.json', changed: '27. 11. 2026 19:41' },
]

type State = {
  phase: number
  issued: boolean
  /** The new PDF in the folder: not there yet, being synced by the drive, synced. */
  file: 'none' | 'syncing' | 'synced'
  view: 'year' | 'root'
  cursor: string | null; press: boolean
}

const INITIAL: State = { phase: 0, issued: false, file: 'none', view: 'year', cursor: null, press: false }

const FRAMES: Frame<State>[] = [
  // 1 Issue the invoice.
  { wait: 3400, set: INITIAL },
  ...click<State>('issue', 1000),
  { wait: 200, set: { issued: true } },
  // 2 Its PDF is in the folder; the drive syncs it.
  { wait: 700, set: { phase: 1, file: 'syncing', cursor: 'newfile' } },
  { wait: 2000, set: { file: 'synced' } },
  // 3 Up to the data folder: plain files.
  ...click<State>('crumb', 1800),
  { wait: 0, set: { phase: 2, view: 'root' } },
]

/** The invoice in the app, cut down to what this story needs: the amount, the button, then the confirmation. */
function AppCard({ s }: { s: State }) {
  return (
    <Card className="flex w-60 shrink-0 flex-col gap-4 self-center px-5 py-5">
      {s.issued ? (
        <>
          <span className="scene-pop flex size-10 items-center justify-center rounded-full bg-success-chip text-success"><Check className="size-5" /></span>
          <div className="space-y-1">
            <div className="font-display text-xl font-semibold">{app.pdfScreen.issued}</div>
            <p className="text-xs break-words text-fg-muted">{app.pdfScreen.savedIn.replace('{{path}}', `${FOLDER}/pdf/2026/${NUMBER}.pdf`)}</p>
          </div>
        </>
      ) : (
        <>
          <div className="font-display text-xl font-semibold">{tr('Faktura', 'Invoice')} {NUMBER}</div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-fg-muted">{app.invoices.customer}</dt><dd className="truncate">Pekařství U Klásku</dd></div>
            <div className="flex justify-between font-semibold"><dt>{app.editor.toPay}</dt><dd className="tabular-nums">{TOTAL}</dd></div>
          </dl>
          <Button data-cue="issue" className="self-start"><Send className="size-4" /> {app.editor.issue}</Button>
        </>
      )}
    </Card>
  )
}

function Status({ state }: { state: 'syncing' | 'synced' }) {
  return state === 'synced'
    ? <CircleCheck className="win-ok size-4" strokeWidth={1.75} />
    : <RefreshCw className="win-accent size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={2} />
}

function FolderWindow({ s }: { s: State }) {
  const root = s.view === 'root'
  const path = root ? [DRIVE, FOLDER] : [DRIVE, FOLDER, 'pdf', '2026']
  return (
    <div className="win11 flex h-[21rem] min-w-0 flex-1 flex-col self-center overflow-hidden">
      <div className="flex h-8 items-center justify-between pr-2 pl-3">
        <span className="flex items-center gap-2"><WinFolder /> {path.at(-1)}</span>
        <X className="size-4" strokeWidth={1.5} />
      </div>
      <div className="flex h-9 items-center gap-2 px-3">
        <ArrowLeft className="win-dim size-4" strokeWidth={1.5} /><ArrowRight className="win-dim size-4 opacity-40" strokeWidth={1.5} /><ArrowUp className="win-dim size-4" strokeWidth={1.5} />
        <div className="win-field flex h-7 flex-1 items-center gap-1 px-2">
          {path.map((p, i) => (
            <span key={p} className="flex items-center gap-1" data-cue={p === FOLDER ? 'crumb' : undefined}>
              {i > 0 && <ChevronRight className="win-dim size-3" />}{p}
            </span>
          ))}
        </div>
        <div className="win-field win-dim flex size-7 items-center justify-center"><Search className="size-3.5" /></div>
      </div>
      <div key={s.view} className="win-pane animate-rise min-h-0 flex-1 px-1 py-1">
        <div className={cn(cols, 'win-dim win-rule h-6 border-b px-2')}><span>{tr('Název', 'Name')}</span><span>{tr('Stav', 'Status')}</span><span>{tr('Datum změny', 'Date modified')}</span></div>
        {root ? ROOT.map((f) => (
          <div key={f.name} className={cn(cols, 'h-7 rounded px-2')}>
            <span className="flex items-center gap-2">{f.folder ? <WinFolder /> : <File className="win-dim size-4" strokeWidth={1.5} />} {f.name}</span>
            <Status state="synced" /><span className="win-dim tabular-nums">{fileDate(f.changed)}</span>
          </div>
        )) : (
          <>
            {PDFS.map((f) => (
              <div key={f.name} className={cn(cols, 'h-7 rounded px-2')}>
                <span className="flex items-center gap-2"><FileText className="win-dim size-4" strokeWidth={1.5} /> {f.name}</span>
                <Status state="synced" /><span className="win-dim tabular-nums">{fileDate(f.changed)}</span>
              </div>
            ))}
            {s.file !== 'none' && (
              <div className={cn(cols, 'win-selected animate-rise h-7 rounded px-2')}>
                <span className="flex items-center gap-2"><FileText className="win-dim size-4" strokeWidth={1.5} /> <span data-cue="newfile">{NUMBER}.pdf</span></span>
                <Status state={s.file} /><span className="win-dim tabular-nums">{fileDate('27. 11. 2026 19:52')}</span>
              </div>
            )}
          </>
        )}
      </div>
      <div className="win-dim flex h-7 items-center px-3">{tr('Položky:', 'Items:')} {root ? ROOT.length : PDFS.length + (s.file === 'none' ? 0 : 1)}</div>
    </div>
  )
}

export function FilesScene({ scene }: { scene: ReturnType<typeof useFilesScene> }) {
  const s = scene.state
  return (
    <Stage width={720} height={420} cursor={s.cursor} press={s.press} sceneKey={`${s.view}${s.file}${s.issued}`}>
      <div className="flex h-full gap-4 bg-surface-2 p-6">
        <AppCard s={s} />
        <FolderWindow s={s} />
      </div>
    </Stage>
  )
}

export const useFilesScene = () => useScene('files', INITIAL, FRAMES)

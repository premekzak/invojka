import { Download, Pause, Play } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import cs from '@/i18n/cs'
import { Logo, WORDMARK } from '@/ui/Logo'
import { cn } from '@/ui/primitives'
import { track } from './analytics'
import { ConsentBanner, openConsent } from './Consent'
import { Faq } from './Faq'
import { Headline } from './Hero'
import { FilesScene, useFilesScene } from './scenes/Files'
import { InstallScene, useInstallScene } from './scenes/Install'
import { InvoiceStepsScene, useInvoiceStepsScene } from './scenes/InvoiceSteps'
import { StatsScene, useStatsScene } from './scenes/Stats'

/** Always the newest release (docs/development.md). */
const DOWNLOAD = 'https://github.com/premekzak/invojka/releases/latest/download/invojka.html'
const SOURCE = 'https://github.com/premekzak/invojka'

/** Drives that sync a folder on the computer, which is all Invojka needs from them. */
const DRIVES = ['Disk Google', 'OneDrive', 'Dropbox']

const focus ='focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link'
const container = 'mx-auto w-full max-w-6xl px-4 sm:px-8'
/** The masthead and the bar above it get more room, so the scene can be larger. */
const wide = 'mx-auto w-full max-w-7xl px-4 sm:px-8'

/** `inverse`: on the accent-coloured closing block, where the accent button would vanish: the logo's dark pair. */
function DownloadLink({ large, inverse, place }: { large?: boolean; inverse?: boolean; /** Where on the page, for the measured event. */ place: 'masthead' | 'closing' }) {
  return (
    <a href={DOWNLOAD} download onClick={() => track({ event: 'download_click', place })}
      className={cn('inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors', focus,
        inverse ? 'bg-brand text-brand-fg hover:bg-fg' : 'bg-accent text-accent-fg hover:bg-accent-deep',
        large ? 'h-12 px-6 text-base' : 'h-9 px-4 text-sm leading-label')}>
      <Download aria-hidden="true" className={large ? 'size-5' : 'size-4'} /> Stáhnout zdarma
    </a>
  )
}

/**
 * One feature: what it does in words on one side, its scene on the other. The captions are the scene's parts; the
 * current one is marked as the scene plays, and choosing one jumps there.
 */
function Feature({ title, lead, captions, phase, onPhase, playing, reduced, onToggle, flip, children }: {
  title: string; lead: string; captions: { title: string; text: string }[]
  phase: number; onPhase: (phase: number) => void
  playing: boolean; reduced: boolean; onToggle: () => void
  /** The scene on the left, so neighbouring features alternate. On phones the scene is always first. */
  flip?: boolean; children: ReactNode
}) {
  return (
    <div className={cn('grid items-center gap-x-12 gap-y-8', flip ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : 'lg:grid-cols-[22rem_minmax(0,1fr)]')}>
      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="font-display text-3xl leading-tight font-semibold">{title}</h2>
          <p className="max-w-hint text-base text-fg-muted">{lead}</p>
        </div>
        <Captions captions={captions} phase={phase} onPhase={onPhase} className="space-y-1" />
      </div>
      <div className={cn('min-w-0 space-y-2', flip ? 'order-first' : 'max-lg:order-first')}>
        <div className="overflow-hidden rounded-2xl ring-1 ring-rule">{children}</div>
        {!reduced && <Toggle playing={playing} onToggle={onToggle} />}
      </div>
    </div>
  )
}

/** The parts of a scene in words: the current one is marked as the scene plays, and choosing one jumps there. */
function Captions({ captions, phase, onPhase, className }: { captions: { title: string; text: string }[]; phase: number; onPhase: (phase: number) => void; className?: string }) {
  return (
    <ol className={className}>
      {captions.map((c, i) => (
        <li key={c.title}>
          <button type="button" aria-current={i === phase ? 'step' : undefined} onClick={() => onPhase(i)}
            className={cn('flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface/60', focus)}>
            <span className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors',
              i === phase ? 'bg-accent text-accent-fg' : 'bg-surface text-fg-muted ring-1 ring-rule')}>{i + 1}</span>
            <span className="space-y-0.5">
              <span className={cn('block text-base', i === phase ? 'font-semibold text-fg' : 'font-medium text-fg-muted')}>{c.title}</span>
              <span className="block max-w-hint text-sm text-fg-muted">{c.text}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

/** Anything that moves by itself for more than a few seconds needs a way to stop it. */
function Toggle({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-lg px-2 text-sm leading-label text-fg-muted hover:text-fg', focus)}>
      {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
      {playing ? 'Pozastavit ukázku' : 'Přehrát ukázku'}
    </button>
  )
}

/**
 * The top of the page (the owner, 2026-11-27): the product itself as the masthead. The invoice scene, a little larger
 * than in a feature, sits on the right of a tinted band; on the left the headline with the changing advantage, the
 * scene's three captions and the download button, so all of it is above the fold and the page's own button stands away
 * from the buttons inside the scene. The band is tinted so that the headline does not run into the scene, which is
 * drawn on the page colour. On a narrow screen: headline, scene, captions, button.
 */
function Masthead() {
  const scene = useInvoiceStepsScene()
  return (
    <section ref={scene.ref} className={cn(wide, 'grid items-start gap-x-12 gap-y-6 pt-6 pb-14 sm:pb-16 lg:grid-cols-[21rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]')}>
      <Headline />
      <div className="min-w-0 space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <div className="overflow-hidden rounded-2xl ring-1 ring-rule"><InvoiceStepsScene scene={scene} maxScale={1.25} /></div>
        {!scene.reduced && <Toggle playing={scene.playing} onToggle={scene.playing ? scene.pause : scene.play} />}
      </div>
      <div className="space-y-6 lg:col-start-1 lg:row-start-2">
        <Captions className="space-y-1" phase={scene.state.phase} onPhase={scene.goTo}
          captions={[
            { title: 'Vyberete odběratele', text: 'Stačí pár písmen. U každého vidíte poslední fakturu a jestli vám něco dluží.' },
            { title: 'Položky už tam jsou', text: 'Předvyplní se podle minulé faktury. Změníte jen to, co je tentokrát jinak.' },
            { title: 'Zkontrolujete a vystavíte', text: 'Uvidíte hotové PDF s QR platbou. Po vystavení se uloží do vaší složky.' },
          ]} />
        <div className="flex flex-col items-start gap-2 pl-2">
          <DownloadLink large place="masthead" />
          <p className="text-sm text-fg-muted">Pro Chrome a Edge na počítači. Bez registrace.</p>
        </div>
      </div>
    </section>
  )
}

function InstallFeature() {
  const scene = useInstallScene()
  return (
    <div ref={scene.ref}>
      <Feature flip
        title="Žádná instalace, žádná registrace"
        lead="Invojka je jeden soubor, který otevřete v prohlížeči. Data ukládá do složky, kterou jí ukážete, a nikam jinam."
        captions={[
          { title: 'Stáhnete jeden soubor', text: 'Nic se neinstaluje. Soubor otevřete dvojklikem v Chromu nebo Edgi.' },
          { title: 'Vyberete složku pro data', text: 'Založíte si novou, třeba v Dokumentech. Když ji máte na OneDrivu nebo Disku Google, je to zároveň záloha.' },
          { title: 'Řeknete, jak začínáte', text: 'Invojka vás provede nastavením a můžete vystavit první fakturu.' },
        ]}
        phase={scene.state.phase} onPhase={scene.goTo}
        playing={scene.playing} reduced={scene.reduced} onToggle={scene.playing ? scene.pause : scene.play}>
        <InstallScene scene={scene} />
      </Feature>
    </div>
  )
}

function StatsFeature() {
  const scene = useStatsScene()
  return (
    <div ref={scene.ref}>
      <Feature
        title="Víte, jak se vám daří"
        lead="Statistiky se počítají samy z faktur, které vystavíte. Žádné přepisování do tabulek."
        captions={[
          { title: 'Tržby měsíc po měsíci', text: 'Každý měsíc stojí vedle stejného měsíce loni, takže hned vidíte, jestli rostete.' },
          { title: 'Všechny roky najednou', text: 'Jedním klikem přepnete na roky a máte přehled od první faktury.' },
          { title: 'Největší odběratelé', text: 'Kdo tvoří jakou část tržeb a za kolik dní obvykle platí.' },
        ]}
        phase={scene.state.phase} onPhase={scene.goTo}
        playing={scene.playing} reduced={scene.reduced} onToggle={scene.playing ? scene.pause : scene.play}>
        <StatsScene scene={scene} />
      </Feature>
    </div>
  )
}

function FilesFeature() {
  const scene = useFilesScene()
  return (
    <div ref={scene.ref}>
      <Feature flip
        title="Vaše data jsou vaše soubory"
        lead="Invojka nemá server ani účet. Faktury leží ve složce ve vašem počítači a nikdo jiný k nim nemá přístup."
        captions={[
          { title: 'Vystavíte fakturu', text: 'Její PDF se hned uloží do vaší složky.' },
          { title: 'Váš disk ji zazálohuje', text: 'Když složku máte na Disku Google nebo OneDrivu, synchronizuje se sama. Invojka nic nikam neposílá.' },
          { title: 'Jsou to obyčejné soubory', text: 'PDF a čitelné soubory s daty. Zůstanou vám, i kdyby Invojka jednou skončila.' },
        ]}
        phase={scene.state.phase} onPhase={scene.goTo}
        playing={scene.playing} reduced={scene.reduced} onToggle={scene.playing ? scene.pause : scene.play}>
        <FilesScene scene={scene} />
      </Feature>
    </div>
  )
}

/** How far down the page the visitor got, measured once per quarter. */
function useScrollDepth() {
  useEffect(() => {
    const marks = [25, 50, 75, 100] as const
    let reached = 0
    const check = () => {
      const room = document.documentElement.scrollHeight - innerHeight
      const percent = room <= 0 ? 100 : (scrollY / room) * 100
      while (reached < marks.length && percent >= marks[reached] - 1) track({ event: 'scroll_depth', percent: marks[reached++] })
    }
    addEventListener('scroll', check, { passive: true })
    return () => removeEventListener('scroll', check)
  }, [])
}

export function Page() {
  useScrollDepth()
  return (
    <div className="flex min-h-screen flex-col text-base">
      <div className="bg-tint">
        {/* Only the logo: a download button and a link here competed with the buttons inside the masthead's scene (the owner, 2026-11-27). */}
        <header className={cn(wide, 'flex h-16 items-center')}>
          <a href="#" className={cn('flex items-center gap-2 rounded-lg', focus)}>
            <Logo className="size-6" />
            <span className="font-display text-xl font-semibold">{WORDMARK}</span>
          </a>
        </header>
      </div>

      <main className="flex-1">
        <div className="bg-tint"><Masthead /></div>

        <section className="py-16 sm:py-20">
          <div className={container}><InstallFeature /></div>
        </section>

        <section className="bg-tint py-16 sm:py-20">
          <div className={container}><StatsFeature /></div>
        </section>

        <section className="py-16 sm:py-20">
          <div className={cn(container, 'space-y-12')}>
            <FilesFeature />
            {/* The drives a data folder can live on. Names in words for now; their logos are the owner's open question (docs/website.md). */}
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-fg-muted">Složku s fakturami můžete mít na disku, který už používáte</p>
              <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-lg font-semibold">
                {DRIVES.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <p className="text-sm text-fg-muted">Nebo jen v počítači, bez jakéhokoli disku.</p>
            </div>
          </div>
        </section>

        <section id="otazky" className="scroll-mt-4 bg-tint py-16 sm:py-20">
          <div className={container}><Faq /></div>
        </section>

        {/* The closing block: the one strong area of the page, in the accent itself. */}
        <section className="bg-accent py-16 text-accent-fg sm:py-20">
          <div className={cn(container, 'flex flex-col items-center gap-5 text-center')}>
            <h2 className="font-display text-3xl leading-tight font-semibold text-accent-fg sm:text-4xl">Vyzkoušejte Invojku</h2>
            <p className="max-w-hint text-lg">Jeden soubor, žádná registrace. Když vám nesedne, prostě ho smažete.</p>
            <div className="flex flex-col items-center gap-2">
              <DownloadLink large inverse place="closing" />
              <p className="text-sm">Pro Chrome a Edge na počítači.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="scheme-footer">
        <div className={cn(container, 'flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 text-sm text-footer-muted')}>
          <div className="flex items-center gap-2">
            <Logo className="size-5" />
            <span className="font-display text-lg font-semibold text-footer-fg">{WORDMARK}</span>
            <span>{cs.app.footerNote}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <button type="button" onClick={openConsent} className={cn('rounded text-link underline underline-offset-2', focus)}>Nastavení měření</button>
            <a href={SOURCE} onClick={() => track({ event: 'outbound_click', target: 'github' })} className={cn('rounded text-link underline underline-offset-2', focus)}>Zdrojový kód na GitHubu</a>
          </div>
        </div>
      </footer>
      <ConsentBanner />
    </div>
  )
}

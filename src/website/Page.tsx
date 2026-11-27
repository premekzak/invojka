import { Download } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Logo, WORDMARK } from '@/ui/Logo'
import { cn } from '@/ui/primitives'
import { track } from './analytics'
import { ConsentBanner, openConsent } from './Consent'
import { Faq } from './Faq'
import { Headline } from './Hero'
import { app, LANG, tr } from './locale'
import { FilesScene, useFilesScene } from './scenes/Files'
import { InstallScene, useInstallScene } from './scenes/Install'
import { InvoiceStepsScene, useInvoiceStepsScene } from './scenes/InvoiceSteps'
import { StatsScene, useStatsScene } from './scenes/Stats'
import { cz } from './text'

/** Always the newest release (docs/development.md). */
const DOWNLOAD = 'https://github.com/premekzak/invojka/releases/latest/download/invojka.html'
const SOURCE = 'https://github.com/premekzak/invojka'

/** The app on made-up data, on the same domain: the deploy script puts the showcase build into demo/ (docs/website.md).
 *  It opens in the page's language; the app reads ?lang=. Not there on the dev server. */
const DEMO = LANG === 'en' ? '../demo/?lang=en' : 'demo/'

/** Drives that sync a folder on the computer, which is all Invojka needs from them. */
const DRIVES = [tr('Disk Google', "Google Drive"), 'OneDrive', 'Dropbox']

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
      <Download aria-hidden="true" className={large ? 'size-5' : 'size-4'} /> {tr('Stáhnout zdarma', "Download for free")}
    </a>
  )
}

/** The quiet second way in, under a download button: try the app first, with nothing to download. */
function DemoLink({ place, className }: { place: 'masthead' | 'closing'; className?: string }) {
  return (
    <a href={DEMO} onClick={() => track({ event: 'outbound_click', target: 'demo', place })} className={cn('rounded text-sm underline underline-offset-2', focus, className)}>
      {tr('Nebo si nejdřív vyzkoušejte demo v prohlížeči', 'Or try the demo in your browser first')}
    </a>
  )
}

/**
 * One feature: what it does in words on one side, its scene on the other. The captions are the scene's parts; the
 * current one is marked as the scene plays, and choosing one jumps there.
 */
function Feature({ title, lead, captions, phase, onPhase, flip, children }: {
  title: string; lead: string; captions: { title: string; text: string }[]
  phase: number; onPhase: (phase: number) => void
  /** The scene on the left, so neighbouring features alternate. On phones the scene is always first. */
  flip?: boolean; children: ReactNode
}) {
  return (
    <div className={cn('grid items-center gap-x-12 gap-y-8', flip ? 'lg:grid-cols-[minmax(0,1fr)_22rem]' : 'lg:grid-cols-[22rem_minmax(0,1fr)]')}>
      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="font-display text-3xl leading-tight font-semibold">{cz(title)}</h2>
          <p className="max-w-hint text-base text-fg-muted">{cz(lead)}</p>
        </div>
        <Captions captions={captions} phase={phase} onPhase={onPhase} className="space-y-1" />
      </div>
      <div className={cn('min-w-0 overflow-hidden rounded-2xl ring-1 ring-rule', flip ? 'order-first' : 'max-lg:order-first')}>{children}</div>
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
              <span className={cn('block text-base', i === phase ? 'font-semibold text-fg' : 'font-medium text-fg-muted')}>{cz(c.title)}</span>
              <span className="block max-w-hint text-sm text-fg-muted">{cz(c.text)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
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
      <div className="min-w-0 overflow-hidden rounded-2xl ring-1 ring-rule lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <InvoiceStepsScene scene={scene} maxScale={1.25} />
      </div>
      <div className="space-y-6 lg:col-start-1 lg:row-start-2">
        <Captions className="space-y-1" phase={scene.state.phase} onPhase={scene.goTo}
          captions={[
            { title: tr('Vyberete odběratele', "Pick the customer"), text: tr('Stačí pár písmen. U každého vidíte poslední fakturu a jestli vám něco dluží.', "A few letters are enough. Each one shows their last invoice and whether they owe you anything.") },
            { title: tr('Položky už tam jsou', "The lines are already there"), text: tr('Předvyplní se podle minulé faktury. Změníte jen to, co je tentokrát jinak.', "They are prefilled from the last invoice. You change only what is different this time.") },
            { title: tr('Zkontrolujete a vystavíte', "Check and issue"), text: tr('Uvidíte hotové PDF s QR platbou. Po vystavení se uloží do vaší složky.', "You see the finished PDF with a QR payment code. Once issued, it is saved to your folder.") },
          ]} />
        <div className="flex flex-col items-start gap-2 pl-2">
          <DownloadLink large place="masthead" />
          <p className="text-sm text-fg-muted">{tr('Pro Chrome a Edge na počítači. Bez registrace.', 'For Chrome and Edge on a computer. No sign-up.')}</p>
          <DemoLink place="masthead" className="text-link" />
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
        title={tr('Žádná instalace, žádná registrace', "No installation, no sign-up")}
        lead={tr('Invojka je jeden soubor, který otevřete v prohlížeči. Data ukládá do složky, kterou jí ukážete, a nikam jinam.', "Invojka is one file that you open in your browser. It saves its data to the folder you show it, and nowhere else.")}
        captions={[
          { title: tr('Stáhnete jeden soubor', "Download one file"), text: tr('Nic se neinstaluje. Soubor otevřete dvojklikem v Chromu nebo Edgi.', "Nothing is installed. Double-click the file to open it in Chrome or Edge.") },
          { title: tr('Vyberete složku pro data', "Choose a folder for the data"), text: tr('Založíte si novou, třeba v Dokumentech. Když ji máte na OneDrivu nebo Disku Google, je to zároveň záloha.', "Make a new one, in Documents for example. If it is on OneDrive or Google Drive, it is your backup too.") },
          { title: tr('Řeknete, jak začínáte', "Say how you are starting"), text: tr('Invojka vás provede nastavením a můžete vystavit první fakturu.', "Invojka takes you through the setup and you can issue your first invoice.") },
        ]}
        phase={scene.state.phase} onPhase={scene.goTo}>
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
        title={tr('Víte, jak se vám daří', "Know how you are doing")}
        lead={tr('Statistiky se počítají samy z faktur, které vystavíte. Žádné přepisování do tabulek.', "The statistics work themselves out from the invoices you issue. No copying into spreadsheets.")}
        captions={[
          { title: tr('Tržby měsíc po měsíci', "Revenue month by month"), text: tr('Každý měsíc stojí vedle stejného měsíce loni, takže hned vidíte, jestli rostete.', "Each month stands beside the same month last year, so you see at once whether you are growing.") },
          { title: tr('Všechny roky najednou', "All the years at once"), text: tr('Jedním klikem přepnete na roky a máte přehled od první faktury.', "One click switches to years, back to your first invoice.") },
          { title: tr('Největší odběratelé', "Biggest customers"), text: tr('Kdo tvoří jakou část tržeb a za kolik dní obvykle platí.', "Who makes up what share of your revenue and how many days they usually take to pay.") },
        ]}
        phase={scene.state.phase} onPhase={scene.goTo}>
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
        title={tr('Vaše data jsou vaše soubory', "Your data are your files")}
        lead={tr('Invojka nemá server ani účet. Faktury leží ve složce ve vašem počítači a nikdo jiný k nim nemá přístup.', "Invojka has no server and no account. The invoices sit in a folder on your computer and nobody else can reach them.")}
        captions={[
          { title: tr('Vystavíte fakturu', "Issue an invoice"), text: tr('Její PDF se hned uloží do vaší složky.', "Its PDF is saved to your folder straight away.") },
          { title: tr('Váš disk ji zazálohuje', "Your drive backs it up"), text: tr('Když složku máte na Disku Google nebo OneDrivu, synchronizuje se sama. Invojka nic nikam neposílá.', "If the folder is on Google Drive or OneDrive, it syncs by itself. Invojka sends nothing anywhere.") },
          { title: tr('Jsou to obyčejné soubory', "They are ordinary files"), text: tr('PDF a čitelné soubory s daty. Zůstanou vám, i kdyby Invojka jednou skončila.', "PDFs and readable data files. They stay yours even if Invojka came to an end one day.") },
        ]}
        phase={scene.state.phase} onPhase={scene.goTo}>
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
              <p className="text-sm text-fg-muted">{tr('Složku s fakturami můžete mít na disku, který už používáte', "Keep the folder with your invoices on the drive you already use")}</p>
              <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-lg font-semibold">
                {DRIVES.map((d) => <li key={d}>{d}</li>)}
              </ul>
              <p className="text-sm text-fg-muted">{tr('Nebo jen v počítači, bez jakéhokoli disku.', "Or only on your computer, with no drive at all.")}</p>
            </div>
          </div>
        </section>

        <section id="otazky" className="scroll-mt-4 bg-tint py-16 sm:py-20">
          <div className={container}><Faq /></div>
        </section>

        {/* The closing block: the one strong area of the page, in the accent itself. */}
        <section className="bg-accent py-16 text-accent-fg sm:py-20">
          <div className={cn(container, 'flex flex-col items-center gap-5 text-center')}>
            <h2 className="font-display text-3xl leading-tight font-semibold text-accent-fg sm:text-4xl">{tr('Vyzkoušejte Invojku', "Try Invojka")}</h2>
            <p className="max-w-hint text-lg">{tr('Jeden soubor, žádná registrace. Když vám nesedne, prostě ho smažete.', "One file, no sign-up. If it is not for you, just delete it.")}</p>
            <div className="flex flex-col items-center gap-2">
              <DownloadLink large inverse place="closing" />
              <p className="text-sm">{tr('Pro Chrome a Edge na počítači.', "For Chrome and Edge on a computer.")}</p>
              <DemoLink place="closing" />
            </div>
          </div>
        </section>
      </main>

      <footer className="scheme-footer">
        <div className={cn(container, 'flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-8 text-sm text-footer-muted')}>
          <div className="flex items-center gap-2">
            <Logo className="size-5" />
            <span className="font-display text-lg font-semibold text-footer-fg">{WORDMARK}</span>
            <span>{app.app.footerNote}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* The other language: the Czech page is the site's root, the English one is in en/. */}
            <a href={LANG === 'en' ? '../' : 'en/'} lang={LANG === 'en' ? 'cs' : 'en'} className={cn('rounded text-link underline underline-offset-2', focus)}>{LANG === 'en' ? 'Česky' : 'English'}</a>
            <button type="button" onClick={openConsent} className={cn('rounded text-link underline underline-offset-2', focus)}>{tr('Nastavení měření', "Measuring settings")}</button>
            <a href={SOURCE} onClick={() => track({ event: 'outbound_click', target: 'github' })} className={cn('rounded text-link underline underline-offset-2', focus)}>{tr('Zdrojový kód na GitHubu', "Source code on GitHub")}</a>
          </div>
        </div>
      </footer>
      <ConsentBanner />
    </div>
  )
}

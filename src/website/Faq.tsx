import { Plus } from 'lucide-react'
import { track } from './analytics'
import { cz } from './text'

/* The questions a visitor asks before downloading. The first three come from the website mockup of October 2026; the
   rest are topics docs/launch.md asks for (another computer, updating) and the honest limits from docs/product.md.
   The owner (2026-11-27) took out "we don't earn on your data" (the competitors don't either; they earn on
   subscriptions) and the question about the project ending; don't bring them back. Every answer must stay true to what the app does today: when a feature
   changes (updates, browsers, the export), change its answer. No promise of legal correctness: the user answers for
   what they write on an invoice. */
const QUESTIONS: { q: string; a: string }[] = [
  {
    q: 'Proč je to zdarma?',
    // The owner's own reason, in the first person (2026-11-27).
    a: 'Invojku vyvíjím hlavně pro vlastní potřebu. Nemá servery ani účty, takže dát ji veřejně k dispozici mě nic nestojí.',
  },
  {
    q: 'Kdo vidí moje faktury?',
    a: 'Jen vy. Faktury a odběratelé se ukládají do složky ve vašem počítači a nikam se neposílají. Na internet jde Invojka jen pro kurzy měn (pošle měnu a datum) a do registru ARES, když v něm sami hledáte firmu podle názvu nebo IČ.',
  },
  {
    // Must stay true to src/website/analytics.ts and the consent banner.
    q: 'Měří se něco na tomto webu?',
    a: 'Jen když to povolíte: pak web Google Analytics řekne, které části stránky jste viděli a jestli jste klikli na stažení. Bez povolení se nic neměří a nic se z Googlu nenačítá. Samotná aplikace Invojka neměří nic nikdy.',
  },
  {
    q: 'Co když se mi rozbije počítač?',
    a: 'Mějte složku s fakturami na Disku Google, OneDrivu nebo Dropboxu, ten ji zálohuje sám. Na novém počítači stáhnete Invojku, vyberete stejnou složku a pokračujete, kde jste skončili.',
  },
  {
    // The import is in onboarding ("Jak začínáte?") and in Settings → Aplikace → Import z jiné služby. The agent part is
    // the owner's wording (2026-11-27); the data folder carries AGENTS.md, a guide to the files for AI agents.
    q: 'Jak do Invojky dostanu faktury odjinud?',
    a: 'Z Fakturoidu a iDokladu je načtete přímo: při prvním spuštění zvolíte, odkud přecházíte, a nahrajete jejich export. Jde to i později v Nastavení. Když fakturujete jinde, zadáte číslo poslední faktury a Invojka v řadě naváže. A protože data jsou obyčejné čitelné soubory s přiloženým popisem, s čímkoli dalším vám pomůže váš AI agent.',
  },
  {
    q: 'Můžu fakturovat na dvou počítačích?',
    a: 'Ano, když je složka na disku, který se synchronizuje mezi nimi. Na obou otevřete Invojku a vyberete stejnou složku. Pracujte ale vždy jen na jednom a nechte disk dosynchronizovat.',
  },
  {
    q: 'V čem Invojka funguje?',
    a: 'V prohlížečích Chrome a Edge na počítači s Windows, macOS nebo Linuxem. Firefox, Safari a telefony zatím neumí pracovat se složkou v počítači, kterou Invojka potřebuje.',
  },
  {
    q: 'Projde faktura u účetní a na finančním úřadu?',
    a: 'Faktura má náležitosti podle českých pravidel pro plátce i neplátce DPH a QR kód pro platbu. Účetní můžete poslat export za měsíc, čtvrtletí nebo rok: přehled v tabulce, doklady ve formátu ISDOC a PDF. Za údaje, které na fakturu napíšete, odpovídáte vy.',
  },
  {
    q: 'Jak dostanu novou verzi?',
    a: 'Stáhnete nový soubor a nahradíte jím ten starý. Vaše faktury zůstávají ve složce, nová verze je otevře tak, jak jsou.',
  },
]

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-3xl leading-tight font-semibold">Časté otázky</h2>
      <div className="border-t border-line-strong/30">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group border-b border-line-strong/30" onToggle={(e) => { if (e.currentTarget.open) track({ event: 'faq_open', question: q }) }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link [&::-webkit-details-marker]:hidden">
              {cz(q)}
              <Plus aria-hidden="true" className="size-5 shrink-0 text-link transition-transform group-open:rotate-45" />
            </summary>
            <p className="max-w-prose pb-5 text-base text-fg-muted">{cz(a)}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

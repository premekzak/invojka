import { Plus } from 'lucide-react'
import { track } from './analytics'
import { tr } from './locale'
import { cz } from './text'

/* The questions a visitor asks before downloading. The first three come from the website mockup of October 2026; the
   rest are topics docs/launch.md asks for (another computer, updating) and the honest limits from docs/product.md.
   The owner (2026-11-27) took out "we don't earn on your data" (the competitors don't either; they earn on
   subscriptions), the question about the project ending and the one about measuring this website ("že se něco měří
   na webu je normální a s aplikací to nesouvisí"); don't bring them back. Every answer must stay true to what the app does today: when a feature
   changes (updates, browsers, the export), change its answer. No promise of legal correctness: the user answers for
   what they write on an invoice. */
const QUESTIONS: { q: string; a: string }[] = [
  {
    q: tr('Proč je to zdarma?', "Why is it free?"),
    // The owner's own reason, in the first person (2026-11-27).
    a: tr('Invojku vyvíjím hlavně pro vlastní potřebu. Nemá servery ani účty, takže dát ji veřejně k dispozici mě nic nestojí.', "I build Invojka mainly for my own use. It has no servers and no accounts, so making it public costs me nothing."),
  },
  {
    q: tr('Kdo vidí moje faktury?', "Who can see my invoices?"),
    a: tr('Jen vy. Faktury a odběratelé se ukládají do složky ve vašem počítači a nikam se neposílají. Na internet jde Invojka jen pro kurzy měn (pošle měnu a datum) a do registru ARES, když v něm sami hledáte firmu podle názvu nebo IČ.', "Only you. Invoices and customers are saved to a folder on your computer and are sent nowhere. Invojka goes online only for exchange rates (it sends a currency and a date) and to the Czech business register ARES, when you yourself look a company up there by its name or ID number."),
  },
  {
    q: tr('Co když se mi rozbije počítač?', "What if my computer breaks?"),
    a: tr('Mějte složku s fakturami na Disku Google, OneDrivu nebo Dropboxu, ten ji zálohuje sám. Na novém počítači stáhnete Invojku, vyberete stejnou složku a pokračujete, kde jste skončili.', "Keep the folder with your invoices on Google Drive, OneDrive or Dropbox, which backs it up by itself. On the new computer you download Invojka, choose the same folder and carry on where you left off."),
  },
  {
    // The import is in onboarding ("Jak začínáte?") and in Settings → Aplikace → Import z jiné služby. The agent part is
    // the owner's wording (2026-11-27); the data folder carries AGENTS.md, a guide to the files for AI agents.
    q: tr('Jak do Invojky dostanu faktury odjinud?', "How do I bring my invoices in from elsewhere?"),
    a: tr('Z Fakturoidu a iDokladu je načtete přímo: při prvním spuštění zvolíte, odkud přecházíte, a nahrajete jejich export. Jde to i později v Nastavení. Když fakturujete jinde, zadáte číslo poslední faktury a Invojka v řadě naváže. A protože data jsou obyčejné čitelné soubory s přiloženým popisem, s čímkoli dalším vám pomůže váš AI agent.', "From Fakturoid and iDoklad you load them directly: on the first run you say where you are coming from and upload their export. It works later too, in Settings. If you invoice somewhere else, you enter your last invoice number and Invojka carries the series on. And because the data are ordinary readable files with a description beside them, your AI agent will help you with anything else."),
  },
  {
    q: tr('Můžu fakturovat na dvou počítačích?', "Can I invoice on two computers?"),
    a: tr('Ano, když je složka na disku, který se synchronizuje mezi nimi. Na obou otevřete Invojku a vyberete stejnou složku. Pracujte ale vždy jen na jednom a nechte disk dosynchronizovat.', "Yes, if the folder is on a drive that syncs between them. Open Invojka on both and choose the same folder. Work on only one at a time, though, and let the drive finish syncing."),
  },
  {
    q: tr('V čem Invojka funguje?', "Where does Invojka run?"),
    a: tr('V prohlížečích Chrome a Edge na počítači s Windows, macOS nebo Linuxem. Firefox, Safari a telefony zatím neumí pracovat se složkou v počítači, kterou Invojka potřebuje.', "In Chrome and Edge on a computer with Windows, macOS or Linux. Firefox, Safari and phones cannot yet work with a folder on the computer, which Invojka needs."),
  },
  {
    q: tr('Projde faktura u účetní a na finančním úřadu?', "Will the invoice pass with my accountant and the tax office?"),
    a: tr('Faktura má náležitosti podle českých pravidel pro plátce i neplátce DPH a QR kód pro platbu. Účetní můžete poslat export za měsíc, čtvrtletí nebo rok: přehled v tabulce, doklady ve formátu ISDOC a PDF. Za údaje, které na fakturu napíšete, odpovídáte vy.', "The invoice has what Czech rules require, for VAT payers and non-payers alike, and a QR code for payment. You can send your accountant an export for a month, a quarter or a year: an overview as a spreadsheet, the documents in the ISDOC format, and PDFs. What you write on the invoice is your responsibility."),
  },
  {
    q: tr('Jak dostanu novou verzi?', "How do I get a new version?"),
    a: tr('Stáhnete nový soubor a nahradíte jím ten starý. Vaše faktury zůstávají ve složce, nová verze je otevře tak, jak jsou.', "Download the new file and replace the old one with it. Your invoices stay in the folder and the new version opens them as they are."),
  },
]

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 font-display text-3xl leading-tight font-semibold">{tr('Časté otázky', 'Questions')}</h2>
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

import { nameKey } from './id'
import type { Customer, Invoice, Settings } from './schema'
import { czechIban } from './spayd'
import { computeTotals } from './vat'

/**
 * Demo mode: an anonymized copy of the user's data for screenshots and videos.
 * Names, IČ/DIČ, addresses, contacts, bank details, descriptions, notes and amounts are replaced;
 * amounts are invented per invoice (not derived from the real ones), so charts show no real trend.
 * Dates, numbers, statuses and currencies are kept.
 * Deterministic (fixed seed), so the same data gives the same demo every time.
 *
 * The names here are generic; a local copy may swap in its own cast for showcases (never committed).
 */
export interface DemoData {
  settings: Settings
  customers: Customer[]
  invoices: Invoice[]
}

const SUPPLIER = 'Jana Svobodová'
/** Names given to the first Czech customers before the BRANDS × TRADES combinations; empty here. */
const FEATURED: string[] = []
const BRANDS = ['Horizont', 'Lipa', 'Vltava', 'Kompas', 'Orion', 'Javor', 'Sokol', 'Atlas', 'Polaris', 'Merkur', 'Topas', 'Granit',
  'Safír', 'Klen', 'Rubín', 'Nova', 'Iris', 'Oblak', 'Brána', 'Most', 'Jantar', 'Kormorán', 'Modřín', 'Zenit']
const TRADES = ['Digital', 'Studio', 'Media', 'Poradna', 'Systems', 'Trade', 'Group', 'Partners', 'Tech', 'Solutions', 'Design', 'Logistik']
const CZ_FORMS = ['s.r.o.', 's.r.o.', 'a.s.', 'spol. s r.o.']
const PEOPLE = ['Jana Svobodová', 'Petr Dvořák', 'Lucie Černá', 'Tomáš Procházka', 'Eva Kučerová', 'Martin Veselý', 'Tereza Horáková',
  'Jakub Marek', 'Kateřina Pokorná', 'Ondřej Král', 'Barbora Růžičková', 'Filip Beneš']
const STREETS = ['Lipová', 'Nádražní', 'Školní', 'Husova', 'Palackého', 'Komenského', 'Masarykova', 'Zahradní', 'Polní', 'Sadová', 'Tyršova', 'Jiráskova']
const CZ_CITIES: [string, string][] = [['Praha', '110 00'], ['Brno', '602 00'], ['Ostrava', '702 00'], ['Plzeň', '301 00'], ['Olomouc', '779 00'],
  ['Liberec', '460 01'], ['České Budějovice', '370 01'], ['Hradec Králové', '500 02'], ['Pardubice', '530 02'], ['Zlín', '760 01']]
/** Country pattern, city, postcode, company form, and the name of the first customer there. */
const FOREIGN: [RegExp, string, string, string, string][] = [
  [/zéland/i, 'Auckland', '1010', 'Ltd', ''], [/irsk/i, 'Dublin', 'D02', 'Ltd', ''],
  [/švýcar/i, 'Zürich', '8001', 'AG', ''], [/maďar/i, 'Budapest', '1051', 'Kft.', ''],
  [/kypr/i, 'Limassol', '3036', 'Ltd', ''], [/sloven/i, 'Bratislava', '811 01', 's.r.o.', ''],
  [/němec|german/i, 'Berlin', '10115', 'GmbH', ''], [/rakous|austri/i, 'Wien', '1010', 'GmbH', ''],
]
const FOREIGN_DEFAULT = ''
const SERVICES = ['Konzultace', 'Správa webu', 'Grafický návrh', 'Vývoj aplikace', 'Online marketing', 'Analýza dat', 'Copywriting',
  'Školení týmu', 'Technická podpora', 'Správa kampaní', 'Údržba systému', 'Fotografie produktů', 'Návrh loga', 'SEO audit']

/** Small seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isCzech = (country: string) => !country || /česk|czech/i.test(country)
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

export function anonymize(data: DemoData, seed = 20260930): DemoData {
  const rand = rng(seed)
  const int = (n: number) => Math.floor(rand() * n)
  const digits = (n: number) => Array.from({ length: n }, () => int(10)).join('')

  /** An 8-digit IČ with a valid mod-11 check digit. */
  const ic = () => {
    const d = digits(7)
    const sum = [...d].reduce((acc, c, i) => acc + Number(c) * (8 - i), 0)
    return d + ((11 - (sum % 11)) % 10)
  }
  /** A Czech account number that passes the bank's mod-11 check. */
  const account = () => {
    const w = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1]
    for (;;) {
      const d = '1' + digits(9)
      if ([...d].reduce((acc, c, i) => acc + Number(c) * w[i]!, 0) % 11 === 0) return d
    }
  }
  const phone = () => `+420 7${digits(2)} ${digits(3)} ${digits(3)}`
  const address = (country: string) => {
    const street = `${STREETS[int(STREETS.length)]} ${1 + int(180)}`
    if (isCzech(country)) {
      const [city, zip] = CZ_CITIES[int(CZ_CITIES.length)]!
      return { street, zip, city, country }
    }
    const f = FOREIGN.find(([re]) => re.test(country))
    const city = f?.[1] ?? 'London', zip = f?.[2] ?? 'EC1A 1BB'
    return { street: `${1 + int(90)} ${['High Street', 'Park Road', 'Main Street', 'Church Lane'][int(4)]}`, zip, city, country }
  }

  // One fake company per real customer, in a stable order so names don't depend on list order.
  let nextBrand = int(BRANDS.length * TRADES.length)
  let nextFeatured = 0
  const usedForeign = new Set<string>()
  const companyName = (country: string) => {
    const foreign = isCzech(country) ? undefined : FOREIGN.find(([re]) => re.test(country))
    const featured = isCzech(country) ? FEATURED[nextFeatured++] : (foreign?.[4] ?? FOREIGN_DEFAULT)
    if (featured && !usedForeign.has(featured)) {
      if (!isCzech(country)) usedForeign.add(featured)
      return featured
    }
    const i = nextBrand++ % (BRANDS.length * TRADES.length)
    const form = isCzech(country) ? CZ_FORMS[int(CZ_FORMS.length)] : (foreign?.[3] ?? 'Ltd')
    return `${BRANDS[i % BRANDS.length]} ${TRADES[(i * 7 + Math.floor(i / BRANDS.length)) % TRADES.length]} ${form}`
  }

  const fakeParty = (country: string, hadDic: boolean) => {
    const name = companyName(country)
    const icv = isCzech(country) ? ic() : ''
    return { name, ic: icv, dic: hadDic ? (isCzech(country) ? `CZ${icv}` : `${country.slice(0, 2).toUpperCase()}${digits(9)}`) : '', address: address(country) }
  }

  const byCustomer = new Map<string, ReturnType<typeof fakeParty>>()
  // The first featured name goes to the Czech customer with the most invoices, so it shows up often.
  const invoiceCount = new Map<string, number>()
  for (const inv of data.invoices) if (inv.customerId) invoiceCount.set(inv.customerId, (invoiceCount.get(inv.customerId) ?? 0) + 1)
  const top = data.customers.filter((c) => isCzech(c.address.country))
    .reduce<Customer | undefined>((best, c) => ((invoiceCount.get(c.id) ?? 0) > (best ? invoiceCount.get(best.id) ?? 0 : -1) ? c : best), undefined)
  const customers = [...data.customers].sort((a, b) => Number(b.id === top?.id) - Number(a.id === top?.id) || a.id.localeCompare(b.id)).map((c): Customer => {
    const p = fakeParty(c.address.country, !!c.dic)
    byCustomer.set(c.id, p)
    const person = PEOPLE[int(PEOPLE.length)]!
    return {
      ...c, ...p,
      email: c.email ? `${slug(person)}@example.com` : '',
      cc: c.cc.map((_, i) => `fakturace${i + 1}@example.com`),
      phone: c.phone ? phone() : '',
      web: '',
      contactName: c.contactName ? person : '',
      note: '',
    }
  })
  const order = new Map(data.customers.map((c, i) => [c.id, i]))
  customers.sort((a, b) => order.get(a.id)! - order.get(b.id)!)

  // Invoices without a customer record get a fake party per distinct snapshot name.
  const bySnapshot = new Map<string, ReturnType<typeof fakeParty>>()
  const partyFor = (inv: Invoice) => {
    const known = inv.customerId ? byCustomer.get(inv.customerId) : undefined
    if (known) return known
    const key = nameKey(inv.customerSnapshot.name)
    if (!bySnapshot.has(key)) bySnapshot.set(key, fakeParty(inv.customerSnapshot.address.country, !!inv.customerSnapshot.dic))
    return bySnapshot.get(key)!
  }

  // Amounts are invented, independent of the real ones. Each month gets an invented revenue
  // (gentle growth over the years, random variation) that is split across that month's invoices,
  // so neither the amounts nor the chart heights reveal real revenue or how many invoices there were.
  const TYPICAL: Record<string, number> = { CZK: 18000, EUR: 750, USD: 800, GBP: 650, CHF: 700, NZD: 1300 }
  const perMonth = new Map<string, number>()
  for (const inv of data.invoices) perMonth.set(inv.issueDate.slice(0, 7), (perMonth.get(inv.issueDate.slice(0, 7)) ?? 0) + 1)
  const monthRevenue = new Map<string, number>()
  for (const m of [...perMonth.keys()].sort()) {
    const growth = Math.max(0.6, 1 + 0.06 * (Number(m.slice(0, 4)) - 2014))
    monthRevenue.set(m, 60000 * growth * (0.6 + rand() * 0.8))
  }
  /** Invented net amount for one invoice, in whole units of its currency. */
  const targetFor = (inv: Invoice) => {
    const m = inv.issueDate.slice(0, 7)
    const czk = (monthRevenue.get(m)! / perMonth.get(m)!) * (0.7 + rand() * 0.6)
    if (inv.currency === 'CZK') return czk
    return czk / (inv.exchangeRate ?? 18000 / (TYPICAL[inv.currency] ?? 800))
  }
  const newLines = (inv: Invoice) => {
    const cz = inv.currency === 'CZK'
    const target = targetFor(inv)
    const weights = inv.lines.map(() => 0.5 + rand())
    const sum = weights.reduce((x, y) => x + y, 0)
    const step = cz ? 1000 : 100 // unit prices in tens of crowns, or whole units of a foreign currency
    return inv.lines.map((l, i) => {
      const qty = Math.abs(l.quantity) || 1
      const price = Math.max(step, Math.round((target * 100 * weights[i]!) / sum / qty / step) * step)
      return { ...l, description: describe(l.description), unitPrice: l.unitPrice < 0 ? -price : price }
    })
  }

  const services = new Map<string, string>()
  const describe = (text: string) => {
    const base = text.replace(/\s+za\s+\S+\s+\d{4}\s*$/i, '').trim()
    if (!services.has(base)) services.set(base, SERVICES[services.size % SERVICES.length]!)
    const period = text.match(/\s+za\s+\S+\s+\d{4}\s*$/i)?.[0] ?? ''
    return services.get(base)! + period
  }

  const invoices = data.invoices.map((inv): Invoice => {
    const lines = newLines(inv)
    return {
      ...inv,
      customerSnapshot: partyFor(inv),
      orderNumber: inv.orderNumber ? `OBJ-${digits(4)}` : '',
      lines,
      paidAmount: inv.paidAmount === undefined ? undefined : computeTotals(lines, inv.vatMode, inv.reverseCharge).total,
      recordedTotal: undefined,
      note: '',
    }
  })

  const s = data.settings
  const acc = s.supplier.bank.account ? account() : ''
  const bankCode = s.supplier.bank.bankCode ? '0800' : ''
  const owner = SUPPLIER
  const supIc = ic()
  const settings: Settings = {
    ...s,
    supplier: {
      name: owner,
      ic: supIc,
      dic: s.supplier.dic ? `CZ${supIc}` : '',
      address: { street: 'Lipová 12', zip: '110 00', city: 'Praha', country: s.supplier.address.country },
      email: s.supplier.email ? `${slug(owner)}@example.com` : '',
      phone: s.supplier.phone ? phone() : '',
      web: '',
      registration: s.supplier.registration ? 'Fyzická osoba zapsaná v živnostenském rejstříku.' : '',
      bank: {
        account: acc,
        bankCode,
        iban: acc && bankCode ? czechIban(acc, bankCode) : '',
        swift: s.supplier.bank.swift ? 'GIBACZPX' : '',
      },
    },
    defaults: { ...s.defaults, note: '' },
    // The owner's logo, stamp, footer and own e-mail texts would give them away in screenshots.
    invoice: { ...s.invoice, logo: undefined, stamp: undefined, footer: '' },
    emailTemplates: undefined,
  }

  return { settings, customers, invoices }
}

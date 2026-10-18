# Czech invoicing and accounting: what we've learned

Facts about Czech invoicing, VAT, taxes and public registers found while building Invojka, with the source and the date each was checked. How the app applies them is in [invoicing-rules.md](invoicing-rules.md); this page is the background. **Add every new finding here** (the owner's request, 2026-10-18). It's not legal advice; laws change, so recheck before relying on an old entry.

Main source: zákon o DPH č. 235/2004 Sb. ([zakonyprolidi.cz](https://www.zakonyprolidi.cz/cs/2004-235)).

## VAT registration (plátcovství)

*Checked 2026-10-18 in the VAT act, BusinessInfo and Finanční správa.*

- **Since 1 January 2025 turnover is watched per calendar year,** no longer over the last 12 months. Supplies from 2024 don't count towards 2025.
- **2,000,000 Kč** (§ 6(1)): a business based in Czechia becomes a VAT payer from **1 January of the year after** the year its domestic turnover passed this amount.
- **2,536,500 Kč** (§ 6(2)(b)): passing this within the year makes it a payer **from the next day**. (Fakturoid shows 2,536,000 Kč, which doesn't match the act.)
- § 6(2)(a): a business can also choose to become a payer from the day after passing 2,000,000 Kč, if it says so in a registration filed in time.
- **Turnover (obrat v tuzemsku, § 4a(1))** is the total consideration excluding VAT for supplies with the **place of supply in Czechia**: taxable supplies (including those exempt only thanks to the small-business regime), exempt supplies with the right to deduct, and exempt supplies without it under §§ 54–56a and some real estate under § 62, unless occasional and ancillary. § 4a(2) adds some deemed supplies; § 4a(3) leaves out the sale of long-term assets unless it's part of ordinary business.

## Place of supply of services

*Checked 2026-10-18.*

- **To a business** (§ 9(1)): where the customer is established. A service from Czechia to a foreign business is supplied abroad, so it isn't Czech turnover. This holds inside and outside the EU; to an EU business it's invoiced under reverse charge.
- **To a consumer** (§ 9(2)): generally where the supplier is established, so a service to a foreign private person is usually supplied in Czechia and counts towards turnover. Some services have their own rules (§§ 10–10k).
- **Double taxation treaties don't apply to VAT.** They cover income tax. Whether foreign revenue counts towards the VAT limit depends only on the place of supply. (The owner asked, 2026-10-18.)

## ARES (business register)

*Checked 2026-10-18 by calling the API.*

- REST API at `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty`: `GET /{ico}` for one business (404 with `NENALEZENO` when unknown), `POST /vyhledat` with `{"obchodniJmeno": "...", "pocet": n, "start": 0}` to search by name (part of the name matches).
- It sends `Access-Control-Allow-Origin: *`, also for `Origin: null`, so a browser page opened from disk can call it directly. ČNB's APIs, by contrast, block browser requests.
- A record has `obchodniJmeno`, `ico`, `dic` (only for VAT-registered businesses, e.g. `CZ27074358`), `datumZaniku` for businesses that no longer exist, and `sidlo` with `nazevUlice`, `cisloDomovni`, `cisloOrientacni` + `cisloOrientacniPismeno`, `nazevCastiObce`, `nazevObce`, `nazevMestskehoObvodu` ("Praha 4"), `psc` (a number, e.g. 14000), `nazevStatu` and a ready `textovaAdresa`. `typCisloDomovni` 2 is an evidence number (č. ev.) instead of a descriptive number.
- Names can contain repeated spaces ("VIENNA INTERNATIONAL   a.s."); clean them up.
- The request body must be UTF-8; a wrongly encoded body returns a JSON parse error.

## Advance payments (zálohy)

*Checked 2026-10-18; sources: the VAT act (§ 28, § 29), pruvodcepodnikanim.cz, iDoklad, Pohoda portal, podnikatel.cz discussion.*

- **A proforma (zálohová faktura) is not a tax document.** It's a request for payment. It has no DUZP, carries no VAT liability by itself and isn't revenue in the books. It's usual to say so on it.
- **VAT payers:** receiving an advance creates the VAT liability on the day of receipt. The payer must issue a **tax document for the received payment** (daňový doklad k přijaté platbě) within **15 days** (§ 28(8): "within 15 days from the day the duty to declare the tax arose"). It must have the § 29 items; the scope and subject of the supply can be left out if not yet known. The VAT is worked out from the gross amount: at 21 % it's amount − amount / 1.21 (10,000 Kč → 1,735.54 Kč VAT). Since 2019 one summary document can cover a supply and its payment in the same month.
- **Rounding:** with base and VAT in whole haléře, some gross amounts can't be split exactly (base + round(base × 21 %) skips some values), so a tax document can be a haléř off the money received. *(Found 2026-10-18 while building it.)*
- **Final invoice (vyúčtování):** after the supply, the payer issues the final tax document, which deducts the advance's base and VAT, within 15 days of the DUZP.
- **Non-payers:** no 15-day rule. Usual practice: a proforma, then after the work a final invoice that deducts what was paid. In tax records (daňová evidence) income counts when money comes in, so the advance is income when received (forum answers, not verified in the law).
- **§ 29(1) items of a tax document:** supplier and customer with their tax IDs, document number, scope and subject of the supply, issue date, DUZP or the date of payment (if earlier and different from the issue date), unit price without VAT, tax base, rate, and VAT in Czech crowns.

## Corrections and credit notes

*Checked 2026-10-18 in the VAT act § 42, § 45.*

- **A VAT payer corrects the tax base with a corrective tax document** (opravný daňový doklad, § 42, § 45) when the price changes after the supply, goods are returned, a discount is given later and similar. It must reach the customer within 15 days of the decisive date (§ 42(5)). No correction after the end of the 7th calendar year after the year the tax arose (§ 42(8)).
- **§ 45(1) items:** supplier and customer names and tax IDs, the number of the original tax document, the number of the corrective one, the reason for the correction, and the differences in the tax base, in the VAT and in the total, plus the decisive date from § 42(3). The title "opravný daňový doklad" itself isn't required (finance.cz, 2011), but it's the usual name.
- **Bad debts** have their own correction (§ 46), within 3 years from the end of the tax period of the supply.
- **Non-payers** don't issue corrective tax documents; the usual practice is a credit note (dobropis, "opravná faktura") that refers to the original invoice.
- An issued invoice isn't edited or deleted; it's corrected by a new document, or cancelled if it was never sent.

## Cash payments

*Checked 2026-10-18; sources: Pohoda portal, banky.cz, money.cz (article of 2026-08-10), pruvodcepodnikanim.cz, a dauc.cz/podnikatel.cz discussion.*

- **Cash limit** (zákon č. 254/2004 Sb., o omezení plateb v hotovosti): one payer may pay one recipient at most **270,000 Kč** in cash per calendar day, all payments that day added up, Czech or foreign currency (converted at the ČNB rate of the day). Above it the payment must go through a bank. It applies to individuals and companies alike, and both the payer and the recipient can be fined: up to 500,000 Kč for individuals, up to 5,000,000 Kč for legal entities and sole traders. Taxes, wages, pensions and some others are exempt. Splitting a payment over several days to get round the limit counts as evasion. An EU-wide limit of €10,000 from July 2027 has been reported but not confirmed.
- **Cash receipt** (příjmový pokladní doklad): for accounting entities a document under § 11 of the Accounting Act (563/1991 Sb.): a document number, what happened and who took part, the amount, when it was made and when it happened, and signature records. Practice: an unbroken number series, signed by both sides, usually two copies (one for the payer). A freelancer on tax records (daňová evidence, § 7b of the Income Tax Act) isn't bound by the Accounting Act, so for them these are good practice rather than a duty (a forum answer, not verified in the law).
- **EET from 2027:** a new electronic sales records bill passed the Chamber of Deputies in July 2026 and was waiting for the Senate and the President (as of 2026-08-10). It would cover payments taken in person (cash, card, vouchers), not bank transfers, from 1 January 2027 at the earliest. Freelancers on the flat-rate tax with turnover up to 1 million Kč would be exempt (their flat-rate tax would go up). **If it passes, cash receipts may need to be registered online, which a local app can't do without sending sales to the tax authority. Check the status before 2027.**

## Sole traders: taxes and insurance

*Checked 2026-10-18; sources: ČSSZ (minimum advances 2026), Ministry of Finance press release of 26 May 2026, Finanční správa (paušální daň 2025 and 2026), Pohoda portal, e15, taxorio, superfaktura. Recheck every January and add the year to `RATES` in `src/domain/taxes.ts`.*

| | 2025 | 2026 |
|---|---|---|
| Average monthly wage (for the limits) | 46 557 Kč | 48 967 Kč |
| Minimum monthly social base, main activity (35 % of the average wage) | 16 295 Kč | 17 139 Kč |
| Minimum monthly health base (50 % of the average wage) | 23 278,50 Kč | 24 483,50 Kč |
| Social insurance ceiling a year (48 × the average wage) | 2 234 736 Kč | 2 350 416 Kč |
| 23 % income tax from (36 × the average wage) | 1 676 052 Kč | 1 762 812 Kč |
| Basic personal allowance (sleva na poplatníka) | 30 840 Kč | 30 840 Kč |
| Secondary activity: profit up to which no social insurance is due (rozhodná částka, 2.4 × the average wage) | 111 736 Kč | 117 521 Kč |
| Secondary activity: minimum monthly social base (11 % of the average wage) | 5 122 Kč | 5 387 Kč |
| Flat-rate tax a month, bands 1 / 2 / 3 | 8 716 / 16 745 / 27 139 Kč | 9 162 / 16 745 / 27 139 Kč |

- **2026 changed mid-year.** The consolidation package raised the minimum social base to 40 % of the average wage from January 2026 (19 587 Kč, advance 5 720 Kč). An amendment passed over the Senate's veto in May 2026 put it back to 35 % (17 139 Kč, advance 5 005 Kč) with retroactive effect from 1 January; overpaid advances are refunded or offset. The flat-tax band 1 went from 9 984 to 9 162 Kč, also retroactively (overpayment 4 932 Kč for January–June). Articles from before June 2026 still show the old figures.
- **Social insurance:** 29.2 % of the assessment base, which is 55 % of the profit (since 2024; it was 50 %), at least the yearly minimum, at most the ceiling. A starting sole trader has a lower minimum (25 %, 12 242 Kč in 2026), and one who started after 31 December 2024 without business in the previous 5 years pays no advances in the first two years; the yearly settlement still applies.
- **Health insurance:** 13.5 % of 50 % of the profit, at least the yearly minimum; no ceiling. A secondary activity has no health minimum.
- **Secondary activity (vedlejší činnost):** a sole trader who is also employed, a student, a pensioner, on parental leave and similar. *Checked 2026-10-18 with ČSSZ, Pohoda, BusinessInfo, Fakturoid, Vyfakturuj.*
  - Social insurance only when the year's profit is over the threshold (117 521 Kč in 2026; reduced by a twelfth for each month without the activity). Above it, 29.2 % of 55 % of the profit, at least 12 × 5 387 Kč (advance 1 574 Kč a month).
  - Health insurance from the profit only, with no minimum, when the person is insured otherwise (an employee, or insured by the state).
  - The basic personal allowance is claimed once a year; an employee usually has it applied at work, so it doesn't lower the business's tax again.
  - The flat-rate tax regime isn't open to anyone with employment income (except some exempt or separately taxed income).
- **Income tax:** the base (profit) rounded down to whole hundreds; 15 %, and 23 % above 36 × the average wage; less the allowance of 30 840 Kč. Social and health insurance are not deductible for a sole trader.
- **Flat-rate expenses (výdajové paušály):** 80 % crafts and agriculture, 60 % other trades, 40 % other self-employment (liberal professions), 30 % renting business property, each from at most 2 million Kč of income (so at most 1.6 M / 1.2 M / 800 k / 600 k Kč).
- **Flat-rate tax regime (paušální režim):** only for non-payers of VAT. Band limits by the previous year's income: band 1 up to 1 M Kč (1.5 M if at least 75 % of income is from 80 % or 60 % activities, 2 M if from 80 % activities); band 2 up to 1.5 M Kč (2 M if from 80 % or 60 % activities); band 3 up to 2 M Kč. 2026 split of band 1: 100 Kč tax, 5 756 Kč social, 3 306 Kč health. Due by the 20th of each month.
- **Income for a sole trader on tax records is money received**, not invoices issued; an advance counts when it comes in.

## ISDOC

*Checked 2026-10-18 against the official schema (isdoc.cz/6.0.2, isdoc-invoice-6.0.2.xsd, standard of 23 March 2022, published by the Ministry of the Interior).*

- **ISDOC** is the Czech national e-invoice standard; accounting programs (Pohoda, Money S3, ABRA, Helios…) import it. Namespace `http://isdoc.cz/namespace/2013`, root `<Invoice version="6.0.2">`, one document per file (`.isdoc`; `.isdocx` is a ZIP with attachments).
- **Document types:** 1 invoice (tax document), 2 credit note, 3 debit note, 4 proforma (no VAT), 5 tax document for an advance, 6 credit note for an advance, 7 simplified tax document.
- **Required at the top:** DocumentType, ID, UUID, IssueDate, VATApplicable, ElectronicPossibilityAgreementReference (may be empty), LocalCurrencyCode, CurrRate, RefCurrRate, the supplier and the customer, InvoiceLines, TaxTotal, LegalMonetaryTotal. Element order is fixed by the schema.
- **Amounts** are in the local currency (CZK); a foreign currency adds `…Curr` twins and the rate in CurrRate. Advances on a final invoice are `NonTaxedDeposits` (proforma without VAT) or `TaxedDeposits` (with a tax document), and the VAT summary has AlreadyClaimed and Difference amounts per rate.
- **Payment means codes:** 10 cash, 20 cheque, 31 debit transfer, 42 payment to a bank account, 48 card, 49 direct debit, 50 postal (giro), 97 clearing. A bank payment's details need due date, account number, bank code, account name, IBAN and BIC (all present, may be empty), then the symbols.

## Bank statement formats

*Checked 2026-10-18; source: Fio's "Struktura GPC formátu" (fio.cz/docs/cz/struktura-gpc.pdf).*

- **GPC (ABO)** is the fixed-width statement most Czech banks export. Records of 128 characters plus CR LF, no separators, numbers padded with zeros on the left, text with spaces on the right; usually Windows-1250.
- **"074" header:** account number (4–19), short account name (20–39), old balance date DDMMRR (40–45), old and new balance in haléře with signs, debit and credit turnovers, statement number (106–108), posting date DDMMRR (109–114).
- **"075" movement:** account (4–19), counter-account (20–35), document number (36–48), amount in haléře (49–60), posting code (61: 1 debit, 2 credit, 4 debit reversal, 5 credit reversal), variable symbol (62–71), constant symbol with the bank code in front, BBBBKSYM (72–81), specific symbol (82–91), "000000" valuta (92–97), the counter-party's short name (98–117), "0", currency as ISO numeric "0203" for CZK (119–122), date DDMMRR (123–128).
- **CAMT.053** (ISO 20022 XML) is the international standard; Czech banks put the variable symbol in the structured creditor reference, the end-to-end id or the message, in no single agreed place.
- **CSV** exports differ by bank (column names, separators, decimal comma or point, encoding).

## Invoices (from the app's earlier work)

- Non-payers write "Nejsem plátce DPH" on the invoice; identified persons write that they are an identified person; reverse charge says "daň odvede zákazník". See [invoicing-rules.md](invoicing-rules.md#vat-modes-settingsvatmode-copied-onto-each-invoice).
- QR Platba uses the SPAYD format; the payment message drops diacritics and `*` and is cut to 60 characters. See [invoicing-rules.md](invoicing-rules.md#qr-platba-domainspaydts-pdfrenderts).
- An issued invoice is corrected with a credit note (opravný daňový doklad), not by editing it.

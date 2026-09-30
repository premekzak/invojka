// A small, made-up export in the previous service's CSV format, for tests that must run without the
// owner's real (git-ignored) customers.csv and invoices.csv. It reproduces each quirk of the real data:
// duplicates with and without the legal form, identical rows, a VAT group sharing one DIČ,
// an IČ with spaces, trailing spaces, foreign customers and currencies, paid and overdue invoices.

const CUSTOMER_HEADER = 'Firma,IČ,DIČ,Ulice,PSČ,Město,Stát,E-mailová adresa,Další příjemci,Telefon,www,Titul,Jméno,Příjmení,Mobil,Číslo účtu,Kód banky,IBAN'
const INVOICE_HEADER = 'Číslo dokladu,Popis,Číslo objednávky,Řada,Název/Jméno,IČ,DIČ,Vystaveno,Splatnost,Datum platby,Celkem,Měna,Stav úhrady,Uhrazená částka,Variabilní symbol,Exportováno,Odesláno odběrateli,Odesláno účetnímu'

export const fixtureCustomersCsv = '﻿' + [
  CUSTOMER_HEADER,
  'Orion Travel,01234567,CZ01234567,Nerudova 3,11000,Praha,Česká republika,info@example.com,,,,,,,,,,',
  '"Orion Travel, s.r.o.",,,,,,,,,,,,,,,,,',
  '"Sokol media, s.r.o. ",123 45 678,CZ12345678,Husova 5,60200,Brno,Česká republika,,,,,,,,,,,',
  '"Sokol media, s.r.o.",,,,,,,,,,,,,,,,,',
  'Alfa Sázky a.s.,11111110,CZ699999999,,,,Česká republika,,,,,,,,,,,',
  'Beta Tip a.s.,22222220,CZ699999999,,,,Česká republika,,,,,,,,,,,',
  'Gama Los s.r.o.,33333330,CZ699999999,,,,Česká republika,,,,,,,,,,,',
  'Kiwi Studio Ltd,,,1 High Street,1010,Auckland,Nový Zéland,hello@example.com,,,,,,,,,,',
  'Euro Partner GmbH,,,,,Berlin,Německo,,,,,,,,,,,',
].join('\n')

export const fixtureInvoicesCsv = '﻿' + [
  INVOICE_HEADER,
  '20260003,"Poradenství za září 2026",,Výchozí,"Sokol media, s.r.o.",12345678,CZ12345678,09/06/2026,09/20/2026,,14500.00,Kč,Neuhrazeno a po splatnosti,0.00,20260003,Ne,Neodesláno,Ne',
  '20260002,"Provoz e-shopu za srpen 2026",,Výchozí,Orion Travel,01234567,CZ01234567,08/13/2026,08/27/2026,08/20/2026,8500.00,Kč,Uhrazeno,8500.00,20260002,Ne,Neodesláno,Ne',
  '20260001,"Tipy a analýzy",,Výchozí,Gama Los a.s.,33333330,CZ699999999,02/16/2026,03/02/2026,03/01/2026,12000.00,Kč,Uhrazeno,12000.00,20260001,Ne,Neodesláno,Ne',
  '20150001,"Website redesign",,Výchozí,Kiwi Studio Ltd,,,03/25/2015,04/08/2015,04/08/2015,1500.00,NZD,Uhrazeno,1500.00,20150001,Ne,Neodesláno,Ne',
  '20140001,"Consulting",,Výchozí,Euro Partner GmbH,,,01/10/2014,01/24/2014,01/20/2014,400.00,EUR,Uhrazeno,400.00,20140001,Ne,Neodesláno,Ne',
].join('\n')

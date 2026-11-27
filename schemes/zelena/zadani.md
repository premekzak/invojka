# Mírně do zelena, s jednou doplňkovou barvou

Majitel, 2026-11-26: „Chtěl bych zkusit schéma mírně do zelena s jednou doplňkovou barvou, udělej pár variant.“

Pět zkušebních variant (`ze-*`). Zelená je všude tlumená a šedé jsou lehce do zelena; každá varianta má jinou stavbu a jinou doplňkovou barvu, která sedí jen v dlaždici „Nová faktura“, v loňských sloupcích grafu, v tečce loga a případně v liště nebo patičce:

- Šalvěj a meruňka (`ze-salvej`): bílá stránka, šedozelená lišta, tlumená šalvějová tlačítka s bílým popiskem; meruňková dlaždice a loňské sloupce. Nejklidnější.
- Máta a švestka (`ze-mata`): světlá živá mátová tlačítka s tmavým popiskem (jako meruňka v Terakotě), lišta v barvě stránky; švestkové logo, tmavá švestková patička a loňské sloupce.
- Eukalyptus a okr (`ze-eukalyptus`): zelená je v samotné stránce (světlý eukalyptus pod bílými kartami), lišta i patička v barvě stránky; okrová dlaždice a loňské sloupce.
- Mech a levandule (`ze-mech`): zelená je v rámu (světle zelená lišta a patička kolem bílé stránky); levandulová dlaždice, hover řádků a loňské sloupce.
- Jedle a nebe (`ze-jedle`): skoro černá jedlová tlačítka a logo, chladné šedé; barvu nese nebesky modrá dlaždice a loňské sloupce.

## Druhé kolo

Majitel, tentýž den: „zkus ještě nějaké další, více pracuj se zelenou.“ Zelená tu zabírá větší část obrazovky a má víc odstínů:

- Louka (`ze-louka`): jen zelená, rozdělená do odstínů podle role (stránka, lišta, patička, tlačítka, odkazy, logo, dlaždice, obě řady grafu); žádná druhá barva.
- Hvozd a zlato (`ze-hvozd`): stavba Úředního v zelené: plná zelená lišta s bílým textem nad nazelenalým papírem; zlatá jen v loňských sloupcích.
- Pistácie a kakao (`ze-pistacie`): zřetelně pistáciová stránka pod bílými kartami, sytější pistáciová dlaždice; kakaové logo, tmavá kakaová patička, béžové loňské sloupce.
- Limetka (`ze-limetka`): světlá živá limetková tlačítka s tmavým popiskem, lesní zelená v písmu, logu a patičce; žádná druhá barva.
- Oliva a terakota (`ze-oliva`): teplá strana zelené: olivové šedé, lišta a tlačítka; terakotová dlaždice a loňské sloupce.

Zachováno: žádná linka pod lištou, světlá dlaždice „Nová faktura“, červená varování a nedoplatky (proto doplňková barva není korálová: pletla by se s červenou), jemné diagonální gradienty, „hotovo“ v jiném odstínu zelené než tlačítka.

Hodnoty generuje skript z OKLCH (odstín šedých, zelená, doplňková barva, stavba); kontrasty počítá `npx vitest run src/design`.

Výsledek: čeká na výběr majitele. Nevybrané varianty pak smazat (soubor, import v `src/index.css`, `SCHEMES`, názvy v `cs.ts` a `en.ts`).

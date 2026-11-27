# Website (invojka.cz)

The public website presents Invojka's features in **short animated scenes** (the owner, 2026-11-27: "web, který bude prezentovat jednotlivé features v krátkých animovaných sekvencích"). Started 2026-11-27; published the same day at a GitHub address, not launched (see Publishing). What must be on the site before launch (privacy page, contact, FAQ, download instructions) is in [launch.md](launch.md) and [product.md](product.md#first-run-from-download-to-first-invoice).

## Where it lives

| Path | What it is |
|---|---|
| `website/index.html`, `website/en/index.html`, `website/entry.js` | The Czech and the English page and their shared entry (the Vite root of the website build) |
| `src/website/locale.ts` | The page's language: `tr()`, the app's texts, money and dates |
| `src/website/Page.tsx` | The page: header, hero, one section per feature, footer |
| `src/website/Faq.tsx` | "Časté otázky": the questions and answers, as `<details>` |
| `src/website/scene/Stage.tsx` | The scene engine: `useScene` (frames, loop, pause), `Stage` (scaling, the pointer), `click` |
| `src/website/scenes/*.tsx` | One file per scene |
| `src/website/site.css` | Tailwind, the design kit, the Terakota scheme, the faces as files |
| `vite.website.config.ts` | The build: `npm run dev:web` (port 5183), `npm run build:web` → `dist-website/` (git-ignored) |

The website is a second build in this repo so that it can import the app's components. It is a normal multi-file static site (not a single file) and it never imports the store or storage.

## Publishing

`bash scripts/deploy-website.sh` builds the site and force-pushes only the built pages to the separate public repository `premekzak/invojka-web` (GitHub Pages from `main`), the same way as the showcase; the source stays in this repository (the owner's choice, 2026-11-27, over publishing from this repository with GitHub Actions). **Run it only when the owner asks.** First published 2026-11-27; it is at https://invojka.cz/ (English: https://invojka.cz/en/) and, as GitHub Pages' copy, at https://premekzak.github.io/invojka-web/.

- **Not launched yet:** `noindex` in `website/index.html` and `robots.txt` from the script keep search engines away until [launch.md](launch.md) is done (privacy page, contact, instructions after the download). Remove both together.
- **The domain:** https://invojka.cz/ is served by Cloudflare (since 2026-11-27): a Cloudflare Workers project `invojka-web` is connected to the `premekzak/invojka-web` repository and runs `npx wrangler deploy` on every push, reading the `wrangler.jsonc` the deploy script writes (static files only, no script). So the deploy script publishes to both addresses at once; Cloudflare follows within a minute or two. `www.invojka.cz` is not set up. `DOMAIN` in the script is for GitHub Pages' own custom domain and stays empty. Asset paths are relative (`base: './'`), so the site works under `/invojka-web/` and at the domain's root alike.

## Measuring

Google Analytics, property `G-56ZL175GS5` ("invojka.cz"), through the owner's Tag Manager container **`GTM-NCD56WJ3`** ("invojka weby") (the owner, 2026-11-27: "chci google analytics a chci tam sledovat microeventy na webu, nastav všechno, co jde", then "GTM nastav sám"), decided knowing that [launch.md](launch.md) said no tracking on the website: the owner runs ads and wants conversions. **This is the website only. The app is never measured** (CLAUDE.md).

- **The page pushes plain events into `dataLayer`** (`track` in `src/website/analytics.ts`; the `SiteEvent` type lists them all), each with every parameter it doesn't use set to undefined, because the data layer remembers values. **The container turns them into GA4 events:** a Google tag for `G-56ZL175GS5` on "Initialization - All Pages", and one GA4 event tag "GA4 event - web events" (event name `{{Event}}`) fired by the custom-event trigger "Web events", whose regular expression lists the event names; the parameters are the data layer variables `DLV - scene`, `place`, `phase`, `question`, `percent`, `target`. Published as version 2 on 2026-11-27. `scripts/gtm-container.json` is the import file of that setup (Admin → Import Container → Merge).
- The first id the owner pasted, `GTM-MV25KJ7Z`, is not a container: it is the Google tag of the same property. Sending `gtag('event', …)` through it worked too, but the owner wants the container.
- **Nothing loads from Google and nothing is sent before consent.** `src/website/Consent.tsx` asks at the bottom of the window; "Odmítnout" and "Povolit měření" are equal buttons; the footer's "Nastavení měření" opens it again. The choice is in `localStorage` (`invojka-web-measuring`). Only `analytics_storage` is granted; the three advertising signals stay denied (change it in `analytics.ts` and in the banner's text together if remarketing is ever wanted).
- What happens before the visitor answers waits in the page and is sent only after "yes"; after "no" it is dropped and nothing is recorded.
- The dev server never contacts Google; it prints the events to the console (`[measure]`).
- Checked on the published site (2026-11-27): no request to Google before consent; after it `page_view` and the events go to `G-56ZL175GS5`. Google's own "enhanced measurement" adds `scroll` at 90 % and others next to ours.
- **Still to do in Analytics itself** (Admin): mark `download_click` as a key event, and register the parameters `scene`, `place`, `phase`, `question`, `percent`, `target` as event-scoped custom dimensions, or they cannot be used in reports.

| Event | Parameters | When |
|---|---|---|
| `download_click` | `place`: `masthead`, `closing` | A click on "Stáhnout zdarma" (the conversion) |
| `scene_view` | `scene`: `invoice`, `install`, `stats`, `files` | A scene came on screen, once per visit |
| `scene_complete` | `scene` | A scene played to its end while on screen, once per visit |
| `scene_pause`, `scene_resume` | `scene`, `phase` (0-based part of the story) | "Pozastavit ukázku" / "Přehrát ukázku" |
| `scene_caption_click` | `scene`, `phase` (1 to 3, as numbered on the page) | A click on a caption beside a scene |
| `faq_open` | `question` (its text) | A question was opened |
| `scroll_depth` | `percent`: 25, 50, 75, 100 | How far down the page, once each |
| `outbound_click` | `target`: `github`, `demo`; for the demo also `place` | The link to the source code, or to the demo |

When an event or parameter is added or renamed, change `SiteEvent`, this table, the container (the trigger's list and a variable, then `scripts/gtm-container.json`) and the custom dimensions in Analytics together. The banner's text must stay true to all of this. The FAQ does not mention measuring (the owner, 2026-11-27: measuring a website is normal and has nothing to do with the app).

## The demo

https://invojka.cz/demo/ is the showcase build (the app on made-up data, [development.md](development.md#showcase-for-testers)) on the website's own domain (the owner, 2026-11-27: "na webu by taky měl být odkaz na demo, ideálně na stejné doméně"). `scripts/deploy-website.sh` builds it (`npm run build:showcase`) and copies its one file into `demo/` of the published site, so every website deploy also publishes the current app as the demo. It keeps its own `noindex`. The app is never measured, so the demo carries no Tag Manager and no consent banner.

The page links to it under both download buttons ("Nebo si nejdřív vyzkoušejte demo v prohlížeči"); the English page opens it with `?lang=en`. The click is measured as `outbound_click` with `target: demo` and `place`. The link leads nowhere on the dev server, which has no `demo/`. The older copy at https://premekzak.github.io/invojka-demo/ is still published by `scripts/deploy-showcase.sh` and is not linked from anywhere.

## Two languages

Czech at the site's root (`website/index.html`) and English in `en/` (`website/en/index.html`), added 2026-11-27 (the owner: "udělej anglickou verzi webu"). Both pages load the same code; the page's `<html lang>` decides the language once, in `src/website/locale.ts`.

- **The website's own sentences are written where they are used,** as `tr('česky', 'in English')`. A new sentence without both halves does not compile, so the two versions cannot drift apart.
- **The scenes take the app's texts** from `app` in `locale.ts`, which is the app's `cs.ts` or `en.ts`, so a scene reads as the app does in that language; money and dates go through `money()` and `date()` there. The made-up Czech businesses keep their names in both; invoice lines, folder names (Faktury / Invoices) and the Windows folder window are translated.
- `cz()` (no line break after a one-letter word) leaves English text alone.
- The footer links to the other language; nothing redirects by itself. Only the Czech title and description were written by the owner's wording; the English ones are a translation to be checked by him.
- `hreflang` links between the two pages are left out until the site has its final address (they need absolute addresses, and Vite's build fails on a relative link to a folder).

## Rules

- **Scenes are built from the app's real components** (the owner's choice, 2026-11-27, over screen recordings and over the live app driven by a script): `Steps`, `Button`, `Card`, the `.control` box, and the app's own Czech texts from `src/i18n/cs.ts`. A scene shows only the part of the screen it is about. When the screen it copies changes, change the scene with it; each scene's header comment names its source screen.
- **The site wears the app's default scheme** (Terakota; the owner, 2026-11-27), so scenes and the page are one piece. Role utilities only, as in the app. White sections alternate with pale blocks in `tint`; one hue family.
- **Made-up data only.** Names, IČ (with a wrong check digit, so they belong to nobody) and amounts are invented. Never the owner's clients.
- **No CDN and no third-party requests, with one recorded exception: measuring, after consent** (see [Measuring](#measuring)). Fonts and scripts are served from the site itself.
- **A scene is an illustration, not a control:** the stage is `inert` and `aria-hidden`; the captions beside it say the same in words. Scenes play only while on screen, have a pause button, and with reduced motion don't play at all (the captions switch between finished pictures).
- A stage is drawn at a fixed size and scaled down like a video, so it looks the same on a phone. On phones the scene goes above its captions.
- **Recorded exception: the folder windows are Windows 11's own** (the owner, 2026-11-27: "chtělo by to aby ten výběr složky byl opravdový, třeba z windows 11"), because that is the window a visitor will meet. It is not built from the app's components, it has a shadow, and its blue, yellow and greys are outside the scheme (`.win11` and the `--win-*` values in `site.css`). Nothing else on the site may use them. Chrome's own questions after the folder is chosen (may the site see and change the files) are left out of the scene.
- **The FAQ says only what is true today** (added 2026-11-27 from the October mockup's three questions and the topics in [launch.md](launch.md)): free, who sees the data, a broken computer, coming from another service (the built-in Fakturoid and iDoklad import, and "váš AI agent vám pomůže" with anything else, the owner's wording), two computers, browsers, the accountant, updating. The owner took out the line that Invojka does not earn on the data (the competitors do not either; they earn on subscriptions) and the question about the project ending. When updates, browser support or the export change, change the answer. It gives no legal guarantee ("the user answers for what they write") and no retention period in years, because none is recorded in [czech-rules.md](czech-rules.md) yet.
- **The headline changes** (the owner, 2026-11-27: "úvodní CTA v hero sekci by se mělo měnit a prezentovat výhody. Klidně můžeme dát nějakou výraznější doplňkovou barvu nebo efekt"): "Fakturujte zdarma." stays, and under it four advantages take turns every 3.4 s (`ADVANTAGES` in `Page.tsx`), each rising in, in the `link` colour (a deeper step of the accent). A marker stroke drawn under the phrase was tried first and turned down (the owner: "to podtržení se mi nelíbí"); don't underline it. More aggressive effects were tried the same day and all turned down: the sentence in a stamp frame, a receipt strip, a dark label, then a small rectangular stamp and a round seal in stamp-pad blue ("bez razítka"). The rust sentence stays; don't bring those back. The download button's label does not change. With reduced motion the first advantage stays.
- **The page ends with a closing block in the accent itself** with the download button once more (the owner, the same day), the one strong area of the page; its button is the logo's dark pair (`brand`, `brand-fg`), because an accent button would vanish on it.
- **The product is the masthead** (the owner, 2026-11-27: "header skromnější a jako masthead použít trochu větší animaci produktu", then "header se plete s animací, protože je stejně barevný, ty tři kroky které vysvětlují, jsou už pod foldem"): the logo bar and the top share a `tint` band, so the headline does not run into the scene (which is drawn on the page colour). In a wider container (`max-w-7xl`) the invoice scene is on the right, up to 1.25 times its size (`maxScale` on `Stage`); on the left the headline with the changing advantage, the scene's three captions and the download button, all above the fold. The invoice scene is therefore not a feature section of its own; the sections after the masthead alternate white and tint, starting with white.
- **The top bar holds only the logo** (the owner, 2026-11-27: "vyhodíme tlačítko stáhnout a faq nahoře, protože se to míchá s tlačítky v animaci"). The download button is beside the headline and in the closing block; the FAQ is reached by scrolling.
- **No spot colour for now** (the owner, 2026-11-27): a vivid colour outside the scheme was tried on the headline's changing advantage only (blue, petrol, raspberry, emerald, violet, behind a chooser) and put off: "zatím to necháme bez doplňkové barvy". The advantage stays in `link` rust.
- **One-letter words never end a line** (the owner: "funguje i bez internetu je zalomeno za i, to nevypadá hezky"): every sentence goes through `cz()` in `src/website/text.ts`, which puts a non-breaking space after a, i, k, o, s, u, v, z.

## How a scene works

A scene is a state object and a list of frames, `{ wait, set }`: wait that many milliseconds, then change those fields. `phase` numbers the parts of the story; the captions beside the scene follow it and jump to it. The pointer goes to the element marked `data-cue="…"` named in `cursor`; `click('cue')` gives the three frames of a click. The first frame's `wait` is the pause before the loop starts again.

## Scenes

| Scene | File | Copies | Story |
|---|---|---|---|
| An invoice in four steps | `scenes/InvoiceSteps.tsx` | The draft editor ([ui.md](ui.md), `#/invoices/:id`) | Type three letters and pick the customer; the lines are prefilled from their last invoice; change one quantity; skip to the review; issue; "Faktura je vystavená" |
| No installation | `scenes/Install.tsx` | The welcome screen, the first onboarding step and Home's "Nová faktura" tile ([ui.md](ui.md)) | Click the download button, the file appears, open it; "Vybrat složku s daty" and the system's folder window, where the scene makes the folder first ("Nová složka", types "Faktury") and then chooses it, because a new user has no folder for the data yet (the owner, 2026-11-27). The folder is called "Faktury", not "Invojka" (the owner, the same day, asked why it should be named after the program): the name says what is in it, and nothing depends on it. The other scenes use the same name; "Jak začínáte?" and the first choice; cut to the Home tile (the steps between are left out). The download page is drawn plainly and copies no browser |
| Statistics | `scenes/Stats.tsx` | Statistiky (`src/features/stats/StatsPage.tsx`), drawn with the app's own `BarChart` and `Segmented` | Revenue 2026 by month beside 2025, the columns growing; a click on "Všechny roky" and the years; cut to "Největší odběratelé" with the share bars growing |
| Your data are your files | `scenes/Files.tsx` | The confirmation after issuing, and the data folder's files ([data-model.md](data-model.md)) | "Vystavit" in a cut-down invoice card; the PDF appears in the folder window beside it (`Disk Google › Faktury › pdf › 2026`), first syncing, then synced; a click on "Faktury" in the path shows the folder's top level: `pdf`, `AGENTS.md` and the three JSON files. The folder window is the Windows 11 one of the installation scene; the drive is named in words, with no service's logo |

Features alternate: one has its scene on the right on a `tint` block, the next on the left on the white page (`flip`).

## Open

- **Logos of the drives** (the owner, 2026-11-27: "možná bych tam dal i loga google drive, onedrive, dropbox", on the page, not in a scene). Under the files scene there is a row naming Disk Google, OneDrive and Dropbox in words for now. To decide: the real multicolour logos (against the one-hue-family rule above and the owner's own "no multicolour brand logos, plain text" of 2026-10-18; a recorded exception if chosen) or one-colour marks in ink; the official files must come from each company's brand page, used unchanged and without implying endorsement.

- The other scenes and the rest of the page (the owner judges the sample first).
- The download instructions after the click.
- The bundle carries all of `cs.ts` (about 100 kB gzipped in total); split the texts the scenes use if it matters.

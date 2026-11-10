# Průběh

## Fáze 1 — uložení partií

Hotovo. Sedm commitů od schématu po obrazovku Moje partie. `npm run lint` čistý, `npm test` 105 testů, `npm run build` prošel. Živý engine (`npm run test:engine`) se v téhle fázi nespouštěl, chování enginu se neměnilo.

### Co je hotové

- Databáze `ai-chess-tutor` verze 1. Story `kv`, `games`, `moves` a prázdné `analysisCache`, `profileSnapshots`, `eloSnapshots`, `trainingItems`.
- `src/storage` je první projekt s `strict: true`. Zbytek aplikace strict pořád nemá.
- Obal nad IndexedDB, fronta zápisů a mapování chyb (plné úložiště, soukromý režim, jiná karta, přerušení).
- Jednorázový přesun čtyř klíčů z localStorage. Záloha se nemaže. Po ověření se čte IndexedDB a každá změna se zapisuje nejdřív tam, potom do localStorage.
- Volná hra a kalkulačka se ukládají. První tah volné hry partii založí, načtená pozice v kalkulačce se uloží hned. Vrácení tahu smaže od toho tahu dál. Konec partie se zapíše jen když se mezitím nezměnila generace.
- Po obnovení stránky se rozehraná partie přehraje na šachovnici. Zahájení a matové úlohy se do historie neukládají.
- Import a export PGN. Duplicita se pozná podle tahů, jmen, data a výsledku, ne podle místa. Vedlejší varianty se zahodí. Soubor musí být UTF-8.
- Obrazovka Moje partie: seznam, smazání s potvrzením, export jedné i všech, import se shrnutím, pokračování rozehrané partie. Plné nebo vypnuté úložiště je vidět nad šachovnicí.

### Soubory

Nové: `src/storage/` (`types`, `schema`, `db`, `errors`, `queue`, `migrate`, `games`, `pgn` a jejich testy), `tsconfig.storage.json`, `src/game/persist.ts`, `src/components/GamesDialog.tsx`, `GamesDialog.css`, `gameList.ts`.

Upravené: kořenový `tsconfig.json`, `tsconfig.app.json`, `tsconfig.test.json`, `package.json` (devDependency `fake-indexeddb`), `src/game/storage.ts`, `useChessGame.ts`, `useGameCommands.ts`, `useOpponent.ts`, `useTutor.ts`, `useCalculatorBridge.ts`, `src/App.tsx`, `src/App.css`.

### Rozhodnutí

- `userColor` je `w`, `b` nebo `both`. U kalkulačky hraje uživatel oběma.
- Zdroj se určí při založení. Zapnutí kalkulačky uprostřed volné hry zdroj nemění. `byUser` říká, kdo tah zahrál.
- `vs-personal` je v typu, ale nic ho zatím nezapisuje.
- Hodiny se neukládají. Komentáře trenéra se neukládají. Mezipaměť analýzy v paměti se do IndexedDB nezapisuje.
- Vzdání ve hře oběma barvami je v záznamu `0-1`. Text „Vzdal jsi partii“ se nemění.
- Dvě karty se nesynchronizují. Poslední zápis vyhrává.

### Známá omezení

- localStorage se nikdy nemaže. Po ověřeném přesunu se pozdější ruční změna v localStorage ignoruje.
- `%clk` se nečte. Čas na tah zůstává prázdný.
- Dohraná partie se na šachovnici nenačítá. To přijde s rozborem.
- Kódování jiné než UTF-8 se odmítne, nehádá se.
- Obnova po reloadu se přeskočí, když uživatel stihne táhnout dřív, než se záznam dočte.

## Design A — základ

Hotovo. `npm run lint` hlásí jen upozornění fast-refresh u `src/chess/pieces.tsx` (soubor exportuje i sadu figur), testy 108, build prošel.

### Co je hotové

- Tokeny barev, písma, mezer, radiusů a stínu v `src/styles/tokens.css`. Tmavý a světlý motiv, přepínač v liště. Volba se pamatuje v localStorage `ai-chess-tutor:appearance`.
- Inter Variable je z balíčku `@fontsource-variable/inter` a servíruje se z aplikace, ne z Google. Čísla jsou tabulková.
- Tři šachovnice napojené na tokeny: Klasická, Modrá, Ořech. Kontrast textu i značení polí je v testu proti WCAG AA (4.5:1).
- Původní geometrické figury, licence CC0. Stejná sada je na šachovnici, v proměně pěšce, v sebraných figurách a v logu místo ♞.
- Navigace bez nové knihovny: Hrát, Moje partie, Rozbor, Můj styl, Trénink, Dashboard. Rozbor, styl a dashboard jsou zatím poctivé prázdné obrazovky. Trénink otevře stávající matové úlohy.
- Náhled varianty se na úzké šířce zalamuje. Tlačítko Nová hra je jen pod šachovnicí.
- `prefers-reduced-motion` zkrátí animace včetně tahu figur.

### Známá omezení

- Světlý motiv a šachovnice se neukládají do IndexedDB, jen do localStorage.
- Můj styl a Dashboard ještě nepočítají data.

## Fáze 2 — rozbor na pozadí

Hotovo. Lint má jen původní upozornění u figur. `npm test` 112 testů, build prošel. Živý engine se nespouštěl.

### Co je hotové

- Fronta v `src/analysis` počítá pozice mimo tah hráče. Hloubka, MultiPV a čas na pozici se nastavují na obrazovce. Jde pozastavit a zrušit. Běžící rozbor se po reloadu spustí z uloženého tahu.
- Pozice se ukládají do `analysisCache`.
- U tahu je `cpLoss`, změna šance na výhru a kategorie podle prahů v `src/tutor/classify.ts`.
- Fáze partie a taktické motivy jsou popsané v `docs/analysis.md`. Motivy jsou jen vidlička a visící figura.
- Obrazovka Rozbor: graf z vlastního SVG, klikací chyby, přehrání pozice na šachovnici.
- Při `hardwareConcurrency <= 4` hraje soupeř na workeru analytika a rozbor počká, než tah doběhne.

### Známá omezení

- Rozbor neběží sám od sebe po dohrání. Spouští se z obrazovky Rozbor.
- Graf používá hodnocení po tahu z pohledu bílého. Neanalyzovaný tah je na nule.
- Sdílený worker se v jednotkových testech jen rozhoduje podle počtu jader. Živý Stockfish to neověřuje.

## Fáze 3 — osobní Elo

Hotovo. Vzorec je v `docs/personal-elo.md`. Tři syntetické testy prošly. Celkem 115 testů, lint bez nové chyby, build prošel.

Odhad je lineární: 50 cp ztráty odpovídá kotvě, každý centipawn hýbe odhadem o 4 body. Bez zadaného ratingu je kotva 1500. Výsledky se přičítají jen u importovaných partií. Pod 20 partiemi je varování a široký interval. Podskóre se schová, když je míň než 8 tahů. Čas se neukazuje jako procento. Jednou denně se uloží `EloSnapshot`. Dashboard číslo ukáže. Graf a radar jsou až v designu B.

## Fáze 4 — profil stylu

Hotovo. Metriky jsou v `docs/style-metrics.md`. Kalkulačka a `playStyle` se neměnily. Testy na malém vzorku, na podílu vývinu a na váze novější partie prošly.

Vývin, střed, braní a šach jsou podíl tahů. Rošáda je podíl partií. Pod 20 tahů nebo pod 8 partií se číslo neukáže. Novější partie váží víc. Obrazovka Můj styl číslo vysvětlí a porovná ho se snímkem starým aspoň měsíc, pokud už takový snímek je.

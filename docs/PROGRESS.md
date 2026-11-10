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

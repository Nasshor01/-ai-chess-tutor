# Architektura

## Uložení (fáze 1)

Všechno zůstává v prohlížeči. IndexedDB `ai-chess-tutor`, verze 1.

| Store | Klíč | K čemu |
| --- | --- | --- |
| `kv` | `key` | nastavení, koncepty, maty, kalkulačka, aktivní partie, rozbor, vzhled, okno chyb |
| `games` | `id` | partie. Indexy `updatedAt`, `status`, `source`, `dedupKey` (není unikátní), `createdAt` |
| `moves` | `[gameId, ply]` | tahy včetně ztráty, fáze, motivu a `bestUci` |
| `analysisCache` | `key` | hotové pozice rozboru |
| `profileSnapshots` | `id` | denní snímek stylu |
| `eloSnapshots` | `id` | denní snímek Elo |
| `trainingItems` | `id` | karty slabin, v `payload` je i plán SM-2 |

`src/storage` neimportuje `src/game` ani `src/chess`. PGN skládá přímo chess.js. `src/game/persist.ts` je adaptér: z živé partie udělá záznam a po reloadu ho přehraje tahy UCI, ne přes `makeMove`, aby soupeř nehrál dvakrát.

Zápisy jdou frontou v `src/storage/queue.ts`. Když se mezi odesláním a zápisem změní generace partie (`genRef`), zápis se zahodí. Chyba uložení tah nevrací. Text chyby jde do varování nad šachovnicí.

Čtyři původní klíče localStorage se jednou zkopírují. localStorage zůstává záloha. Po ověření se nastavení čte z IndexedDB a každá změna se zapisuje do obou.

`src/storage` má vlastní `tsconfig.storage.json` s `strict: true` a je vyřazený z `tsconfig.app.json` a `tsconfig.test.json`, aby se typově nekontroloval dvakrát.

## Vzhled (design A)

Tokeny jsou v `src/styles/tokens.css`. Motiv a šachovnice drží `src/ui/appearance.ts` (vlastní strict projekt) a zapisuje je na `<html data-theme data-board>`. Nejdřív se čte localStorage, potom IndexedDB `kv` pod stejným klíčem. Figury v `src/chess/pieces.tsx` jsou původní a pod CC0. Mapa pro šachovnici je v `src/chess/pieceSet.ts`, aby soubor s komponentami neexportoval konstantu. Navigace je stav v `App.tsx`, bez routeru. Dashboard, rozbor a styl se načítají až při otevření.

## Rozbor (fáze 2)

`src/analysis` je strict projekt. Fronta bere hledání jako funkci, takže testy nepotřebují Stockfish. Napojení na analytika je v `src/game/analysisBridge.ts`. Pravidla fáze partie a motivů jsou v `docs/analysis.md`. Na čtyřech a méně jádrech vrací `playingEngine()` analytika. `beginSharedOpponentTurn` v `src/engine/sharedTurn.ts` rozbor zruší a soupeř na frontu nečeká. `markGameSearch` pak drží frontu, dokud tah nedoběhne.

## Osobní soupeř (fáze 5)

`src/personal` je strict. `createPersonalProvider()` vrací statistický model nad MultiPV. Neuronová Maia (`id: 'maia'`) má zůstat za stejným rozhraním a nikdo jiný ji nemá vybírat. Hra volá `search()` se Skill Level podle síly. `analyze()` se nemění a zůstává na plné síle. Partie má `source: 'vs-personal'` a `userColor: 'w'`. Když je styl pod minimem z `docs/style-metrics.md`, soupeř to řekne a styl do vah nedá.

## Trenér (fáze 6)

`src/coach` je strict. Predikce zůstává na `PersonalMoveProvider`. Doporučení počítá `teachingMove` z plného rozboru. Souhrn partie čte uložené tahy a při prázdném rozboru nic nevymýšlí.

## Trénink (fáze 7)

`src/training` je strict. Karty jsou v `trainingItems`. Po dohrání volné partie `scheduleLearning` spustí rozbor jen té partie a pak přepočítá okno chyb, karty a denní snímky. Zapíná se z aplikace, testy ho nechávají vypnuté.

## Tok dat a workery

Volná hra a kalkulačka jdou přes `persist.ts` do `games` a `moves`. Po reloadu se partie přehraje tahy UCI. Zahájení a maty se neukládají.

Dohraná volná partie zavolá `scheduleLearning`. Fronta v `src/analysis` spočítá jen tuhle partii. Na čtyřech a méně jádrech je worker jeden: `playingEngine()` vrátí analytika, soupeř rozbor zruší a nečeká na něj. Jinak hraje samostatný worker a analytik běží vedle. Kalkulačka má třetí worker. `analyze()` je vždy plná síla. Osobní soupeř volá `search()` se Skill Level.

Z uložených tahů se pak složí okno chyb, karty a denní snímky Elo a stylu. Dashboard, styl a trenér čtou ty snímky a tahy. Predikce „co bych zahrál já“ jde jen přes `createPersonalProvider()`.

## Maia

Další model má implementovat `PersonalMoveProvider` s id `maia`. Vstup je stejný: FEN, snímek profilu, režim, síla, historie tahů. Chybí síť (Maia přes lc0, nebo model doladěný na exportovaných PGN), běh v prohlížeči bez serveru a rozhodnutí, jak z PGN udělat trénovací dvojice pozice a tah. Dokud to není, `createPersonalProvider()` vrací statistiku a UI se na id neptá.

## TypeScript strict roadmap

`strict` se v téhle fázi nezapíná pro celý projekt. Kořenový `tsconfig` zůstává beze změny a hromadný přepis se nedělá.

Až se bude zapínat, tak po jednom adresáři a v tomhle pořadí:

1. `src/chess/`
2. `src/engine/`
3. `src/tutor/`
4. `src/calculator/`
5. `src/components/`
6. `src/game/useChessGame.ts` a moduly, které z něj už vznikly: `end`, `messages`, `search`, `useOpening`, `useTutor`, `useOpponent`, `useCalculatorBridge`, `useGameCommands`

Nové adresáře se do uvolněného nastavení nepřidávají a na tenhle seznam nečekají. První soubor v každé z nich dostane vlastní `tsconfig` s `"strict": true` a odkaz z kořenového projektu:

- `src/storage/` (hotovo ve fázi 1)
- `src/analysis/` (hotovo ve fázi 2)
- `src/elo/` (hotovo ve fázi 3, vzorec v `docs/personal-elo.md`)
- `src/profile/` (hotovo ve fázi 4, metriky v `docs/style-metrics.md`)
- `src/personal/` (hotovo ve fázi 5, metoda v `docs/personal-provider.md`)
- `src/coach/` (hotovo ve fázi 6, výběr tahu v `docs/coach.md`)
- `src/training/` (hotovo ve fázi 7, SM-2 v `docs/training.md`)
- `src/ui/` (hotovo v designu A: motiv a šachovnice)

Do nových modulů se nedává `any` bez komentáře, proč je nutné.

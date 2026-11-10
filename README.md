# AI Chess Tutor

Šachový trenér v prohlížeči. Hraješ bílými proti Stockfishi nebo proti odhadu vlastního stylu. Trenér po tahu česky řekne, jestli byl dobrý, proč, a co bylo lepší. Partie, rozbor, Elo i trénink zůstávají v prohlížeči.

## Spuštění

Potřeba je Node.js 22 nebo novější (`engines` je `>=22`, verze pro vývoj je v `.nvmrc`).

```bash
npm install          # zkopíruje i Stockfish (WASM) do public/stockfish
npm run dev          # http://localhost:5173
npm run lint
npm test             # logika, bez Stockfishe (projekt unit)
npm run test:engine  # živý Stockfish (projekt engine)
npm run build
```

`npm test` a `npm run test:engine` jsou oddělené projekty ve Vitestu. CI má dva joby na Node 22. Job `check` udělá instalaci, lint, build a `npm test`. Job `engine` jen `npm run test:engine`.

## Režimy

- **Volná hra** – partie proti Stockfishi ve třech obtížnostech, nebo proti volbě Já (dnes, před měsícem, po měsíci tréninku). Komentář ke každému tahu. Partie se uloží, po reloadu pokračuje.
- **Moje partie** – seznam, import a export PGN, smazání, pokračování rozehrané hry.
- **Rozbor** – graf hodnocení, chyby a přehrání pozice. Běží na pozadí a při čtyřech a méně jádrech uvolní worker tahu.
- **Můj styl** a **Dashboard** – podíly z vlastních tahů a odhad Elo s intervalem. Čísla se neukazují, dokud je vzorků málo.
- **Trenér** – „Co bych zahrál já?“ a „Co mám zahrát, abych se zlepšil?“. Souhrn partie přidá až tři chyby, silnou stránku a cíl, jen z rozboru.
- **Trénink** – matové úlohy a karty z opakovaných chyb vlastních partií (SM-2).
- **Trénink zahájení** – hlavní varianty populárních zahájení tah po tahu.
- **Trénink matů** – 22 vyhraných pozic s vynuceným matem ve 2–4 tazích (zadní řada, dušený mat, polibek smrti, dva střelci, věž a král…). Soupeř se brání naplno a trenér po každém tahu řekne, jestli matová síť drží, kolik volných polí má král a jaké pokračování bylo správné. Po matu ukáže použitý vzor. Že je mat vynucený, ověřuje `npm run test:engine`, ne běžné `npm test`.
- **Režim kalkulačka** (přepínač v postranním panelu) – hra sám se sebou na úrovni kolem 1200 Elo. Na tahu bílého i černého dostaneš tři návrhy: *Tah A – rozumný*, *Tah B – průměrný*, *Tah C – riskantní / chybný*. Tahy si vybíráš a hraješ za obě barvy; šipky a náhled zůstanou, tlačítko Zahrát tah rovnou položí. *Nastavit pozici* načte FEN nebo ručně postavenou šachovnici a kalkulačka pokračuje odtud. *Analyzovat tuto pozici* přepne do kalkulačky rozestavení, které právě hraješ. Když máš jasně vyhranou pozici, kalkulačka přepne do režimu *Dokonči partii*: první návrh je *Matová cesta* (nebo tah, který omezí krále) a trenér radí, jak výhru dotáhnout do matu. Když je kalkulačka vypnutá, zase hraješ jen bílými proti Stockfishi.

## Struktura

```
src/
  engine/       Stockfish ve Web Workeru (UCI, fronta, cache) – analytik, soupeř, kalkulačka
  chess/        pomocné funkce: české názvy figur a pády, notace (J/S/V/D), hodnocení
  tutor/
    features.ts     co tah dělá na šachovnici (střed, vývin, sloupce, hrozby, vidličky…)
    commentary.ts   skládá komentáře z faktů o pozici + hodnocení enginu
    mating.ts       komentáře v tréninku matů (matová síť, úniková pole krále)
    concepts.ts     knihovna pojmů, které trenér postupně vysvětluje
    classify.ts     hodnocení tahu (nejlepší … hrubá chyba)
    summary.ts      rozbor po konci partie
  puzzles/      matové úlohy
  calculator/   Režim kalkulačka – výběr praktických variant a odhad stylu hráče
  openings/     sedm českých zahájení a kniha z Lichess (strict strom v book/)
  game/         useChessGame – řízení partie, obtížnosti, ukládání
  storage/      IndexedDB, PGN, fronta zápisů
  analysis/     rozbor na pozadí
  elo/          odhad Elo
  profile/      styl přes víc partií
  personal/     PersonalMoveProvider, teď statistika nad MultiPV
  coach/        predikce a tah k naučení
  training/     karty slabin, SM-2
  components/   UI (šachovnice, panely, dialogy, dashboard)
```

## Zahájení

Jména a linie zahájení jsou ze souboru [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (tabulky `a.tsv` až `e.tsv`). Licence je [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) – veřejná doména, ověřená v souboru `COPYING.txt` a ve SPDX označení repozitáře `CC0-1.0`. Vygenerovaný soubor `src/openings/book/data/openings.json` je v gitu, takže build síť nepotřebuje. Znovu se stáhne příkazem `node scripts/build-openings.mjs`.

Průzkumník v záložce Zahájení skládá z tabulky strom pozic, aby se transpozice slučovaly. Sedm původních zahájení si nechává české vysvětlení tahů. Ostatní linie komentář nemají. Podrobnosti, statistiky a omezení jsou v `docs/openings.md`.

## Figury

Kresby figur jsou od Colina M. L. Burnetta (Wikimedia Commons) a do aplikace vstupují jako výchozí sada knihovny [react-chessboard](https://github.com/Clariity/react-chessboard) (Ryan Gregory, MIT). Žádný další soubor s figurami se nestahuje.

Licence kreseb je [Creative Commons Uveďte autora – Zachovejte licenci 3.0 (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/). S webovou aplikací je slučitelná: kresby se smějí šířit, pokud je uvedený autor a licence a případná úprava kreseb zůstane pod stejnou licencí. Text a kód aplikace se touto licencí neřídí. Stejné znění je v aplikaci pod „O aplikaci“.

Stockfish běží ve Web Workeru. Analytik je plná síla (`analyze`). Soupeř má vlastní worker, na čtyřech a méně jádrech se o něj dělí s analytikem a tah hry má přednost. Kalkulačka má třetí worker. Varianta je `stockfish-19-lite-single`.

Neuronový model (Maia) sem patří jako další `PersonalMoveProvider`. Zatím chybí samotná síť v prohlížeči a převod exportovaných PGN na dvojice pozice a tah. Rozhraní a statistický model jsou v `docs/personal-provider.md`.

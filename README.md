# AI Chess Tutor

Šachový trenér v prohlížeči. Hraješ bílými proti Stockfishi a trenér ti po každém tahu česky vysvětlí, jestli byl tah dobrý, proč, co bylo lepší a co komu hrozí.

## Spuštění

```bash
npm install      # zkopíruje i Stockfish (WASM) do public/stockfish
npm run dev      # http://localhost:5173
npm test         # testy logiky trenéra (běží proti skutečnému Stockfishi v Node)
npm run build
```

## Režimy

- **Volná hra** – celá partie proti počítači ve třech obtížnostech, komentář ke každému tahu, rozbor na konci.
- **Trénink zahájení** – hlavní varianty populárních zahájení tah po tahu.
- **Trénink matů** – 22 vyhraných pozic s vynuceným matem ve 2–4 tazích (zadní řada, dušený mat, polibek smrti, dva střelci, věž a král…). Soupeř se brání naplno a trenér po každém tahu řekne, jestli matová síť drží, kolik volných polí má král a jaké pokračování bylo správné. Po matu ukáže použitý vzor. Všechny úlohy ověřuje test proti Stockfishi.
- **Calculator Mode** (přepínač v postranním panelu) – hra sám se sebou na úrovni kolem 1200 Elo. Na tahu bílého i černého dostaneš tři návrhy: *Tah A – rozumný*, *Tah B – průměrný*, *Tah C – riskantní / chybný*. Tahy si vybíráš a hraješ za obě barvy; šipky a náhled zůstanou, tlačítko Zahrát tah rovnou položí. Když máš jasně vyhranou pozici, kalkulačka přepne do režimu *Dokonči partii*: první návrh je *Matová cesta* (nebo tah, který omezí krále) a trenér radí, jak výhru dotáhnout do matu. Když je kalkulačka vypnutá, zase hraješ jen bílými proti Stockfishi.

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
  calculator/   Calculator Mode – výběr praktických variant a odhad stylu hráče
  openings/     hlavní varianty zahájení s vysvětlením každého tahu
  game/         useChessGame – řízení partie, obtížnosti, ukládání pokroku
  components/   UI (šachovnice, panel trenéra, historie, dialogy)
```

Stockfish běží v samostatných workerech: jeden hraje se sníženou silou podle obtížnosti (v tréninku matů naplno), druhý (plná síla) analyzuje pozice pro trenéra a nápovědu a třetí se spouští jen pro Calculator Mode, aby nezdržoval komentáře. Použitá je varianta `stockfish-19-lite-single`, která nepotřebuje žádné speciální HTTP hlavičky.

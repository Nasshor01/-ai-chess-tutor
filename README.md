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
- **Calculator Mode** (přepínač v postranním panelu) – místo jediného nejlepšího tahu nabídne 2–3 praktické možnosti: *Tah A – více možností*, *Tah B – agresivní / taktický*, *Tah C – bezpečný*. U každé ukáže, co soupeř nejspíš odpoví a jak pokračovat. Doporučení se přizpůsobuje tvému stylu v partii a kliknutím na variantu si ji přehraješ na šachovnici, aniž by se zahrála.

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

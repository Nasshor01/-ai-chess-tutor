# AI Chess Tutor

Šachový trenér v prohlížeči. Hraješ bílými proti Stockfishi a trenér ti po každém tahu česky vysvětlí, jestli byl tah dobrý, proč, co bylo lepší a co komu hrozí.

## Spuštění

```bash
npm install      # zkopíruje i Stockfish (WASM) do public/stockfish
npm run dev      # http://localhost:5173
npm test         # testy logiky trenéra (běží proti skutečnému Stockfishi v Node)
npm run build
```

## Struktura

```
src/
  engine/       Stockfish ve Web Workeru (UCI, fronta, cache) – analytik + soupeř
  chess/        pomocné funkce: české názvy figur a pády, notace (J/S/V/D), hodnocení
  tutor/
    features.ts     co tah dělá na šachovnici (střed, vývin, sloupce, hrozby, vidličky…)
    commentary.ts   skládá komentáře z faktů o pozici + hodnocení enginu
    concepts.ts     knihovna pojmů, které trenér postupně vysvětluje
    classify.ts     hodnocení tahu (nejlepší … hrubá chyba)
    summary.ts      rozbor po konci partie
  openings/     hlavní varianty zahájení s vysvětlením každého tahu
  game/         useChessGame – řízení partie, obtížnosti, ukládání pokroku
  components/   UI (šachovnice, panel trenéra, historie, dialogy)
```

Stockfish běží ve dvou workerech: jeden hraje se sníženou silou podle obtížnosti, druhý (plná síla) analyzuje pozice pro trenéra a nápovědu. Použitá je varianta `stockfish-19-lite-single`, která nepotřebuje žádné speciální HTTP hlavičky.

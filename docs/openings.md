# Průzkumník zahájení

## Zdroj a licence

Tabulky `a.tsv` až `e.tsv` jsou z [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), větev `master`. Licence je [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (veřejná doména). Ověřená je v souboru `COPYING.txt` toho repozitáře a ve SPDX označení `CC0-1.0`.

`scripts/build-openings.mjs` licenci zkontroluje, každou partii přehraje chess.js a zapíše `src/openings/book/data/openings.json` (`eco`, `name`, `pgn`, `epd`). Soubor je v gitu. Build aplikace síť nepotřebuje. Nové stažení: `node scripts/build-openings.mjs`.

JSON se načítá dynamickým `import()` v `src/openings/loadBook.ts`, takže zůstává ve vlastním balíku.

## Strom

Klíč pozice je EPD: první čtyři pole FEN, bez čítačů tahů. Transpozice se slévají do jednoho uzlu. Id zahájení je `eco:název`. Stejné jméno z víc řádků je jedna varianta; `lineTo` drží nejkratší linii. Počet variant pod tahem je počet různých id v podstromu, ne počet řádků tabulky.

`nameForPosition` vrací nejdelší už dosažené zahájení na cestě do pozice. `continuations` vrací jen tahy, které chess.js považuje za legální. `searchOpenings` skládá diakritiku a pár českých aliasů (Sicilská, Najdorf, královská indická, …) a umí filtr první písmeno ECO.

Skupiny ECO v UI jsou běžné popisky, ne komentáře tahů: A flankové, B polootevřené, C otevřené a Francouzská, D uzavřené a dámské, E indické.

## Sedm českých zahájení

`src/openings/openings.ts` dál drží italskou, španělskou, sicilskou, dámský gambit, londýnskou, francouzskou a Caro-Kann i s vysvětlením každého tahu. Ostatní linie z knihy komentář nemají. Výjimka: když je celá jedna z těch sedmi linií předpona knižní linie, tahy té předpony si nechají její text. Sdílený začátek jako 1. e4, který sedí na víc zahájení, se nepůjčuje.

## Statistiky a vyzkoušené

Počty u pokračování jdou jen z uložených tahů (`games` + `moves`). Počítá se tah, který v té pozici zahrál uživatel. Nedohraná partie (`*`) je zahraná, ale není výhra, remíza ani prohra. Nula se ukáže jako „zatím nehráno“ a „nové pro tebe“. Žádná čísla se nedomýšlejí.

Trénink zahájení se do Moje partie neukládá. Id se zapíše do `kv` pod `ai-chess-tutor:openings-tried` (a do localStorage). „Překvap mě“ nejdřív bere zahájení, které není v uložených partiích ani mezi vyzkoušenými. Za černé vybírá linii, ve které černý už táhl, a tu jde rovnou trénovat černými.

## Trénink

Z průzkumníka lze linii hrát bílými i černými proti Stockfishovi s knihou. Barva je `playerColor` na partii. Výchozí je bílá, takže volná hra, maty a kalkulačka se nemění.

Za černé je deska od začátku otočená. Bílý po krátké pauze zahraje knižní tahy včetně prvního a teprve potom je na řadě hráč. Tah mimo knihu se odmítne jen hráči. Po konci knihy hraje Stockfish podle obtížnosti. Undo vrátí tah hráče i odpověď soupeře, ale nesejme první knižní tah bílého. Otočit mění jen pohled, ne stranu na tahu. „Ty“ zůstává u figur hráče.

## Omezení

Jména v knize jsou anglicky, jak je má Lichess. České hledání kryje jen aliasy, ne překlad všech názvů. Kniha obsahuje jen linie z tabulek, ne celou teorii. Sestavení stromu při prvním načtení trvá pár sekund, protože se přehrává každá partie. Stejná pozice s různým počtem tahů v datech není; název se stejně šíří po hranách stromu, aby nezávisel na pořadí řádků.

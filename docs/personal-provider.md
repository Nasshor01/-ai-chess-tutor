# Osobní soupeř

Rozhraní je `PersonalMoveProvider`. Vstup je FEN, snímek profilu, režim, síla, historie tahů a linie MultiPV. Výstup jsou kandidáti s pravděpodobností a důvodem. Součet pravděpodobností je 1. Nelegální tah engine zahodí.

`createPersonalProvider()` je jediné místo, které vybere implementaci. Obrazovky a tah soupeře ho volají a na konkrétní model nesahají. První implementace má id `statistical`.

## Statistický model

Síla nastaví Skill Level, hloubku, čas a MultiPV hledání `search()`. `analyze()` se nevolá a zůstává na plné síle.

Každá legální linie dostane váhu z hodnocení strany na tahu (`tanh(cp / 200)`, mat jako velká výhoda nebo prohra). Vyšší teplota síly váhu zploští, takže slabší soupeř častěji sáhne po horším tahu.

Když profil splní minimum z `docs/style-metrics.md` (aspoň 20 tahů a nějaká známá metrika), přičte se shoda:

- rošáda, vývin jezdce nebo střelce, pěšec do středu, braní, šach
- stejné rozestavení figur, ve kterém hráč ten tah už zahrál („podobná pozice z tvých partií“)
- tah horší aspoň o 15 cp, který opakuje druh chyby z aspoň tří vlastních chyb („typická chyba: braní figurou“)

Důvod je ten, který váhu zvedl. Když styl chybí, soupeř to řekne a nechá jen zploštělé hodnocení. Žádný podíl si nedomýšlí.

## Režimy

- **Já dnes** používá aktuální profil. Jde vždy.
- **Já před měsícem** vezme nejnovější snímek starý aspoň 30 dní. Mladší snímek nestačí a režim zůstane vypnutý.
- **Já po měsíci tréninku** potřebuje aspoň dva snímky. U každé metriky, která je číslo v obou, spočítá denní změnu, ořízne ji na ±1 procentní bod za den a přičte 30 dní k novějšímu snímku. Výsledek zůstane mezi 0 a 100. Metrika, která v jednom snímku chybí, zůstane prázdná. Není to důkaz, že trénink pomohl, a počet chyb se tím nesnižuje.

## Neuronový model

`NEURAL_PROVIDER_ID` je `maia`. Až půjde doplnit Maia přes lc0 nebo síť doladěná na vlastních PGN, implementuje stejné rozhraní. Na tuhle větev se nesmí ptát ani dialog nové hry, ani kalkulačka.

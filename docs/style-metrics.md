# Metriky stylu

Kalkulačka dál používá `playStyle` v `src/calculator/style.ts` beze změny. Profil přes víc partií počítá stejné události: tah jezdcem nebo střelcem, rošáda, pěšec na d4, e4, d5 nebo e5, braní a šach.

Hodnota je podíl, 0 až 100. Rošáda je podíl partií, ostatní jsou podíl tahů uživatele. Novější partie váží víc: váha se každých 30 dní půlí.

Metrika se neukáže, když je míň než 20 tahů uživatele. Rošáda chce aspoň 8 partií, ve kterých uživatel táhl. Žádné číslo se nedomýšlí.

Jednou denně se uloží `PlayerProfileSnapshot`. Obrazovka porovná dnešek se snímkem starým aspoň 30 dní, pokud takový snímek je.

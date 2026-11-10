# Osobní Elo

Odhad, ne oficiální rating. Počítá se z posledních 40 partií, ve kterých má uživatel aspoň jeden ohodnocený tah.

Průměrná ztráta v centipawnech (ACPL) se porovná s 50. Každý centipawn pod 50 přidá 4 body, každý nad 50 ubere 4. Bez zadaného ratingu je kotva 1500. Zadaný rating kotvu nahradí.

Výsledek partie se přičte jen u importovaných her proti lidem: (podíl bodů − 0,5) × 200. Výhry nad Stockfishem se do toho nepočítají.

Interval je ±1,96 × 400 / √n. Pod 20 partiemi je odhad označený jako nejistý.

Podskóre je 100 × (1 − podíl nepřesností, chyb a hrubých chyb) a jen tam, kde je aspoň 8 tahů. Fáze bere uloženou fázi tahu. Taktika jsou tahy, u kterých rozbor našel motiv. Obrana jsou tahy, kde byl uživatel aspoň o půl pěšce horší. Čas se neprevádí na procenta. Když u tahů je `timeSpentMs`, ukáže se průměr v sekundách, jinak se řádek schová.

Jednou denně se odhad uloží jako `EloSnapshot`.

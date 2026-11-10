# Trenér

Dva režimy jsou oddělené. Predikce „Co bych zahrál já?“ jde přes `PersonalMoveProvider` a může říct, že stylu je málo. Doporučení „Co mám zahrát, abych se zlepšil?“ nehraje za hráče. Bere plné `analyze()` a z linií vybere tah k naučení.

## Jak se vybírá tah k naučení

Ztráta je rozdíl hodnocení proti nejlepší linii, z pohledu strany na tahu. Rozpočet je 80 cp pod 1200 (a když rating chybí), 50 cp od 1200 do 1599 a 30 cp od 1600. Tah nad rozpočet se zahodí.

Pod 1600, nebo když je slabina vývin, rošáda nebo střed, vyhraje z rozpočtu rošáda, tah jezdcem nebo střelcem bez braní, nebo pěšec do středu. Jinak vyhraje nejlepší linie v rozpočtu. Věta je z `explainMove` a z `concepts.ts`: pod 1600 delší vysvětlení, výš jen krátká připomínka.

## Souhrn partie

`SummaryDialog` dál ukazuje původní souhrn. Pod ním jsou nejvýš tři chyby seřazené podle ztráty centipawnů, jedna fáze s nejnižší průměrnou ztrátou (aspoň čtyři tahy) a jeden cíl. Cíl je nejčastější motiv z chyb, jinak nejslabší fáze. Když rozbor chybí, dialog nabídne jeho spuštění a nic nedoplňuje.

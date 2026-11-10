# Rozbor partií

Rozbor běží ve frontě nad vrstvou enginu. Nevolá se z tahu hráče. Na počítači s `hardwareConcurrency` 4 a méně sdílí hra a rozbor jednoho workera: než počítač začne hledat tah, rozbor se přeruší a fronta počká. Na silnějším počítači má rozbor vlastního workera a hru nezdržuje.

Výchozí nastavení je hloubka 12, MultiPV 1 a 800 ms na pozici. Jde to změnit na obrazovce Rozbor. Pozastavení nechá rozdělaný výpočet doběhnout a uloží, u kterého tahu pokračovat. Zrušení frontu smaže. Po obnovení stránky se běžící rozbor znovu spustí od uloženého tahu. Pozastavený zůstane pozastavený.

Každá pozice se ukládá do `analysisCache`. Klíč je FEN, hloubka, MultiPV, movetime a skill 20. Stejná pozice se podruhé nepočítá.

## Hodnocení tahu

`cpLoss` je, o kolik centipawnů klesla výhoda hráče, který táhl. Záporná ztráta se neukládá, zůstane nula. Změna šance na výhru je ve procentních bodech, stejný model jako pruh hodnocení (`winChance` v `src/chess/utils.ts`). Kategorie bere prahy z `src/tutor/classify.ts`. Tah shodný s prvním tahem z MultiPV je nejlepší.

## Fáze partie

Není to definice z teorie. Důstojníci jsou dáma 9, věž 5, střelec 3, jezdec 3.

- Zahájení: číslo tahu je nejvýš 12, obě dámy jsou na šachovnici a obě strany dohromady mají aspoň 30 bodů důstojníků.
- Koncovka: obě strany dohromady mají nejvýš 20 bodů důstojníků.
- Jinak střední hra.

## Motivy

Z `src/tutor/features.ts` se berou jen vidlička (aspoň dva hodnotné cíle) a figura, která tahem zůstala viset. Vazba a vidlička po diagonále se nehádají, protože je ten modul nepočítá.

# Architektura

Tahle stránka zatím drží jen pořadí, v jakém se později zapne přísnější TypeScript. Popis modulů, ukládání partií a osobního Elá sem přijde v dalších fázích.

## TypeScript strict roadmap

`strict` se v téhle fázi nezapíná pro celý projekt. Kořenový `tsconfig` zůstává beze změny a hromadný přepis se nedělá.

Až se bude zapínat, tak po jednom adresáři a v tomhle pořadí:

1. `src/chess/`
2. `src/engine/`
3. `src/tutor/`
4. `src/calculator/`
5. `src/components/`
6. `src/game/useChessGame.ts` a moduly, které z něj už vznikly: `end`, `messages`, `search`, `useOpening`, `useTutor`, `useOpponent`, `useCalculatorBridge`, `useGameCommands`

Nové adresáře se do uvolněného nastavení nepřidávají a na tenhle seznam nečekají. První soubor v každé z nich dostane vlastní `tsconfig` s `"strict": true` a odkaz z kořenového projektu:

- `src/storage/` (fáze 1)
- `src/analysis/`
- `src/elo/`
- `src/profile/`
- `src/personal/`
- `src/coach/`
- `src/training/`
- `src/ui/`

Do nových modulů se nedává `any` bez komentáře, proč je nutné.

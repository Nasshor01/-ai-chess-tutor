# Trénink slabin

Karta vznikne jen z tahu, který hráč opravdu zahrál a rozbor ho označil jako chybu nebo hrubou chybu. Stejné téma (motiv, jinak druh chyby) musí být aspoň dvakrát. Pozice je ta z partie. Správný tah je `bestUci` z rozboru. Když ho rozbor nemá, karta nevznikne.

## SM-2

`again` má kvalitu 1. Opakování spadne na 0, interval je 1 den a snadnost klesne, ne však pod 1,3. `good` má kvalitu 4. První úspěch je za 1 den, druhý za 6 dní, další je předchozí interval krát novou snadnost. Špatně vyřešená karta se proto vrací dřív.

## Po dohrání partie

Na pozadí se analyzuje jen tahle partie. Hotové pozice v mezipaměti se znovu nehledají. Až doběhne, přibyde řádek do okna 40 partií, karty se doplní a denní snímek Elo a stylu se zapíše, pokud dnes ještě není. Hra na tah nečeká. Agregace čte uložené tahy, nespouští Stockfish znovu na staré partie.

## Trend

Okno se rozdělí na starší a novější polovinu. Když má některá půlka míň než 8 tahů hráče, text je „zatím málo dat“. Jinak se porovná podíl chyb daného tématu. Pokles aspoň o 2 procentní body je „opakuje se míň“.

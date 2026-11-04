export interface OpeningMove {
  /** SAN in standard (English) notation as chess.js expects it. */
  san: string
  explanation: string
}

export interface Opening {
  id: string
  name: string
  eco: string
  level: 'začátečník' | 'pokročilý'
  summary: string
  idea: string
  moves: OpeningMove[]
}

export const OPENINGS: Opening[] = [
  {
    id: 'italian',
    name: 'Italská hra',
    eco: 'C50–C54',
    level: 'začátečník',
    summary: 'Klasické zahájení, ve kterém bílý rychle vyvine figury a míří střelcem na slabé pole f7.',
    idea: 'Rychlý vývin, kontrola středu, střelec na c4 míří na f7 a příprava pěšcového středu tahy c3 a d4.',
    moves: [
      { san: 'e4', explanation: 'Pěšec obsazuje střed a otevírá cestu dámě i střelci f1.' },
      { san: 'e5', explanation: 'Černý odpovídá symetricky a také si bere svůj díl středu.' },
      { san: 'Nf3', explanation: 'Jezdec se vyvíjí na nejlepší pole a hned napadá pěšce e5.' },
      { san: 'Nc6', explanation: 'Černý kryje pěšce e5 a zároveň vyvíjí figuru.' },
      { san: 'Bc4', explanation: 'Italský střelec! Míří na pole f7, které kryje jen černý král – to je slabina černého.' },
      { san: 'Bc5', explanation: 'Černý staví střelce zrcadlově – míří na tvé slabé pole f2.' },
      { san: 'c3', explanation: 'Připravuješ tah d4, kterým postavíš silný pěšcový střed. Navíc uvolňuješ pole c2 pro dámu.' },
      { san: 'Nf6', explanation: 'Černý vyvíjí dalšího jezdce a napadá tvého pěšce e4.' },
      { san: 'd4', explanation: 'Úder ve středu! Napadáš pěšce e5 a otevíráš hru, dokud máš lepší vývin.' },
      { san: 'exd4', explanation: 'Černý bere, aby si nenechal zatlačit pěšce.' },
      { san: 'cxd4', explanation: 'Bereš zpět a máš teď ideální dvojici pěšců na d4 a e4.' },
      { san: 'Bb4+', explanation: 'Černý dává šach, aby narušil tvůj vývin.' },
    ],
  },
  {
    id: 'spanish',
    name: 'Španělská hra',
    eco: 'C60–C99',
    level: 'pokročilý',
    summary: 'Jedno z nejstarších a nejhranějších zahájení. Bílý nepřímo tlačí na pěšce e5 a staví se k dlouhé strategické hře.',
    idea: 'Střelec na b5 napadá jezdce, který kryje e5. Bílý rychle udělá rošádu a postaví pěšce na c3 a d4.',
    moves: [
      { san: 'e4', explanation: 'Klasický začátek – pěšec obsazuje střed.' },
      { san: 'e5', explanation: 'Černý si také bere střed.' },
      { san: 'Nf3', explanation: 'Vyvíjíš jezdce s útokem na pěšce e5.' },
      { san: 'Nc6', explanation: 'Černý kryje pěšce e5 jezdcem.' },
      { san: 'Bb5', explanation: 'Španělský střelec napadá jezdce, který chrání pěšce e5. Tím na černého vyvíjíš nepřímý tlak.' },
      { san: 'a6', explanation: 'Morphyho obrana: černý se ptá střelce, co zamýšlí.' },
      { san: 'Ba4', explanation: 'Střelec ustupuje, ale drží tlak na jezdce c6 ze vzdálenější diagonály.' },
      { san: 'Nf6', explanation: 'Černý vyvíjí jezdce a napadá pěšce e4.' },
      { san: 'O-O', explanation: 'Rošáda! Král je v bezpečí a věž se blíží středu. Pěšec e4 je nepřímo krytý.' },
      { san: 'Be7', explanation: 'Černý připravuje vlastní rošádu – tzv. uzavřená Španělská.' },
      { san: 'Re1', explanation: 'Věž kryje pěšce e4 a podporuje budoucí postup ve středu.' },
      { san: 'b5', explanation: 'Černý odhání střelce a získává prostor na dámském křídle.' },
      { san: 'Bb3', explanation: 'Střelec se usazuje na skvělé diagonále a míří na f7.' },
    ],
  },
  {
    id: 'sicilian',
    name: 'Sicilská obrana',
    eco: 'B20–B99',
    level: 'pokročilý',
    summary: 'Nejpopulárnější odpověď na 1. e4. Černý hraje nesymetricky a usiluje o protiútok.',
    idea: 'Černý vymění svého c-pěšce za tvého d-pěšce. Ty získáš náskok ve vývinu, černý zase polootevřený sloupec c a pevný střed.',
    moves: [
      { san: 'e4', explanation: 'Pěšec obsazuje střed.' },
      { san: 'c5', explanation: 'Sicilská! Černý kontroluje pole d4 ze strany a vyhýbá se symetrii.' },
      { san: 'Nf3', explanation: 'Vyvíjíš jezdce a připravuješ tah d4.' },
      { san: 'd6', explanation: 'Černý kontroluje pole e5 a otevírá cestu svému střelci c8.' },
      { san: 'd4', explanation: 'Otevřená Sicilská: otevíráš hru ve středu, dokud jsi napřed ve vývinu.' },
      { san: 'cxd4', explanation: 'Černý mění křídlového pěšce za tvého centrálního – to je jeho hlavní myšlenka.' },
      { san: 'Nxd4', explanation: 'Bereš zpět jezdcem, který stojí krásně ve středu.' },
      { san: 'Nf6', explanation: 'Černý vyvíjí jezdce a napadá pěšce e4.' },
      { san: 'Nc3', explanation: 'Kryješ pěšce e4 a vyvíjíš další figuru.' },
      { san: 'a6', explanation: 'Najdorfova varianta: černý bere jezdcům pole b5 a připravuje postup b5.' },
      { san: 'Be2', explanation: 'Klidný vývin střelce a příprava rošády.' },
      { san: 'e5', explanation: 'Černý odhání tvého jezdce z centra.' },
      { san: 'Nb3', explanation: 'Jezdec ustupuje na bezpečné pole a drží kontrolu nad d4.' },
    ],
  },
  {
    id: 'queens-gambit',
    name: 'Dámský gambit',
    eco: 'D06–D69',
    level: 'začátečník',
    summary: 'Solidní zahájení s tahem 1. d4. Bílý nabízí pěšce c4, aby odlákal černého pěšce ze středu.',
    idea: 'Tlak na pěšce d5, rychlý vývin jezdců a střelce na g5 a hra na dámském křídle.',
    moves: [
      { san: 'd4', explanation: 'Pěšec obsazuje střed a je od začátku krytý dámou.' },
      { san: 'd5', explanation: 'Černý staví svého pěšce proti tvému.' },
      { san: 'c4', explanation: 'Gambit: nabízíš pěšce, abys odlákal černého pěšce ze středu. Ve skutečnosti ho skoro vždy získáš zpět.' },
      { san: 'e6', explanation: 'Odmítnutý dámský gambit: černý pevně kryje pěšce d5.' },
      { san: 'Nc3', explanation: 'Jezdec zvyšuje tlak na pěšce d5.' },
      { san: 'Nf6', explanation: 'Černý také kryje pole d5 a vyvíjí jezdce.' },
      { san: 'Bg5', explanation: 'Vazba! Jezdec f6 nemůže odejít, aniž by odkryl dámu – oslabuješ tím obranu pole d5.' },
      { san: 'Be7', explanation: 'Černý ruší vazbu a připravuje rošádu.' },
      { san: 'e3', explanation: 'Otevíráš cestu střelci f1 a pevně kryješ pěšce d4.' },
      { san: 'O-O', explanation: 'Černý schovává krále.' },
      { san: 'Nf3', explanation: 'Vyvíjíš posledního jezdce a připravuješ vlastní rošádu.' },
    ],
  },
  {
    id: 'london',
    name: 'Londýnský systém',
    eco: 'D02',
    level: 'začátečník',
    summary: 'Jednoduchý a spolehlivý systém pro bílého. Stavíš figury pořád stejně – ideální na učení.',
    idea: 'Pěšci na d4, e3 a c3, střelec na f4 (ještě před tahem e3!), jezdec na f3 a rychlá rošáda.',
    moves: [
      { san: 'd4', explanation: 'Pěšec obsazuje střed.' },
      { san: 'd5', explanation: 'Černý odpovídá symetricky.' },
      { san: 'Bf4', explanation: 'Londýnský střelec vyjíždí ještě před tahem e3, aby nezůstal zavřený za pěšci.' },
      { san: 'Nf6', explanation: 'Černý vyvíjí jezdce a kontroluje pole e4.' },
      { san: 'e3', explanation: 'Pevně kryješ pěšce d4 a otevíráš cestu druhému střelci.' },
      { san: 'e6', explanation: 'Černý také otevírá cestu svému střelci.' },
      { san: 'Nf3', explanation: 'Jezdec se vyvíjí na nejlepší pole a hlídá pole e5.' },
      { san: 'c5', explanation: 'Černý útočí na tvůj střed z boku.' },
      { san: 'c3', explanation: 'Typický londýnský tah: pěšcový trojúhelník c3–d4–e3 je velmi pevný.' },
      { san: 'Nc6', explanation: 'Černý vyvíjí jezdce a zvyšuje tlak na d4.' },
      { san: 'Nbd2', explanation: 'Druhý jezdec se vyvíjí za pěšce c3 a kryje pole e4.' },
    ],
  },
  {
    id: 'french',
    name: 'Francouzská obrana',
    eco: 'C00–C19',
    level: 'pokročilý',
    summary: 'Solidní obrana černého. Ty dostaneš víc prostoru, černý pevnou pěšcovou strukturu a protiúder ve středu.',
    idea: 'Proti tahu e6 a d5 postavíš silný střed. Učíš se hrát s prostorovou výhodou.',
    moves: [
      { san: 'e4', explanation: 'Pěšec obsazuje střed.' },
      { san: 'e6', explanation: 'Francouzská: černý připravuje tah d5 s útokem na tvého pěšce.' },
      { san: 'd4', explanation: 'Stavíš ideální střed – dva pěšce vedle sebe.' },
      { san: 'd5', explanation: 'Černý napadá pěšce e4.' },
      { san: 'Nc3', explanation: 'Kryješ pěšce e4 a vyvíjíš figuru.' },
      { san: 'Nf6', explanation: 'Černý znovu napadá pěšce e4.' },
      { san: 'e5', explanation: 'Postupuješ pěšcem, odháníš jezdce a získáváš prostor.' },
      { san: 'Nfd7', explanation: 'Jezdec ustupuje, ale připravuje útok na tvůj střed tahem c5.' },
      { san: 'f4', explanation: 'Podpíráš pěšce e5 – tvůj střed je teď velmi pevný.' },
      { san: 'c5', explanation: 'Černý útočí na základnu tvého řetězce – pěšce d4.' },
      { san: 'Nf3', explanation: 'Jezdec kryje d4 i e5.' },
    ],
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann',
    eco: 'B10–B19',
    level: 'začátečník',
    summary: 'Pevná obrana černého, která se vyhýbá ostrým útokům. Bílý získá volnou hru a příjemný vývin.',
    idea: 'Proti c6 a d5 hraješ jednoduše: kryješ střed, vyvíjíš figury a napadáš černého střelce.',
    moves: [
      { san: 'e4', explanation: 'Pěšec obsazuje střed.' },
      { san: 'c6', explanation: 'Caro-Kann: černý připravuje tah d5 a pěšec c6 ho bude krýt.' },
      { san: 'd4', explanation: 'Bereš si celý střed.' },
      { san: 'd5', explanation: 'Černý napadá pěšce e4.' },
      { san: 'Nc3', explanation: 'Kryješ pěšce e4 a vyvíjíš jezdce.' },
      { san: 'dxe4', explanation: 'Černý mění pěšce ve středu.' },
      { san: 'Nxe4', explanation: 'Bereš zpět a jezdec stojí aktivně ve středu.' },
      { san: 'Bf5', explanation: 'Černý vyvíjí střelce mimo pěšcový řetězec a napadá tvého jezdce.' },
      { san: 'Ng3', explanation: 'Jezdec ustupuje a napadá střelce f5 – získáváš tempo.' },
      { san: 'Bg6', explanation: 'Střelec ustupuje na bezpečnou diagonálu.' },
      { san: 'h4', explanation: 'Hrozíš h5, kterým bys střelce chytil. Černý musí reagovat.' },
      { san: 'h6', explanation: 'Černý dává střelci únikové pole h7.' },
      { san: 'Nf3', explanation: 'Vyvíjíš jezdce a připravuješ rošádu.' },
    ],
  },
]

export function getOpening(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id)
}

function matchedPlies(opening: Opening, sanHistory: string[]): number {
  let matched = 0
  while (matched < sanHistory.length && matched < opening.moves.length && opening.moves[matched].san === sanHistory[matched]) {
    matched++
  }
  return matched
}

/** Name of the opening the game started with (needs at least 3 matching plies and a unique leader). */
export function detectOpening(sanHistory: string[]): Opening | null {
  let best: Opening | null = null
  let bestMatched = 0
  let tie = false
  for (const opening of OPENINGS) {
    const matched = matchedPlies(opening, sanHistory)
    if (matched > bestMatched) {
      best = opening
      bestMatched = matched
      tie = false
    } else if (matched === bestMatched && matched > 0) {
      tie = true
    }
  }
  return best && bestMatched >= 3 && !tie ? best : null
}

/** If every move so far follows a known line, returns the explanation of the last move. */
export function bookInfo(sanHistory: string[]): { openingName: string; explanation: string } | null {
  const matching = OPENINGS.filter((o) => sanHistory.length <= o.moves.length && matchedPlies(o, sanHistory) === sanHistory.length)
  if (matching.length === 0 || sanHistory.length === 0) return null
  const last = matching[0].moves[sanHistory.length - 1]
  return { openingName: matching.length === 1 ? matching[0].name : '', explanation: last.explanation }
}

export type PuzzleDifficulty = 'lehká' | 'střední' | 'těžká'

export interface MatePuzzle {
  id: string
  /** Name of the mating pattern – revealed after the puzzle is solved. */
  pattern: string
  mateIn: 2 | 3 | 4
  difficulty: PuzzleDifficulty
  /** White to move, forced mate in exactly `mateIn` (verified by Stockfish in matePuzzles.test.ts). */
  fen: string
  /** Neutral nudge that doesn't give the solution away. */
  tip: string
  /** Why the mate works – shown after success or when the player misses it. */
  idea: string
  /** One correct main line in SAN (for reference and tests). */
  solution: string[]
}

export const MATE_PUZZLES: MatePuzzle[] = [
  {
    id: 'kr-2',
    pattern: 'Věž a král proti králi',
    mateIn: 2,
    difficulty: 'lehká',
    fen: '7k/8/5K2/8/8/8/8/R7 w - - 0 1',
    tip: 'Nejdřív zavři králi pole, teprve potom dej šach.',
    idea: 'Tvůj král zabere soupeřovu králi pole na sedmé řadě a věž pak dá mat na poslední řadě. Král a věž musí spolupracovat.',
    solution: ['Kg6', 'Kg8', 'Ra8#'],
  },
  {
    id: 'kq-2',
    pattern: 'Polibek smrti (dáma a král)',
    mateIn: 2,
    difficulty: 'lehká',
    fen: '7k/8/5K2/8/8/8/8/Q7 w - - 0 1',
    tip: 'Dáma potřebuje oporu svého krále.',
    idea: 'Dáma se postaví těsně vedle soupeřova krále a tvůj král ji kryje. Soupeř ji nemůže sebrat a král nemá kam uhnout – tomu se říká „polibek smrti“.',
    solution: ['Kg6+', 'Kg8', 'Qg7#'],
  },
  {
    id: 'backrank-2',
    pattern: 'Mat na zadní řadě',
    mateIn: 2,
    difficulty: 'lehká',
    fen: '3rr1k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',
    tip: 'Podívej se na černého krále – má kam utéct?',
    idea: 'Černý král je uvězněný za vlastními pěšci. Zdvojené věže na sloupci e mají víc síly než obránci na osmé řadě – po výměně druhá věž dá mat.',
    solution: ['Rxe8+', 'Rxe8', 'Rxe8#'],
  },
  {
    id: 'deflection-2',
    pattern: 'Zadní řada s odlákáním',
    mateIn: 2,
    difficulty: 'lehká',
    fen: '3r2k1/2q2ppp/8/8/8/8/3Q1PPP/3R2K1 w - - 0 1',
    tip: 'Kolik figur hlídá pole d8?',
    idea: 'Černá dáma je jediný obránce zadní řady. Obětí dámy ji odlákáš na d8 a věž pak dá mat na zadní řadě.',
    solution: ['Qxd8+', 'Qxd8', 'Rxd8#'],
  },
  {
    id: 'damiano-2',
    pattern: 'Damianův mat',
    mateIn: 2,
    difficulty: 'lehká',
    fen: '3r2k1/pp6/6P1/7Q/8/8/5PPP/6K1 w - - 0 1',
    tip: 'Pěšec na g6 je skvělá opora pro dámu.',
    idea: 'Pěšec na g6 kryje pole f7 a h7. Dáma s jeho podporou vyžene krále šachem a pak dá mat na f7 – král ji nemůže sebrat.',
    solution: ['Qh7+', 'Kf8', 'Qf7#'],
  },
  {
    id: 'arabian-2',
    pattern: 'Arabský mat',
    mateIn: 2,
    difficulty: 'střední',
    fen: '5bk1/1R5p/8/8/4N3/8/5PPP/6K1 w - - 0 1',
    tip: 'Jezdec a věž jsou na matování krále v rohu ideální dvojice.',
    idea: 'Jezdec na f6 hlídá pole g8 a kryje věž na h7. Věž dá mat v rohu a král nemá kam uhnout – nejstarší popsaný matový obrazec.',
    solution: ['Nf6+', 'Kh8', 'Rxh7#'],
  },
  {
    id: 'anastasia-2',
    pattern: 'Anastasiin mat',
    mateIn: 2,
    difficulty: 'střední',
    fen: '5r1k/4Nppp/8/7Q/8/4R3/5PPP/6K1 w - - 0 1',
    tip: 'Někdy je potřeba obětovat i dámu, aby se otevřel sloupec h.',
    idea: 'Jezdec na e7 hlídá pole g8 a g6, pěšec g7 králi blokuje únik. Po oběti dámy na h7 věž přejde na sloupec h a dá mat.',
    solution: ['Qxh7+', 'Kxh7', 'Rh3#'],
  },
  {
    id: 'diagonal-2',
    pattern: 'Mat na dlouhé diagonále',
    mateIn: 2,
    difficulty: 'střední',
    fen: '5rk1/5p1p/5npQ/8/8/8/1B3PPP/6K1 w - - 0 1',
    tip: 'Kdo brání černého krále na poli g7?',
    idea: 'Jezdec na f6 byl jediný obránce pole g7. Po jeho sebrání střelec z dlouhé diagonály podpoří dámu a ta dá mat na g7.',
    solution: ['Bxf6', 'Ra8', 'Qg7#'],
  },
  {
    id: 'epaulette-2',
    pattern: 'Epoletový mat',
    mateIn: 2,
    difficulty: 'střední',
    fen: '3rkr2/8/2Nb4/8/8/1Q6/5PPP/6K1 w - - 0 1',
    tip: 'Černé věže stojí králi těsně po bocích…',
    idea: 'Věže na d8 a f8 jsou jako nárameníky (epolety) – zabírají králi jediná úniková pole. Dáma s podporou jezdce dá mat zepředu.',
    solution: ['Qe6+', 'Be7', 'Qxe7#'],
  },
  {
    id: 'legal-2',
    pattern: 'Légalův mat',
    mateIn: 2,
    difficulty: 'střední',
    fen: 'rn1qkbnr/ppp2ppp/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6',
    tip: 'Černý sebral dámu – ale co jeho král?',
    idea: 'Černý vzal dámu, ale přehlédl, že lehké figury spolupracují. Střelec dá šach na f7, král musí na e7 a jezdec d5 dá mat – kryje ho druhý jezdec a střelec.',
    solution: ['Bxf7+', 'Ke7', 'Nd5#'],
  },
  {
    id: 'boden-2',
    pattern: 'Bodenův mat',
    mateIn: 2,
    difficulty: 'střední',
    fen: '2kr4/pp1n4/2n5/8/5B2/5Q2/4BPPP/6K1 w - - 0 1',
    tip: 'Dva střelci na křížících se diagonálách jsou smrtící.',
    idea: 'Po oběti dámy pěšec b7 zmizí z diagonály. Střelec na a6 dá mat a druhý střelec z f4 hlídá pole b8 a c7 – král je sevřený vlastními figurami.',
    solution: ['Qxc6+', 'bxc6', 'Ba6#'],
  },
  {
    id: 'opera-2',
    pattern: 'Morphyho mat z Operní partie',
    mateIn: 2,
    difficulty: 'střední',
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16',
    tip: 'Kdo hlídá pole d8? Dá se odlákat?',
    idea: 'Jezdec d7 je jediný obránce pole d8. Obětí dámy na b8 ho odlákáš a věž dá mat na d8 s podporou střelce g5 – slavná partie Paula Morphyho z roku 1858.',
    solution: ['Qb8+', 'Nxb8', 'Rd8#'],
  },
  {
    id: 'kr-3',
    pattern: 'Věž a král proti králi',
    mateIn: 3,
    difficulty: 'střední',
    fen: '4k3/8/8/3K4/8/8/8/7R w - - 0 1',
    tip: 'Postav krále proti soupeřovu králi (do opozice).',
    idea: 'Králové stojí proti sobě (opozice), takže soupeřův král nemůže dopředu. Věž ho pak odřízne a dá mat na zadní řadě.',
    solution: ['Ke6', 'Kf8', 'Rg1', 'Ke8', 'Rg8#'],
  },
  {
    id: 'kq-3a',
    pattern: 'Dáma a král proti králi',
    mateIn: 3,
    difficulty: 'střední',
    fen: '8/k7/8/K7/1Q6/8/8/8 w - - 0 1',
    tip: 'Zmenšuj králi prostor, ale pozor na pat!',
    idea: 'Dáma uzavře krále na okraji šachovnice tahem jezdce od něj, tvůj král se přiblíží a dáma dá mat na poslední řadě. Vždy kontroluj, jestli má soupeř ještě nějaký tah – jinak je pat.',
    solution: ['Qb5', 'Ka8', 'Kb6', 'Kb8', 'Qe8#'],
  },
  {
    id: 'kq-3b',
    pattern: 'Dáma a král proti králi',
    mateIn: 3,
    difficulty: 'střední',
    fen: '5K2/8/8/7k/8/3Q4/8/8 w - - 0 1',
    tip: 'Dáma umí krále zahnat sama, král ji pak jen podpoří.',
    idea: 'Dáma tlačí krále po sloupci h stále výš, až se dostane do dosahu tvého krále. Pak dá mat na g7 s jeho podporou.',
    solution: ['Qg3', 'Kh6', 'Qg4', 'Kh7', 'Qg7#'],
  },
  {
    id: 'two-rooks-3',
    pattern: 'Mat dvěma věžemi („schody“)',
    mateIn: 3,
    difficulty: 'střední',
    fen: '6R1/8/8/8/8/2R4K/1k6/8 w - - 0 1',
    tip: 'Věže se střídají – jedna hlídá řadu, druhá dává šach.',
    idea: 'Věže fungují jako schody: jedna odřízne krále od středu, druhá ho tlačí k okraji. Na kraji šachovnice pak věž dá mat, zatímco druhá hlídá únikovou řadu.',
    solution: ['Rc7', 'Ka2', 'Rb7', 'Ka1', 'Ra8#'],
  },
  {
    id: 'two-bishops-3',
    pattern: 'Mat dvěma střelci',
    mateIn: 3,
    difficulty: 'těžká',
    fen: '8/4B3/8/8/8/8/4K3/5B1k w - - 0 1',
    tip: 'Nejdřív přiveď krále – střelci samotní mat nedají.',
    idea: 'Dva střelci hlídají sousední diagonály, takže král nemůže přeskočit z bílého pole na černé. Tvůj král zabere zbylá pole a střelci dají mat v rohu.',
    solution: ['Kf2', 'Kh2', 'Bd6+', 'Kh1', 'Bg2#'],
  },
  {
    id: 'smothered-3',
    pattern: 'Dušený mat',
    mateIn: 3,
    difficulty: 'těžká',
    fen: '4r1k1/pp3Npp/8/8/2Q5/8/PP4PP/6K1 w - - 0 1',
    tip: 'Dvojitý šach je nejsilnější šach – soupeř musí táhnout králem.',
    idea: 'Po dvojitém šachu musí král do rohu. Oběť dámy na g8 donutí věž zablokovat poslední volné pole a jezdec dá mat králi, který se „udusí“ vlastními figurami.',
    solution: ['Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#'],
  },
  {
    id: 'kr-4',
    pattern: 'Věž a král proti králi',
    mateIn: 4,
    difficulty: 'těžká',
    fen: '8/1R6/8/8/K7/8/k7/8 w - - 0 1',
    tip: 'Věž odřízne krále, tvůj král přijde na pomoc.',
    idea: 'Věž drží krále na okraji, tvůj král se postaví do opozice a věž pak dá mat na první řadě. Čekací tah věží je při matu věží častý trik.',
    solution: ['Rb5', 'Ka1', 'Kb3', 'Kb1', 'Rc5', 'Ka1', 'Rc1#'],
  },
  {
    id: 'kq-4',
    pattern: 'Dáma a král proti králi',
    mateIn: 4,
    difficulty: 'těžká',
    fen: '8/3K4/8/7k/8/8/8/1Q6 w - - 0 1',
    tip: 'Odřízni krále dámou a přiveď svého krále.',
    idea: 'Dáma uzavře krále na sloupci h, tvůj král dojde až k němu a dáma dá mat na g6 nebo g7 s jeho podporou.',
    solution: ['Qg1', 'Kh6', 'Ke6', 'Kh7', 'Kf6', 'Kh6', 'Qg6#'],
  },
  {
    id: 'two-bishops-4',
    pattern: 'Mat dvěma střelci',
    mateIn: 4,
    difficulty: 'těžká',
    fen: '8/7k/B4K2/8/5B2/8/8/8 w - - 0 1',
    tip: 'Krále drž v rohu – střelci mu berou diagonály.',
    idea: 'Tvůj král zabere pole g7 a g8, střelci se střídají v šachování po sousedních diagonálách a poslední šach v rohu je mat.',
    solution: ['Kf7', 'Kh8', 'Bc8', 'Kh7', 'Bf5+', 'Kh8', 'Be5#'],
  },
  {
    id: 'smothered-4',
    pattern: 'Dušený mat (Philidorův odkaz)',
    mateIn: 4,
    difficulty: 'těžká',
    fen: '4r2k/pp4pp/8/6N1/2Q5/8/PP4PP/6K1 w - - 0 1',
    tip: 'Jezdec a dáma – šach, dvojitý šach, oběť…',
    idea: 'Jezdec šachuje z f7 a h6, dáma s ním dává dvojitý šach. Po oběti dámy na g8 se král udusí vlastní věží a jezdec dá mat na f7.',
    solution: ['Nf7+', 'Kg8', 'Nh6+', 'Kh8', 'Qg8+', 'Rxg8', 'Nf7#'],
  },
]

export function getPuzzle(id: string | null | undefined): MatePuzzle | undefined {
  return MATE_PUZZLES.find((p) => p.id === id)
}

export function nextPuzzleId(currentId: string | null, solved: string[]): string {
  const index = MATE_PUZZLES.findIndex((p) => p.id === currentId)
  for (let step = 1; step <= MATE_PUZZLES.length; step++) {
    const candidate = MATE_PUZZLES[(index + step) % MATE_PUZZLES.length]
    if (!solved.includes(candidate.id)) return candidate.id
  }
  return MATE_PUZZLES[(index + 1) % MATE_PUZZLES.length].id
}

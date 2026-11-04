export type ConceptId =
  | 'center'
  | 'development'
  | 'castling'
  | 'openFile'
  | 'diagonal'
  | 'earlyQueen'
  | 'samePieceTwice'
  | 'kingSafety'
  | 'hangingPiece'
  | 'fork'
  | 'threat'
  | 'check'
  | 'trade'
  | 'material'
  | 'passedPawn'
  | 'seventhRank'
  | 'promotion'
  | 'doubledPawns'
  | 'mateThreat'

export interface Concept {
  id: ConceptId
  title: string
  /** One-line reminder once the player already knows the idea. */
  short: string
  /** Gentle, beginner-friendly explanation shown the first time(s). */
  explanation: string
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  center: {
    id: 'center',
    title: 'Kontrola středu',
    short: 'Střed (pole d4, e4, d5, e5) je nejdůležitější část šachovnice.',
    explanation:
      'Figury ve středu mají nejvíc možností, kam táhnout, a mohou rychle přejít na kterékoli křídlo. Kdo ovládá střed, ten obvykle diktuje hru. Proto se partie často začínají tahy jako e4 nebo d4.',
  },
  development: {
    id: 'development',
    title: 'Vývin figur',
    short: 'Na začátku partie dostaň jezdce a střelce co nejrychleji do hry.',
    explanation:
      'Figury, které stojí na výchozích polích, nic nedělají. V zahájení je cílem „vyvinout“ jezdce a střelce na aktivní pole – ideálně tak, aby mířili do středu. Hrubé pravidlo: nejdřív jezdci, pak střelci, potom rošáda.',
  },
  castling: {
    id: 'castling',
    title: 'Rošáda',
    short: 'Rošáda schová krále a zapojí věž do hry.',
    explanation:
      'Rošáda je jediný tah, kdy hýbeš dvěma figurami najednou: král se posune o dvě pole k věži a věž přeskočí vedle něj. Král je pak schovaný za pěšci a věž se dostane blíž ke středu, kde může pomáhat.',
  },
  openFile: {
    id: 'openFile',
    title: 'Otevřený sloupec',
    short: 'Věže patří na otevřené sloupce – tam, kde jim nestojí v cestě pěšci.',
    explanation:
      'Věž je silná na dlouhých přímých liniích. Když na sloupci nejsou žádní pěšci (otevřený sloupec) nebo jen soupeřovi (polootevřený), může věž proniknout až k soupeřovým figurám.',
  },
  diagonal: {
    id: 'diagonal',
    title: 'Otevřená diagonála',
    short: 'Tah pěšcem může uvolnit cestu střelci nebo dámě.',
    explanation:
      'Střelci se pohybují po diagonálách. Dokud jim pěšci stojí v cestě, jsou „zavření“. Když pěšce posuneš, otevřeš střelci (a často i dámě) dlouhou diagonálu.',
  },
  earlyQueen: {
    id: 'earlyQueen',
    title: 'Předčasný výpad dámou',
    short: 'Dáma vytažená příliš brzy bývá terčem útoků.',
    explanation:
      'Dáma je nejcennější figura, takže když ji soupeř napadne, musíš s ní uhnout. Soupeř tak vyvíjí figury „s tempem“ (s útokem), zatímco ty ztrácíš čas. Proto dámu obvykle zapojujeme až po jezdcích a střelcích.',
  },
  samePieceTwice: {
    id: 'samePieceTwice',
    title: 'Ztráta tempa',
    short: 'V zahájení netahej zbytečně stejnou figurou vícekrát.',
    explanation:
      'Každý tah v zahájení je cenný. Když táhneš stejnou figurou dvakrát bez dobrého důvodu, ostatní figury zůstávají doma a soupeř tě ve vývinu předběhne.',
  },
  kingSafety: {
    id: 'kingSafety',
    title: 'Bezpečnost krále',
    short: 'Pěšci před králem jsou jeho štít – nehýbej s nimi zbytečně.',
    explanation:
      'Když posuneš pěšce před svým králem (hlavně f, g a h pěšce), vzniknou díry, kterými může soupeř zaútočit. Král je nejbezpečnější za neporušenou řadou pěšců, obvykle po rošádě.',
  },
  hangingPiece: {
    id: 'hangingPiece',
    title: 'Nechráněná figura',
    short: 'Figura, kterou nic nekryje, může soupeř zdarma sebrat.',
    explanation:
      'Před každým tahem se zeptej: „Co mi soupeř může sebrat?“ Figura, kterou soupeř napadá a ty ji nekryješ (nebo ji napadá levnější figurou), je v ohrožení. Tohle je nejčastější důvod, proč začátečníci prohrávají.',
  },
  fork: {
    id: 'fork',
    title: 'Vidlička',
    short: 'Vidlička = jedna figura napadá dvě soupeřovy figury najednou.',
    explanation:
      'Když jedna tvoje figura napadne dvě soupeřovy současně, soupeř obvykle zachrání jen jednu. Jezdci jsou na vidličky specialisté, ale umí je i pěšci, dáma a další figury.',
  },
  threat: {
    id: 'threat',
    title: 'Hrozba',
    short: 'Hrozba nutí soupeře reagovat – ty tak máš iniciativu.',
    explanation:
      'Hrozba je tah, po kterém chceš příště něco získat (figuru, pěšce nebo dát mat). Soupeř musí hrozbu odrazit, a tak nemůže dělat své plány. Tomu se říká iniciativa.',
  },
  check: {
    id: 'check',
    title: 'Šach',
    short: 'Šach = útok na krále; soupeř na něj musí okamžitě reagovat.',
    explanation:
      'Když dáš šach, soupeř musí krále ochránit: uhnout, vložit figuru mezi, nebo útočící figuru sebrat. Šach je užitečný, když ti něco přinese – samotný šach bez plánu ale často nic nezíská.',
  },
  trade: {
    id: 'trade',
    title: 'Výměna',
    short: 'Výměna je výhodná, když dostaneš víc, než dáš.',
    explanation:
      'Orientační hodnoty figur: pěšec 1, jezdec 3, střelec 3, věž 5, dáma 9. Když bereš figuru a soupeř ti vezme zpět stejně hodnotnou, je to rovná výměna. Výměny se vyplatí hlavně tomu, kdo má víc materiálu.',
  },
  material: {
    id: 'material',
    title: 'Materiál',
    short: 'Víc materiálu = víc síly na šachovnici.',
    explanation:
      'Materiál je součet hodnot tvých figur (pěšec 1, jezdec a střelec 3, věž 5, dáma 9). Získat materiál zdarma je skoro vždy dobré – s převahou se pak snáz útočí i brání.',
  },
  passedPawn: {
    id: 'passedPawn',
    title: 'Volný pěšec',
    short: 'Volný pěšec nemá před sebou žádné soupeřovy pěšce a může se proměnit.',
    explanation:
      'Pěšec je „volný“, když mu v cestě ani na sousedních sloupcích nestojí žádný soupeřův pěšec. Takový pěšec je velmi nebezpečný, protože ho soupeř musí hlídat figurami, aby nedošel až na konec a nestal se z něj dáma.',
  },
  seventhRank: {
    id: 'seventhRank',
    title: 'Věž na sedmé řadě',
    short: 'Věž na předposlední řadě napadá soupeřovy pěšce a svazuje krále.',
    explanation:
      'Na sedmé řadě (z pohledu bílého) obvykle stojí soupeřovi pěšci, kteří se tam nemohou bránit navzájem. Věž tam často sbírá pěšce a zavírá soupeřova krále na poslední řadu.',
  },
  promotion: {
    id: 'promotion',
    title: 'Proměna pěšce',
    short: 'Pěšec, který dojde na konec šachovnice, se promění – nejčastěji v dámu.',
    explanation:
      'Když pěšec dojde na poslední řadu, promění se v libovolnou figuru kromě krále. Skoro vždy si vybereš dámu, protože je nejsilnější.',
  },
  doubledPawns: {
    id: 'doubledPawns',
    title: 'Zdvojení pěšci',
    short: 'Dva pěšci na jednom sloupci se navzájem blokují.',
    explanation:
      'Zdvojení pěšci se nemohou navzájem krýt a ten zadní je zablokovaný tím předním. Nejsou vždy špatní (často otevřou sloupec pro věž), ale v koncovce bývají slabinou.',
  },
  mateThreat: {
    id: 'mateThreat',
    title: 'Matová hrozba',
    short: 'Mat ukončí partii – na matové hrozby reaguj jako první.',
    explanation:
      'Když soupeř hrozí mat, nic jiného není důležité – ani materiál. Hledej, jak krále ochránit: uvolnit mu únikové pole, zakrýt linii nebo útočící figuru sebrat.',
  },
}

// The V12's catalogue for the explorer: systems, pieces, groups and what each one does.
// Every part the build draws belongs to exactly one piece, and a piece is a real part of the
// engine (the crankshaft is one piece drawn as 23 parts). The texts quote the model's numbers.
import { ORDER } from "./model.mjs";

// French typography: thin no-break space before ; : ! ? and %, no-break space between a number and its unit
const fr = (s) =>
  s
    .replace(/ ([;:!?%])/g, " $1")
    .replace(/(\d) (mm|bar|N·m|cm³|L|kN|kV|V|g|dents|tonnes|°)(?![\p{L}])/gu, "$1 $2")
    .replace(/(\d) (\d{3})/g, "$1 $2");

export const SYSTEMS = [
  { id: "mobile", name: "Équipage mobile", color: "#d0955a", text: "Pistons, bielles et vilebrequin transforment la poussée des gaz en rotation. Douze pistons montent et descendent ; leurs bielles font tourner un seul vilebrequin, qui fait deux tours par cycle complet de quatre temps." },
  { id: "bloc", name: "Bloc moteur", color: "#8d99a8", text: "La charpente du moteur : ses cloisons portent le vilebrequin sur sept paliers, ses parois séparent les cylindres et il encaisse les efforts de la combustion. Il est découpé ici : il ne reste que les cloisons, les chapeaux de palier et les parois entre cylindres, pour voir ce qui bouge dedans." },
  { id: "culasses", name: "Culasses", color: "#7ea6c8", text: "Chaque rangée de six cylindres a sa culasse. Elle ferme le haut des cylindres, forme les chambres de combustion, guide les soupapes et porte les arbres à cames. La rangée B est ouverte pour montrer sa distribution." },
  { id: "distribution", name: "Distribution", color: "#b48bc4", text: "Les arbres à cames tournent deux fois moins vite que le vilebrequin. Leurs cames enfoncent les poussoirs, qui ouvrent les soupapes au bon moment : l'admission pendant que le piston descend, l'échappement pendant qu'il remonte." },
  { id: "admission", name: "Admission", color: "#69b3a2", text: "L'air entre par les cornets, passe un papillon par cylindre et descend par un conduit court jusqu'aux soupapes d'admission. Il n'y a pas de boîte à air commune : chaque cylindre respire seul." },
  { id: "injection", name: "Alimentation", color: "#cdb35c", text: "Deux rampes amènent l'essence sous pression à douze injecteurs, un par conduit d'admission. Le calculateur dose chaque injection d'après l'air qui entre." },
  { id: "echappement", name: "Échappement", color: "#c7765c", text: "Les gaz brûlés quittent chaque cylindre par leur propre tube, puis se rejoignent dans un collecteur par rangée. Une sonde mesure l'oxygène qui reste dans les gaz." },
  { id: "allumage", name: "Allumage", color: "#e09a3e", text: `Une bobine par cylindre produit la haute tension ; la bougie fait jaillir l'étincelle qui enflamme le mélange comprimé. Douze allumages par cycle de 720°, donc un tous les 60°, dans l'ordre ${ORDER}.` },
  { id: "lubrification", name: "Lubrification", color: "#949d5e", text: "L'huile du carter est filtrée puis envoyée sous pression aux paliers, aux bielles et aux arbres à cames, où elle forme le film qui sépare les pièces qui tournent." },
  { id: "banc", name: "Banc d'essai", color: "#9b958b", text: "Le support de la figure, pas une pièce du moteur : un socle gradué, un plateau tournant qui fait pivoter le moteur et un écran qui trace son couple." },
];

// what each kind of piece is and does; `sub` explains the zone of a piece drawn as several parts
const KINDS = {
  vilebrequin: {
    text: "La pièce maîtresse du moteur, forgée d'un seul bloc. Ses six manetons, décalés de 120°, portent chacun deux bielles côte à côte, une par rangée, décalées de 11 mm. Il tourne sur sept tourillons tenus par les cloisons du bloc, et ses contrepoids équilibrent les masses qui tournent. Il fait deux tours pendant que chaque cylindre accomplit ses quatre temps.",
    note: "Les manetons sont cachés sous les têtes de bielle.",
    sub: {
      journal: "Le tourillon tourne dans un palier du bloc, sur un film d'huile. Le petit trou amène l'huile, qui rejoint les manetons par des canaux percés dans l'arbre.",
      web: "Le bras relie un tourillon au maneton. Sa partie massive, à l'opposé du maneton, est un contrepoids qui équilibre le maneton et la tête de bielle.",
      snout: "Le nez porte la poulie amortisseur et le pignon qui entraîne la chaîne de distribution.",
      flange: "La bride reçoit le volant moteur, boulonné.",
    },
  },
  amortisseur: { text: "Montée sur le nez du vilebrequin, elle contient un anneau lourd collé sur du caoutchouc. Un vilebrequin à six manetons se tord un peu à chaque explosion ; l'amortisseur absorbe ces vibrations de torsion. Ses gorges entraînent aussi la courroie des accessoires (alternateur, pompe à eau), non représentés." },
  volant: { text: "Un disque lourd boulonné à l'arrière du vilebrequin. Il stocke de l'énergie entre deux explosions et lisse la rotation ; sa couronne de 132 dents sert au démarreur. Le couple d'un V12 ne retombe jamais à zéro (au moins 382 N·m dans ce modèle), donc son volant peut rester léger." },
  piston: {
    text: `Il coulisse dans son cylindre de 95 mm d'alésage, sur 76,4 mm de course. Pendant la détente, la pression des gaz brûlés le pousse vers le vilebrequin : jusqu'à 75 bar dans ce modèle, soit environ 52 kN, le poids de 5 tonnes. Les trois gorges sous sa tête portent les segments qui font l'étanchéité ; les quatre empreintes sur la tête laissent la place aux soupapes ouvertes.`,
    note: "Les segments et l'axe du piston sont à l'intérieur : ils sont décrits ici, pas dessinés à part.",
  },
  bielle: {
    text: "Elle relie le piston au vilebrequin. Son pied tourne autour de l'axe du piston, sa tête autour du maneton : elle change le va-et-vient du piston en rotation. Elle mesure 155 mm entre axes, environ quatre fois le rayon de manivelle. Sur ce V12, chaque maneton porte deux bielles, une de chaque rangée.",
    sub: {
      small: "Le pied entoure l'axe du piston, sur une bague en bronze.",
      beam: "Le corps, en I, transmet plus de 5 tonnes de poussée à chaque détente.",
      big: "La tête serre le maneton entre deux demi-coussinets. Le trait sur sa face marque le joint avec le chapeau, tenu par deux vis.",
    },
  },
  culasse: {
    text: "Elle ferme les six cylindres de sa rangée. Elle contient les chambres de combustion, les conduits d'admission (côté V) et d'échappement (côté extérieur), et 24 soupapes, quatre par cylindre. Les points sur sa face supérieure sont ses vis de fixation sur le bloc.",
    note: "Les soupapes et leurs ressorts sont à l'intérieur de la culasse ; leurs poussoirs sont visibles sur la rangée B.",
  },
  couvre: { text: "Il ferme la distribution de la rangée A et retient l'huile projetée sur les cames. Dessous se trouvent les mêmes arbres à cames et poussoirs que ceux montrés à nu sur la rangée B. Les six bobines d'allumage le traversent ; la gravure V12 est à l'avant." },
  tour: { text: "Il porte les deux arbres à cames de la rangée B au-dessus des soupapes. Les arbres y tournent sur un film d'huile ; les deux points sont les vis de son chapeau." },
  arbre: {
    text: "Entraîné par une chaîne, il tourne deux fois moins vite que le vilebrequin : un tour pour les quatre temps. Chacune de ses douze cames ouvre une soupape par son poussoir, de 9 mm au plus, pendant 248° de vilebrequin. Les cames sont calées dans l'ordre d'allumage.",
    sub: {
      lobe: "La came : quand son nez passe, elle enfonce le poussoir et ouvre la soupape.",
      shaft: "Un tronçon d'arbre entre deux cames. En vrai, l'arbre est creux et amène l'huile à ses portées.",
      nose: "Le bout d'arbre, qui reçoit le pignon de distribution.",
    },
  },
  pignon: { text: "Il reçoit la chaîne de distribution (non représentée) qui le relie au vilebrequin. Il a deux fois plus de dents que le pignon du vilebrequin : l'arbre à cames tourne deux fois moins vite." },
  poussoir: {
    text: "Un poussoir à coupelle, posé sur la queue d'une soupape. La came l'enfonce et la soupape s'ouvre ; un ressort la referme quand le nez de la came est passé. Chaque cylindre a quatre soupapes : deux d'admission, deux d'échappement.",
    note: "Le poussoir est dessiné au-dessus de la culasse, à une distance égale à sa levée : la figure ne peut pas emboîter les pièces.",
  },
  bobine: { text: "Une bobine crayon, plantée au-dessus de la bougie de son cylindre. Quand le calculateur coupe le courant dans son enroulement primaire, la tension monte à plusieurs dizaines de kV dans le secondaire, et l'étincelle jaillit à la bougie." },
  bougie: {
    text: "Elle fait jaillir l'étincelle entre ses électrodes, au fond de la chambre de combustion, pour enflammer le mélange comprimé.",
    note: "Le modèle allume au point mort haut ; un vrai moteur allume quelques degrés plus tôt, pour que la pression culmine juste après.",
  },
  capuchon: { text: "Il coiffe la bougie et isole la connexion qui lui amène la haute tension de la bobine." },
  conduit: { text: "Le conduit, un par cylindre, mène l'air du papillon aux deux soupapes d'admission. Sans boîte à air commune, chaque cylindre respire seul et répond tout de suite à l'accélérateur. Les deux points sont ses vis sur la culasse." },
  papillon: { text: "Un volet rond tourne dans ce boîtier, commandé par l'accélérateur : presque fermé au ralenti, grand ouvert à pleine charge. Les deux bossages portent son axe. Avec un papillon par cylindre, il reste très peu d'air à remplir entre le volet et la soupape, d'où une réponse immédiate." },
  cornet: { text: "L'entrée d'air en trompette. Son bord arrondi évite que l'air décolle des parois en entrant ; sa longueur règle les ondes de pression qui aident à remplir le cylindre à haut régime." },
  injecteur: { text: "Une électrovanne qui pulvérise l'essence dans le conduit, vers les soupapes d'admission. Le calculateur règle sa durée d'ouverture pour garder environ 14,7 g d'air pour 1 g d'essence, et un mélange plus riche à pleine charge." },
  rampe: { text: "Un tube d'essence sous pression, quelques bars, qui alimente les six injecteurs de sa rangée." },
  primaire: {
    text: "Le tube qui évacue les gaz brûlés de son cylindre. Dans ce modèle, les soupapes d'échappement s'ouvrent 40° avant le point mort bas : la pression qui reste chasse les gaz, puis le piston pousse le reste en remontant.",
    sub: {
      port: "La bride, serrée sur la sortie d'échappement de la culasse.",
      elbow: "Le coude tourne le flux vers le bas.",
      drop: "Le tube descend vers le collecteur commun. Sa longueur est choisie pour que les ondes de pression aident à vider le cylindre.",
    },
  },
  collecteur: { text: "Les six tubes de la rangée se rejoignent ici. Les gaz partent ensuite vers le catalyseur et le silencieux, non représentés." },
  lambda: { text: "La sonde lambda mesure l'oxygène qui reste dans les gaz. S'il en reste trop, le mélange est pauvre et le calculateur ajoute de l'essence ; s'il n'en reste pas assez, il en retire." },
  carter: { text: "La réserve d'huile, sous le vilebrequin. La pompe, non représentée, y aspire l'huile et l'envoie sous pression aux paliers. Les points le long de son bord sont les vis de sa bride." },
  filtre: { text: "Une cartouche de papier plissé qui retient les particules avant que l'huile n'atteigne les paliers." },
  vidange: { text: "On le dévisse pour vider l'huile usée." },
  cloison: { text: "Une des sept cloisons du bloc qui portent le vilebrequin. Elle tient un tourillon par le haut ; son chapeau le serre par le bas. L'arc gravé sur ses faces marque le logement du coussinet." },
  chapeau: { text: "Boulonné sous sa cloison, il ferme le palier autour d'un tourillon du vilebrequin. Les deux points sont ses vis." },
  paroi: { text: "Une paroi du bloc entre deux cylindres. Les deux cercles sont des passages d'eau : le liquide de refroidissement circule autour des cylindres et monte vers la culasse." },
  plateau: { text: "Le plateau tournant du banc. Il fait pivoter le moteur pour le montrer sous tous les angles ; le repère clair indique son orientation sur la couronne graduée du socle." },
  rail: { text: "Un des deux rails du berceau, qui portent le moteur par son carter." },
  socle: { text: "Le socle octogonal du banc. Sa couronne est graduée tous les 5°." },
  ecran: {
    text: "L'écran trace le couple sur le vilebrequin pendant un cycle de 720° : en trait vif pour les douze cylindres, en trait sombre pour un seul. Le point suit l'angle actuel. Un cylindre seul freine pendant sa compression (jusqu'à −171 N·m) ; le V12 pousse toujours, entre 382 et 847 N·m, 591 N·m en moyenne.",
    note: "Modèle simplifié de la pression dans les cylindres, à pleine charge, sans les forces d'inertie.",
  },
  pied: { text: "Les pieds du socle." },
};

const U = (tag) => tag.toUpperCase();
const N = (tag, i) => Number(i) + (tag === "b" ? 6 : 0);
const SIDE = (s) => (s === "f" ? "avant" : "arrière");
const CAM = { in: "d'admission", ex: "d'échappement" };
const cyl = (tag, i, more) => ({ cyl: N(tag, i), bank: tag, i: Number(i), ...more });

// every drawn part's piece, and the zone of that piece the part draws
const RULES = [
  [/^stand\.platter$/, () => ({ id: "plateau", name: "Plateau tournant", system: "banc", kind: "plateau" })],
  [/^stand\.rail\.([ab])$/, (m) => ({ id: `rail.${m[1]}`, name: `Rail du berceau, côté ${U(m[1])}`, system: "banc", kind: "rail" })],
  [/^stand\.plinth$/, () => ({ id: "socle", name: "Socle gradué", system: "banc", kind: "socle" })],
  [/^stand\.scope$/, () => ({ id: "ecran", name: "Écran de couple", system: "banc", kind: "ecran" })],
  [/^stand\.foot\./, () => ({ id: "pieds", name: "Pieds du socle", system: "banc", kind: "pied" })],
  [/^block\.sump$/, () => ({ id: "carter", name: "Carter d'huile", system: "lubrification", kind: "carter" })],
  [/^oil\.filter$/, () => ({ id: "filtre", name: "Filtre à huile", system: "lubrification", kind: "filtre" })],
  [/^oil\.drain$/, () => ({ id: "vidange", name: "Bouchon de vidange", system: "lubrification", kind: "vidange" })],
  [/^block\.cap\.(\d)$/, (m) => ({ id: `chapeau.${+m[1] + 1}`, name: `Chapeau de palier ${+m[1] + 1}`, system: "bloc", kind: "chapeau" })],
  [/^block\.bulkhead\.(\d)$/, (m) => ({ id: `cloison.${+m[1] + 1}`, name: `Cloison de palier ${+m[1] + 1}`, system: "bloc", kind: "cloison" })],
  [
    /^block\.web\.([ab])(\d)$/,
    (m) => {
      const k = +m[2];
      const n = N(m[1], k);
      const name = k === 0 ? `Paroi avant, rangée ${U(m[1])}` : k === 6 ? `Paroi arrière, rangée ${U(m[1])}` : `Paroi entre les cylindres ${n} et ${n + 1}`;
      return { id: `paroi.${m[1]}${k}`, name, system: "bloc", kind: "paroi", bank: m[1] };
    },
  ],
  [/^block\.head\.([ab])$/, (m) => ({ id: `culasse.${m[1]}`, name: `Culasse, rangée ${U(m[1])}`, system: "culasses", kind: "culasse", bank: m[1] })],
  [/^block\.cover\.a$/, () => ({ id: "couvre.a", name: "Couvre-culasse, rangée A", system: "culasses", kind: "couvre", bank: "a" })],
  [/^head\.tower\.(\d)$/, (m) => ({ id: `tour.${+m[1] + 1}`, name: `Palier d'arbres à cames ${+m[1] + 1}`, system: "culasses", kind: "tour", bank: "b" })],
  [
    /^crank\.(journal|web|snout|flange)(?:\.(\d)([fr])?)?$/,
    (m) => {
      const zone = m[1] === "journal" ? `Tourillon ${+m[2] + 1}` : m[1] === "web" ? `Bras et contrepoids du maneton ${m[2]}, côté ${SIDE(m[3])}` : m[1] === "snout" ? "Nez, côté poulie" : "Bride du volant";
      return { id: "vilebrequin", name: "Vilebrequin", system: "mobile", kind: "vilebrequin", sub: m[1], zone };
    },
  ],
  [/^crank\.damper$/, () => ({ id: "amortisseur", name: "Poulie amortisseur", system: "mobile", kind: "amortisseur" })],
  [/^crank\.flywheel$/, () => ({ id: "volant", name: "Volant moteur", system: "mobile", kind: "volant" })],
  [/^piston\.([ab])(\d)$/, (m) => ({ id: `piston.${N(m[1], m[2])}`, name: `Piston ${N(m[1], m[2])}`, system: "mobile", kind: "piston", ...cyl(m[1], m[2]) })],
  [
    /^rod\.([ab])(\d)\.(small|beam|big)$/,
    (m) => {
      const zone = { small: "Pied de bielle", beam: "Corps de bielle", big: `Tête de bielle, sur le maneton ${m[2]}` }[m[3]];
      return { id: `bielle.${N(m[1], m[2])}`, name: `Bielle ${N(m[1], m[2])}`, system: "mobile", kind: "bielle", sub: m[3], zone, ...cyl(m[1], m[2]) };
    },
  ],
  [
    /^cam\.(in|ex)\.(lobe|shaft|nose)(?:\.(\d+)([fr])?)?$/,
    (m) => {
      const zone = m[2] === "lobe" ? `Came du cylindre ${+m[3] + 6}, ${SIDE(m[4])}` : m[2] === "shaft" ? "Tronçon d'arbre" : "Bout d'arbre";
      return { id: `arbre.${m[1]}`, name: `Arbre à cames ${CAM[m[1]]}, rangée B`, system: "distribution", kind: "arbre", cam: m[1], bank: "b", sub: m[2], zone };
    },
  ],
  [/^cam\.(in|ex)\.sprocket$/, (m) => ({ id: `pignon.${m[1]}`, name: `Pignon de l'arbre ${CAM[m[1]]}`, system: "distribution", kind: "pignon", cam: m[1], bank: "b" })],
  [/^bucket\.(in|ex)(\d)([fr])$/, (m) => ({ id: `poussoir.${m[1]}${m[2]}${m[3]}`, name: `Poussoir ${CAM[m[1]]}, cylindre ${N("b", m[2])}, ${SIDE(m[3])}`, system: "distribution", kind: "poussoir", cam: m[1], ...cyl("b", m[2]) })],
  [/^intake\.runner\.([ab])(\d)$/, (m) => ({ id: `conduit.${N(m[1], m[2])}`, name: `Conduit d'admission, cylindre ${N(m[1], m[2])}`, system: "admission", kind: "conduit", ...cyl(m[1], m[2]) })],
  [/^intake\.throttle\.([ab])(\d)$/, (m) => ({ id: `papillon.${N(m[1], m[2])}`, name: `Boîtier papillon, cylindre ${N(m[1], m[2])}`, system: "admission", kind: "papillon", ...cyl(m[1], m[2]) })],
  [/^intake\.trumpet\.([ab])(\d)$/, (m) => ({ id: `cornet.${N(m[1], m[2])}`, name: `Cornet d'admission, cylindre ${N(m[1], m[2])}`, system: "admission", kind: "cornet", ...cyl(m[1], m[2]) })],
  [/^fuel\.injector\.([ab])(\d)$/, (m) => ({ id: `injecteur.${N(m[1], m[2])}`, name: `Injecteur, cylindre ${N(m[1], m[2])}`, system: "injection", kind: "injecteur", ...cyl(m[1], m[2]) })],
  [/^fuel\.rail\.([ab])$/, (m) => ({ id: `rampe.${m[1]}`, name: `Rampe d'injection, rangée ${U(m[1])}`, system: "injection", kind: "rampe", bank: m[1] })],
  [
    /^exhaust\.(port|elbow|drop)\.([ab])(\d)$/,
    (m) => {
      const zone = { port: "Bride sur la culasse", elbow: "Coude", drop: "Tube descendant" }[m[1]];
      return { id: `primaire.${N(m[2], m[3])}`, name: `Tube d'échappement, cylindre ${N(m[2], m[3])}`, system: "echappement", kind: "primaire", sub: m[1], zone, ...cyl(m[2], m[3]) };
    },
  ],
  [/^exhaust\.log\.([ab])$/, (m) => ({ id: `collecteur.${m[1]}`, name: `Collecteur d'échappement, rangée ${U(m[1])}`, system: "echappement", kind: "collecteur", bank: m[1] })],
  [/^exhaust\.lambda\.([ab])$/, (m) => ({ id: `lambda.${m[1]}`, name: `Sonde lambda, rangée ${U(m[1])}`, system: "echappement", kind: "lambda", bank: m[1] })],
  [/^ignition\.coil\.a(\d)$/, (m) => ({ id: `bobine.${N("a", m[1])}`, name: `Bobine d'allumage, cylindre ${N("a", m[1])}`, system: "allumage", kind: "bobine", ...cyl("a", m[1]) })],
  [/^ignition\.plug\.b(\d)$/, (m) => ({ id: `bougie.${N("b", m[1])}`, name: `Bougie, cylindre ${N("b", m[1])}`, system: "allumage", kind: "bougie", ...cyl("b", m[1]) })],
  [/^ignition\.boot\.b(\d)$/, (m) => ({ id: `capuchon.${N("b", m[1])}`, name: `Capuchon de bougie, cylindre ${N("b", m[1])}`, system: "allumage", kind: "capuchon", ...cyl("b", m[1]) })],
];

// other names a reader may type, English included
const WORDS = {
  vilebrequin: "crankshaft crank manivelle maneton tourillon contrepoids",
  amortisseur: "damper poulie pulley",
  volant: "flywheel couronne démarreur",
  piston: "piston segments",
  bielle: "connecting rod conrod",
  culasse: "cylinder head chambre combustion soupapes",
  couvre: "cam cover valve cover cache-culbuteurs",
  tour: "cam tower palier",
  arbre: "camshaft came cam",
  pignon: "sprocket chaîne chain distribution",
  poussoir: "tappet bucket soupape valve",
  bobine: "coil ignition",
  bougie: "spark plug",
  capuchon: "plug boot",
  conduit: "intake runner pipe",
  papillon: "throttle body",
  cornet: "trumpet velocity stack",
  injecteur: "injector essence fuel",
  rampe: "fuel rail essence",
  primaire: "exhaust header",
  collecteur: "exhaust manifold",
  lambda: "oxygen sensor o2 oxygène",
  carter: "oil pan sump huile",
  filtre: "oil filter huile",
  vidange: "drain plug huile",
  cloison: "bulkhead main bearing palier",
  chapeau: "main cap bearing palier",
  paroi: "cylinder wall eau water cooling refroidissement",
  plateau: "turntable",
  rail: "cradle",
  socle: "plinth base",
  ecran: "torque scope couple oscilloscope",
};

const GROUPS = [
  ["g.pistons", "Les 12 pistons", (p) => p.kind === "piston"],
  ["g.bielles", "Les 12 bielles", (p) => p.kind === "bielle"],
  ["g.mobile", "Vilebrequin, bielles et pistons", (p) => ["vilebrequin", "bielle", "piston"].includes(p.kind)],
  ["g.arbres", "Arbres à cames et pignons", (p) => p.kind === "arbre" || p.kind === "pignon"],
  ["g.poussoirs", "Les 24 poussoirs", (p) => p.kind === "poussoir"],
  ["g.culasses", "Les 2 culasses", (p) => p.kind === "culasse"],
  ["g.paliers", "Paliers de vilebrequin (cloisons et chapeaux)", (p) => p.kind === "cloison" || p.kind === "chapeau"],
  ["g.parois", "Parois de cylindre", (p) => p.kind === "paroi"],
  ["g.conduits", "Conduits d'admission", (p) => p.kind === "conduit"],
  ["g.papillons", "Boîtiers papillon", (p) => p.kind === "papillon"],
  ["g.cornets", "Cornets d'admission", (p) => p.kind === "cornet"],
  ["g.injecteurs", "Les 12 injecteurs", (p) => p.kind === "injecteur"],
  ["g.primaires", "Tubes d'échappement", (p) => p.kind === "primaire"],
  ["g.bobines", "Bobines d'allumage", (p) => p.kind === "bobine"],
  ["g.bougies", "Bougies et capuchons", (p) => p.kind === "bougie" || p.kind === "capuchon"],
  ["g.rangee.a", "Rangée A, cylindres 1 à 6", (p) => p.bank === "a"],
  ["g.rangee.b", "Rangée B, cylindres 7 à 12", (p) => p.bank === "b"],
  ...Array.from({ length: 12 }, (_, k) => [`g.cyl.${k + 1}`, `Cylindre ${k + 1}, toutes ses pièces`, (p) => p.cyl === k + 1]),
];

// the page's catalogue for the given drawn part names (live and static)
export function catalogue(names) {
  const pieces = [];
  const byId = new Map();
  const parts = {};
  for (const name of names) {
    const rule = RULES.find(([re]) => re.test(name));
    if (!rule) throw new Error(`atlas: no piece for part ${name}`);
    const info = rule[1](name.match(rule[0]));
    let piece = byId.get(info.id);
    if (!piece) {
      const { sub, zone, ...rest } = info;
      piece = { ...rest, parts: [], words: WORDS[info.kind] ?? "" };
      byId.set(info.id, piece);
      pieces.push(piece);
    }
    piece.parts.push(name);
    parts[name] = [pieces.indexOf(piece), info.sub ?? null, info.zone ?? null];
  }
  for (const p of pieces) {
    p.name = fr(p.name);
    if (p.kind === "arbre") p.extra = fr(p.cam === "in" ? "L'arbre d'admission est côté V ; ses cames atteignent la levée maximale 110° après le point mort haut." : "L'arbre d'échappement est côté extérieur ; ses cames atteignent la levée maximale 110° avant le point mort haut.");
    if (p.kind === "paroi" && /avant|arrière/.test(p.name)) p.extra = fr("Celle-ci ferme le bout de la rangée.");
  }
  for (const key of Object.keys(parts)) if (parts[key][2]) parts[key][2] = fr(parts[key][2]);
  const groups = GROUPS.map(([id, name, test]) => ({ id, name: fr(name), pieces: pieces.flatMap((p, k) => (test(p) ? [k] : [])) })).filter((g) => g.pieces.length);
  const kinds = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { text: fr(v.text), note: v.note ? fr(v.note) : null, sub: v.sub ? Object.fromEntries(Object.entries(v.sub).map(([s, t]) => [s, fr(t)])) : null }]));
  const systems = SYSTEMS.map((s) => ({ ...s, text: fr(s.text), count: pieces.filter((p) => p.system === s.id).length }));
  const suggest = ["vilebrequin", "piston.1", "bielle.1", "arbre.in", "culasse.b", "volant", "bougie.7", "papillon.1", "g.cyl.7", "ecran"];
  return { systems, kinds, pieces, parts, groups, suggest };
}

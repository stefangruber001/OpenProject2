/* =============================================================================
   Canei Subirats — the starter price book in English and Catalan.

   WHY THIS IS A SEPARATE FILE, AND WHY IT EXISTS AT ALL. `erp-catalogue-pack.js`
   is a table of two hundred priced partidas and it has to stay readable AS a
   table; two more columns of prose per row would bury the money. Same reason
   `i18n-dict-ca.js` is not a third element inside `i18n-dict.js`.

   THE DISTINCTION THAT MATTERS. Everywhere else in this system, the company's
   own data is deliberately NOT translated — a customer's name, a site address,
   a partida the estimator typed. That rule stands. But the STARTER price book
   is not the company's data: it is data this system ships, in the same way it
   ships the word "Presupuesto", and an operator reading the interface in
   English should not meet two hundred lines of Spanish inside it.

   So: a partida that came from this pack is shown in the reader's language; a
   partida somebody typed is shown exactly as it was typed, in every language,
   because inventing a translation of somebody else's words is worse than
   leaving them alone. `catalogueDesc()` in erp.html is the seam that decides.

   BRAND, MODEL AND QUALITY ARE NOT HERE. "Porcelanosa", "Altherma 3", "AC5"
   and "λ 0,035" are the same in every language; translating a product name is
   how a quote comes to name a thing the supplier does not sell.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpCatalogueI18n = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** Chapter names. The pack already carries `es` and `ca`; this adds `en`. */
  var CHAPTERS_EN = {
    AUX: "Access, plant and safety",
    DEM: "Demolition",
    RES: "Waste management",
    ALB: "Masonry",
    TAB: "Partitions and linings",
    AIS: "Insulation and waterproofing",
    CUB: "Roofing",
    FAC: "Façades",
    SOL: "Floor finishes",
    REV: "Wall finishes",
    FON: "Plumbing",
    SAN: "Sanitaryware and taps",
    ELE: "Electrical",
    CLI: "Heating and cooling",
    CAR: "Joinery",
    PIN: "Painting",
    VAR: "Sundries",
    VEN: "Windows and glazing",
    COC: "Kitchen and fitted furniture",
    LIM: "Cleaning and snagging",
  };

  /** code → [English, Catalan]. Spanish is in the pack itself. */
  var DESC = {
    "AUX-101": [
      "Certified façade scaffolding: erection, 1 month's hire and dismantling",
      "Bastida homologada en façana, muntatge, lloguer 1 mes i desmuntatge",
    ],
    "AUX-102": [
      "Mobile aluminium indoor tower, weekly hire",
      "Bastida interior mòbil d'alumini, lloguer setmanal",
    ],
    "AUX-103": [
      "Scissor lift platform, daily hire",
      "Plataforma elevadora de tisora, lloguer diari",
    ],
    "AUX-104": [
      "Floor protection with board and film, laid and removed",
      "Protecció de terres amb cartró i film, col·locació i retirada",
    ],
    "AUX-105": [
      "Plastic protection of joinery and furniture",
      "Protecció de fusteries i mobiliari amb plàstic",
    ],
    "AUX-106": [
      "Dust screen with zipped access, erected",
      "Muntatge de mampara antipols amb cremallera",
    ],
    "AUX-107": [
      "Site hoarding and signage on the public highway",
      "Tancament i senyalització de zona d'obra a via pública",
    ],
    "AUX-108": [
      "Personal protective equipment per operative per job",
      "Equips de protecció individual per operari i obra",
    ],
    "AUX-109": [
      "Health and safety plan: drafting and monitoring",
      "Redacció i seguiment del pla de seguretat i salut",
    ],
    "AUX-110": ["Site health and safety coordination", "Coordinació de seguretat i salut a l'obra"],
    "DEM-101": [
      "Hollow brick partition demolition, by hand",
      "Enderroc d'envà de maó buit, amb mitjans manuals",
    ],
    "DEM-102": [
      "Plasterboard partition and stud demolition",
      "Enderroc d'envà de placa de guix i estructura",
    ],
    "DEM-103": ["Hacking off wall tiling", "Repicat d'enrajolat en parament vertical"],
    "DEM-104": [
      "Lifting ceramic flooring including the bedding layer",
      "Aixecament de paviment ceràmic inclosa capa d'agafada",
    ],
    "DEM-105": [
      "Lifting parquet or floating board flooring",
      "Aixecament de parquet o tarima flotant",
    ],
    "DEM-106": [
      "Concrete slab demolition up to 15 cm",
      "Enderroc de solera de formigó fins a 15 cm",
    ],
    "DEM-107": ["Removal of sanitaryware and taps", "Desmuntatge d'aparells sanitaris i aixetes"],
    "DEM-108": [
      "Removal of internal joinery and subframe",
      "Desmuntatge de fusteria interior amb bastiment",
    ],
    "DEM-109": [
      "Forming an opening in a non-structural partition",
      "Obertura de forat en envà no estructural",
    ],
    "DEM-110": [
      "Forming an opening in a loadbearing wall with a steel lintel",
      "Obertura de forat en mur de càrrega amb llinda metàl·lica",
    ],
    "RES-101": [
      "5 m³ skip for construction waste, collection included",
      "Contenidor de 5 m³ per a residus de construcció, retirada inclosa",
    ],
    "RES-102": [
      "12 m³ skip for construction waste, collection included",
      "Contenidor de 12 m³ per a residus de construcció, retirada inclosa",
    ],
    "RES-103": [
      "1 m³ rubble sack, supplied and collected",
      "Sac de runa d'1 m³, subministrament i retirada",
    ],
    "RES-104": [
      "Rubble chute on the façade, erected and hired",
      "Baixant de runa per façana, muntatge i lloguer",
    ],
    "RES-105": ["Hand loading rubble into the skip", "Càrrega manual de runa al contenidor"],
    "RES-106": [
      "Licensed landfill charge for mixed waste",
      "Cànon d'abocador autoritzat per a residu barrejat",
    ],
    "RES-107": [
      "Asbestos waste removal and disposal by a licensed contractor",
      "Retirada i gestió de residu amb amiant per gestor autoritzat",
    ],
    "RES-108": ["Waste segregation on site", "Separació selectiva de residus a l'obra"],
    "RES-109": [
      "Waste documentation and traceability (DCR)",
      "Documentació i traçabilitat de residus (DCR)",
    ],
    "RES-110": [
      "Cleaning the skip and loading area after collection",
      "Neteja de contenidor i zona de càrrega després de la retirada",
    ],
    "ALB-101": [
      "9 cm double hollow brickwork bedded in mortar",
      "Obra de maó buit doble de 9 cm presa amb morter",
    ],
    "ALB-102": [
      "Bedding in subframes and door frames with mortar",
      "Rebut de bastiments de base i premarcs amb morter",
    ],
    "ALB-103": [
      "Chasing and making good in masonry",
      "Formació de regates i posterior tapat en obra",
    ],
    "ALB-104": [
      "Ruled mortar render to walls",
      "Arrebossat mestrejat de morter en parament vertical",
    ],
    "ALB-105": [
      "Gypsum backing coat and skim to walls",
      "Enguixat i lliscat de guix en parament vertical",
    ],
    "ALB-106": [
      "Forming stair treads and risers in brick",
      "Formació d'esglaonat d'escala amb maó",
    ],
    "ALB-107": [
      "Self-levelling screed up to 5 cm",
      "Recrescut de morter autoanivellant fins a 5 cm",
    ],
    "ALB-108": [
      "Forming falls in lightweight concrete",
      "Formació de pendents amb formigó alleugerit",
    ],
    "ALB-109": ["Builder's work in connection with services", "Ajuts de paleta a instal·lacions"],
    "ALB-110": [
      "Sealing and finishing junctions with flexible joints",
      "Segellat i acabat de trobades amb juntes elàstiques",
    ],
    "TAB-101": [
      "Plasterboard partition 15+46+15 with mineral wool",
      "Envà de placa de guix laminat 15+46+15 amb llana mineral",
    ],
    "TAB-102": [
      "Moisture-resistant board partition for wet areas 15+46+15",
      "Envà de placa hidròfuga per a zones humides 15+46+15",
    ],
    "TAB-103": [
      "46 mm free-standing lining with insulation",
      "Trasdossat autoportant de 46 mm amb aïllament",
    ],
    "TAB-104": [
      "Direct board lining onto an existing wall",
      "Trasdossat directe de placa sobre mur existent",
    ],
    "TAB-105": [
      "Seamless plasterboard suspended ceiling",
      "Fals sostre continu de placa de guix laminat",
    ],
    "TAB-106": [
      "Accessible mineral tile ceiling 60×60",
      "Fals sostre registrable de placa mineral 60×60",
    ],
    "TAB-107": [
      "Perimeter coffer for indirect lighting",
      "Formació de fossat perimetral per a il·luminació indirecta",
    ],
    "TAB-108": [
      "Internal noggings for hanging units or sanitaryware",
      "Reforç interior per penjar mobiliari o sanitaris",
    ],
    "TAB-109": [
      "Joint treatment and filling to level Q3",
      "Tractament de juntes i massillat a nivell Q3",
    ],
    "TAB-110": ["Access hatch in the suspended ceiling", "Registre practicable al fals sostre"],
    "AIS-101": [
      "45 mm mineral wool insulation in the lining",
      "Aïllament de llana mineral de 45 mm al trasdossat",
    ],
    "AIS-102": [
      "40 mm extruded polystyrene insulation",
      "Aïllament de poliestirè extruït de 40 mm",
    ],
    "AIS-103": [
      "Blown cellulose into the façade cavity",
      "Insuflat de cel·lulosa a la cambra de façana",
    ],
    "AIS-104": [
      "Liquid polyurethane tanking in the bathroom",
      "Impermeabilització líquida de poliuretà al bany",
    ],
    "AIS-105": [
      "Bituminous waterproofing membrane on the roof",
      "Làmina impermeabilitzant asfàltica a la coberta",
    ],
    "AIS-106": [
      "Flexible perimeter band at shower tray junctions",
      "Banda perimetral elàstica a les trobades del plat de dutxa",
    ],
    "AIS-107": [
      "Damp treatment by perimeter injection",
      "Tractament antihumitat per injecció perimetral",
    ],
    "AIS-108": [
      "Cutting back damp walls and applying repair mortar",
      "Sanejament de parament amb humitat i morter de reparació",
    ],
    "AIS-109": [
      "Acoustic floor insulation with an impact-isolation layer",
      "Aïllament acústic de terra amb làmina antiimpacte",
    ],
    "AIS-110": [
      "Sealing thermal bridges at the joinery",
      "Segellat de ponts tèrmics a la fusteria",
    ],
    "CUB-101": [
      "Stripping clay tiles with the material salvaged",
      "Retirada de teula ceràmica amb recuperació de material",
    ],
    "CUB-102": [
      "Pitched roof refurbishment with interlocking tile",
      "Rehabilitació de coberta inclinada amb teula mixta",
    ],
    "CUB-103": [
      "Waterproofing a trafficable flat roof",
      "Impermeabilització de coberta plana transitable",
    ],
    "CUB-104": ["60 mm XPS roof insulation", "Aïllament tèrmic de coberta amb XPS de 60 mm"],
    "CUB-105": ["Forming falls in aerated concrete", "Formació de pendents amb formigó cel·lular"],
    "CUB-106": [
      "Zinc gutter, supplied and fitted",
      "Canaló de zinc, subministrament i col·locació",
    ],
    "CUB-107": ["110 mm PVC rainwater downpipe", "Baixant de pluvials de PVC de 110 mm"],
    "CUB-108": [
      "Wall abutment finished with a flashing",
      "Acabat de trobada amb parament mitjançant babeta",
    ],
    "CUB-109": [
      "Rooflight replaced with safety glass",
      "Substitució de claraboia amb vidre de seguretat",
    ],
    "CUB-110": [
      "Roof and outlet cleaning and inspection",
      "Neteja i revisió de coberta i embornals",
    ],
    "FAC-101": [
      "Hacking off failed façade render",
      "Repicat de revestiment de façana en mal estat",
    ],
    "FAC-102": [
      "Crack repair with mortar and reinforcing mesh",
      "Reparació d'esquerdes amb morter i malla de reforç",
    ],
    "FAC-103": ["One-coat render, scraped finish", "Arrebossat monocapa acabat raspat"],
    "FAC-104": [
      "External wall insulation system, 60 mm EPS and finish",
      "Sistema SATE amb EPS de 60 mm i acabat",
    ],
    "FAC-105": ["Silicate façade paint, two coats", "Pintura de façana al silicat, dues mans"],
    "FAC-106": [
      "Preparing and painting metal railings",
      "Sanejament i pintat de baranes metàl·liques",
    ],
    "FAC-107": [
      "Replacing reconstituted stone sills",
      "Substitució d'escopidors de pedra artificial",
    ],
    "FAC-108": ["Façade cleaning by pressure washer", "Neteja de façana amb hidronetejadora"],
    "FAC-109": ["Repointing facing brickwork", "Rejuntat d'obra de maó vist"],
    "FAC-110": ["Façade technical inspection and report", "Inspecció tècnica de façana i informe"],
    "SOL-101": [
      "Porcelain floor tiling 60×60 with C2 adhesive",
      "Paviment ceràmic porcellànic 60×60 amb adhesiu C2",
    ],
    "SOL-102": [
      "Large-format porcelain flooring 120×60",
      "Paviment porcellànic gran format 120×60",
    ],
    "SOL-103": [
      "AC5 laminate floating floor with underlay",
      "Tarima flotant laminada AC5 amb làmina",
    ],
    "SOL-104": [
      "Engineered oak parquet, fully bonded",
      "Parquet multicapa de roure, col·locació encolada",
    ],
    "SOL-105": ["8 cm white lacquered skirting", "Sòcol lacat blanc de 8 cm"],
    "SOL-106": ["SPC click vinyl flooring", "Paviment vinílic SPC amb clic"],
    "SOL-107": [
      "Levelling the substrate with self-levelling compound",
      "Anivellament de suport amb morter autoanivellant",
    ],
    "SOL-108": [
      "Grinding and polishing existing terrazzo",
      "Poliment i abrillantat de terratzo existent",
    ],
    "SOL-109": [
      "Stair treads in porcelain with nosing",
      "Esglaonat d'escala amb porcellànic i mamperlà",
    ],
    "SOL-110": [
      "Floor movement joint with an aluminium profile",
      "Junta de dilatació en paviment amb perfil d'alumini",
    ],
    "REV-101": [
      "Porcelain wall tiling 30×60",
      "Enrajolat de porcellànic 30×60 en parament vertical",
    ],
    "REV-102": [
      "Stoneware wall tiling 20×60 with flexible adhesive",
      "Enrajolat de gres 20×60 amb adhesiu flexible",
    ],
    "REV-103": [
      "Microcement bathroom finish, complete system",
      "Revestiment de microciment al bany, sistema complet",
    ],
    "REV-104": ["PVC panelling to wet-area walls", "Panellat de PVC en parament de zona humida"],
    "REV-105": [
      "Kitchen splashback in large-format porcelain",
      "Front de cuina en porcellànic gran format",
    ],
    "REV-106": ["Epoxy grouting in wet areas", "Rejuntat amb morter epoxi en zona humida"],
    "REV-107": ["Aluminium edge trim", "Perfil d'acabat d'alumini en cantells"],
    "REV-108": ["Wallpaper, preparation and hanging", "Paper pintat, preparació i col·locació"],
    "REV-109": ["Natural stone wall cladding", "Revestiment de pedra natural en parament"],
    "REV-110": [
      "Sanitary sealing of junctions with neutral silicone",
      "Segellat sanitari de trobades amb silicona neutra",
    ],
    "FON-101": [
      "Water point in multilayer pipe, standard range",
      "Punt d'aigua en multicapa, gamma estàndard",
    ],
    "FON-102": [
      "Water point in multilayer pipe, premium range with isolating valve",
      "Punt d'aigua en multicapa, gamma alta amb clau de pas",
    ],
    "FON-103": ["PVC waste point to the trap", "Punt de desguàs en PVC fins al pot sifònic"],
    "FON-104": [
      "Replacing the soil stack within the dwelling",
      "Substitució de baixant de sanejament a l'habitatge",
    ],
    "FON-105": [
      "Fitting a distribution manifold with valves",
      "Muntatge de col·lector de distribució amb claus",
    ],
    "FON-106": [
      "Installing an 80 l electric water heater",
      "Instal·lació de termos elèctric de 80 l",
    ],
    "FON-107": [
      "Installing a gas condensing boiler",
      "Instal·lació de caldera de condensació de gas",
    ],
    "FON-108": ["Main isolating valve and safety group", "Clau de pas general i grup de seguretat"],
    "FON-109": ["Pressure test and commissioning", "Prova d'estanquitat i posada en servei"],
    "FON-110": ["Plumbing installation certificate", "Certificat d'instal·lació de lampisteria"],
    "SAN-101": [
      "Wall-hung WC with concealed cistern and flush plate",
      "Inodor suspès amb cisterna encastada i polsador",
    ],
    "SAN-102": ["Floor-standing WC with dual outlet", "Inodor a terra amb sortida dual"],
    "SAN-103": ["Made-to-measure resin shower tray", "Plat de dutxa de resina a mida"],
    "SAN-104": [
      "Fixed shower screen in 8 mm toughened glass",
      "Mampara de dutxa fixa de vidre trempat de 8 mm",
    ],
    "SAN-105": [
      "80 cm wall-hung vanity unit with basin",
      "Moble de bany suspès de 80 cm amb lavabo",
    ],
    "SAN-106": [
      "Single-lever basin tap, standard range",
      "Aixeta monocomandament de lavabo, gamma estàndard",
    ],
    "SAN-107": [
      "Thermostatic shower valve, premium range",
      "Aixeta termostàtica de dutxa, gamma alta",
    ],
    "SAN-108": ["Shower set with rail and head", "Conjunt de dutxa amb barra i ruixador"],
    "SAN-109": ["170 cm acrylic bath with frame", "Banyera acrílica de 170 cm amb suport"],
    "SAN-110": ["Bathroom accessories, 5-piece set", "Accessoris de bany, conjunt de 5 peces"],
    "ELE-101": [
      "Single lighting point, flush, with switch",
      "Punt de llum simple encastat amb mecanisme",
    ],
    "ELE-102": [
      "Two-way lighting point with two switches",
      "Punt de llum commutat amb dos mecanismes",
    ],
    "ELE-103": ["16 A socket outlet with earth", "Base d'endoll 16 A amb presa de terra"],
    "ELE-104": ["Premium socket outlet with USB", "Base d'endoll gamma alta amb USB"],
    "ELE-105": ["12-way consumer unit", "Quadre general de comandament i protecció de 12 elements"],
    "ELE-106": [
      "Dedicated circuit for the kitchen or air conditioning",
      "Circuit independent per a cuina o climatització",
    ],
    "ELE-107": ["Cat 6 RJ45 data point", "Punt de dades RJ45 categoria 6"],
    "ELE-108": ["7 W recessed LED downlight", "Downlight LED encastat de 7 W"],
    "ELE-109": ["LED strip with driver in the coffer", "Tira LED amb font d'alimentació al fossat"],
    "ELE-110": [
      "Electrical certificate and registration of the installation",
      "Butlletí elèctric i legalització de la instal·lació",
    ],
    "CLI-101": [
      "3,500 W inverter wall split, unit and installation",
      "Split de paret inverter 3.500 W, equip i muntatge",
    ],
    "CLI-102": [
      "2×1 inverter multi-split, units and installation",
      "Multisplit 2×1 inverter, equip i muntatge",
    ],
    "CLI-103": [
      "Fibre ductwork in the ceiling void with grilles",
      "Conductes de fibra al fals sostre amb reixes",
    ],
    "CLI-104": [
      "Air-source heat pump for hot water and heating, unit and installation",
      "Aerotèrmia per a ACS i calefacció, equip i muntatge",
    ],
    "CLI-105": [
      "Aluminium radiator, supplied and fitted",
      "Radiador d'alumini, subministrament i muntatge",
    ],
    "CLI-106": [
      "Wet underfloor heating, complete system",
      "Terra radiant per aigua, sistema complet",
    ],
    "CLI-107": [
      "Balanced heat recovery unit for the dwelling",
      "Recuperador de calor de doble flux per a l'habitatge",
    ],
    "CLI-108": [
      "Bathroom extractor with timer and duct",
      "Extractor de bany amb temporitzador i conducte",
    ],
    "CLI-109": [
      "Programmable thermostat with app control",
      "Termòstat programable amb control per aplicació",
    ],
    "CLI-110": [
      "Commissioning and certificate for the thermal installation",
      "Posada en marxa i certificat de la instal·lació tèrmica",
    ],
    "VEN-101": [
      "PVC tilt-and-turn window with 4/16/4 low-e glazing",
      "Finestra de PVC oscil·lobatent amb vidre 4/16/4 baix emissiu",
    ],
    "VEN-102": [
      "Thermally broken aluminium window",
      "Finestra d'alumini amb trencament de pont tèrmic",
    ],
    "VEN-103": ["Stained pine timber window", "Finestra de fusta de pi lasurada"],
    "VEN-104": ["Two-leaf aluminium sliding door", "Porta corredissa d'alumini de dues fulles"],
    "VEN-105": ["Motorised aluminium roller shutter", "Persiana enrotllable d'alumini amb motor"],
    "VEN-106": ["Made-to-measure roller insect screen", "Mosquitera enrotllable a mida"],
    "VEN-107": [
      "3+3 laminated safety glass, replacement",
      "Vidre laminat de seguretat 3+3 en substitució",
    ],
    "VEN-108": [
      "Perimeter sealing of external joinery",
      "Segellat perimetral de fusteria exterior",
    ],
    "VEN-109": [
      "Removing existing joinery and subframe",
      "Retirada de fusteria existent i bastiment",
    ],
    "VEN-110": ["Internal reveal and sill finishing", "Acabat interior de brancals i escopidors"],
    "CAR-101": [
      "White lacquered internal door with subframe and ironmongery",
      "Porta de pas lacada blanca amb bastiment i ferramenta",
    ],
    "CAR-102": ["Pocket sliding door with cassette", "Porta corredissa encastada amb cassette"],
    "CAR-103": [
      "Armoured entrance door with security lock",
      "Porta d'entrada cuirassada amb pany de seguretat",
    ],
    "CAR-104": [
      "2 m fitted wardrobe with sliding doors",
      "Armari encastat amb portes corredisses, 2 m",
    ],
    "CAR-105": ["Lacquered hinged wardrobe front", "Front d'armari batent lacat"],
    "CAR-106": ["Wardrobe interior with shelf and rail", "Interior d'armari amb prestatge i barra"],
    "CAR-107": ["Solid timber stair treads", "Tarima d'escala en fusta massissa"],
    "CAR-108": ["Internal steel and timber balustrade", "Barana interior d'acer i fusta"],
    "CAR-109": [
      "Adjusting and replacing ironmongery on existing doors",
      "Ajust i substitució de ferramenta en portes existents",
    ],
    "CAR-110": [
      "Made-to-measure shelving in a structural recess",
      "Prestatgeria a mida en forat d'obra",
    ],
    "PIN-101": [
      "Smooth emulsion paint to walls, two coats",
      "Pintura plàstica llisa en paraments, dues mans",
    ],
    "PIN-102": [
      "Washable emulsion in the kitchen and bathroom",
      "Pintura plàstica rentable a cuina i bany",
    ],
    "PIN-103": [
      "Water-based eggshell on internal joinery",
      "Esmalt a l'aigua en fusteria interior",
    ],
    "PIN-104": [
      "Substrate preparation: sanding, filling and priming",
      "Preparació de suport: escatat, massillat i imprimació",
    ],
    "PIN-105": ["Ceiling paint, matt finish", "Pintura de sostres amb acabat mat"],
    "PIN-106": ["Anti-rust enamel on metalwork", "Esmalt antioxidant sobre element metàl·lic"],
    "PIN-107": ["Anti-mould paint in damp areas", "Pintura antifongs en zones amb humitat"],
    "PIN-108": [
      "Glaze or decorative effect on the wall",
      "Veladura o efecte decoratiu en parament",
    ],
    "PIN-109": ["Parquet varnishing, three coats", "Envernissat de parquet, tres mans"],
    "PIN-110": [
      "Masking up and removing protection for painting",
      "Protecció i retirada de proteccions per a pintura",
    ],
    "COC-101": [
      "Base kitchen units with drawers, standard range",
      "Mobiliari de cuina baix amb calaixos, gamma estàndard",
    ],
    "COC-102": ["Wall kitchen units with doors", "Mobiliari de cuina alt amb portes"],
    "COC-103": [
      "Spanish granite worktop, polished edge",
      "Encimera de granit nacional, cantell polit",
    ],
    "COC-104": ["12 mm porcelain worktop", "Encimera de porcellànic de 12 mm"],
    "COC-105": ["Undermounted stainless steel sink", "Aigüera sota encimera d'acer inoxidable"],
    "COC-106": ["Three-zone induction hob", "Placa d'inducció de tres zones"],
    "COC-107": [
      "Decorative extractor hood ducted outside",
      "Campana extractora decorativa amb sortida a l'exterior",
    ],
    "COC-108": ["Built-in multifunction oven", "Forn multifunció encastable"],
    "COC-109": [
      "Appliance installation and connection",
      "Muntatge d'electrodomèstics i connexionat",
    ],
    "COC-110": ["Plinth, trims and worktop sealing", "Sòcol, acabats i segellat d'encimera"],
    "LIM-101": ["Site cleaning by stage", "Neteja d'obra per fases"],
    "LIM-102": [
      "Final builder's clean, ready for handover",
      "Neteja final d'obra, lliurament claus en mà",
    ],
    "LIM-103": ["Glass cleaning inside and out", "Neteja de vidres interior i exterior"],
    "LIM-104": [
      "Removing offcuts and packaging to the recycling centre",
      "Retirada de restes i embalatges a la deixalleria",
    ],
    "LIM-105": [
      "Snagging after the first inspection",
      "Repàs d'acabats i defectes després de la primera visita",
    ],
    "LIM-106": [
      "Final sealing of junctions and skirtings",
      "Segellats finals de trobades i sòcols",
    ],
    "LIM-107": [
      "Adjusting doors and ironmongery after settlement",
      "Ajust de portes i ferramenta després de l'assentament",
    ],
    "LIM-108": [
      "Paint touch-up after the units are fitted",
      "Repàs de pintura després del muntatge de mobiliari",
    ],
    "LIM-109": [
      "Preparing the use and maintenance manual",
      "Elaboració del manual d'ús i manteniment",
    ],
    "LIM-110": ["Six-month warranty visit", "Visita de garantia als sis mesos"],
    "VAR-101": [
      "Assistance and unforeseen work, tradesman hour",
      "Ajuts i treballs no previstos, hora d'oficial",
    ],
    "VAR-102": [
      "Assistance and unforeseen work, labourer hour",
      "Ajuts i treballs no previstos, hora de peó",
    ],
    "VAR-103": [
      "Carriage and delivery of materials to site",
      "Ports i transport de material a l'obra",
    ],
    "VAR-104": ["Small plant hire, per day", "Lloguer de maquinària menor per dia"],
    "VAR-105": ["Sundries and site consumables", "Material petit i consumibles d'obra"],
    "VAR-106": ["Fees and minor works permit", "Taxes i llicència d'obra menor"],
    "VAR-107": ["Technical design and site supervision", "Projecte tècnic i direcció d'obra"],
    "VAR-108": [
      "Topographic survey or measured drawings",
      "Estudi topogràfic o aixecament de plànols",
    ],
    "VAR-109": [
      "Utility management and meter connections",
      "Gestió de subministraments i altes de comptadors",
    ],
    "VAR-110": [
      "Site contingency, provisional sum to be substantiated",
      "Imprevistos d'obra, partida alçada a justificar",
    ],
  };

  return { CHAPTERS_EN: CHAPTERS_EN, DESC: DESC };
});

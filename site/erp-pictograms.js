/* =============================================================================
   Canei Subirats — line-drawn pictograms for the price book.

   WHY THESE ARE DRAWINGS AND NOT PHOTOGRAPHS. The operator asked for "a picture
   which represents the task … keep it simple and lean to avoid using super a
   lot of data". Two hundred and eight photographs is somewhere north of forty
   megabytes, and every one of them would have to be shot, licensed, stored,
   backed up and restored — for a thumbnail beside a line of a quote.

   A pictogram is a few dozen numbers. The whole set below is smaller than one
   photograph, costs nothing at runtime, and is legible at 14px on a phone and
   at 300dpi on paper, which no thumbnail is.

   IT IS ALSO THE ONLY THING THAT REACHES THE PDF. `site/erp-pdf.js` has no
   image support at all — it draws with PDF path operators, and its house mark
   says why: "Vector rather than an image so it stays crisp at any size and adds
   no bytes worth counting." A raster picture on a quote line would need an
   XObject pipeline, a colour space and a decoder that do not exist here. These
   shapes emit as the same path operators the mark already uses, so the drawing
   in the catalogue, the drawing in the quote builder and the drawing on the
   printed quote are one definition rendered three times, and cannot disagree.

   AND THEY ARE NOT UPLOADS. `ensureDemoImages` refuses to write invented
   pictures into the company's real attachment store, on the grounds that a
   fiction indistinguishable from a photograph of an actual wall is worse than
   no picture. These are not fictions about anyone's site: they are symbols, and
   they live in code rather than in the blob store, so nothing about them can
   ever be mistaken for evidence.

   THE COORDINATE SYSTEM. Every shape is drawn in a 0..1 box with **y pointing
   up**, which is PDF's convention; the SVG writer flips it once, on the way
   out. Ops are deliberately few — a line drawing needs no more:

     ["M", x, y]          move the pen
     ["L", x, y]          line to
     ["R", x, y, w, h]    rectangle
     ["C", cx, cy, r]     circle

   Stroked, never filled, one colour: that is the brand's own device, and it
   also means a shape cannot go wrong by being printed in greyscale.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ErpPictograms = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* --------------------------------------------------------------- shapes */
  /** Each entry is [spanish label, ops]. The label is what the drawing IS, used
   *  as the image's alt text and its tooltip — a picture with no name is
   *  unreachable to a screen reader and unsearchable to everyone else. */
  var SHAPES = {
    /* ---- access, safety, protection ---- */
    scaffold: [
      "andamio",
      [
        ["R", 0.14, 0.1, 0.72, 0.8],
        ["M", 0.14, 0.37],
        ["L", 0.86, 0.37],
        ["M", 0.14, 0.63],
        ["L", 0.86, 0.63],
        ["M", 0.5, 0.1],
        ["L", 0.5, 0.9],
      ],
    ],
    lift: [
      "plataforma elevadora",
      [
        ["R", 0.16, 0.72, 0.68, 0.18],
        ["M", 0.28, 0.72],
        ["L", 0.72, 0.34],
        ["M", 0.72, 0.72],
        ["L", 0.28, 0.34],
        ["R", 0.22, 0.12, 0.56, 0.22],
      ],
    ],
    helmet: [
      "seguridad",
      [
        ["M", 0.16, 0.42],
        ["L", 0.84, 0.42],
        ["M", 0.24, 0.42],
        ["L", 0.24, 0.6],
        ["L", 0.4, 0.78],
        ["L", 0.6, 0.78],
        ["L", 0.76, 0.6],
        ["L", 0.76, 0.42],
      ],
    ],
    floorprotect: [
      "protección de suelos",
      [
        ["R", 0.12, 0.2, 0.76, 0.42],
        ["M", 0.12, 0.62],
        ["L", 0.32, 0.84],
        ["L", 0.88, 0.84],
        ["L", 0.88, 0.62],
      ],
    ],

    /* ---- taking things apart, and taking them away ---- */
    demolition: [
      "demolición",
      [
        ["M", 0.2, 0.18],
        ["L", 0.6, 0.58],
        ["M", 0.5, 0.66],
        ["L", 0.72, 0.88],
        ["M", 0.44, 0.72],
        ["L", 0.66, 0.94],
        ["M", 0.44, 0.72],
        ["L", 0.72, 0.88],
        ["M", 0.12, 0.12],
        ["L", 0.28, 0.28],
      ],
    ],
    rubble: [
      "escombro",
      [
        ["M", 0.1, 0.24],
        ["L", 0.9, 0.24],
        ["R", 0.2, 0.24, 0.22, 0.18],
        ["R", 0.46, 0.24, 0.3, 0.26],
        ["R", 0.3, 0.5, 0.24, 0.2],
      ],
    ],
    skip: [
      "contenedor",
      [
        ["M", 0.1, 0.7],
        ["L", 0.9, 0.7],
        ["L", 0.78, 0.18],
        ["L", 0.22, 0.18],
        ["L", 0.1, 0.7],
        ["M", 0.16, 0.44],
        ["L", 0.84, 0.44],
      ],
    ],
    truck: [
      "retirada",
      [
        ["R", 0.08, 0.34, 0.5, 0.34],
        ["M", 0.58, 0.68],
        ["L", 0.78, 0.68],
        ["L", 0.92, 0.5],
        ["L", 0.92, 0.34],
        ["L", 0.58, 0.34],
        ["C", 0.26, 0.24, 0.1],
        ["C", 0.76, 0.24, 0.1],
      ],
    ],

    /* ---- walls ---- */
    brickwall: [
      "fábrica de ladrillo",
      [
        ["R", 0.1, 0.16, 0.8, 0.68],
        ["M", 0.1, 0.39],
        ["L", 0.9, 0.39],
        ["M", 0.1, 0.61],
        ["L", 0.9, 0.61],
        ["M", 0.36, 0.16],
        ["L", 0.36, 0.39],
        ["M", 0.64, 0.39],
        ["L", 0.64, 0.61],
        ["M", 0.36, 0.61],
        ["L", 0.36, 0.84],
      ],
    ],
    studwall: [
      "tabique de placa",
      [
        ["R", 0.12, 0.12, 0.76, 0.76],
        ["M", 0.34, 0.12],
        ["L", 0.34, 0.88],
        ["M", 0.5, 0.12],
        ["L", 0.5, 0.88],
        ["M", 0.66, 0.12],
        ["L", 0.66, 0.88],
      ],
    ],
    plaster: [
      "enfoscado y guarnecido",
      [
        ["R", 0.1, 0.5, 0.8, 0.36],
        ["M", 0.2, 0.42],
        ["L", 0.8, 0.42],
        ["L", 0.68, 0.26],
        ["L", 0.32, 0.26],
        ["L", 0.2, 0.42],
        ["M", 0.5, 0.26],
        ["L", 0.5, 0.12],
      ],
    ],

    /* ---- what goes behind and above ---- */
    insulation: [
      "aislamiento",
      [
        ["R", 0.1, 0.18, 0.8, 0.64],
        ["M", 0.1, 0.34],
        ["L", 0.9, 0.5],
        ["M", 0.1, 0.5],
        ["L", 0.9, 0.66],
        ["M", 0.1, 0.66],
        ["L", 0.9, 0.82],
      ],
    ],
    waterproof: [
      "impermeabilización",
      [
        ["M", 0.5, 0.9],
        ["L", 0.26, 0.5],
        ["L", 0.5, 0.16],
        ["L", 0.74, 0.5],
        ["L", 0.5, 0.9],
        ["M", 0.1, 0.1],
        ["L", 0.9, 0.1],
      ],
    ],
    roof: [
      "cubierta",
      [
        ["M", 0.06, 0.46],
        ["L", 0.5, 0.86],
        ["L", 0.94, 0.46],
        ["M", 0.18, 0.46],
        ["L", 0.18, 0.14],
        ["M", 0.82, 0.46],
        ["L", 0.82, 0.14],
        ["M", 0.18, 0.14],
        ["L", 0.82, 0.14],
      ],
    ],
    rooftile: [
      "teja",
      [
        ["M", 0.1, 0.32],
        ["L", 0.9, 0.32],
        ["M", 0.1, 0.54],
        ["L", 0.9, 0.54],
        ["M", 0.1, 0.76],
        ["L", 0.9, 0.76],
        ["M", 0.3, 0.32],
        ["L", 0.3, 0.76],
        ["M", 0.6, 0.32],
        ["L", 0.6, 0.76],
      ],
    ],
    gutter: [
      "canalón",
      [
        ["M", 0.1, 0.74],
        ["L", 0.9, 0.74],
        ["M", 0.1, 0.56],
        ["L", 0.9, 0.56],
        ["M", 0.1, 0.56],
        ["L", 0.1, 0.74],
        ["M", 0.74, 0.56],
        ["L", 0.74, 0.12],
      ],
    ],
    facade: [
      "fachada",
      [
        ["R", 0.14, 0.1, 0.72, 0.8],
        ["R", 0.26, 0.6, 0.18, 0.18],
        ["R", 0.56, 0.6, 0.18, 0.18],
        ["R", 0.26, 0.3, 0.18, 0.18],
        ["R", 0.56, 0.3, 0.18, 0.18],
      ],
    ],

    /* ---- surfaces underfoot and on the wall ---- */
    floortile: [
      "solado",
      [
        ["R", 0.1, 0.1, 0.36, 0.36],
        ["R", 0.54, 0.1, 0.36, 0.36],
        ["R", 0.1, 0.54, 0.36, 0.36],
        ["R", 0.54, 0.54, 0.36, 0.36],
      ],
    ],
    plank: [
      "tarima",
      [
        ["R", 0.08, 0.14, 0.84, 0.72],
        ["M", 0.08, 0.38],
        ["L", 0.92, 0.38],
        ["M", 0.08, 0.62],
        ["L", 0.92, 0.62],
        ["M", 0.44, 0.62],
        ["L", 0.44, 0.86],
        ["M", 0.6, 0.14],
        ["L", 0.6, 0.38],
      ],
    ],
    screed: [
      "solera y mortero",
      [
        ["R", 0.08, 0.2, 0.84, 0.26],
        ["M", 0.08, 0.56],
        ["L", 0.92, 0.56],
        ["M", 0.2, 0.56],
        ["L", 0.3, 0.78],
        ["M", 0.46, 0.56],
        ["L", 0.56, 0.78],
        ["M", 0.72, 0.56],
        ["L", 0.82, 0.78],
      ],
    ],
    walltile: [
      "alicatado",
      [
        ["R", 0.1, 0.14, 0.8, 0.72],
        ["M", 0.1, 0.38],
        ["L", 0.9, 0.38],
        ["M", 0.1, 0.62],
        ["L", 0.9, 0.62],
        ["M", 0.5, 0.14],
        ["L", 0.5, 0.86],
      ],
    ],
    falseceiling: [
      "falso techo",
      [
        ["M", 0.08, 0.82],
        ["L", 0.92, 0.82],
        ["M", 0.08, 0.62],
        ["L", 0.92, 0.62],
        ["M", 0.28, 0.62],
        ["L", 0.28, 0.82],
        ["M", 0.56, 0.62],
        ["L", 0.56, 0.82],
        ["C", 0.5, 0.32, 0.14],
      ],
    ],

    /* ---- water ---- */
    pipe: [
      "canalización",
      [
        ["M", 0.08, 0.7],
        ["L", 0.52, 0.7],
        ["L", 0.52, 0.24],
        ["L", 0.92, 0.24],
        ["M", 0.44, 0.62],
        ["L", 0.6, 0.62],
        ["M", 0.44, 0.78],
        ["L", 0.6, 0.78],
      ],
    ],
    tap: [
      "punto de agua",
      [
        ["M", 0.24, 0.24],
        ["L", 0.24, 0.62],
        ["L", 0.62, 0.62],
        ["L", 0.62, 0.48],
        ["M", 0.24, 0.74],
        ["L", 0.24, 0.62],
        ["M", 0.1, 0.74],
        ["L", 0.42, 0.74],
        ["M", 0.62, 0.36],
        ["L", 0.62, 0.24],
      ],
    ],
    drain: [
      "desagüe",
      [
        ["C", 0.5, 0.66, 0.28],
        ["M", 0.5, 0.38],
        ["L", 0.5, 0.1],
        ["M", 0.34, 0.66],
        ["L", 0.66, 0.66],
      ],
    ],
    boiler: [
      "caldera",
      [
        ["R", 0.2, 0.3, 0.6, 0.6],
        ["M", 0.32, 0.72],
        ["L", 0.68, 0.72],
        ["C", 0.38, 0.5, 0.06],
        ["M", 0.34, 0.3],
        ["L", 0.34, 0.14],
        ["M", 0.66, 0.3],
        ["L", 0.66, 0.14],
      ],
    ],
    toilet: [
      "inodoro",
      [
        ["R", 0.24, 0.6, 0.44, 0.3],
        ["M", 0.24, 0.6],
        ["L", 0.2, 0.34],
        ["L", 0.62, 0.34],
        ["L", 0.68, 0.6],
        ["M", 0.3, 0.34],
        ["L", 0.3, 0.14],
        ["M", 0.56, 0.34],
        ["L", 0.56, 0.14],
        ["M", 0.24, 0.14],
        ["L", 0.62, 0.14],
      ],
    ],
    basin: [
      "lavabo",
      [
        ["M", 0.12, 0.6],
        ["L", 0.88, 0.6],
        ["L", 0.76, 0.28],
        ["L", 0.24, 0.28],
        ["L", 0.12, 0.6],
        ["M", 0.5, 0.6],
        ["L", 0.5, 0.86],
        ["M", 0.38, 0.86],
        ["L", 0.62, 0.86],
      ],
    ],
    shower: [
      "plato de ducha",
      [
        ["R", 0.12, 0.12, 0.76, 0.4],
        ["C", 0.5, 0.32, 0.07],
        ["M", 0.74, 0.52],
        ["L", 0.74, 0.86],
        ["M", 0.6, 0.86],
        ["L", 0.88, 0.86],
      ],
    ],

    /* ---- current ---- */
    socket: [
      "mecanismo",
      [
        ["R", 0.16, 0.16, 0.68, 0.68],
        ["C", 0.38, 0.5, 0.07],
        ["C", 0.62, 0.5, 0.07],
      ],
    ],
    panel: [
      "cuadro eléctrico",
      [
        ["R", 0.12, 0.12, 0.76, 0.76],
        ["M", 0.24, 0.68],
        ["L", 0.34, 0.68],
        ["M", 0.44, 0.68],
        ["L", 0.54, 0.68],
        ["M", 0.64, 0.68],
        ["L", 0.74, 0.68],
        ["M", 0.12, 0.5],
        ["L", 0.88, 0.5],
      ],
    ],
    light: [
      "luminaria",
      [
        ["C", 0.5, 0.6, 0.24],
        ["M", 0.4, 0.36],
        ["L", 0.6, 0.36],
        ["M", 0.42, 0.24],
        ["L", 0.58, 0.24],
        ["M", 0.5, 0.84],
        ["L", 0.5, 0.96],
      ],
    ],
    cable: [
      "línea eléctrica",
      [
        ["M", 0.08, 0.3],
        ["L", 0.42, 0.3],
        ["L", 0.42, 0.62],
        ["L", 0.92, 0.62],
        ["M", 0.3, 0.7],
        ["L", 0.46, 0.42],
        ["L", 0.4, 0.42],
        ["L", 0.56, 0.16],
      ],
    ],

    /* ---- air ---- */
    acunit: [
      "climatización",
      [
        ["R", 0.1, 0.56, 0.8, 0.3],
        ["M", 0.16, 0.64],
        ["L", 0.84, 0.64],
        ["M", 0.28, 0.5],
        ["L", 0.28, 0.24],
        ["M", 0.5, 0.5],
        ["L", 0.5, 0.16],
        ["M", 0.72, 0.5],
        ["L", 0.72, 0.24],
      ],
    ],
    radiator: [
      "radiador",
      [
        ["R", 0.14, 0.16, 0.72, 0.68],
        ["M", 0.32, 0.16],
        ["L", 0.32, 0.84],
        ["M", 0.5, 0.16],
        ["L", 0.5, 0.84],
        ["M", 0.68, 0.16],
        ["L", 0.68, 0.84],
      ],
    ],
    duct: [
      "conducto",
      [
        ["R", 0.08, 0.34, 0.84, 0.32],
        ["M", 0.3, 0.34],
        ["L", 0.3, 0.66],
        ["M", 0.52, 0.34],
        ["L", 0.52, 0.66],
        ["M", 0.74, 0.34],
        ["L", 0.74, 0.66],
      ],
    ],

    /* ---- joinery and glass ---- */
    door: [
      "puerta",
      [
        ["R", 0.22, 0.08, 0.56, 0.84],
        ["C", 0.66, 0.48, 0.05],
        ["M", 0.3, 0.16],
        ["L", 0.3, 0.84],
      ],
    ],
    window: [
      "ventana",
      [
        ["R", 0.12, 0.14, 0.76, 0.72],
        ["M", 0.5, 0.14],
        ["L", 0.5, 0.86],
        ["M", 0.12, 0.5],
        ["L", 0.88, 0.5],
      ],
    ],
    glass: [
      "vidriería",
      [
        ["R", 0.16, 0.14, 0.68, 0.72],
        ["M", 0.26, 0.28],
        ["L", 0.6, 0.72],
        ["M", 0.46, 0.28],
        ["L", 0.74, 0.62],
      ],
    ],
    wardrobe: [
      "armario",
      [
        ["R", 0.16, 0.08, 0.68, 0.84],
        ["M", 0.5, 0.08],
        ["L", 0.5, 0.92],
        ["M", 0.42, 0.5],
        ["L", 0.42, 0.6],
        ["M", 0.58, 0.5],
        ["L", 0.58, 0.6],
      ],
    ],

    /* ---- kitchen ---- */
    kitchenunit: [
      "mueble de cocina",
      [
        ["R", 0.1, 0.1, 0.8, 0.44],
        ["M", 0.5, 0.1],
        ["L", 0.5, 0.54],
        ["R", 0.1, 0.66, 0.8, 0.24],
        ["M", 0.3, 0.66],
        ["L", 0.3, 0.9],
      ],
    ],
    countertop: [
      "encimera",
      [
        ["R", 0.06, 0.58, 0.88, 0.14],
        ["M", 0.16, 0.58],
        ["L", 0.16, 0.2],
        ["M", 0.84, 0.58],
        ["L", 0.84, 0.2],
        ["M", 0.16, 0.2],
        ["L", 0.84, 0.2],
      ],
    ],

    /* ---- finishing ---- */
    roller: [
      "pintura",
      [
        ["R", 0.14, 0.62, 0.5, 0.24],
        ["M", 0.39, 0.62],
        ["L", 0.39, 0.46],
        ["L", 0.7, 0.46],
        ["L", 0.7, 0.1],
        ["M", 0.62, 0.1],
        ["L", 0.78, 0.1],
      ],
    ],
    brush: [
      "brocha",
      [
        ["R", 0.36, 0.1, 0.28, 0.3],
        ["M", 0.36, 0.4],
        ["L", 0.64, 0.4],
        ["R", 0.44, 0.4, 0.12, 0.5],
      ],
    ],
    broom: [
      "limpieza",
      [
        ["M", 0.7, 0.94],
        ["L", 0.42, 0.42],
        ["M", 0.2, 0.34],
        ["L", 0.64, 0.34],
        ["L", 0.54, 0.5],
        ["L", 0.3, 0.5],
        ["L", 0.2, 0.34],
        ["M", 0.26, 0.34],
        ["L", 0.26, 0.14],
        ["M", 0.42, 0.34],
        ["L", 0.42, 0.14],
        ["M", 0.58, 0.34],
        ["L", 0.58, 0.14],
      ],
    ],

    /* ---- the ones that are not a trade: time, paper, permissions ----
       These are the "Varios" chapter, and they were the nine partidas that fell
       through to the generic box. Every one of them names a real thing — an
       hour of an oficial, a licence, a technical project, a meter connection —
       so every one of them can be drawn. A miscellaneous CHAPTER is not the
       same as a miscellaneous partida, and only the second deserves a box. */
    hours: [
      "horas de trabajo",
      [
        ["C", 0.5, 0.52, 0.36],
        ["M", 0.5, 0.52],
        ["L", 0.5, 0.76],
        ["M", 0.5, 0.52],
        ["L", 0.68, 0.44],
      ],
    ],
    tool: [
      "maquinaria menor",
      [
        ["C", 0.31, 0.72, 0.16],
        ["M", 0.42, 0.61],
        ["L", 0.82, 0.21],
        ["M", 0.7, 0.1],
        ["L", 0.9, 0.3],
        ["M", 0.7, 0.1],
        ["L", 0.82, 0.21],
        ["M", 0.9, 0.3],
        ["L", 0.82, 0.21],
      ],
    ],
    consumables: [
      "pequeño material",
      [
        ["R", 0.14, 0.16, 0.72, 0.5],
        ["M", 0.14, 0.66],
        ["L", 0.5, 0.86],
        ["L", 0.86, 0.66],
        ["M", 0.5, 0.86],
        ["L", 0.5, 0.16],
      ],
    ],
    permit: [
      "tasas y licencia",
      [
        ["R", 0.18, 0.1, 0.64, 0.8],
        ["M", 0.28, 0.74],
        ["L", 0.62, 0.74],
        ["M", 0.28, 0.62],
        ["L", 0.62, 0.62],
        ["C", 0.6, 0.32, 0.14],
      ],
    ],
    plans: [
      "proyecto y dirección",
      [
        ["R", 0.1, 0.18, 0.8, 0.62],
        ["M", 0.32, 0.18],
        ["L", 0.32, 0.8],
        ["M", 0.32, 0.56],
        ["L", 0.66, 0.56],
        ["M", 0.66, 0.56],
        ["L", 0.66, 0.3],
        ["M", 0.32, 0.3],
        ["L", 0.66, 0.3],
      ],
    ],
    survey: [
      "levantamiento",
      [
        ["R", 0.32, 0.68, 0.36, 0.16],
        ["M", 0.5, 0.68],
        ["L", 0.5, 0.56],
        ["M", 0.5, 0.56],
        ["L", 0.24, 0.1],
        ["M", 0.5, 0.56],
        ["L", 0.76, 0.1],
        ["M", 0.5, 0.56],
        ["L", 0.5, 0.1],
      ],
    ],
    meter: [
      "contador y suministro",
      [
        ["R", 0.16, 0.12, 0.68, 0.76],
        ["C", 0.5, 0.56, 0.2],
        ["M", 0.5, 0.56],
        ["L", 0.62, 0.68],
        ["M", 0.34, 0.26],
        ["L", 0.66, 0.26],
      ],
    ],
    contingency: [
      "partida alzada",
      [
        ["R", 0.14, 0.2, 0.72, 0.6],
        ["M", 0.14, 0.2],
        ["L", 0.86, 0.8],
        ["M", 0.3, 0.88],
        ["L", 0.7, 0.88],
      ],
    ],

    /* ---- the honest fallback ---- */
    generic: [
      "partida",
      [
        ["R", 0.14, 0.14, 0.72, 0.72],
        ["M", 0.14, 0.38],
        ["L", 0.86, 0.38],
      ],
    ],
  };

  /* --------------------------------------------------------- trade colour */
  /**
   * SIX COLOURS FOR TWENTY CHAPTERS, AND THAT IS THE DESIGN.
   *
   * Twenty categorical colours do not exist. Past about eight, any two of them
   * are a pair somebody cannot tell apart, and a plate list scrolls — so any
   * two can end up side by side, which is the all-pairs case and the hardest
   * one. Running the numbers rather than trusting an eye: the eight-slot
   * reference palette fails it outright (green↔orange at ΔE 3.2 for a protan
   * reader), and the largest subset that clears both floors is SIX.
   *
   * So colour groups the trades and the CODE names the partida. That is the
   * composite encoding the method asks for — identity is never colour alone —
   * and it is also how a price book is actually read: nobody identifies a
   * partida by its tint, they read DEM-101.
   *
   * Measured, light surface, all pairs:
   *   normal-vision worst  ΔE 15.6  (hard floor 15)
   *   CVD worst            ΔE  6.9  (6–8 band, legal WITH the code beside it)
   * Two hues sit under 3:1 against the surface, which obliges a visible label —
   * which is the code, on every plate, by construction.
   */
  var FAMILY = {
    // Getting in, taking out, taking away.
    AUX: "site",
    DEM: "site",
    RES: "site",
    // What holds the building up and divides it.
    ALB: "structure",
    TAB: "structure",
    AIS: "structure",
    // What keeps the weather out.
    CUB: "envelope",
    FAC: "envelope",
    VEN: "envelope",
    // Water in, water out.
    FON: "water",
    SAN: "water",
    // Current and air.
    ELE: "energy",
    CLI: "energy",
    // Everything the customer sees at the end.
    SOL: "finish",
    REV: "finish",
    PIN: "finish",
    CAR: "finish",
    COC: "finish",
    LIM: "finish",
    VAR: "finish",
  };
  var FAMILY_COLOUR = {
    site: "#2a78d6",
    structure: "#008300",
    envelope: "#4a3aa7",
    water: "#1baf7a",
    energy: "#e34948",
    finish: "#eda100",
  };
  var FAMILY_NAME = {
    site: "Obra y desmontaje",
    structure: "Estructura y particiones",
    envelope: "Envolvente",
    water: "Agua",
    energy: "Energía y aire",
    finish: "Acabados y remates",
  };
  /** The trade colour for a chapter code, or a neutral for one nobody mapped. */
  function colourFor(chapter) {
    return FAMILY_COLOUR[FAMILY[String(chapter || "").toUpperCase()]] || "#6b705c";
  }
  function familyFor(chapter) {
    return FAMILY[String(chapter || "").toUpperCase()] || "";
  }

  /* ------------------------------------------------------------- choosing */
  /* Keyword before chapter, longest match first.
     A chapter answers "what trade" and the description answers "what job", and
     the operator asked for the job. "Punto de agua" and "caldera mural" are both
     FON; drawing them the same would be a picture that carries no information,
     which is worse than none because it still takes the space and the eye. */
  var KEYWORDS = [
    ["andamio", "scaffold"],
    ["elevadora", "lift"],
    ["plataforma", "lift"],
    ["protecci", "floorprotect"],
    ["casco", "helmet"],
    ["seguridad", "helmet"],
    ["contenedor", "skip"],
    ["saco de escombro", "skip"],
    ["escombro", "rubble"],
    ["retirada", "truck"],
    ["transporte", "truck"],
    ["vertedero", "truck"],
    ["demolici", "demolition"],
    ["picado", "demolition"],
    ["desmontaje", "demolition"],
    ["apertura de hueco", "demolition"],
    ["ladrillo", "brickwall"],
    ["fábrica", "brickwall"],
    ["pladur", "studwall"],
    ["placa de yeso", "studwall"],
    ["trasdosado", "studwall"],
    ["tabique", "studwall"],
    ["falso techo", "falseceiling"],
    ["techo", "falseceiling"],
    ["enfoscado", "plaster"],
    ["guarnecido", "plaster"],
    ["enlucido", "plaster"],
    ["mortero", "screed"],
    ["solera", "screed"],
    ["recrecido", "screed"],
    ["aislamiento", "insulation"],
    ["lana", "insulation"],
    ["poliuretano", "insulation"],
    ["impermeabiliza", "waterproof"],
    ["lámina", "waterproof"],
    ["teja", "rooftile"],
    ["canalón", "gutter"],
    ["bajante", "drain"],
    ["cubierta", "roof"],
    ["fachada", "facade"],
    ["alicatado", "walltile"],
    ["azulejo", "walltile"],
    ["gres", "floortile"],
    ["porcelánico", "floortile"],
    ["pavimento", "floortile"],
    ["tarima", "plank"],
    ["parquet", "plank"],
    ["laminado", "plank"],
    ["rodapi", "plank"],
    ["punto de agua", "tap"],
    ["grifer", "tap"],
    ["grifo", "tap"],
    ["desag", "drain"],
    ["caldera", "boiler"],
    ["termo", "boiler"],
    ["inodoro", "toilet"],
    ["cisterna", "toilet"],
    ["lavabo", "basin"],
    ["bid", "basin"],
    ["ducha", "shower"],
    ["bañera", "shower"],
    ["mampara", "shower"],
    ["fontaner", "pipe"],
    ["tuber", "pipe"],
    ["cuadro", "panel"],
    ["mecanismo", "socket"],
    ["enchufe", "socket"],
    ["interruptor", "socket"],
    ["luminaria", "light"],
    ["foco", "light"],
    ["led", "light"],
    ["circuito", "cable"],
    ["cablead", "cable"],
    ["línea", "cable"],
    ["radiador", "radiator"],
    ["split", "acunit"],
    ["aire acondicionado", "acunit"],
    ["conducto", "duct"],
    ["ventilaci", "duct"],
    ["puerta", "door"],
    ["ventana", "window"],
    ["vidrio", "glass"],
    ["acristala", "glass"],
    ["armario", "wardrobe"],
    ["encimera", "countertop"],
    ["cocina", "kitchenunit"],
    ["mueble", "kitchenunit"],
    ["imprimaci", "roller"],
    ["pintura", "roller"],
    ["esmalte", "brush"],
    ["barniz", "brush"],
    ["limpieza", "broom"],
    ["remate", "broom"],
    ["hora de oficial", "hours"],
    ["hora de peón", "hours"],
    ["ayudas", "hours"],
    ["maquinaria menor", "tool"],
    ["alquiler de maquinaria", "tool"],
    ["consumible", "consumables"],
    ["pequeño material", "consumables"],
    ["licencia", "permit"],
    ["tasas", "permit"],
    ["proyecto técnico", "plans"],
    ["dirección de obra", "plans"],
    ["topográfico", "survey"],
    ["levantamiento", "survey"],
    ["contador", "meter"],
    ["suministro", "meter"],
    ["partida alzada", "contingency"],
    ["imprevisto", "contingency"],
    /* Chapter HEADINGS, which name a trade rather than a job. A quote line
       often carries no words of its own and leans entirely on the heading
       above it, so these have to be here as well as in BY_CHAPTER — the code
       is only available where a price book is, and a printed quote has none. */
    ["electricidad", "socket"],
    ["carpinter", "door"],
    ["albañiler", "brickwall"],
    ["albaniler", "brickwall"],
    ["climatizaci", "acunit"],
    ["calefacci", "radiator"],
    ["solado", "floortile"],
    ["revestimiento", "walltile"],
    ["acabado", "roller"],
    ["trabajos previos", "demolition"],
    ["medios auxiliares", "scaffold"],
    ["residuo", "skip"],
    ["gas", "pipe"],
    ["mobiliario", "kitchenunit"],
    ["sanitario", "basin"],
    ["vidrier", "glass"],
    ["ventilaci", "duct"],
  ];

  /** Chapter code → the drawing that stands for the whole trade. */
  var BY_CHAPTER = {
    AUX: "scaffold",
    DEM: "demolition",
    RES: "skip",
    ALB: "brickwall",
    TAB: "studwall",
    AIS: "insulation",
    CUB: "roof",
    FAC: "facade",
    SOL: "floortile",
    REV: "walltile",
    FON: "pipe",
    SAN: "basin",
    ELE: "socket",
    CLI: "acunit",
    CAR: "door",
    VEN: "window",
    PIN: "roller",
    COC: "kitchenunit",
    LIM: "broom",
    VAR: "generic",
  };

  /** Longest keyword first, computed once: "punto de agua" must be tried before
   *  "agua" would be, and "falso techo" before "techo". Sorting here rather than
   *  demanding the table above be kept in length order — a rule the table cannot
   *  enforce is a rule that breaks the first time somebody appends a row. */
  var ORDERED = KEYWORDS.slice().sort(function (a, b) {
    return b[0].length - a[0].length;
  });

  /**
   * The drawing for a price-book entry: its job if we can name it, its trade if
   * we cannot, and `generic` if it has neither. Never empty — a missing picture
   * in a column of pictures reads as a broken row, not as an absent one.
   */
  /* ACCENTS STRIPPED FROM BOTH SIDES.
     The document fixtures spell their chapters "Demolicion" and "Fontaneria"
     because the PDF writer's font is Latin-1 and the text is transliterated on
     the way in; the price book spells them "Demolición" and "Fontanería". Two
     spellings of one word matched nothing on one side and everything on the
     other, which showed up as a page of identical boxes. Normalising here means
     the table below can be written the way Spanish is written and still match
     text that has been through a transliterator. */
  function fold(s) {
    s = String(s || "").toLowerCase();
    return s.normalize ? s.normalize("NFD").replace(/[̀-ͯ]/g, "") : s;
  }
  var FOLDED = ORDERED.map(function (r) {
    return [fold(r[0]), r[1], r[0].length];
  });

  /**
   * The first thing the text mentions, not the longest word in it.
   *
   * "Limpieza y retirada" is a chapter about cleaning that ends with a lorry,
   * and "Carpintería y vidrio" is joinery that also does glass — in both, the
   * subject is what comes first. Ranking by keyword length alone drew the lorry
   * and the pane. Length only breaks a tie at the same position, so "falso
   * techo" still beats "techo" where they start together.
   */
  function match(text) {
    var hay = fold(text);
    if (!hay) return "";
    var bestAt = Infinity,
      bestLen = -1,
      best = "";
    for (var i = 0; i < FOLDED.length; i++) {
      var at = hay.indexOf(FOLDED[i][0]);
      if (at === -1) continue;
      if (at < bestAt || (at === bestAt && FOLDED[i][2] > bestLen)) {
        bestAt = at;
        bestLen = FOLDED[i][2];
        best = FOLDED[i][1];
      }
    }
    return best;
  }

  /**
   * The drawing for a price-book entry or a quote line, in four steps:
   *
   *   1. an explicit `pictogram`, if anyone ever sets one;
   *   2. the words of the partida itself — the job;
   *   3. the words of the CHAPTER it sits under — the trade;
   *   4. the chapter CODE, for a price book that has one.
   *
   * Step 3 is not decoration. A real quote line often reads "Partida 3" or
   * "Ayudas" and leans entirely on the heading above it for its meaning, and
   * without this every such line drew the same box — which is what the first
   * rendering of the quote showed, and the reason to look at the page rather
   * than at the count of marks the gate reported.
   *
   * Never empty: a missing picture in a column of pictures reads as a broken
   * row, not as an absent one.
   */
  function pick(item) {
    if (!item) return "generic";
    if (item.pictogram && SHAPES[item.pictogram]) return item.pictogram;
    return (
      match(String(item.desc || "") + " " + String(item.customerWording || "")) ||
      match(item.chapterName) ||
      BY_CHAPTER[String(item.chapter || "").toUpperCase()] ||
      "generic"
    );
  }

  function shape(key) {
    return SHAPES[key] || SHAPES.generic;
  }
  /** What the drawing depicts, in words. Alt text, tooltip, and the label the
   *  catalogue editor shows beside the picture. */
  function label(key) {
    return shape(key)[0];
  }
  function keys() {
    return Object.keys(SHAPES);
  }

  /* --------------------------------------------------------------- plates */
  /**
   * The drawing as a small COLOURED plate carrying its own code.
   *
   * Asked for so the operator can tell at a glance that the picture on a line
   * is the right one. A 16px monochrome mark could be checked only by knowing
   * every shape; a tinted plate that says "DEM-101" underneath can be checked
   * by reading it.
   *
   * The tint is the trade family and the CODE is the identity — see the note on
   * FAMILY above for why it cannot be the other way round. The drawing is
   * stroked in the family colour at full strength on a 12%-alpha wash of the
   * same hue, so the plate reads as one object and stays legible in greyscale,
   * which is how half of these will be printed.
   */
  function plate(key, code, chapter, size, opts) {
    var o = opts || {};
    var s = shape(key);
    var col = colourFor(chapter);
    var px = size || 34;
    var box = plateOps(s[1]);
    return (
      '<span class="plate" style="--plate:' +
      col +
      '" title="' +
      esc(String(code || "") + " · " + s[0]) +
      '">' +
      '<svg viewBox="0 0 1 1" width="' +
      px +
      '" height="' +
      px +
      '" fill="none" role="img" aria-label="' +
      esc(String(code || "") + " · " + s[0]) +
      '">' +
      "<title>" +
      esc(String(code || "") + " · " + s[0]) +
      "</title>" +
      box +
      "</svg>" +
      (o.code === false ? "" : '<b class="platec">' + esc(String(code || "")) + "</b>") +
      "</span>"
    );
  }
  function esc(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /* The drawing inset inside the plate, so the stroke never touches the edge —
     a line drawing that runs into its own border reads as a broken box. */
  function plateOps(ops) {
    var d = [];
    var extra = [];
    var INSET = 0.16;
    var X = function (v) {
      return n2(INSET + v * (1 - 2 * INSET));
    };
    var Y = function (v) {
      return n2(1 - (INSET + v * (1 - 2 * INSET)));
    };
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op[0] === "M") d.push("M" + X(op[1]) + " " + Y(op[2]));
      else if (op[0] === "L") d.push("L" + X(op[1]) + " " + Y(op[2]));
      else if (op[0] === "R")
        extra.push(
          '<rect x="' +
            X(op[1]) +
            '" y="' +
            Y(op[2] + op[4]) +
            '" width="' +
            n2(op[3] * (1 - 2 * INSET)) +
            '" height="' +
            n2(op[4] * (1 - 2 * INSET)) +
            '"/>',
        );
      else if (op[0] === "C")
        extra.push(
          '<circle cx="' +
            X(op[1]) +
            '" cy="' +
            Y(op[2]) +
            '" r="' +
            n2(op[3] * (1 - 2 * INSET)) +
            '"/>',
        );
    }
    return (
      '<rect x="0" y="0" width="1" height="1" rx="0.18" fill="var(--plate)" fill-opacity="0.12"/>' +
      '<g stroke="var(--plate)" stroke-width="0.062" stroke-linecap="round" stroke-linejoin="round">' +
      (d.length ? '<path d="' + d.join(" ") + '"/>' : "") +
      extra.join("") +
      "</g>"
    );
  }

  /* ------------------------------------------------------------- rendering */
  var n2 = function (v) {
    return Math.round(v * 100) / 100;
  };

  /**
   * Inline SVG. No <img>, no data: URI, no request — the marks are part of the
   * document, so they inherit `currentColor` and cost nothing to fetch.
   *
   * `y` is flipped here and ONLY here: the shapes are authored in PDF's
   * coordinate system, and one flip on the way out is cheaper to keep true than
   * two sets of coordinates that must be edited together.
   */
  function svg(key, size, opts) {
    var o = opts || {};
    var s = shape(key),
      ops = s[1];
    var d = [];
    var extra = [];
    var Y = function (v) {
      return n2(1 - v);
    };
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op[0] === "M") d.push("M" + n2(op[1]) + " " + Y(op[2]));
      else if (op[0] === "L") d.push("L" + n2(op[1]) + " " + Y(op[2]));
      else if (op[0] === "R")
        extra.push(
          '<rect x="' +
            n2(op[1]) +
            '" y="' +
            Y(op[2] + op[4]) +
            '" width="' +
            n2(op[3]) +
            '" height="' +
            n2(op[4]) +
            '"/>',
        );
      else if (op[0] === "C")
        extra.push('<circle cx="' + n2(op[1]) + '" cy="' + Y(op[2]) + '" r="' + n2(op[3]) + '"/>');
    }
    var px = size || 18;
    return (
      '<svg class="pict" viewBox="0 0 1 1" width="' +
      px +
      '" height="' +
      px +
      '" fill="none" stroke="' +
      (o.colour || "currentColor") +
      '" stroke-width="' +
      (o.weight || 0.075) +
      '" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' +
      String(s[0]).replace(/"/g, "&quot;") +
      '"><title>' +
      String(s[0]).replace(/</g, "&lt;") +
      "</title>" +
      (d.length ? '<path d="' + d.join(" ") + '"/>' : "") +
      extra.join("") +
      "</svg>"
    );
  }

  /* A circle as four cubic beziers. PDF has no circle operator, and this is the
     constant every drawing program uses for the job. */
  var K = 0.5522847498;

  /**
   * A PDF content-stream fragment, stroked in the colour given as an `RG`
   * prefix (e.g. "0.19 0.44 0.18 RG"). Placed at (x, y) — the BOTTOM-left, PDF's
   * origin — and scaled to `size` points. No graphics state is left behind: the
   * caller's line width and colour are restored with q/Q, because a pictogram
   * that quietly changes the stroke of everything drawn after it is a bug that
   * shows up three sections down the page.
   */
  function pdfOps(key, x, y, size, rg, bare) {
    var ops = shape(key)[1];
    // `bare` leaves the q/Q off, for a caller that is already inside its own
    // saved state — the plate wraps the ground and the drawing together, so
    // one plate is ONE saved-state block and can be counted as one.
    var out =
      (bare ? "" : "q\n") + (rg || "0.4 0.4 0.4 RG") + " " + n2(size * 0.075) + " w 1 J 1 j\n";
    var X = function (v) {
      return n2(x + v * size);
    };
    var Y = function (v) {
      return n2(y + v * size);
    };
    var open = false;
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op[0] === "M") {
        if (open) out += "S\n";
        out += X(op[1]) + " " + Y(op[2]) + " m\n";
        open = true;
      } else if (op[0] === "L") {
        out += X(op[1]) + " " + Y(op[2]) + " l\n";
      } else if (op[0] === "R") {
        if (open) {
          out += "S\n";
          open = false;
        }
        out +=
          X(op[1]) + " " + Y(op[2]) + " " + n2(op[3] * size) + " " + n2(op[4] * size) + " re S\n";
      } else if (op[0] === "C") {
        if (open) {
          out += "S\n";
          open = false;
        }
        var cx = op[1],
          cy = op[2],
          r = op[3],
          k = r * K;
        out +=
          X(cx + r) +
          " " +
          Y(cy) +
          " m\n" +
          X(cx + r) +
          " " +
          Y(cy + k) +
          " " +
          X(cx + k) +
          " " +
          Y(cy + r) +
          " " +
          X(cx) +
          " " +
          Y(cy + r) +
          " c\n" +
          X(cx - k) +
          " " +
          Y(cy + r) +
          " " +
          X(cx - r) +
          " " +
          Y(cy + k) +
          " " +
          X(cx - r) +
          " " +
          Y(cy) +
          " c\n" +
          X(cx - r) +
          " " +
          Y(cy - k) +
          " " +
          X(cx - k) +
          " " +
          Y(cy - r) +
          " " +
          X(cx) +
          " " +
          Y(cy - r) +
          " c\n" +
          X(cx + k) +
          " " +
          Y(cy - r) +
          " " +
          X(cx + r) +
          " " +
          Y(cy - k) +
          " " +
          X(cx + r) +
          " " +
          Y(cy) +
          " c\nS\n";
      }
    }
    if (open) out += "S\n";
    return out + (bare ? "" : "Q\n");
  }

  /** "#rrggbb" → "r g b" in PDF's 0..1 space. */
  function rgbOf(hex) {
    var h = String(hex).replace("#", "");
    return (
      n2(parseInt(h.slice(0, 2), 16) / 255) +
      " " +
      n2(parseInt(h.slice(2, 4), 16) / 255) +
      " " +
      n2(parseInt(h.slice(4, 6), 16) / 255)
    );
  }
  /**
   * The plate as a PDF fragment: a tinted rounded ground with the drawing on
   * it, both in the trade's colour.
   *
   * The wash is drawn as a light tint of the same hue rather than a grey, so a
   * colour reader gets the family at a glance and a greyscale printer still
   * gets a legible line drawing on a pale ground. No alpha: PDF transparency
   * needs an ExtGState and this writer has none, so the tint is mixed against
   * white here — which is what the paper is anyway.
   */
  function pdfPlate(key, chapter, x, y, size) {
    var hex = colourFor(chapter);
    var h = String(hex).replace("#", "");
    var mix = function (i) {
      var c = parseInt(h.slice(i, i + 2), 16) / 255;
      return n2(c * 0.12 + 1 * 0.88); // 12% of the hue over white
    };
    var out = "q\n";
    // The ground. A plain rectangle: a rounded one costs four beziers for a
    // corner nobody reads at twelve points.
    out +=
      mix(0) +
      " " +
      mix(2) +
      " " +
      mix(4) +
      " rg\n" +
      n2(x) +
      " " +
      n2(y) +
      " " +
      n2(size) +
      " " +
      n2(size) +
      " re f\n";
    // …and the drawing on it, inset so the stroke never touches the edge.
    var inset = size * 0.16;
    out += pdfOps(key, x + inset, y + inset, size - 2 * inset, rgbOf(hex) + " RG", true);
    return out + "Q\n";
  }

  return {
    SHAPES: SHAPES,
    BY_CHAPTER: BY_CHAPTER,
    FAMILY: FAMILY,
    FAMILY_COLOUR: FAMILY_COLOUR,
    FAMILY_NAME: FAMILY_NAME,
    colourFor: colourFor,
    familyFor: familyFor,
    plate: plate,
    pdfPlate: pdfPlate,
    pick: pick,
    shape: shape,
    label: label,
    keys: keys,
    svg: svg,
    pdfOps: pdfOps,
  };
});

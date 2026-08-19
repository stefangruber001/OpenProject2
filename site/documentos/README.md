# CaneiSubirats — documentos del ERP · versión 2

Rediseño completo de los 20 documentos sobre la **Identitat Visual CaneiSubirats
(maig 2026)** y su design system. Misma información, mismos campos legales,
misma estructura de carpetas (nombres sin paréntesis: `01-cliente`,
`02-proveedor`, `03-gestoria`, `04-interno`).

## Qué ha cambiado

- **Marca real**: símbolo de la casa (vector oficial, inline SVG) + wordmark
  "CaneiSubirats" en Roboto Serif 400 + tagline en ExtraLight verde. El logo
  aparece una vez, arriba, a tamaño moderado.
- **Registro de imprenta**: esquinas rectas, blanco dominante, verde como
  tinta (nunca como relleno grande), filete verde en el pie legal.
- **Bandas de color por audiencia** (el dispositivo de la papelería):
  azul pálido = cliente · amarillo = cobros y momentos clave · gris = proveedor
  / gestoría / interno. Texto siempre en negro sobre banda (contraste AA).
- **Cifras protagonistas**: franja de datos clave bajo el título — total,
  vencimiento, IBAN — en Roboto Serif tabular. El símbolo pequeño en amarillo
  actúa de signo de puntuación junto a la cifra principal (dispositivo de marca).
- **Gráficos lean e imprimibles**: barra de distribución por partidas
  (presupuesto), barras de avance (certificación), línea de hitos de pago
  (contrato), barras de margen (ficha de proyecto). Tinta mínima, sin librerías.
- **Formato es-ES corregido**: 1.109,30 € (antes 1109,30 €) en todo el conjunto.
- **Marca de agua**: símbolo sobredimensionado en gris claro, recortado por la
  esquina superior — solo en documentos con aire (índice, contrato, acta…).
- **Emails** con chrome De/Para/Asunto, resumen de importes, IBAN destacado y
  botón verde corporativo.

## Tipografía

Roboto Serif (variable) + Inter desde Google Fonts, **con fallbacks**: si la red
falla, caen a Georgia / system-ui y el documento sigue siendo correcto.
Para producción sin red: autohospedar los woff2 del design system
(`assets/fonts/roboto-serif-*.woff2`).

## Impresión

Cada archivo mantiene `@page { size: A4 }` y su hoja de estilos de impresión
(cortes de página controlados: las filas, cajas y firmas no se parten).
El presupuesto sigue ocupando 2–3 páginas según partidas; el resto, una.

## Producción

Los campos con datos de ejemplo son los mismos del conjunto v1 — el generador
(`tools/doc-templates/build.mjs`) puede sustituirlos por variables sin tocar
la maquetación. Idiomas: los textos crecen ~15–20 % en catalán/inglés; las
rejillas usan anchos flexibles para absorberlo.

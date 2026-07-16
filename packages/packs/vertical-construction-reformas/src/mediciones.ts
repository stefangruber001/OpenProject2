import { toMillis, type Millis } from "@repo/kernel";

/**
 * Medición: the dimensional breakdown behind a partida's quantity —
 * units × length × width × height, any factor optional. Construction
 * vocabulary lives HERE (vertical pack), never in capabilities.
 */
export interface Medicion {
  descripcion?: string;
  unidades: number;
  largo?: number;
  ancho?: number;
  alto?: number;
}

export function medicionQtyMillis(m: Medicion): Millis {
  return toMillis(m.unidades * (m.largo ?? 1) * (m.ancho ?? 1) * (m.alto ?? 1));
}

export function totalQtyMillis(mediciones: readonly Medicion[]): Millis {
  return mediciones.reduce((acc, m) => acc + medicionQtyMillis(m), 0);
}

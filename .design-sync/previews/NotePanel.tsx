import { NotePanel } from "@repo/ui";

export const Tones = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 460 }}>
    <NotePanel>
      Nada sale del sistema sin revisión: los correos se envían solo con su visto bueno.
    </NotePanel>
    <NotePanel tone="warn">3 precios del catálogo llevan más de 90 días sin actualizar.</NotePanel>
    <NotePanel tone="danger">La factura FAC-2026-0006 lleva 12 días vencida.</NotePanel>
  </div>
);

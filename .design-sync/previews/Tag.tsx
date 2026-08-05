import { Tag } from "@repo/ui";

export const Tones = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <Tag>Cobrada</Tag>
    <Tag tone="neutral">Borrador</Tag>
    <Tag tone="warn">Parcial</Tag>
    <Tag tone="danger">Vencida</Tag>
    <Tag tone="spark">Nueva</Tag>
  </div>
);

export const InContext = () => (
  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
    <span style={{ font: "600 13px Inter, system-ui, sans-serif", color: "#14160f" }}>
      FAC-2026-0006
    </span>
    <Tag tone="danger">Vencida · 12 días</Tag>
  </div>
);

import { StatTile } from "@repo/ui";

export const Highlight = () => (
  <div style={{ width: 220 }}>
    <StatTile
      label="Proyectos activos"
      value="12"
      sub="margen previsto 48.200 €"
      variant="highlight"
    />
  </div>
);

export const Default = () => (
  <div style={{ width: 220 }}>
    <StatTile label="Pendiente de cobro" value="23.640 €" sub="de 148.900 € facturados" />
  </div>
);

export const Warn = () => (
  <div style={{ width: 220 }}>
    <StatTile label="Alertas" value="3" sub="2 críticas · 1 alta" variant="warn" />
  </div>
);

export const DashboardRow = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 200px)", gap: 11 }}>
    <StatTile label="Proyectos activos" value="12" sub="obras en curso" variant="highlight" />
    <StatTile label="Caja y bancos" value="61.450 €" sub="posición actual" />
    <StatTile label="Facturado" value="148.900 €" sub="este ejercicio" />
    <StatTile label="Alertas" value="3" sub="requieren atención" variant="warn" />
  </div>
);

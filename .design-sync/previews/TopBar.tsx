import { TopBar, Button, Tag } from "@repo/ui";

export const Home = () => (
  <div style={{ width: 900, padding: 12, background: "#eef3ea" }}>
    <TopBar subtitle="Plataforma de gestión">
      <span style={{ fontSize: 12, color: "#8b8f80" }}>martes, 28 de julio</span>
      <Button variant="primary">Abrir torre de control →</Button>
    </TopBar>
  </div>
);

export const Workspace = () => (
  <div style={{ width: 900, padding: 12, background: "#eef3ea" }}>
    <TopBar subtitle="ERP · un único entorno">
      <Tag>Datos al día</Tag>
      <Button size="sm">⤓ Exportar</Button>
    </TopBar>
  </div>
);

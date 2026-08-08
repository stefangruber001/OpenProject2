import { Card, Tag, ListItem } from "@repo/ui";

export const WithTitle = () => (
  <div style={{ width: 420 }}>
    <Card title="Identificación" aside={<Tag>✓ completa para facturar</Tag>}>
      <div className="cnx-list">
        <ListItem>
          NIF/CIF: <b>12345678Z</b> · Particular
        </ListItem>
        <ListItem>Dirección: C/ Mallorca 21, 08029 Barcelona</ListItem>
        <ListItem>Condiciones: transferencia · 30 días</ListItem>
      </div>
    </Card>
  </div>
);

export const Plain = () => (
  <div style={{ width: 420 }}>
    <Card>
      <p style={{ margin: 0 }}>
        Un único entorno — nada se escribe dos veces. Cada indicador abre su detalle.
      </p>
    </Card>
  </div>
);

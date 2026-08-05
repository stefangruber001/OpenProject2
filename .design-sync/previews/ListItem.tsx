import { ListItem } from "@repo/ui";

export const DayPanel = () => (
  <div className="cnx-list" style={{ width: 380 }}>
    <ListItem strong="3">visitas pendientes</ListItem>
    <ListItem strong="2">extras por valorar</ListItem>
    <ListItem strong="1" danger>
      factura vencida por reclamar
    </ListItem>
    <ListItem strong="4">documentos por validar</ListItem>
  </div>
);

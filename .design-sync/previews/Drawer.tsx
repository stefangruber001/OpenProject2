import { Drawer, Card, Field, Input, Select, Button, Tag } from "@repo/ui";

export const PartyEditor = () => (
  <div style={{ height: 480, display: "flex", justifyContent: "flex-end", background: "#eef3ea" }}>
    <Drawer title="Editar — Familia Roca">
      <Card title="Identificación" aside={<Tag>✓ completa</Tag>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Nombre o razón social *">
            <Input defaultValue="Familia Roca" />
          </Field>
          <Field label="NIF / CIF *">
            <Input defaultValue="12345678Z" />
          </Field>
          <Field label="Forma de pago">
            <Select options={["Transferencia", "Tarjeta", "Efectivo"]} />
          </Field>
          <Field label="Plazo (días)">
            <Input type="number" defaultValue="30" />
          </Field>
        </div>
      </Card>
      <Button variant="primary">Guardar cambios</Button>
    </Drawer>
  </div>
);

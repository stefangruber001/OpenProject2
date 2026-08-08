import { Button } from "@repo/ui";

export const Primary = () => <Button variant="primary">Guardar cambios</Button>;

export const Variants = () => (
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <Button>Editar datos</Button>
    <Button variant="primary">Emitir factura</Button>
    <Button variant="danger">Anular pago</Button>
    <Button variant="ghost">Ver detalle</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
    <Button variant="primary">Registrar cobro</Button>
    <Button variant="primary" size="sm">
      Reclamar
    </Button>
    <Button size="sm">Exportar</Button>
  </div>
);

export const Disabled = () => (
  <Button variant="primary" disabled>
    Emitir factura
  </Button>
);

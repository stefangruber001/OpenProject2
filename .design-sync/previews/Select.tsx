import { Select } from "@repo/ui";

export const Options = () => (
  <div style={{ width: 280 }}>
    <Select options={["Transferencia", "Tarjeta", "Efectivo", "Recibo domiciliado"]} />
  </div>
);

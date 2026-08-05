import { Input } from "@repo/ui";

export const Text = () => (
  <div style={{ width: 280 }}>
    <Input placeholder="Buscar cliente o NIF…" />
  </div>
);

export const Filled = () => (
  <div style={{ width: 280 }}>
    <Input defaultValue="ES91 2100 0418 4502 0005 1332" />
  </div>
);

export const DateType = () => (
  <div style={{ width: 280 }}>
    <Input type="date" defaultValue="2026-07-28" />
  </div>
);

import { ModuleCard } from "@repo/ui";

export const Default = () => (
  <div style={{ width: 250 }}>
    <ModuleCard
      icon="👥"
      title="Clientes"
      description="Registro único de terceros con datos fiscales validados."
      live="5 clientes"
    />
  </div>
);

export const AlertState = () => (
  <div style={{ width: 250 }}>
    <ModuleCard
      icon="🏦"
      title="Pagos, banco y caja"
      description="Asigna un movimiento a su obra tecleando el nº de proyecto."
      live="2 movimientos sin asignar"
      liveAlert
    />
  </div>
);

export const Tower = () => (
  <div style={{ width: 520 }}>
    <ModuleCard
      icon="📊"
      title="Torre de control"
      description="Toda la empresa de un vistazo: obras, avance, margen, facturado, cobrado, pagos, caja y alertas."
      live="Indicadores en vivo"
      variant="tower"
    />
  </div>
);

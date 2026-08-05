import { Toast } from "@repo/ui";

export const Confirm = () => <Toast>Datos actualizados</Toast>;

export const Danger = () => (
  <Toast tone="danger">No se pudo guardar: el tercero necesita al menos un rol</Toast>
);

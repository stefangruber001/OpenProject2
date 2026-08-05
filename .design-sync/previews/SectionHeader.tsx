import { SectionHeader } from "@repo/ui";

export const Default = () => (
  <SectionHeader title="Áreas de gestión" hint="un único entorno — nada se escribe dos veces" />
);

export const NoHint = () => <SectionHeader title="Mi día" />;

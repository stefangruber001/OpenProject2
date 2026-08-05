import { LogoMark } from "@repo/ui";

export const Sizes = () => (
  <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
    <LogoMark size={64} />
    <LogoMark size={40} />
    <LogoMark size={24} />
  </div>
);

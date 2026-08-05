import { Field, Input, Select } from "@repo/ui";

export const TextField = () => (
  <div style={{ width: 300 }}>
    <Field label="Nombre o razón social *">
      <Input placeholder="p. ej. Familia Roca" />
    </Field>
  </div>
);

export const SelectField = () => (
  <div style={{ width: 300 }}>
    <Field label="Línea de actividad">
      <Select options={["Reforma", "Reparaciones", "Humedades", "Comercial"]} />
    </Field>
  </div>
);

export const FormRow = () => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, width: 460 }}>
    <Field label="C.P. *">
      <Input defaultValue="08960" />
    </Field>
    <Field label="Población *">
      <Input defaultValue="Sant Just Desvern" />
    </Field>
  </div>
);

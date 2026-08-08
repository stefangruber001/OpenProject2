import type { ReactNode, ChangeEventHandler } from "react";

export interface FieldProps {
  /** Uppercase micro-label above the control. */
  label: string;
  children: ReactNode;
}

/** Labelled form row — wrap an Input or Select in it. */
export const Field = ({ label, children }: FieldProps) => (
  <label className="cnx-field">
    <span className="cnx-field__label">{label}</span>
    {children}
  </label>
);

export interface InputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  type?: "text" | "number" | "date" | "email";
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

/** Text input in the Canei form style (green focus ring). */
export const Input = ({
  value,
  defaultValue,
  placeholder,
  type = "text",
  disabled,
  onChange,
}: InputProps) => (
  <input
    className="cnx-input"
    type={type}
    value={value}
    defaultValue={defaultValue}
    placeholder={placeholder}
    disabled={disabled}
    onChange={onChange}
  />
);

export interface SelectProps {
  /** Options as visible labels; pair with `values` when they differ. */
  options: string[];
  values?: string[];
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
}

/** Select in the Canei form style. */
export const Select = ({
  options,
  values,
  value,
  defaultValue,
  disabled,
  onChange,
}: SelectProps) => (
  <select
    className="cnx-select"
    value={value}
    defaultValue={defaultValue}
    disabled={disabled}
    onChange={onChange}
  >
    {options.map((label, i) => (
      <option key={label} value={values ? values[i] : label}>
        {label}
      </option>
    ))}
  </select>
);

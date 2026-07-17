import { z } from "zod";

/**
 * Access control is generic: roles carry permission strings, members hold
 * roles, and a check answers whether a person may perform an action. Permission
 * names are opaque (e.g. "quote.issue"); "*" grants everything.
 */
export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Member {
  id: string;
  personRef: string;
  roleIds: string[];
}

export interface Directory {
  roles: Role[];
  members: Member[];
}

export const accessConfigSchema = z
  .object({
    /** Seed roles as data (name → permissions), e.g. owner/admin/field. */
    roles: z.record(z.array(z.string())).default({}),
  })
  .default({});
export type AccessConfig = z.infer<typeof accessConfigSchema>;

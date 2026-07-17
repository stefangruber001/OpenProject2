import { FactoryError, type IdGenPort } from "@repo/kernel";
import type { AccessConfig, Directory, Member, Role } from "./model";

export interface AccessDeps {
  idGen: IdGenPort;
  config: AccessConfig;
}

/**
 * Access engine. Define roles (or seed them from config data), assign roles to
 * members, and check permissions. A role with "*" grants everything. Who-did-
 * what/when auditing is the kernel's append-only event log, not this capability.
 */
export class AccessService {
  constructor(private readonly deps: AccessDeps) {}

  /** Directory seeded from config.roles (name → permissions). */
  seed(): Directory {
    const roles: Role[] = Object.entries(this.deps.config.roles).map(([name, permissions]) => ({
      id: this.deps.idGen.next("role"),
      name,
      permissions,
    }));
    return { roles, members: [] };
  }

  addRole(dir: Directory, name: string, permissions: string[]): Directory {
    if (dir.roles.some((r) => r.name === name)) {
      throw new FactoryError("INVALID_STATE", `Role "${name}" already exists.`);
    }
    const role: Role = { id: this.deps.idGen.next("role"), name, permissions };
    return { ...dir, roles: [...dir.roles, role] };
  }

  assign(dir: Directory, personRef: string, roleName: string): Directory {
    const role = dir.roles.find((r) => r.name === roleName);
    if (!role) throw new FactoryError("NOT_FOUND", `Role "${roleName}" not found.`);
    const existing = dir.members.find((m) => m.personRef === personRef);
    if (existing) {
      if (existing.roleIds.includes(role.id)) return dir;
      return {
        ...dir,
        members: dir.members.map((m) =>
          m.personRef === personRef ? { ...m, roleIds: [...m.roleIds, role.id] } : m,
        ),
      };
    }
    const member: Member = { id: this.deps.idGen.next("mem"), personRef, roleIds: [role.id] };
    return { ...dir, members: [...dir.members, member] };
  }

  /** Effective permissions for a person (union across their roles). */
  permissionsOf(dir: Directory, personRef: string): string[] {
    const member = dir.members.find((m) => m.personRef === personRef);
    if (!member) return [];
    const perms = new Set<string>();
    for (const roleId of member.roleIds) {
      const role = dir.roles.find((r) => r.id === roleId);
      role?.permissions.forEach((p) => perms.add(p));
    }
    return [...perms];
  }

  /** May this person perform the action? "*" is a wildcard grant. */
  can(dir: Directory, personRef: string, permission: string): boolean {
    const perms = this.permissionsOf(dir, personRef);
    return perms.includes("*") || perms.includes(permission);
  }
}

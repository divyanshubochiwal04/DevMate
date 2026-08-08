import { Role } from "../../../src/rbac/roles/role.constants";

/**
 * Roles to be seeded into the database.
 * Ordered: SUPER_ADMIN first so it can be referenced in role-permissions mapping.
 */
export const rolesData: Array<{ name: string; description: string }> = [
  {
    name: Role.SUPER_ADMIN,
    description: "Full system access. Bypasses all permission and role checks.",
  },
  {
    name: Role.ADMIN,
    description: "Administrative access. Can manage users and application data.",
  },
  {
    name: Role.USER,
    description: "Standard user access. Can manage their own data only.",
  },
];

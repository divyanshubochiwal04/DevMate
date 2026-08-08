/**
 * Role — canonical role name constants.
 *
 * These are seeded into the `roles` table. Use these constants
 * instead of raw strings everywhere in guard metadata and seed data.
 */
export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN:       "ADMIN",
  USER:        "USER",
} as const;

export type RoleKey = (typeof Role)[keyof typeof Role];

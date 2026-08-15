/**
 * Admin RBAC claim helpers — pure, edge-safe (no Node/server-only imports)
 * so both the Edge middleware and server actions can share them.
 *
 * Claim shape (set via app/api/admin/bootstrap/route.ts or Firebase console):
 *   admin: true | editor: true           (legacy booleans)
 *   roles: { admin?: boolean, editor?: boolean }
 */
export interface AdminRoles {
  isAdmin: boolean;
  isEditor: boolean;
}

export function parseRoles(
  claims: Record<string, unknown> | undefined,
): AdminRoles {
  if (!claims) return { isAdmin: false, isEditor: false };
  const legacyAdmin = claims.admin === true;
  const legacyEditor = claims.editor === true;
  const roles = (claims.roles as { admin?: unknown; editor?: unknown }) ?? {};
  const isAdmin = legacyAdmin || roles.admin === true;
  return {
    isAdmin,
    isEditor: legacyEditor || roles.editor === true || isAdmin,
  };
}

export function hasAdminClaim(
  claims: Record<string, unknown> | undefined,
): boolean {
  return parseRoles(claims).isAdmin;
}

export function hasEditorClaim(
  claims: Record<string, unknown> | undefined,
): boolean {
  return parseRoles(claims).isEditor;
}

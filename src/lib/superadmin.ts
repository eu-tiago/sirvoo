// Owner email with unrestricted superadmin access
export const SUPERADMIN_EMAIL = "tiagotalmud@gmail.com";

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
}

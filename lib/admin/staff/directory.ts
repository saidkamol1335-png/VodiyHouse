import { isStaffRole, type StaffRole } from "../access";

/** Строка public.staff_directory() как её отдаёт Supabase (даты — ISO-строки). */
export type DirectoryRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  email: string;
  last_sign_in_at: string | null;
  banned: boolean;
  created_at: string;
};

export type StaffMember = {
  id: string;
  fullName: string;
  role: StaffRole;
  isActive: boolean;
  mustChangePassword: boolean;
  email: string;
  lastSignInAt: string | null;
  banned: boolean;
  createdAt: string;
};

/** Строки с неизвестной ролью отбрасываются: в интерфейсе для них нет подписи. */
export function parseDirectoryRows(rows: readonly DirectoryRow[]): StaffMember[] {
  return rows.flatMap((row) =>
    isStaffRole(row.role)
      ? [
          {
            id: row.id,
            fullName: row.full_name,
            role: row.role,
            isActive: row.is_active,
            mustChangePassword: row.must_change_password,
            email: row.email,
            lastSignInAt: row.last_sign_in_at,
            banned: row.banned,
            createdAt: row.created_at,
          },
        ]
      : [],
  );
}

/**
 * Состояние для плашки. Отключение — два шага (база, затем бан в Auth): если второй не прошёл,
 * база и Auth расходятся — показываем предупреждение и даём повторить.
 */
export type StaffState = "active" | "pending" | "inactive" | "inactiveNotBanned" | "activeBanned";

export function staffState(
  member: Pick<StaffMember, "isActive" | "banned" | "mustChangePassword">,
): StaffState {
  if (!member.isActive) return member.banned ? "inactive" : "inactiveNotBanned";
  if (member.banned) return "activeBanned";
  return member.mustChangePassword ? "pending" : "active";
}

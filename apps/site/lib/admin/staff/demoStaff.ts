import type { StaffMember } from "./directory";

// DEMO для /dev/staff: сотрудники мокапа (docs/mockup/source/project/Main.dc.html, USERS) во всех
// состояниях списка. Email — demo-…@example.com, в базу не попадают.

export const DEMO_VIEWER_ID = "00000000-0000-4000-8000-000000000002";

const demo = (member: Omit<StaffMember, "email"> & { login: string }): StaffMember => {
  const { login, ...rest } = member;
  return { ...rest, email: `demo-${login}@example.com` };
};

/** Порядок как у staff_directory(): активные, потом отключённые; внутри — по имени. */
export const DEMO_STAFF: readonly StaffMember[] = [
  demo({
    id: "00000000-0000-4000-8000-000000000001",
    login: "aziz",
    fullName: "Азиз Рахимов",
    role: "manager",
    isActive: true,
    mustChangePassword: true,
    lastSignInAt: null,
    banned: false,
    createdAt: "2026-10-19T09:20:00Z",
  }),
  demo({
    id: DEMO_VIEWER_ID,
    login: "bakhtiyor",
    fullName: "Бахтиёр Каримов",
    role: "head",
    isActive: true,
    mustChangePassword: false,
    lastSignInAt: "2026-10-20T04:12:00Z",
    banned: false,
    createdAt: "2026-10-01T05:00:00Z",
  }),
  demo({
    id: "00000000-0000-4000-8000-000000000003",
    login: "dilnoza",
    fullName: "Дилноза Юсупова",
    role: "manager",
    isActive: true,
    mustChangePassword: false,
    lastSignInAt: "2026-10-20T03:40:00Z",
    banned: false,
    createdAt: "2026-10-02T06:30:00Z",
  }),
  demo({
    id: "00000000-0000-4000-8000-000000000004",
    login: "sardor",
    fullName: "Сардор Алиев",
    role: "videographer",
    isActive: true,
    mustChangePassword: false,
    lastSignInAt: "2026-10-17T11:05:00Z",
    banned: false,
    createdAt: "2026-10-05T07:00:00Z",
  }),
  demo({
    id: "00000000-0000-4000-8000-000000000005",
    login: "jasur",
    fullName: "Жасур Тошматов",
    role: "manager",
    isActive: false,
    mustChangePassword: false,
    lastSignInAt: "2026-10-12T08:00:00Z",
    banned: false,
    createdAt: "2026-10-03T06:00:00Z",
  }),
  demo({
    id: "00000000-0000-4000-8000-000000000006",
    login: "nigora",
    fullName: "Нигора Саидова",
    role: "manager",
    isActive: false,
    mustChangePassword: false,
    lastSignInAt: "2026-10-10T10:15:00Z",
    banned: true,
    createdAt: "2026-10-03T06:10:00Z",
  }),
];

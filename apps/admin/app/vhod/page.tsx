import type { Metadata } from "next";
import { AdminLogin } from "@/components/AdminLogin";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return <AdminLogin />;
}

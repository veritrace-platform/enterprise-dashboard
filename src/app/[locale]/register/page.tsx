import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Đăng ký doanh nghiệp | GS1 Control Tower — VeriTrace",
  description:
    "Khởi tạo doanh nghiệp, trụ sở chính GLN-13 và tài khoản quản trị trên nền tảng truy xuất nguồn gốc chuỗi lạnh GS1 Control Tower (EPCIS 2.0).",
};

export default function RegisterPage() {
  return <RegisterForm />;
}

import type { Metadata } from "next";
import { LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Đăng nhập | GS1 Control Tower — VeriTrace",
  description:
    "Cổng xác thực định danh số hợp chuẩn quốc tế GS1 Control Tower dành cho chuỗi cung ứng toàn cầu theo tiêu chuẩn EPCIS 2.0 và ABAC L4.",
};

export default function LoginPage() {
  return <LoginForm />;
}

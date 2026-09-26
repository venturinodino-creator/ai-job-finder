import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-20">
      <h1 className="font-display text-2xl font-semibold">Create your account</h1>
      <AuthForm mode="register" />
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}

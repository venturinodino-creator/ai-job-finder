import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-20">
      <h1 className="font-display text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" />
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        No account yet?{" "}
        <Link href="/register" className="underline">
          Create one
        </Link>
      </p>
    </main>
  );
}

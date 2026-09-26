import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-20">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        No account yet?{" "}
        <Link href="/register" className="underline">
          Create one
        </Link>
      </p>
    </main>
  );
}

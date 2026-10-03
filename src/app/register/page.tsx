import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your search in a few minutes and see your first ranked shortlist."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </>
      }
    >
      <AuthForm mode="register" />
    </AuthShell>
  );
}

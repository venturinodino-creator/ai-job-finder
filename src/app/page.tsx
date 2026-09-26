import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col items-center px-6 py-20 gap-16 max-w-3xl mx-auto text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">AI Job Finder</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Set up a search profile once. Every day, agents scan the job market, score every role against your CV,
          and hand you a ranked shortlist — plus a few wildcards you wouldn&apos;t have searched for yourself.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 text-left w-full">
        <Feature title="Ranked daily feed" body="Every match scored 0–100% with a one-line reason: strong skills fit, missing X, location matches." />
        <Feature title="Wildcard picks" body="A few surprise roles outside your exact search that your skills would still crush." />
        <Feature title="CV coaching" body="A rated CV review with concrete fixes, and one-click tailoring for any specific posting." />
      </div>

      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded-md bg-black text-white dark:bg-white dark:text-black px-5 py-2.5 font-medium hover:opacity-90"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-gray-300 dark:border-gray-700 px-5 py-2.5 font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Log in
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        Open source and self-hostable — see{" "}
        <a className="underline" href="https://github.com" target="_blank" rel="noreferrer">
          BUILD_SPEC.md
        </a>{" "}
        for the full architecture.
      </p>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">{body}</p>
    </div>
  );
}

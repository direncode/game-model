import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-8 py-16">
      <h1 className="text-2xl">Chapter not found</h1>
      <p className="mt-4 text-zinc-500">
        That chapter does not exist.{" "}
        <Link href="/handbook" className="underline">
          Back to the index.
        </Link>
      </p>
    </div>
  );
}

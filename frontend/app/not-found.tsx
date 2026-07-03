import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="mb-2 text-6xl font-bold">404</h1>
        <p className="mb-6 text-sm text-[rgb(var(--muted-foreground))]">
          That page doesn't exist.
        </p>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </div>
  );
}

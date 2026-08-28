"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, Input } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createRoom } from "@/lib/api";

export default function CreateRoomPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) {
      setError("Enter a username");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createRoom(name);
      try {
        sessionStorage.setItem("wt:username", name);
        sessionStorage.setItem(`wt:token:${created.code}`, created.token);
      } catch {
        // storage unavailable
      }
      router.push(`/room/${created.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create room");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-20">
      <Card className="w-full max-w-sm p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground mb-6"
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 className="text-xl font-semibold">Create a room</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-muted mb-1.5">
              Your username
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 30))}
              placeholder="Bata"
              maxLength={30}
              className="normal-case tracking-normal font-sans"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Create Room"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

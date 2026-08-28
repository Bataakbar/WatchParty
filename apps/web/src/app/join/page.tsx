"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button, Input } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRoomInfo } from "@/lib/api";
import { ROOM_CODE_PATTERN } from "@watchparty/shared";

export default function JoinRoomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time storage bootstrap
      setUsername(sessionStorage.getItem("wt:username") ?? "");
    } catch {
      // storage unavailable
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!ROOM_CODE_PATTERN.test(normalized)) {
      setError("Room codes are 6 letters and digits");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await getRoomInfo(normalized);
      router.push(`/room/${normalized}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find room");
      setChecking(false);
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
        <h1 className="text-xl font-semibold">Join a room</h1>
        {!username && (
          <div className="mt-6">
            <label htmlFor="join-username" className="block text-sm text-muted mb-1.5">
              Your username
            </label>
            <input
              id="join-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 30))}
              placeholder="Andi"
              maxLength={30}
              className="h-11 w-full rounded-lg border border-line bg-white/[0.04] px-4 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>
        )}
        <form onSubmit={handleSubmit} className={username ? "mt-6 space-y-4" : "mt-4 space-y-4"}>
          <div>
            <label htmlFor="code" className="block text-sm text-muted mb-1.5">
              Room code
            </label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="K7X92P"
              maxLength={6}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={checking}>
            {checking ? "Checking…" : "Join Room"}
          </Button>
        </form>
      </Card>
    </main>
  );
}

import Link from "next/link";
import { PlayCircle, Users, MessageSquare, MonitorPlay } from "lucide-react";

const steps = [
  { icon: Users, title: "Create a room", body: "Get a short code to share with friends." },
  { icon: MessageSquare, title: "Share the code", body: "Friends join in one click." },
  { icon: MonitorPlay, title: "Open the supported video", body: "Everyone's browser loads it locally." },
  { icon: PlayCircle, title: "Watch together", body: "Play, pause and seek stay in sync." },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-2xl flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-4 py-1.5 text-xs text-muted mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          Synchronized watch parties
        </div>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
          Watch<span className="text-cyan-400">Together</span>
        </h1>
        <p className="mt-4 text-lg text-muted max-w-md">
          Watch together. Stay synchronized.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/create"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-cyan-500 px-8 text-base font-medium text-zinc-950 transition-colors hover:bg-cyan-400"
          >
            Create Room
          </Link>
          <Link
            href="/join"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white/[0.04] px-8 text-base font-medium text-foreground transition-colors hover:bg-white/10"
          >
            Join Room
          </Link>
        </div>
      </div>

      <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="rounded-2xl border border-line bg-surface-glass backdrop-blur-md p-5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
              <step.icon size={18} />
            </div>
            <h3 className="mt-4 font-medium">
              <span className="text-muted mr-1.5">{i + 1}.</span>
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm text-muted leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-16 max-w-md text-center text-xs text-muted/70 leading-relaxed">
        Video never passes through our servers. Each browser loads the media directly from the
        source website — we only keep playback state in sync.
      </p>
    </main>
  );
}

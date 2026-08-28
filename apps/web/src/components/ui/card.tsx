import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-surface-glass backdrop-blur-md shadow-lg shadow-black/20",
        className,
      )}
    >
      {children}
    </div>
  );
}

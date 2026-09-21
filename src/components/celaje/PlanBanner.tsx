import type { PlanNotice } from "@/lib/celaje";

const TONES: Record<PlanNotice["tone"], string> = {
  info: "border-border bg-[var(--surface)] text-foreground",
  warning: "border-[var(--warn)]/40 bg-[var(--warn-soft)] text-foreground",
  danger: "border-destructive/40 bg-destructive/15 text-foreground",
};

export function PlanBanner({ notice }: { notice: PlanNotice | null }) {
  if (!notice) return null;
  return (
    <div className={`rounded-3xl border px-5 py-4 ${TONES[notice.tone]}`}>
      <p className="text-sm font-semibold">{notice.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{notice.body}</p>
    </div>
  );
}

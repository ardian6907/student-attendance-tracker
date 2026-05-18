export type Status = "Hadir" | "Izin" | "Sakit" | "Alpa";
import { cn } from "@/lib/utils";

const styles: Record<Status, string> = {
  Hadir: "bg-success/15 text-success border-success/30",
  Izin: "bg-info/15 text-info border-info/30",
  Sakit: "bg-warning/20 text-warning-foreground border-warning/40",
  Alpa: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}

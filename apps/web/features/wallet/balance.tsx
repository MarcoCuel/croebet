import { formatBalance } from "./wallet";

export function Balance({ value }: { value: number | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2 tabular-nums">
      <span
        className="grid size-6 shrink-0 place-items-center rounded-full bg-brand bg-primary-button text-xs font-black text-white inset-shadow-primary-coin"
        aria-hidden="true"
      >
        C
      </span>
      <span className="truncate" aria-live="polite">
        <span className="sr-only">Saldo de </span>
        {value === null ? "—" : formatBalance.format(value)}{" "}
        <span className="sr-only">{value === 1 ? "Croin" : "Croins"}</span>
      </span>
    </span>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { CroinIcon } from "@/components/shared/croin-icon";
import { formatBalance } from "@/features/wallet/wallet";

/** Only changes to an already displayed balance animate; SSR and first loads show the total. */
export function BalanceValue({ value }: { value: number | null }) {
  const number = useRef<HTMLSpanElement>(null);
  const change = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const displayed = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    const label = number.current;
    const indicator = change.current;
    if (!label || !indicator) return;
    if (value === null || from === null || value === from) {
      displayed.current = value;
      label.textContent = value === null ? "—" : formatBalance.format(value);
      indicator.style.opacity = "0";
      return;
    }

    const delta = value - from;
    indicator.dataset.direction = delta < 0 ? "loss" : "gain";
    indicator.textContent = `${delta > 0 ? "+" : "−"}${formatBalance.format(Math.abs(delta))}`;
    const media = gsap.matchMedia();
    media.add({ animate: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, context => {
      if (!context.conditions?.animate) {
        displayed.current = value;
        label.textContent = formatBalance.format(value);
        gsap.set(indicator, { opacity: 0 });
        return;
      }
      const counter = { value: displayed.current ?? from };
      gsap.to(counter, {
        value, duration: 1, ease: "power2.out",
        onUpdate: () => {
          displayed.current = counter.value;
          label.textContent = formatBalance.format(Math.round(counter.value));
        },
        onComplete: () => { displayed.current = value; label.textContent = formatBalance.format(value); },
      });
      gsap.fromTo(indicator, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.15 });
      gsap.to(indicator, { opacity: 0, y: -8, delay: 1.05, duration: 0.4, ease: "power1.out" });
    });
    return () => media.revert();
  }, [value]);

  return (
    <span className="relative inline-block tabular-nums">
      <span className="sr-only" aria-live="polite" aria-atomic="true">Saldo de {value === null ? "—" : formatBalance.format(value)} {value === 1 ? "Croin" : "Croins"}</span>
      <span ref={number} aria-hidden="true">{value === null ? "—" : formatBalance.format(value)}</span>
      <span ref={change} aria-hidden="true" className="pointer-events-none absolute -top-3 right-0 whitespace-nowrap text-xs leading-none font-medium text-prediction-yes opacity-0 data-[direction=loss]:text-prediction-no" />
    </span>
  );
}

export function Balance({ value }: { value: number | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2 tabular-nums">
      <CroinIcon />
      <BalanceValue value={value} />
    </span>
  );
}

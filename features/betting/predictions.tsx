"use client";

import { useState } from "react";
import { MarketList } from "./market-list";
import { PredictionTicket } from "./prediction-ticket";
import type { Selection } from "./types";

export function Predictions() {
  const [selection, setSelection] = useState<Selection | null>(null);
  return (
    <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.52fr)]">
      <MarketList selection={selection} onSelect={setSelection} />
      <PredictionTicket selection={selection} />
    </div>
  );
}

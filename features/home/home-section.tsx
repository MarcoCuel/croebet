"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type HomeSection = "casino" | "bets";

const HomeSectionContext = createContext<{
  section: HomeSection;
  setSection: (section: HomeSection) => void;
} | null>(null);

export function HomeSectionProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<HomeSection>("casino");
  return (
    <HomeSectionContext.Provider value={{ section, setSection }}>
      {children}
    </HomeSectionContext.Provider>
  );
}

export function useHomeSection() {
  const context = useContext(HomeSectionContext);
  if (!context) throw new Error("HomeSectionProvider is required");
  return context;
}

export function HomeContent({ casino, bets }: { casino: ReactNode; bets: ReactNode }) {
  const { section } = useHomeSection();
  return section === "casino" ? casino : bets;
}

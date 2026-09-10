import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface SessionValue {
  frame: number;
  setFrame: (f: number) => void;
  dataset: string;
  setDataset: (d: string) => void;
  fps: number;
  selectedPlayer: string | null;
  setSelectedPlayer: (id: string | null) => void;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [frame, setFrame] = useState(1250);
  const [dataset, setDataset] = useState("Metrica Sample_Game_1");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>("H10");

  const value = useMemo(
    () => ({ frame, setFrame, dataset, setDataset, fps: 25, selectedPlayer, setSelectedPlayer }),
    [frame, dataset, selectedPlayer],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

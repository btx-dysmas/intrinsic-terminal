"use client";
import { createContext, useContext } from "react";
import type { Co } from "./api";
import type { Assumptions, peerStats, rating } from "./models";

export type CompanyState = {
  co: Co;
  a: Assumptions;
  setA: (fn: (a: Assumptions) => Assumptions) => void;
  resetA: () => void;
  peers: string[];
  setPeers: (p: string[]) => void;
  peerCos: Co[];
  peersLoading: boolean;
  addPeer: (tk: string) => Promise<void>;
  d: any;
  comp: ReturnType<typeof peerStats>;
  rt: ReturnType<typeof rating>;
  rf: number | null;
};

export const CompanyCtx = createContext<CompanyState | null>(null);
export const useCompany = () => {
  const c = useContext(CompanyCtx);
  if (!c) throw new Error("useCompany must be used inside a company page");
  return c;
};

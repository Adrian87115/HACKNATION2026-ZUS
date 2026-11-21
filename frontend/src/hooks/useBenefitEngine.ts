// src/hooks/useBenefitEngine.ts
import { useEffect, useState } from "react";
import {
  BenefitEngine,
  DEFAULT_PARAMS_2026,
  type BenefitParams,
} from "../engine/index.js";

export function useBenefitEngine() {
  // Startujemy natychmiast na domyślnych parametrach 2026, żeby UI nie czekało na sieć
  const [engine, setEngine] = useState(
    () => new BenefitEngine(DEFAULT_PARAMS_2026),
  );

  useEffect(() => {
    let active = true;
    fetch("/api/engine/params")
      .then((res) => (res.ok ? res.json() : null))
      .then((remoteParams: Partial<BenefitParams> | null) => {
        if (active && remoteParams) {
          const updated = new BenefitEngine(DEFAULT_PARAMS_2026);
          updated.updateParams(remoteParams);
          setEngine(updated);
        }
      })
      .catch(() => {
        // Fallback do DEFAULT_PARAMS_2026 w trybie offline
      });

    return () => {
      active = false;
    };
  }, []);

  return engine;
}

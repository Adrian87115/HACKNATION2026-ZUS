// src/components/BasisCalculator.tsx
import React, { useMemo, useState } from "react";
import type { BasisInput, BenefitEngine, ParentRole } from "../engine/index.js";

interface BasisCalculatorProps {
  engine: BenefitEngine;
  primaryBasis: number;
  secondaryBasis: number;
  onChangePrimaryBasis: (value: number) => void;
  onChangeSecondaryBasis: (value: number) => void;
}

interface ParentCalculatorFormState {
  kind: "employee" | "non_employee";
  averageMonthlyGross: number;
  quarterlyBonuses: number;
  annualBonuses: number;
  fullTime: boolean;
  continuePreviousBenefit: boolean;
  previousBasis: number;
}

const DEFAULT_FORMS: Record<ParentRole, ParentCalculatorFormState> = {
  primary: {
    kind: "employee",
    averageMonthlyGross: 6953, // ok. 6000 zł podstawy po odliczeniu 13,71%
    quarterlyBonuses: 0,
    annualBonuses: 0,
    fullTime: true,
    continuePreviousBenefit: false,
    previousBasis: 6000,
  },
  secondary: {
    kind: "employee",
    averageMonthlyGross: 9850, // ok. 8500 zł podstawy po odliczeniu 13,71%
    quarterlyBonuses: 0,
    annualBonuses: 0,
    fullTime: true,
    continuePreviousBenefit: false,
    previousBasis: 8500,
  },
};

const ROLE_TITLES: Record<ParentRole, string> = {
  primary: "Rodzic 1 (Matka / pierwszy opiekun)",
  secondary: "Rodzic 2 (Ojciec / drugi opiekun)",
};

export function BasisCalculator({
  engine,
  primaryBasis,
  secondaryBasis,
  onChangePrimaryBasis,
  onChangeSecondaryBasis,
}: BasisCalculatorProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<ParentRole>("primary");
  const [forms, setForms] =
    useState<Record<ParentRole, ParentCalculatorFormState>>(DEFAULT_FORMS);

  const currentForm = forms[activeTab];

  // Wyliczenie wyniku z silnika dla aktywnej zakładki rodzica
  const calculation = useMemo(() => {
    try {
      let input: BasisInput;

      if (currentForm.continuePreviousBenefit) {
        input =
          currentForm.kind === "employee"
            ? {
                kind: "employee",
                months: [],
                gapShorterThanOneMonth: true,
                previousBasis: currentForm.previousBasis,
              }
            : {
                kind: "non_employee",
                months: [],
                gapShorterThanOneMonth: true,
                previousBasis: currentForm.previousBasis,
              };
      } else if (currentForm.kind === "employee") {
        input = {
          kind: "employee",
          months: Array.from({ length: 12 }, () => ({
            grossSalary: currentForm.averageMonthlyGross,
          })),
          quarterlyBonusesLast4Quarters: currentForm.quarterlyBonuses,
          annualBonusesLastYear: currentForm.annualBonuses,
          fullTime: currentForm.fullTime,
        };
      } else {
        input = {
          kind: "non_employee",
          months: Array.from({ length: 12 }, () => ({
            contributionBasis: currentForm.averageMonthlyGross,
          })),
        };
      }

      return {
        result: engine.calculateBasis(input),
        error: null as string | null,
      };
    } catch (err) {
      return {
        result: null,
        error:
          err instanceof Error ? err.message : "Niepoprawne dane wejściowe.",
      };
    }
  }, [engine, currentForm]);

  const updateForm = (patch: Partial<ParentCalculatorFormState>) => {
    setForms((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], ...patch },
    }));
  };

  const applyCalculatedBasis = () => {
    if (!calculation.result) return;
    if (activeTab === "primary") {
      onChangePrimaryBasis(calculation.result.monthlyBasis);
    } else {
      onChangeSecondaryBasis(calculation.result.monthlyBasis);
    }
  };

  return (
    <section
      style={{
        marginBottom: 24,
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: "#ffffff",
        overflow: "hidden",
      }}
    >
      {/* Nagłówek zwijanego kalkulatora */}
      <div
        style={{
          padding: "14px 18px",
          background: "#eff6ff",
          borderBottom: isOpen ? "1px solid #dbeafe" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <strong style={{ color: "#1e3a8a", fontSize: 15 }}>
            Krok 0 (opcjonalny): Kalkulator podstawy wymiaru zasiłku ZUS
          </strong>
          <div style={{ fontSize: 13, color: "#475569" }}>
            Nie znasz swojej podstawy ZUS? Oblicz ją z wynagrodzenia brutto i
            przenieś do osi czasu.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #93c5fd",
            background: "#fff",
            color: "#1d4ed8",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isOpen ? "Zwiń kalkulator ▲" : "Rozwiń kalkulator ▼"}
        </button>
      </div>

      {isOpen && (
        <div style={{ padding: 18 }}>
          {/* Zakładki wyboru rodzica */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["primary", "secondary"] as ParentRole[]).map((role) => {
              const active = activeTab === role;
              const currentSavedValue =
                role === "primary" ? primaryBasis : secondaryBasis;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActiveTab(role)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: active ? "#eff6ff" : "#f8fafc",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}
                  >
                    {ROLE_TITLES[role]}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                    Aktualnie w planie:{" "}
                    <strong>
                      {currentSavedValue.toLocaleString("pl-PL")} zł
                    </strong>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pola formularza */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 13,
              }}
            >
              <span>Forma zatrudnienia / ubezpieczenia:</span>
              <select
                value={currentForm.kind}
                onChange={(e) =>
                  updateForm({
                    kind: e.target.value as "employee" | "non_employee",
                  })
                }
                style={{
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                }}
              >
                <option value="employee">Umowa o pracę (pracownik)</option>
                <option value="non_employee">
                  B2B / Umowa zlecenie (niepracownik)
                </option>
              </select>
            </label>

            {!currentForm.continuePreviousBenefit ? (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <span>
                  {currentForm.kind === "employee"
                    ? "Średnie wynagrodzenie brutto (12 mies.):"
                    : "Średnia podstawa składek chorobowych (12 mies.):"}
                </span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={currentForm.averageMonthlyGross}
                  onChange={(e) =>
                    updateForm({ averageMonthlyGross: Number(e.target.value) })
                  }
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </label>
            ) : (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  fontSize: 13,
                }}
              >
                <span>Podstawa z poprzedniego zasiłku (np. L4 w ciąży):</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={currentForm.previousBasis}
                  onChange={(e) =>
                    updateForm({ previousBasis: Number(e.target.value) })
                  }
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </label>
            )}

            {currentForm.kind === "employee" &&
              !currentForm.continuePreviousBenefit && (
                <>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <span>
                      Suma premii kwartalnych (z 4 kwartałów, brutto):
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={currentForm.quarterlyBonuses}
                      onChange={(e) =>
                        updateForm({ quarterlyBonuses: Number(e.target.value) })
                      }
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      fontSize: 13,
                    }}
                  >
                    <span>
                      Premia / nagroda roczna (za poprzedni rok, brutto):
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={currentForm.annualBonuses}
                      onChange={(e) =>
                        updateForm({ annualBonuses: Number(e.target.value) })
                      }
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                      }}
                    />
                  </label>
                </>
              )}
          </div>

          {/* Opcje dodatkowe (checkboxy) */}
          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {currentForm.kind === "employee" &&
              !currentForm.continuePreviousBenefit && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={currentForm.fullTime}
                    onChange={(e) => updateForm({ fullTime: e.target.checked })}
                  />
                  Pełny etat (gwarancja minimalnej podstawy z Art. 45)
                </label>
              )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={currentForm.continuePreviousBenefit}
                onChange={(e) =>
                  updateForm({ continuePreviousBenefit: e.target.checked })
                }
              />
              Przerwa od poprzedniego zasiłku krótsza niż 1 mies. (Art. 43)
            </label>
          </div>

          {/* Wynik obliczeń i przycisk przeniesienia do osi czasu */}
          {calculation.error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {calculation.error}
            </div>
          ) : (
            calculation.result && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 14 }}>
                    Wyliczona podstawa miesięczna:{" "}
                    <strong style={{ fontSize: 17, color: "#0f172a" }}>
                      {calculation.result.monthlyBasis.toLocaleString("pl-PL")}{" "}
                      zł
                    </strong>{" "}
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      (stawka dzienna 100%:{" "}
                      {calculation.result.dailyBasis.toLocaleString("pl-PL")}{" "}
                      zł)
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: "6px 0 0",
                      paddingLeft: 18,
                      fontSize: 12,
                      color: "#475569",
                    }}
                  >
                    {calculation.result.appliedRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={applyCalculatedBasis}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Zastosuj dla:{" "}
                  {activeTab === "primary" ? "Rodzic 1" : "Rodzic 2"}
                </button>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}

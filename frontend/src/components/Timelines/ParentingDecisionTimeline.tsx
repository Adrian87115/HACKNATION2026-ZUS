// src/components/Timelines/ParentingDecisionTimeline.tsx
import React, { useMemo, useState } from "react";
import {
  PARENTING_DECISION_TREE,
  type DecisionNode,
} from "../../data/parentingDecisionTree.js";
import { useBenefitEngine } from "../../hooks/useBenefitEngine.js";
import type { ParentRole } from "../../engine/index.js";
import { BasisCalculator } from "../BasisCalculator.js";

const ROLE_LABELS: Record<ParentRole, string> = {
  primary: "Matka / Rodzic 1",
  secondary: "Ojciec / Rodzic 2",
};

const SEGMENT_LABELS: Record<string, string> = {
  maternity: "Urlop macierzyński",
  maternity_conditions: "Urlop na warunkach macierzyńskiego",
  supplementary_maternity:
    "Uzupełniający urlop macierzyński (szpital/wcześniak)",
  parental: "Urlop rodzicielski",
  paternity: "Urlop ojcowski",
};

export function ParentingDecisionTimeline() {
  const engine = useBenefitEngine();

  const [path, setPath] = useState<DecisionNode[]>([PARENTING_DECISION_TREE]);
  const [eventDate, setEventDate] = useState("2026-05-15");
  const [primaryBasis, setPrimaryBasis] = useState(6000);
  const [secondaryBasis, setSecondaryBasis] = useState(8500);

  const currentNode = path[path.length - 1];
  const isLeaf = Boolean(currentNode.buildPlanInput);

  const planResult = useMemo(() => {
    if (!currentNode.buildPlanInput) return null;
    const input = currentNode.buildPlanInput(eventDate, {
      primary: primaryBasis,
      secondary: secondaryBasis,
    });
    return engine.planMaternity(input);
  }, [currentNode, eventDate, primaryBasis, secondaryBasis, engine]);

  const handleSelectBranch = (branch: DecisionNode) => {
    setPath((prev) => [...prev, branch]);
  };

  const handleJumpToStep = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  return (
    <div
      style={{
        maxWidth: 880,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* 1. Kalkulator podstawy wymiaru zasiłku nad drzewkiem decyzyjnym */}
      <BasisCalculator
        engine={engine}
        primaryBasis={primaryBasis}
        secondaryBasis={secondaryBasis}
        onChangePrimaryBasis={setPrimaryBasis}
        onChangeSecondaryBasis={setSecondaryBasis}
      />

      {/* 2. Pasek parametrów wejściowych (zasilany z kalkulatora lub edytowany ręcznie) */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
          padding: 16,
          background: "#f8fafc",
          borderRadius: 12,
        }}
      >
        <label>
          Data zdarzenia (poród / przyjęcie):{" "}
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </label>
        <label>
          Podstawa Rodzic 1 (zł):{" "}
          <input
            type="number"
            value={primaryBasis}
            onChange={(e) => setPrimaryBasis(Number(e.target.value))}
          />
        </label>
        <label>
          Podstawa Rodzic 2 (zł):{" "}
          <input
            type="number"
            value={secondaryBasis}
            onChange={(e) => setSecondaryBasis(Number(e.target.value))}
          />
        </label>
      </div>

      {/* 3. Pionowa oś czasu kroków decyzyjnych */}
      <div
        style={{
          borderLeft: "3px solid #3b82f6",
          paddingLeft: 24,
          marginLeft: 12,
        }}
      >
        {path.map((node, index) => {
          const isCurrent = index === path.length - 1;
          return (
            <div
              key={node.id}
              style={{ position: "relative", marginBottom: 28 }}
            >
              <span
                style={{
                  position: "absolute",
                  left: -33,
                  top: 4,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: isCurrent ? "#2563eb" : "#93c5fd",
                  border: "2px solid #fff",
                }}
              />

              {index > 0 && (
                <div
                  style={{
                    display: "inline-block",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1e40af",
                    background: "#dbeafe",
                    padding: "4px 10px",
                    borderRadius: 999,
                    marginBottom: 8,
                  }}
                >
                  {path[index - 1].affectedWho}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: "4px 0" }}>{node.label}</h3>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(index)}
                    style={{
                      fontSize: 13,
                      color: "#2563eb",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Zmień wybór
                  </button>
                )}
              </div>

              <p style={{ margin: "4px 0 12px", color: "#475569" }}>
                {node.shortDescription}
              </p>

              {isCurrent && node.children && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 12,
                  }}
                >
                  {node.children.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => handleSelectBranch(branch)}
                      style={{
                        textAlign: "left",
                        padding: 16,
                        borderRadius: 10,
                        border: "1px solid #cbd5e1",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {branch.label} →
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          marginBottom: 8,
                        }}
                      >
                        {branch.shortDescription}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#0f766e",
                          fontWeight: 600,
                        }}
                      >
                        {branch.affectedWho}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 4. Węzeł końcowy: wynik z BenefitEngine + przywileje osób */}
      {isLeaf && planResult && (
        <section
          style={{
            marginTop: 24,
            padding: 24,
            borderRadius: 14,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0f766e",
              marginBottom: 6,
            }}
          >
            PODSUMOWANIE UPRAWNIEŃ • {currentNode.affectedWho}
          </div>
          <h2 style={{ marginTop: 0 }}>Co przysługuje w wybranej sytuacji?</h2>

          {currentNode.specialLegalNote && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#fefce8",
                border: "1px solid #fde047",
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {currentNode.specialLegalNote}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 20,
            }}
          >
            {(["primary", "secondary"] as ParentRole[]).map((role) => {
              const roleSegments = planResult.segments.filter(
                (s) => s.parent === role,
              );
              const totalWeeks = roleSegments.reduce(
                (sum, s) => sum + s.leaveWeeks,
                0,
              );
              return (
                <div
                  key={role}
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: "#f1f5f9",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {ROLE_LABELS[role]}
                  </div>
                  <div
                    style={{ fontSize: 14, color: "#334155", margin: "6px 0" }}
                  >
                    Łączny wymiar urlopów: <strong>{totalWeeks} tyg.</strong>
                  </div>
                  <div style={{ fontSize: 14, color: "#334155" }}>
                    Szacowana suma zasiłku:{" "}
                    <strong>
                      {planResult.totals[role].toLocaleString("pl-PL")} zł
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          <h4>Harmonogram okresów zasiłkowych (wyliczony przez silnik)</h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {planResult.segments.map((seg, idx) => (
              <li
                key={`${seg.type}-${seg.parent}-${idx}`}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div>
                  <strong>{SEGMENT_LABELS[seg.type] ?? seg.type}</strong> —{" "}
                  {ROLE_LABELS[seg.parent]}
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {seg.startDate} → {seg.endDate} ({seg.leaveWeeks} tyg. /{" "}
                    {seg.days} dni) • Podstawa prawna: {seg.legalBasis}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>
                    {Math.round(seg.rate * 100)}% zasiłku
                  </div>
                  <div style={{ fontSize: 13, color: "#0f172a" }}>
                    {seg.totalAmount.toLocaleString("pl-PL")} zł łącznie
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {currentNode.supportOrganizations && (
            <div
              style={{
                marginTop: 24,
                padding: 20,
                borderRadius: 12,
                background: "#fdf2f8",
                border: "1px solid #fbcfe8",
              }}
            >
              <h3 style={{ marginTop: 0, color: "#831843" }}>
                Wsparcie dla rodziców po stracie dziecka
              </h3>
              <p style={{ fontSize: 14, color: "#500724" }}>
                W tej trudnej sytuacji przysługuje Wam nie tylko urlop na
                regenerację po porodzie, ale również bezpłatna pomoc
                psychologiczna i prawna:
              </p>
              <div style={{ display: "grid", gap: 12 }}>
                {currentNode.supportOrganizations.map((org) => (
                  <div
                    key={org.name}
                    style={{ padding: 12, background: "#fff", borderRadius: 8 }}
                  >
                    <div style={{ fontWeight: 700 }}>{org.name}</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#475569",
                        margin: "4px 0",
                      }}
                    >
                      {org.description}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#9d174d",
                      }}
                    >
                      {org.contact} •{" "}
                      <a href={org.url} target="_blank" rel="noreferrer">
                        {org.url}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

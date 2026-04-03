"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  DrugInteractionResult,
  HerbDrugResult,
  ClinicalTrialResult,
  ICD10Suggestion,
} from "@/types/clinical-tools";
import {
  checkDrugInteraction,
  checkHerbDrugSafety,
  findClinicalTrials,
  suggestICD10,
} from "@/lib/api";

type ToolId = "drug" | "herb" | "trials" | "icd10";

export default function ClinicalToolsPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as ToolId) || "drug";

  const [tab, setTab] = useState<ToolId>(initialTab);

  // Drug interaction state
  const [drugInput, setDrugInput] = useState("");
  const [drugList, setDrugList] = useState<string[]>([]);
  const [drugResult, setDrugResult] =
    useState<DrugInteractionResult | null>(null);
  const [drugLoading, setDrugLoading] = useState(false);

  // Herb-drug state
  const [herbName, setHerbName] = useState("");
  const [herbDrug, setHerbDrug] = useState("");
  const [herbResult, setHerbResult] =
    useState<HerbDrugResult | null>(null);
  const [herbLoading, setHerbLoading] = useState(false);

  // Trials state
  const [trialQuery, setTrialQuery] = useState("");
  const [trialPhase, setTrialPhase] = useState<string>("");
  const [trialStatus, setTrialStatus] = useState<string>("");
  const [trialIndiaOnly, setTrialIndiaOnly] = useState(false);
  const [trialResults, setTrialResults] = useState<
    ClinicalTrialResult[]
  >([]);
  const [trialLoading, setTrialLoading] = useState(false);

  // ICD-10 state
  const [icdQuery, setIcdQuery] = useState("");
  const [icdResults, setIcdResults] = useState<ICD10Suggestion[]>(
    [],
  );
  const [icdLoading, setIcdLoading] = useState(false);

  const groupedIcdResults = useMemo(() => {
    const groups: Record<string, ICD10Suggestion[]> = {};
    icdResults.forEach((s) => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [icdResults]);

  // Prefill from query params on first mount
  useEffect(() => {
    const drugs = searchParams.get("drugs");
    if (drugs) {
      setDrugList(
        drugs
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      );
    }
    const herb = searchParams.get("herb");
    if (herb) setHerbName(herb);
    const drug = searchParams.get("drug");
    if (drug) setHerbDrug(drug);
    const q = searchParams.get("query");
    if (q) {
      if (initialTab === "trials") setTrialQuery(q);
      if (initialTab === "icd10") setIcdQuery(q);
    }
  }, [searchParams, initialTab]);

  useEffect(() => {
    if (tab !== "icd10") return;
    if (!icdQuery.trim()) {
      setIcdResults([]);
      return;
    }
    setIcdLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await suggestICD10(icdQuery.trim());
        setIcdResults(res);
      } catch {
        setIcdResults([]);
      } finally {
        setIcdLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [icdQuery, tab]);

  const handleAddDrug = () => {
    const val = drugInput.trim();
    if (!val) return;
    setDrugList((prev) =>
      prev.includes(val) ? prev : [...prev, val],
    );
    setDrugInput("");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="font-ui text-[10px] tracking-[0.5em] uppercase text-cream/40">
            Clinical Tools
          </h1>
          <p className="font-body text-sm text-cream/70">
            Drug safety · Herb-drug interactions · Clinical trials ·
            ICD-10 codes — within the Manthana stack.
          </p>
        </div>
      </header>

      <div className="bg-black/40 border border-white/[0.09] rounded-2xl shadow-xl overflow-hidden">
        <div className="px-4 pt-3 pb-2 border-b border-white/[0.06] flex gap-1">
          {[
            { id: "drug", icon: "💊", label: "Drug" },
            { id: "herb", icon: "🌿", label: "Herb-Drug" },
            { id: "trials", icon: "🧬", label: "Trials" },
            { id: "icd10", icon: "🏥", label: "ICD-10" },
          ].map((t) => {
            const active = tab === (t.id as ToolId);
            return (
              <button
                key={t.id}
                type="button"
                className={`flex-1 px-3 py-1.75 rounded-full text-[11px] font-ui tracking-[0.14em] uppercase border ${
                  active
                    ? "bg-purple-600/80 border-purple-400 text-cream"
                    : "bg-white/[0.02] border-white/[0.08] text-cream/60 hover:bg-white/[0.06]"
                }`}
                onClick={() => {
                  setTab(t.id as ToolId);
                  setDrugResult(null);
                  setHerbResult(null);
                  setTrialResults([]);
                  setIcdResults([]);
                }}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-4 space-y-4 text-[12px] text-cream/80">
          {tab === "drug" && (
            <div className="space-y-3">
              <p className="text-[11px] text-cream/65 font-body">
                Add drug names to check for pairwise interactions
                across modern and traditional medicine.
              </p>
              <div className="flex gap-2">
                <input
                  value={drugInput}
                  onChange={(e) => setDrugInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDrug();
                    }
                  }}
                  placeholder="e.g. Metoprolol, Atorvastatin"
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-cream/80 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddDrug}
                  className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.12] text-[11px] font-ui uppercase tracking-[0.16em] text-cream/70"
                >
                  Add
                </button>
              </div>
              {drugList.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {drugList.map((d) => (
                    <button
                      type="button"
                      key={d}
                      className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-500/60 text-[11px] text-cream/80"
                      onClick={() =>
                        setDrugList((prev) =>
                          prev.filter((x) => x !== d),
                        )
                      }
                    >
                      {d} ✕
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={drugList.length < 2 || drugLoading}
                onClick={async () => {
                  if (drugList.length < 2) return;
                  setDrugLoading(true);
                  setDrugResult(null);
                  try {
                    const res = await checkDrugInteraction(drugList);
                    setDrugResult(res);
                  } catch {
                    setDrugResult(null);
                  } finally {
                    setDrugLoading(false);
                  }
                }}
                className="mt-1 inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-purple-600/80 hover:bg-purple-500 text-[11px] font-ui uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {drugLoading ? "Checking..." : "Check Interactions →"}
              </button>

              {drugResult && (
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className="font-ui text-[10px] uppercase tracking-[0.18em] text-cream/40">
                    Overall risk:{" "}
                    <span className="text-cream/80">
                      {drugResult.overallRisk.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {drugResult.interactions.map((it, idx) => (
                      <div
                        key={`${it.drug1}-${it.drug2}-${idx}`}
                        className="rounded-md border border-purple-400/40 bg-purple-900/30 px-2 py-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-ui text-[10px] tracking-[0.16em] uppercase">
                            {it.drug1} × {it.drug2}
                          </span>
                          <span className="font-ui text-[9px]">
                            {it.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-0.5">
                          <strong>Effect:</strong> {it.clinicalEffect}
                        </p>
                        <p className="mt-0.5">
                          <strong>Mechanism:</strong> {it.mechanism}
                        </p>
                        <p className="mt-0.5">
                          <strong>Recommendation:</strong>{" "}
                          {it.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "herb" && (
            <div className="space-y-3">
              <p className="text-[11px] text-cream/65 font-body">
                Evaluate Ayurvedic herb and modern drug combinations for
                safety.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  value={herbName}
                  onChange={(e) => setHerbName(e.target.value)}
                  placeholder="Herb (e.g. Ashwagandha)"
                  className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-cream/80 outline-none"
                />
                <input
                  value={herbDrug}
                  onChange={(e) => setHerbDrug(e.target.value)}
                  placeholder="Drug (e.g. Metoprolol)"
                  className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-cream/80 outline-none"
                />
              </div>
              <button
                type="button"
                disabled={
                  !herbName.trim() || !herbDrug.trim() || herbLoading
                }
                onClick={async () => {
                  if (!herbName.trim() || !herbDrug.trim()) return;
                  setHerbLoading(true);
                  setHerbResult(null);
                  try {
                    const res = await checkHerbDrugSafety(
                      herbName.trim(),
                      herbDrug.trim(),
                    );
                    setHerbResult(res);
                  } catch {
                    setHerbResult(null);
                  } finally {
                    setHerbLoading(false);
                  }
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-emerald-600/80 hover:bg-emerald-500 text-[11px] font-ui uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {herbLoading ? "Analyzing..." : "Analyze Safety →"}
              </button>

              {herbResult && (
                <div className="mt-3 space-y-1.5 text-[11px]">
                  <div className="font-ui text-[10px] uppercase tracking-[0.18em] text-cream/40">
                    Safety level:{" "}
                    <span className="text-cream/80">
                      {herbResult.safetyLevel.toUpperCase()}
                    </span>
                    {herbResult.interaction?.evidence_level && (
                      <span className="ml-1.5 text-cream/50">
                        ({herbResult.interaction.evidence_level})
                      </span>
                    )}
                  </div>
                  <p>
                    <strong>Mechanism:</strong> {herbResult.mechanism}
                  </p>
                  <p>
                    <strong>Clinical notes:</strong>{" "}
                    {herbResult.clinicalNotes}
                  </p>
                  {herbResult.ayurvedicContext && (
                    <p>
                      <strong>Ayurvedic context:</strong>{" "}
                      {Array.isArray(herbResult.ayurvedicContext)
                        ? herbResult.ayurvedicContext.join(", ")
                        : herbResult.ayurvedicContext}
                    </p>
                  )}
                  {herbResult.interaction?.citations && herbResult.interaction.citations.length > 0 && (
                    <div className="pt-1">
                      <strong>References:</strong>{" "}
                      {herbResult.interaction.citations.slice(0, 3).map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 underline decoration-dotted mr-1"
                        >
                          {c.pmid ? `PMID ${c.pmid}` : c.title?.slice(0, 40) || "Link"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "trials" && (
            <div className="space-y-3">
              <p className="text-[11px] text-cream/65 font-body">
                Search ClinicalTrials.gov-style metadata for drugs,
                conditions, or interventions.
              </p>
              <input
                value={trialQuery}
                onChange={(e) => setTrialQuery(e.target.value)}
                placeholder="e.g. Ashwagandha anxiety, Metformin PCOS"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-cream/80 outline-none"
              />
              <div className="flex gap-2 text-[11px]">
                <select
                  value={trialPhase}
                  onChange={(e) => setTrialPhase(e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-cream/80 outline-none"
                >
                  <option value="" className="text-slate-900">
                    All phases
                  </option>
                  <option value="I" className="text-slate-900">
                    Phase I
                  </option>
                  <option value="II" className="text-slate-900">
                    Phase II
                  </option>
                  <option value="III" className="text-slate-900">
                    Phase III
                  </option>
                  <option value="IV" className="text-slate-900">
                    Phase IV
                  </option>
                </select>
                <select
                  value={trialStatus}
                  onChange={(e) => setTrialStatus(e.target.value)}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2 py-1.5 text-cream/80 outline-none"
                >
                  <option value="" className="text-slate-900">
                    Any status
                  </option>
                  <option value="recruiting" className="text-slate-900">
                    Recruiting
                  </option>
                  <option value="completed" className="text-slate-900">
                    Completed
                  </option>
                  <option value="active" className="text-slate-900">
                    Active
                  </option>
                </select>
                <label className="flex items-center gap-1.5 text-[11px] text-cream/70">
                  <input
                    type="checkbox"
                    checked={trialIndiaOnly}
                    onChange={(e) => setTrialIndiaOnly(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  India only
                </label>
              </div>
              <button
                type="button"
                disabled={!trialQuery.trim() || trialLoading}
                onClick={async () => {
                  if (!trialQuery.trim()) return;
                  setTrialLoading(true);
                  setTrialResults([]);
                  try {
                    const res = await findClinicalTrials(
                      trialQuery.trim(),
                      {
                        phase: trialPhase || undefined,
                        status: trialStatus || undefined,
                        india_only: trialIndiaOnly,
                      },
                    );
                    setTrialResults(res);
                  } catch {
                    setTrialResults([]);
                  } finally {
                    setTrialLoading(false);
                  }
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-sky-600/80 hover:bg-sky-500 text-[11px] font-ui uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {trialLoading ? "Searching..." : "Find Trials →"}
              </button>

              {trialResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {trialResults.map((t) => (
                    <div
                      key={t.nctId}
                      className="rounded-lg border border-white/[0.12] bg-white/[0.02] px-2.5 py-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-mono text-[10px] text-cream/70">
                          {t.nctId}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[9px] text-cream/70">
                          {t.phase || "N/A"}
                        </span>
                      </div>
                      <div className="text-cream/85 font-body line-clamp-2">
                        {t.title}
                      </div>
                      <div className="mt-0.5 text-cream/40">
                        {t.sponsor}
                      </div>
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[10px] text-sky-300 underline decoration-dotted"
                      >
                        🔗 ClinicalTrials.gov
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "icd10" && (
            <div className="space-y-3">
              <p className="text-[11px] text-cream/65 font-body">
                Live ICD-10 code suggestions as you type.
              </p>
              <input
                value={icdQuery}
                onChange={(e) => setIcdQuery(e.target.value)}
                placeholder="e.g. pneumonia, pleural effusion, cardiomegaly"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-cream/80 outline-none"
              />
              {icdLoading && (
                <p className="text-[11px] text-cream/40 font-ui">
                  Searching ICD-10 suggestions…
                </p>
              )}
              {!icdLoading &&
                Object.keys(groupedIcdResults).length > 0 && (
                  <div className="max-h-64 overflow-y-auto pr-1 space-y-2 text-[11px]">
                    {Object.entries(groupedIcdResults).map(
                      ([cat, items]) => (
                        <div key={cat}>
                          <div className="font-ui text-[10px] tracking-[0.16em] uppercase text-cream/35 mb-0.5">
                            {cat}
                          </div>
                          <ul className="space-y-0.5">
                            {items.map((s) => (
                              <li
                                key={s.code}
                                className="flex items-center justify-between gap-2 bg-white/[0.02] border border-white/[0.08] rounded-md px-2 py-1"
                              >
                                <div>
                                  <span className="font-mono text-[10px] text-cream/80 mr-1">
                                    [{s.code}]
                                  </span>
                                  <span className="text-cream/80">
                                    {s.description}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="px-2 py-0.5 rounded-full border border-white/[0.16] text-[10px] font-ui uppercase tracking-[0.14em] text-cream/70"
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      s.code,
                                    )
                                  }
                                >
                                  📋 Copy
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


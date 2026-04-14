"use client";

import { useCallback, useState } from "react";
import type {
  AIInterpretationReport,
  AIOrchestrationStage,
  InterrogateResult,
  InterrogatorQuestion,
} from "@/lib/analyse/types";
import {
  detectModalityOrchestration,
  interpretOrchestration,
  interrogateOrchestration,
} from "@/lib/analyse/api";
import { AI_ORCHESTRATION_ENABLED } from "@/lib/analyse/constants";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf("base64,");
      resolve(i >= 0 ? s.slice(i + 7) : s);
    };
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function useAIOrchestration(subscriptionTier?: string) {
  const [stage, setStage] = useState<AIOrchestrationStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<InterrogatorQuestion[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<AIInterpretationReport | null>(null);
  const [detectedModality, setDetectedModality] = useState<string | null>(null);
  /** Final modality key used for Labs quota (auto-detect resolved key or user selection). */
  const [resolvedModalityKey, setResolvedModalityKey] = useState<string | null>(null);
  const [interrogatorMeta, setInterrogatorMeta] = useState<InterrogateResult | null>(null);
  /** Confidence from auto-detect only (0–100); null if not applicable. */
  const [detectedConfidence, setDetectedConfidence] = useState<number | null>(null);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setQuestions([]);
    setSessionId(null);
    setReport(null);
    setDetectedModality(null);
    setResolvedModalityKey(null);
    setInterrogatorMeta(null);
    setDetectedConfidence(null);
  }, []);

  const start = useCallback(
    async (opts: {
      file: File;
      modalityKey: string;
      imageMime?: string;
      signal?: AbortSignal;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!AI_ORCHESTRATION_ENABLED) {
        const msg = "AI orchestration is disabled";
        setError(msg);
        setStage("error");
        return { ok: false, error: msg };
      }
      setError(null);
      setReport(null);
      setQuestions([]);
      setSessionId(null);
      setInterrogatorMeta(null);
      setResolvedModalityKey(null);
      setDetectedConfidence(null);

      let mk = opts.modalityKey;
      const mime = opts.imageMime || opts.file.type || "image/jpeg";
      const b64 = await fileToBase64(opts.file);

      try {
        if (mk === "auto") {
          setStage("detecting");
          const det = await detectModalityOrchestration(
            { image_b64: b64, image_mime: mime },
            { subscriptionTier, signal: opts.signal }
          );
          if (!det.modality_key || det.modality_key === "unknown") {
            throw new Error(det.reason || "Could not detect modality");
          }
          mk = det.modality_key;
          setDetectedModality(mk);
          setResolvedModalityKey(mk);
          setDetectedConfidence(
            typeof det.confidence === "number" && !Number.isNaN(det.confidence)
              ? Math.round(det.confidence)
              : null
          );
        } else {
          setDetectedModality(mk);
          setResolvedModalityKey(mk);
          setDetectedConfidence(null);
        }

        setStage("interrogating");
        const iq = await interrogateOrchestration(
          {
            image_b64: b64,
            image_mime: mime,
            modality_key: mk,
          },
          { subscriptionTier, signal: opts.signal }
        );
        setInterrogatorMeta(iq);
        setQuestions(iq.questions || []);
        setSessionId(iq.session_id);
        setStage("answering_questions");
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStage("error");
        return { ok: false, error: msg };
      }
    },
    [subscriptionTier]
  );

  const submitAnswers = useCallback(
    async (
      answers: Array<{ question_id: string; answer: string }>,
      options?: { signal?: AbortSignal }
    ): Promise<{
      report: AIInterpretationReport | null;
      modalityIdForUsage: string | null;
    }> => {
      if (!sessionId) {
        setError("No session");
        setStage("error");
        return { report: null, modalityIdForUsage: resolvedModalityKey };
      }
      setStage("interpreting");
      setError(null);
      try {
        const out = await interpretOrchestration(sessionId, answers, {
          subscriptionTier,
          signal: options?.signal,
        });
        const rep = out.report as AIInterpretationReport;
        setReport(rep);
        setStage("report_ready");
        return {
          report: rep,
          modalityIdForUsage: resolvedModalityKey,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStage("error");
        return { report: null, modalityIdForUsage: resolvedModalityKey };
      }
    },
    [sessionId, subscriptionTier, resolvedModalityKey]
  );

  return {
    stage,
    error,
    questions,
    sessionId,
    report,
    detectedModality,
    detectedConfidence,
    resolvedModalityKey,
    interrogatorMeta,
    start,
    submitAnswers,
    reset,
    isLoading:
      stage === "detecting" ||
      stage === "interrogating" ||
      stage === "interpreting",
  };
}

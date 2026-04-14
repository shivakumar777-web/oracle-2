"use client";
import React, { useState, useRef, useEffect } from "react";
import type {
  PreValidationResponse,
  DiagnosticQuestion,
  ChatMessage,
} from "@/lib/analyse/deepseek-validator";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  validationResult: PreValidationResponse;
  userAnswers: Record<string, string>;
  chatHistory: ChatMessage[];
  onAnswerQuestion: (questionId: string, answer: string) => void;
  onAskQuestion: (question: string) => void;
  onConfirm: () => void;
  onForceProceed: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function AIValidationPanel({
  validationResult,
  userAnswers,
  chatHistory,
  onAnswerQuestion,
  onAskQuestion,
  onConfirm,
  onForceProceed,
  onCancel,
  isProcessing = false,
}: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !isProcessing) {
      onAskQuestion(chatInput.trim());
      setChatInput("");
    }
  };

  const qualityColor = {
    good: "text-emerald-400",
    acceptable: "text-amber-400",
    poor: "text-red-400",
  };

  const qualityBg = {
    good: "bg-emerald-400/10",
    acceptable: "bg-amber-400/10",
    poor: "bg-red-400/10",
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">AI Pre-Validation</h2>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* File Analysis */}
        <div className="glass-panel p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            File Analysis
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">File Type:</span>
              <span className="text-white font-medium">
                {validationResult.fileType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Detected Modality:</span>
              <span className="text-white font-medium">
                {validationResult.detectedModality}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Modality Match:</span>
              <span
                className={`font-medium ${
                  validationResult.modalityMatch
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {validationResult.modalityMatch ? "✓ Aligned" : "✗ Mismatch"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Image Quality:</span>
              <span
                className={`font-medium ${qualityColor[validationResult.imageQuality]}`}
              >
                {validationResult.imageQuality.charAt(0).toUpperCase() +
                  validationResult.imageQuality.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Provisional Opinion */}
        <div className="glass-panel p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Provisional Opinion
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            {validationResult.provisionalOpinion}
          </p>
        </div>

        {/* Diagnostic Questions */}
        {validationResult.questions.length > 0 && (
          <div className="glass-panel p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Diagnostic Questions
              <span className="ml-2 text-slate-500 font-normal">
                (Optional)
              </span>
            </h3>
            <div className="space-y-3">
              {validationResult.questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">•</span>
                    <div className="flex-1">
                      <p className="text-sm text-white mb-1">
                        {q.question}
                      </p>
                      <p className="text-xs text-slate-500 italic">
                        {q.whyItHelps}
                      </p>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Answer (optional)..."
                    value={userAnswers[q.id] || ""}
                    onChange={(e) =>
                      onAnswerQuestion(q.id, e.target.value)
                    }
                    disabled={isProcessing}
                    className="w-full px-3 py-2 text-sm bg-ink-900/50 border border-ink-700 rounded-lg text-white placeholder:text-slate-600 focus:border-accent focus:outline-none disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patient Data Validation */}
        {validationResult.patientDataCompleteness.missingFields.length > 0 && (
          <div className="glass-panel p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Patient Data
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-slate-500 mb-1">Missing Fields:</p>
                <div className="flex flex-wrap gap-1">
                  {validationResult.patientDataCompleteness.missingFields.map(
                    (field, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs bg-amber-400/10 text-amber-400 rounded"
                      >
                        {field}
                      </span>
                    )
                  )}
                </div>
              </div>
              {validationResult.patientDataCompleteness.suggestions.length >
                0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Suggestions:</p>
                    <ul className="text-xs text-slate-400 space-y-1">
                      {validationResult.patientDataCompleteness.suggestions.map(
                        (suggestion, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-accent">→</span>
                            <span>{suggestion}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Chat Interface */}
        <div className="glass-panel p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Ask AI Assistant
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === "user"
                      ? "bg-accent/20 text-white"
                      : "bg-ink-900/50 text-slate-300"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Ask about the image..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isProcessing}
              className="flex-1 px-3 py-2 text-sm bg-ink-900/50 border border-ink-700 rounded-lg text-white placeholder:text-slate-600 focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isProcessing || !chatInput.trim()}
              className="px-4 py-2 text-sm bg-accent text-black font-medium rounded-lg hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </form>
        </div>

        {/* Concerns */}
        {validationResult.concerns.length > 0 && (
          <div className="glass-panel p-4 border-amber-400/30">
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
              Notes
            </h3>
            <ul className="space-y-2">
              {validationResult.concerns.map((concern, idx) => (
                <li key={idx} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-4 border-t border-ink-700">
        <button
          onClick={onConfirm}
          disabled={isProcessing}
          className="w-full py-3 px-4 bg-accent text-black font-semibold rounded-lg hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? "Processing..." : "Send to GPU Inference"}
        </button>
        {validationResult.concerns.length > 0 &&
          !validationResult.readyForInference && (
            <button
              onClick={onForceProceed}
              disabled={isProcessing}
              className="w-full py-2 px-4 bg-ink-800 text-slate-300 font-medium rounded-lg hover:bg-ink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Force Proceed Anyway
            </button>
          )}
      </div>
    </div>
  );
}

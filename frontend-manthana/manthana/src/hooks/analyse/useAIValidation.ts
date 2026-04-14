"use client";
import { useState, useCallback, useRef } from "react";
import {
  validateFile,
  type PreValidationResponse,
  type ChatMessage,
  type PatientContext,
  chatWithDeepSeek,
} from "@/lib/analyse/deepseek-validator";
import { useToast } from "@/hooks/useToast";

export type ValidationStage =
  | "idle"
  | "validating"
  | "awaiting_response"
  | "confirmed"
  | "proceeding";

export interface AIValidationState {
  stage: ValidationStage;
  validationResult: PreValidationResponse | null;
  userAnswers: Record<string, string>;
  chatHistory: ChatMessage[];
  forceProceed: boolean;
  error: string | null;
}

export function useAIValidation() {
  const { addToast } = useToast();
  const [state, setState] = useState<AIValidationState>({
    stage: "idle",
    validationResult: null,
    userAnswers: {},
    chatHistory: [],
    forceProceed: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  /**
   * Start validation with DeepSeek
   */
  const startValidation = useCallback(
    async (
      file: File,
      selectedModality: string,
      patientContext: PatientContext
    ) => {
      setState({
        stage: "validating",
        validationResult: null,
        userAnswers: {},
        chatHistory: [],
        forceProceed: false,
        error: null,
      });

      // Cancel any previous validation
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await validateFile(
          file,
          selectedModality,
          patientContext,
          controller.signal
        );

        setState((prev) => ({
          ...prev,
          stage: "awaiting_response",
          validationResult: result,
          chatHistory: [
            {
              role: "ai",
              content: `I've analyzed your image. Here's what I found:\n\n**File Type**: ${result.fileType}\n**Detected Modality**: ${result.detectedModality}\n**Image Quality**: ${result.imageQuality}\n\n${result.provisionalOpinion}`,
            },
          ],
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Validation failed";
        setState((prev) => ({
          ...prev,
          stage: "idle",
          error: errorMessage,
        }));

        if (errorMessage.includes("API key")) {
          addToast("OpenRouter API key not configured", "error");
        } else {
          addToast(`Validation error: ${errorMessage}`, "error");
        }
      }
    },
    [addToast]
  );

  /**
   * Submit answer to a diagnostic question
   */
  const submitAnswer = useCallback((questionId: string, answer: string) => {
    setState((prev) => ({
      ...prev,
      userAnswers: {
        ...prev.userAnswers,
        [questionId]: answer,
      },
    }));
  }, []);

  /**
   * Ask a follow-up question to DeepSeek
   */
  const askFollowUpQuestion = useCallback(async (question: string) => {
    if (!state.validationResult) {
      return;
    }

    setState((prev) => ({
      ...prev,
      chatHistory: [...prev.chatHistory, { role: "user", content: question }],
    }));

    try {
      const response = await chatWithDeepSeek(
        question,
        state.chatHistory,
        state.validationResult
      );

      setState((prev) => ({
        ...prev,
        chatHistory: [...prev.chatHistory, { role: "ai", content: response }],
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get response";
      addToast(errorMessage, "error");
      setState((prev) => ({
        ...prev,
        chatHistory: [
          ...prev.chatHistory,
          { role: "ai", content: "Sorry, I couldn't process your question." },
        ],
      }));
    }
  }, [state.validationResult, state.chatHistory, addToast]);

  /**
   * Confirm and proceed to GPU inference
   */
  const confirmAndProceed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stage: "proceeding",
    }));
  }, []);

  /**
   * Force proceed even with concerns
   */
  const forceProceedAnyway = useCallback(() => {
    setState((prev) => ({
      ...prev,
      forceProceed: true,
      stage: "proceeding",
    }));
  }, []);

  /**
   * Reset validation state
   */
  const resetValidation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setState({
      stage: "idle",
      validationResult: null,
      userAnswers: {},
      chatHistory: [],
      forceProceed: false,
      error: null,
    });
  }, []);

  /**
   * Cancel current validation
   */
  const cancelValidation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      stage: "idle",
    }));
  }, []);

  return {
    state,
    startValidation,
    submitAnswer,
    askFollowUpQuestion,
    confirmAndProceed,
    forceProceedAnyway,
    resetValidation,
    cancelValidation,
  };
}

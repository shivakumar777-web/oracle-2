"use client";

import type { DeepResearchState } from "@/hooks/useDeepResearch";
import { WorkspaceEmptyState } from "./WorkspaceEmptyState";
import { WorkspaceThinkingState } from "./WorkspaceThinkingState";
import { WorkspaceResultState } from "./WorkspaceResultState";

interface Props {
  state: DeepResearchState;
  onReset: () => void;
  /** Optional: persist current thread + result to research-service (requires auth). */
  onSaveToServer?: () => Promise<void>;
}

export function ResearchWorkspace({
  state,
  onReset,
  onSaveToServer,
}: Props) {
  if (state.result) {
    return (
      <WorkspaceResultState
        result={state.result}
        citationStyle={state.citationStyle}
        onReset={onReset}
        onSaveToServer={onSaveToServer}
      />
    );
  }
  if (state.isResearching) {
    return (
      <WorkspaceThinkingState
        log={state.activityLog}
        query={state.query}
        domains={state.selectedDomains}
        depth={state.depth}
        intent={state.researchIntent}
        sources={state.sourceFilters}
      />
    );
  }
  return <WorkspaceEmptyState selectedDomains={state.selectedDomains} />;
}


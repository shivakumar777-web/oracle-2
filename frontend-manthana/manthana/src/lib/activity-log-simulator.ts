import { ActivityLogEntry } from "@/hooks/useDeepResearch";

type SimulatorConfig = {
  domains: string[];
  sources: string[];
  depth: string;
  intent: string;
};

export function generateActivitySequence(
  config: SimulatorConfig,
): Omit<ActivityLogEntry, "status">[] {
  const steps: Omit<ActivityLogEntry, "status">[] = [];
  let t = 0;

  const addStep = (text: string, delay: number = 900) => {
    steps.push({ id: crypto.randomUUID(), text, timestamp: (t += delay) });
  };

  // Phase 1: Initialise
  addStep("🔱 Initialising deep research engine...", 300);
  addStep(
    `📡 Connecting to ${config.sources.length} knowledge sources...`,
    600,
  );

  // Phase 2: Domain-specific search
  config.domains.forEach((domain) => {
    const domainLabels: Record<string, string> = {
      allopathy: "PubMed / MEDLINE",
      ayurveda: "CCRAS & AYUSH Formulary",
      homeopathy: "HRI Research Database",
      siddha: "CCRS Classical Repository",
      unani: "CCRUM & Ibn Sina Archive",
    };
    addStep(
      `🔍 Searching ${domainLabels[domain] || domain} database...`,
    );
    addStep(
      `✓  Retrieved ${Math.floor(Math.random() * 800 + 200).toLocaleString()} relevant records`,
    );
  });

  // Phase 3: Source-specific
  if (config.sources.includes("cochrane")) {
    addStep("🔍 Querying Cochrane systematic reviews...");
    addStep(
      `✓  Found ${Math.floor(Math.random() * 40 + 5)} applicable systematic reviews`,
    );
  }
  if (config.sources.includes("clinicaltrials")) {
    addStep("🔍 Scanning ClinicalTrials.gov registry...");
    addStep(
      `✓  Identified ${Math.floor(Math.random() * 60 + 10)} relevant clinical trials`,
    );
  }

  // Phase 4: Cross-tradition (if multiple domains)
  if (config.domains.length > 1) {
    addStep("🧩 Cross-referencing multi-tradition evidence...");
    addStep(
      `✓  Mapped ${Math.floor(Math.random() * 20 + 5)} cross-tradition correlates`,
    );
    addStep("⚖️  Analysing convergences and divergences...");
  }

  // Phase 5: Intent-specific
  if (config.intent === "systematic-review") {
    addStep("📊 Applying PRISMA framework filters...");
    addStep("✓  Quality assessment (RoB 2.0) complete");
  }
  if (config.intent === "thesis") {
    addStep("🎓 Structuring literature review framework...");
    addStep(
      "✓  Citation network mapped — " +
        (Math.floor(Math.random() * 30 + 15)) +
        " primary sources",
    );
  }
  if (config.intent === "drug-herb-research") {
    addStep("🌿 Running pharmacokinetic interaction analysis...");
    addStep("✓  Active constituent database cross-matched");
  }

  // Phase 6: Depth-specific
  if (config.depth === "exhaustive") {
    addStep("🌊 Running exhaustive evidence sweep...");
    addStep("🔍 Scanning grey literature and preprint servers...");
    addStep(
      `✓  ${Math.floor(Math.random() * 200 + 100)} additional sources indexed`,
    );
  }

  // Phase 7: Synthesis
  addStep("🧠 Synthesising evidence with Meditron clinical AI...");
  addStep("📝 Generating structured research report...");
  addStep(
    "🔢 Formatting citations (" +
      (config.intent === "thesis" ? "Vancouver" : "APA") +
      ")...",
  );
  addStep("✅ Research complete — rendering output...", 400);

  return steps;
}

export function estimateResearchTime(config: {
  domains: string[];
  depth: string;
  intent: string;
  targetSeconds?: number;
}): number {
  if (config.targetSeconds && config.targetSeconds > 0) {
    return Math.round(config.targetSeconds);
  }
  const base =
    config.depth === "focused"
      ? 15
      : config.depth === "comprehensive"
      ? 35
      : 75;
  const domainMultiplier = 1 + (config.domains.length - 1) * 0.4;
  const intentBonus =
    config.intent === "systematic-review"
      ? 20
      : config.intent === "thesis"
      ? 15
      : 0;
  return Math.round(base * domainMultiplier + intentBonus);
}


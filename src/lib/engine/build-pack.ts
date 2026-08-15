import type {
  AIAnalysis,
  BuildPackContent,
  Cluster,
  Opportunity,
  SerpResult,
  Settings,
  UtilityType,
} from "@/lib/domain/types";
import { summarizeSerp } from "@/lib/scoring/serp";
import { scoreOpportunity } from "@/lib/scoring/engine";

export interface BuildPackInput {
  opportunity: Opportunity;
  serpResults: SerpResult[];
  analysis: AIAnalysis | null;
  clusters: Cluster[];
  clusterSiblings: Opportunity[];
  settings: Pick<
    Settings,
    "weights" | "thresholds" | "demandCalibration" | "currency"
  >;
}

export interface GeneratedBuildPack {
  content: BuildPackContent;
  claudeCodePrompt: string;
  usedAiAnalysis: boolean;
}

const UTILITY_DEFAULTS: Record<
  UtilityType,
  { inputs: string[]; outputs: string[]; features: string[] }
> = {
  CALCULATOR: {
    inputs: ["The primary numeric quantity the user already knows"],
    outputs: ["The computed result, stated in one prominent line"],
    features: [
      "Live recalculation as any input changes — no submit button",
      "A visible breakdown of how the result was derived",
    ],
  },
  GENERATOR: {
    inputs: ["Optional constraints that shape what is generated"],
    outputs: ["A generated set of results the user can copy individually"],
    features: [
      "Regenerate without losing previous results",
      "Copy-to-clipboard on every generated item",
    ],
  },
  CONVERTER: {
    inputs: ["Source value", "Source unit", "Target unit"],
    outputs: ["Converted value", "The conversion factor used"],
    features: [
      "Swap source and target in one click",
      "A short reference table of the most common conversions for this pair",
    ],
  },
  CHECKER: {
    inputs: ["The value or text to be checked"],
    outputs: ["A pass/fail verdict", "The specific reasons behind the verdict"],
    features: [
      "Explain every failure in plain language",
      "Never send the checked input to a server unless strictly required",
    ],
  },
  LOOKUP: {
    inputs: ["The identifier being looked up"],
    outputs: ["The matched record and its key attributes"],
    features: ["Type-ahead search", "A browsable index for SEO-crawlable depth"],
  },
  FORMATTER: {
    inputs: ["The raw text or data to format"],
    outputs: ["The formatted output, ready to copy"],
    features: ["Client-side only processing", "Copy and download actions"],
  },
  ANALYZER: {
    inputs: ["The artefact to analyse"],
    outputs: ["A structured breakdown of findings"],
    features: ["Show the method, not just the verdict"],
  },
  TEMPLATE: {
    inputs: ["The variables that personalise the template"],
    outputs: ["The filled-in template, ready to copy"],
    features: ["Copy as plain text and as formatted output"],
  },
  OTHER: {
    inputs: ["The primary input the user already has"],
    outputs: ["The single answer the user came for"],
    features: ["Answer above the fold with no interstitial steps"],
  },
};

/**
 * Builds a complete build pack from recorded evidence, optionally enriched by an
 * AI analysis.
 *
 * Everything that is not backed by stored data is routed into `assumptions` so
 * the operator can see exactly which parts of the pack are inference. No
 * external metric is ever invented — unknown metrics are stated as unknown.
 */
export function generateBuildPack(input: BuildPackInput): GeneratedBuildPack {
  const { opportunity, serpResults, analysis, clusterSiblings } = input;
  const assumptions: string[] = [];
  const ai = analysis?.content ?? null;
  const summary = summarizeSerp(serpResults);
  const utilityType = opportunity.utilityType ?? "OTHER";
  const defaults = UTILITY_DEFAULTS[utilityType];

  if (!opportunity.utilityType) {
    assumptions.push(
      "No utility type was recorded, so generic utility defaults were used for inputs, outputs and features.",
    );
  }
  if (!analysis) {
    assumptions.push(
      "No AI analysis exists for this opportunity. Intent, problem definition and differentiation below are derived from the keyword and recorded SERP data only.",
    );
  }
  if (opportunity.searchVolume === null) {
    assumptions.push(
      "Search volume is unknown. Do not assume traffic potential from this pack.",
    );
  }
  if (serpResults.length === 0) {
    assumptions.push(
      "No SERP results were captured, so competitor observations are empty rather than guessed.",
    );
  }

  const productName = ai?.recommendedUtility?.trim() || titleCase(opportunity.keyword);
  const slug = slugify(opportunity.keyword);

  const searchIntent =
    ai?.searchIntent?.trim() ||
    `Users searching "${opportunity.keyword}" want the answer itself, not an explanation of how to get it. Treat this as tool intent: the result must be visible without scrolling or reading.`;

  const problemDefinition =
    ai?.problemDefinition?.trim() ||
    `Someone needs the outcome behind "${opportunity.keyword}" and currently has to either do the work by hand or read through a page that buries the answer.`;

  const competitorObservations = buildCompetitorObservations(serpResults, summary);

  const secondaryKeywords = dedupe([
    ...(ai?.clusterOpportunities ?? []).slice(0, 4),
    ...clusterSiblings.map((s) => s.keyword),
  ]).filter((k) => k.toLowerCase() !== opportunity.keyword.toLowerCase());

  if (secondaryKeywords.length === 0) {
    assumptions.push(
      "No secondary keywords are recorded. Add cluster siblings or an AI analysis before relying on the SEO section.",
    );
  }

  const content: BuildPackContent = {
    productName,
    primaryKeyword: opportunity.keyword,
    secondaryKeywords,
    searchIntent,
    problemDefinition,
    productDescription: `A single-purpose ${utilityType.toLowerCase()} that resolves "${opportunity.keyword}" immediately on page load, with the supporting explanation placed below the tool rather than above it.`,
    inputs: ai?.coreInputs?.length ? ai.coreInputs : defaults.inputs,
    outputs: ai?.expectedOutputs?.length ? ai.expectedOutputs : defaults.outputs,
    businessLogic: [
      "All calculation runs client-side so the tool works instantly and without a backend round-trip.",
      "Validate every input and show the reason for rejection inline, next to the field.",
      "State units, rounding rules and any assumption the result depends on directly beneath the result.",
      "Never silently coerce an invalid input into a plausible-looking number.",
    ],
    coreFeatures: [
      "The tool renders above the fold and is usable with zero clicks beyond typing",
      ...defaults.features,
      "Shareable URL state so a filled-in result can be linked",
    ],
    optionalFeatures: [
      "Print/PDF-friendly output",
      "Locale-aware number and currency formatting",
      "A small worked example pre-filled on first load",
      ...(ai?.possibleDifferentiation ?? []),
    ],
    uxRequirements: [
      "Desktop and mobile parity — most utility traffic is mobile",
      "No modal, no interstitial, no email gate before the result",
      "Keyboard accessible with visible focus states and labelled inputs",
      "Results update within 100ms of an input change",
      "Meets WCAG AA contrast",
    ],
    competitorObservations,
    seoRequirements: [
      `Target the exact phrase "${opportunity.keyword}" in the H1, title and first paragraph`,
      "Tool first, prose second — supporting content lives below the utility",
      "Internal links to sibling utilities in the same cluster",
      "Fast LCP: no blocking third-party scripts above the fold",
    ],
    suggestedSlug: `/${slug}`,
    suggestedTitle: truncate(`${productName} — Free Instant ${labelFor(utilityType)}`, 60),
    metaDescription: truncate(
      `${productName}. ${ai?.productGap?.trim() || `Get the answer to ${opportunity.keyword} instantly — no sign-up, no waiting.`}`,
      155,
    ),
    h1: productName,
    supportingContentOutline: [
      "How this result is calculated (the actual formula or method)",
      "A worked example with real numbers",
      "The edge cases and what the tool does with them",
      "When this answer does not apply",
      "Related utilities in this cluster",
    ],
    faqIdeas: buildFaqIdeas(opportunity.keyword, ai?.jobsToBeDone ?? []),
    structuredData: [
      "WebApplication or SoftwareApplication schema for the tool itself",
      "FAQPage schema for the FAQ block (only for questions genuinely answered on the page)",
      "BreadcrumbList schema linking back to the cluster hub",
    ],
    analyticsEvents: [
      "tool_input_changed",
      "tool_result_generated",
      "tool_result_copied",
      "tool_result_shared",
      "faq_expanded",
      "cluster_link_clicked",
    ],
    monetizationConsiderations: buildMonetizationNotes(opportunity, input.settings.currency),
    relatedUtilityIdeas: ai?.clusterOpportunities ?? [],
    futureClusterOpportunities: clusterSiblings.map(
      (s) => `${s.keyword} (already tracked, score ${s.opportunityScore}/100)`,
    ),
    assumptions,
  };

  return {
    content,
    claudeCodePrompt: renderClaudeCodePrompt(content, input),
    usedAiAnalysis: Boolean(analysis),
  };
}

function buildCompetitorObservations(
  results: SerpResult[],
  summary: ReturnType<typeof summarizeSerp>,
): string[] {
  if (results.length === 0) return [];

  const observations: string[] = [
    `${summary.resultCount} SERP result(s) captured: ${summary.utilityCount} utility, ${summary.articleCount} article, ${summary.directoryCount} directory, ${summary.forumCount} forum, ${summary.ecommerceCount} ecommerce, ${summary.otherCount} other.`,
  ];

  if (summary.lowAuthorityCount > 0) {
    observations.push(
      `${summary.lowAuthorityCount} result(s) explicitly marked low authority.`,
    );
  }
  if (summary.unknownAuthorityCount > 0) {
    observations.push(
      `${summary.unknownAuthorityCount} result(s) have no authority data — treat their strength as unknown, not weak.`,
    );
  }
  if (summary.strongCompetitorCount > 0) {
    observations.push(
      `${summary.strongCompetitorCount} result(s) flagged as strong competitors — the build must be clearly better, not merely equivalent.`,
    );
  }

  for (const result of [...results].sort((a, b) => a.position - b.position).slice(0, 10)) {
    const bits = [`#${result.position} ${result.domain}`, result.pageType.toLowerCase()];
    if (result.domainAuthority !== null) bits.push(`DA ${result.domainAuthority}`);
    if (result.assessment !== "UNCLASSIFIED") {
      bits.push(result.assessment.replace(/_/g, " ").toLowerCase());
    }
    if (result.notes) bits.push(result.notes);
    observations.push(bits.join(" · "));
  }

  return observations;
}

function buildFaqIdeas(keyword: string, jobs: string[]): string[] {
  const base = [
    `How is ${keyword} calculated?`,
    `Is this ${keyword} tool free?`,
    `How accurate is this ${keyword} result?`,
    `When should you not rely on ${keyword}?`,
  ];
  return dedupe([...base, ...jobs.map((job) => `How do I ${job.toLowerCase()}?`)]).slice(0, 8);
}

function buildMonetizationNotes(
  opportunity: Opportunity,
  currency: string,
): string[] {
  const notes: string[] = [];
  if (opportunity.cpc === null) {
    notes.push(
      "CPC is unknown, so commercial value cannot be estimated from the recorded data.",
    );
  } else {
    notes.push(
      `Recorded CPC is ${opportunity.cpc.toFixed(2)} ${currency}, which is the only commercial signal captured for this keyword.`,
    );
  }
  notes.push(
    "Display advertising is the default fit for utility traffic, placed below the result and never above it.",
  );
  notes.push(
    "Check for an affiliate offer that matches the moment of use — utility intent converts when the next step is obvious.",
  );
  notes.push(
    "Do not gate the result. Gating a single-answer utility destroys the ranking signal it depends on.",
  );
  return notes;
}

/**
 * Renders the ready-to-paste Claude Code prompt.
 *
 * The prompt carries the full evidence base and an explicit instructions block
 * telling the downstream build agent which parts are measured and which are
 * assumed.
 */
function renderClaudeCodePrompt(
  content: BuildPackContent,
  input: BuildPackInput,
): string {
  const { opportunity, serpResults, analysis, settings } = input;
  const breakdown = scoreOpportunity(opportunity, {
    weights: settings.weights,
    thresholds: settings.thresholds,
    demandCalibration: settings.demandCalibration,
  });
  const summary = summarizeSerp(serpResults);

  const unknown = "unknown (not recorded)";
  const list = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "- (none recorded)";

  return `# Build: ${content.productName}

You are building a single, production-quality SEO web utility. Build the whole thing: working tool, page content, metadata and analytics hooks.

## Non-negotiable rules

1. The tool must work fully client-side and produce its answer without a page reload.
2. The answer appears above the fold. Supporting content goes below the tool.
3. No email gate, no modal, no interstitial before the result.
4. Every number the tool outputs must be explainable on the page — show the method.
5. Do not invent statistics, citations or authority claims in the page copy.

## Target query

- Primary keyword: **${content.primaryKeyword}**
- Country / language: ${opportunity.country} / ${opportunity.language}
- Utility type: ${opportunity.utilityType ?? "not recorded — treat as a general utility"}
- Secondary keywords:
${list(content.secondaryKeywords)}

## Measured data (facts — do not contradict these)

| Metric | Value |
| --- | --- |
| Search volume | ${opportunity.searchVolume === null ? unknown : `${formatInt(opportunity.searchVolume)}/mo`} |
| Keyword difficulty | ${opportunity.keywordDifficulty ?? unknown} |
| CPC | ${opportunity.cpc === null ? unknown : `${opportunity.cpc.toFixed(2)} ${settings.currency}`} |
| Trend | ${opportunity.trend} |
| Opportunity score | ${breakdown.total}/100 (${breakdown.decision}) |
| Score completeness | ${breakdown.completeness}% of scoring weight backed by data |
| SERP results captured | ${summary.resultCount} |
| Low-authority results | ${summary.lowAuthorityCount} |
| Utility results already ranking | ${summary.utilityCount} |
| Article results | ${summary.articleCount} |

${
  breakdown.missingFactors.length
    ? `> Unscored factors: ${breakdown.missingFactors.join(", ")}. Treat the opportunity score as a lower bound.`
    : "> All scoring factors have data."
}

## SERP evidence

${list(content.competitorObservations)}

## Product definition

**Problem**: ${content.problemDefinition}

**Search intent**: ${content.searchIntent}

**Description**: ${content.productDescription}

### Inputs
${list(content.inputs)}

### Outputs
${list(content.outputs)}

### Business logic
${list(content.businessLogic)}

### Core features
${list(content.coreFeatures)}

### Optional features (only if they cost nothing in speed)
${list(content.optionalFeatures)}

### UX requirements
${list(content.uxRequirements)}

## SEO deliverables

- URL slug: \`${content.suggestedSlug}\`
- Title tag: ${content.suggestedTitle}
- Meta description: ${content.metaDescription}
- H1: ${content.h1}

### Requirements
${list(content.seoRequirements)}

### Supporting content outline
${list(content.supportingContentOutline)}

### FAQ
${list(content.faqIdeas)}

### Structured data
${list(content.structuredData)}

## Analytics events to emit
${list(content.analyticsEvents)}

## Monetization
${list(content.monetizationConsiderations)}

## Cluster context
${list(content.futureClusterOpportunities.length ? content.futureClusterOpportunities : content.relatedUtilityIdeas)}

## ⚠️ Assumptions — verify before relying on these
${list(content.assumptions)}

${
  analysis
    ? `## AI interpretation (from ${analysis.provider}${analysis.model ? ` / ${analysis.model}` : ""}) — NOT measured data

Recommendation: ${analysis.content.recommendation} (confidence: ${analysis.content.confidence})

**Reasons to build**
${list(analysis.content.reasonsToBuild)}

**Reasons NOT to build**
${list(analysis.content.reasonsNotToBuild)}

**Risks**
${list(analysis.content.risks)}`
    : "## AI interpretation\n\nNo AI analysis was available. This pack is derived from recorded data only."
}

## Definition of done

- The utility produces a correct result for the worked example in the supporting content.
- Lighthouse: no render-blocking resources above the fold; LCP under 2.5s on a mid-tier mobile device.
- All analytics events above fire with the documented names.
- Every FAQ question on the page is genuinely answered on the page.
- Metadata matches the title, description, H1 and slug specified above.
`;
}

// --- helpers ---------------------------------------------------------------

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function labelFor(utilityType: UtilityType): string {
  return titleCase(utilityType.toLowerCase());
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

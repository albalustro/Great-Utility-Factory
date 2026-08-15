import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { DECISIONS } from "@/lib/domain/types";
import type {
  AIAnalysisRequest,
  AIAnalysisResult,
  AIProvider,
  ProviderStatus,
} from "@/lib/providers/types";
import { ProviderNotConfiguredError } from "@/lib/providers/types";

/**
 * Structured output schema. Using a schema rather than free-text parsing means
 * the model cannot return a shape the UI is not prepared to render, and every
 * section (including the mandatory "reasons not to build") is guaranteed present.
 */
const analysisSchema = z.object({
  searchIntent: z.string(),
  jobsToBeDone: z.array(z.string()),
  problemDefinition: z.string(),
  currentSolutionLandscape: z.string(),
  productGap: z.string(),
  recommendedUtility: z.string(),
  coreInputs: z.array(z.string()),
  expectedOutputs: z.array(z.string()),
  possibleDifferentiation: z.array(z.string()),
  clusterOpportunities: z.array(z.string()),
  reasonsToBuild: z.array(z.string()),
  reasonsNotToBuild: z.array(z.string()),
  risks: z.array(z.string()),
  recommendation: z.enum(DECISIONS),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assumptions: z.array(z.string()),
});

const DEFAULT_MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You are the analyst inside Utility Factory, an evidence-based system for deciding which small SEO web utilities are worth building.

You will be given objective data about a keyword opportunity and, when available, the SERP results the operator captured. Your job is interpretation, not measurement.

Hard rules — these are not stylistic preferences:

1. NEVER invent or estimate search volume, keyword difficulty, CPC, traffic, rankings, domain authority, revenue, or any other external metric. If a metric is null in the data you were given, it is unknown. Say "unknown" and reason around it.
2. NEVER assert that a competitor is new, weak, or low-authority unless that was explicitly recorded in the data. An unclassified result is unknown, not weak.
3. Every inference you make that is not directly supported by the supplied data belongs in "assumptions", stated plainly.
4. "reasonsNotToBuild" is mandatory and must be genuine. If you cannot find real reasons not to build, the opportunity is not as good as it looks and you should say so there. Never leave it empty.
5. Set "confidence" from how much real data you were given, not from how appealing the idea is. Sparse data means LOW confidence even for an exciting keyword.
6. Recommend a utility that can realistically be built as a single-purpose page that answers the query immediately.

Be concrete and specific to this keyword. Generic advice that would apply to any calculator is worthless here.`;

export class ClaudeAIProvider implements AIProvider {
  readonly id = "claude";
  readonly label = "Claude (Anthropic)";

  private readonly apiKey: string | undefined;
  private readonly model: string;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  status(): ProviderStatus {
    const configured = Boolean(this.apiKey);
    return {
      id: this.id,
      label: this.label,
      configured,
      detail: configured
        ? `Ready. Analyses will run on ${this.model}.`
        : "ANTHROPIC_API_KEY is not set. Add it to your environment to enable AI analysis.",
      requiredEnv: ["ANTHROPIC_API_KEY"],
      isManual: false,
    };
  }

  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    if (!this.apiKey) {
      throw new ProviderNotConfiguredError("AI", this.status());
    }

    const client = new Anthropic({ apiKey: this.apiKey });

    const response = await client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: {
        effort: "high",
        format: zodOutputFormat(analysisSchema),
      },
      messages: [
        {
          role: "user",
          content: buildUserMessage(request),
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error(
        "The model declined to analyse this opportunity. Review the keyword and notes for anything that may have triggered a safety filter.",
      );
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error(
        "The AI provider returned a response that did not match the expected analysis schema.",
      );
    }

    // Belt and braces: the schema cannot force a non-empty array, and an
    // analysis with no stated downside is not an analysis.
    if (parsed.reasonsNotToBuild.length === 0) {
      parsed.reasonsNotToBuild = [
        "The model did not supply any reasons against building. Treat that as a gap in the analysis, not as an endorsement.",
      ];
    }

    return { content: parsed, model: this.model };
  }
}

function buildUserMessage(request: AIAnalysisRequest): string {
  const { opportunity, serpResults, serpSummary, scoreSummary } = request;
  const unknown = "unknown (not recorded)";

  const serpTable = serpResults.length
    ? serpResults
        .map((result) => {
          const bits = [
            `#${result.position}`,
            result.domain,
            `page type: ${result.pageType}`,
            `domain authority: ${result.domainAuthority ?? "unknown"}`,
            `low authority: ${describeTriState(result.isLowAuthority)}`,
            `new site: ${describeTriState(result.isNewSite)}`,
            `operator assessment: ${result.assessment}`,
          ];
          if (result.title) bits.push(`title: ${result.title}`);
          if (result.notes) bits.push(`notes: ${result.notes}`);
          return `- ${bits.join(" | ")}`;
        })
        .join("\n")
    : "- (no SERP results have been captured for this keyword)";

  return `## Opportunity data (measured — treat as fact)

- Keyword: ${opportunity.keyword}
- Country: ${opportunity.country}
- Language: ${opportunity.language}
- Search volume: ${opportunity.searchVolume === null ? unknown : `${opportunity.searchVolume}/month`}
- Keyword difficulty: ${opportunity.keywordDifficulty ?? unknown}
- CPC: ${opportunity.cpc ?? unknown}
- Trend: ${opportunity.trend}
- Utility type recorded by operator: ${opportunity.utilityType ?? "not recorded"}
- Operator notes: ${opportunity.notes?.trim() || "(none)"}

## Captured SERP results

${serpTable}

## SERP summary (counts of what was actually recorded)

- Results captured: ${serpSummary.resultCount}
- Explicitly marked low authority: ${serpSummary.lowAuthorityCount}
- Explicitly marked new sites: ${serpSummary.newSiteCount}
- Utility pages: ${serpSummary.utilityCount}
- Article pages: ${serpSummary.articleCount}
- Results with NO authority data at all: ${serpSummary.unknownAuthorityCount}

## Current deterministic score

- Opportunity score: ${scoreSummary.total}/100 (${scoreSummary.decision})
- Share of scoring weight backed by data: ${scoreSummary.completeness}%
- Factors with no data: ${scoreSummary.missingFactors.length ? scoreSummary.missingFactors.join(", ") : "none"}

## Task

Analyse this opportunity under the rules in your instructions. Remember that any metric marked unknown above must stay unknown in your analysis, and that "reasonsNotToBuild" must contain real, specific objections.`;
}

function describeTriState(value: boolean | null): string {
  if (value === null) return "unknown";
  return value ? "yes" : "no";
}

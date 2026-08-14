/**
 * LAYER 4 — JUDGMENT
 * Semantic calls a rule cannot make. Batched, strict JSON, tuned
 * conservative per Rule 3: "a false alarm costs more credibility than a
 * miss." Emits provenance: "llm" with a numeric 0-1 llmConfidence, per
 * schema v0.2 (the UI badges this distinctly from rule-based findings).
 *
 * Covers "is this alt text meaningful" (checkId: "image-alt-quality") and
 * link/button label clarity (checkId: "link-name" / "button-name" quality
 * pass — axe already catches missing names; this catches present-but-unclear).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ViolationEvent, BBox } from "../../schema/timeline";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export interface AltTextCandidate {
  selector: string;
  altText: string | null;
  surroundingContext: string;
  bbox: BBox;
}

export interface LabelCandidate {
  selector: string;
  visibleText: string;
  accessibleName: string;
  isIconOnly: boolean;
  bbox: BBox;
}

interface JudgmentVerdict {
  selector: string;
  verdict: "pass" | "fail";
  confidence: number; // 0-1, matches schema v0.2's llmConfidence type directly
  reason: string;
}

const SYSTEM_PROMPT = `You are a conservative accessibility auditor. You will be given a batch of
candidates (images with alt text, or interactive elements with labels) and must judge whether each
one meaningfully conveys its purpose to a screen-reader user.

Rules:
- Be conservative. Only fail an item if a reasonable screen-reader user would genuinely be confused
  or blocked. When in doubt, pass it.
- A false "fail" is worse than a missed "fail". Do not nitpick acceptable-but-imperfect text.
- confidence is a number from 0 to 1 reflecting how sure you are of the verdict.
- Respond with ONLY a JSON array, no markdown fences, no preamble, no commentary. Each element:
  {"selector": string, "verdict": "pass"|"fail", "confidence": number, "reason": string}
- "reason" must be one plain-English sentence a non-technical buyer can understand.`;

async function callJudgment(userPrompt: string): Promise<JudgmentVerdict[]> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as JudgmentVerdict[];
  } catch {
    console.error("[judgment] failed to parse LLM response:", cleaned);
    return []; // fail closed — parse failure is a reliability bug, not a finding
  }
}

export async function judgeAltText(candidates: AltTextCandidate[], t: number): Promise<ViolationEvent[]> {
  if (candidates.length === 0) return [];

  const prompt = `Judge whether each image's alt text meaningfully describes it, given nearby page context.\n\n${candidates
    .map(
      (c, i) =>
        `${i + 1}. selector: ${c.selector}\n   alt text: ${c.altText === null ? "(missing — already flagged by axe, do not re-flag; only judge quality if present)" : JSON.stringify(c.altText)}\n   nearby context: ${JSON.stringify(c.surroundingContext.slice(0, 200))}`
    )
    .join("\n\n")}`;

  const verdicts = await callJudgment(prompt);
  const bySelector = new Map(candidates.map((c) => [c.selector, c]));

  return verdicts
    .filter((v) => v.verdict === "fail")
    .map((v) => {
      const c = bySelector.get(v.selector)!;
      return {
        t,
        type: "violation" as const,
        checkId: "image-alt-quality",
        selector: c.selector,
        wcag: "1.1.1",
        severity: "moderate" as const,
        bbox: c.bbox,
        plainEnglish: v.reason,
        fix: "Rewrite the alt text to describe the image's purpose in context, not just its literal contents.",
        provenance: "llm" as const,
        llmConfidence: v.confidence,
      };
    });
}

export async function judgeLabelClarity(candidates: LabelCandidate[], t: number): Promise<ViolationEvent[]> {
  if (candidates.length === 0) return [];

  const prompt = `Judge whether each control's accessible name clearly conveys what it does out of context (as a screen-reader user tabbing through would hear it, with no surrounding visual cues).\n\n${candidates
    .map(
      (c, i) =>
        `${i + 1}. selector: ${c.selector}\n   visible text: ${JSON.stringify(c.visibleText)}\n   accessible name: ${JSON.stringify(c.accessibleName)}\n   icon-only: ${c.isIconOnly}`
    )
    .join("\n\n")}`;

  const verdicts = await callJudgment(prompt);
  const bySelector = new Map(candidates.map((c) => [c.selector, c]));

  return verdicts
    .filter((v) => v.verdict === "fail")
    .map((v) => {
      const c = bySelector.get(v.selector)!;
      return {
        t,
        type: "violation" as const,
        checkId: c.isIconOnly ? "link-name" : "label-clarity",
        selector: c.selector,
        wcag: "2.4.4",
        severity: "serious" as const,
        bbox: c.bbox,
        plainEnglish: v.reason,
        fix: "Give the control a descriptive accessible name (visible text, aria-label, or aria-labelledby) that makes sense read on its own.",
        provenance: "llm" as const,
        llmConfidence: v.confidence,
      };
    });
}

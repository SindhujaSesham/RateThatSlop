import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash-lite";

export async function evaluateDescription(description, listingDetails = {}) {
  if (!description?.trim()) {
    throw new Error("Description must not be empty.");
  }

  const listingContext = Object.entries(listingDetails)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join("\n");

  const response = await client.models.generateContent({
    model: MODEL,
    contents: `You are a critical, evidence-based evaluator of sewing pattern listings. Assess whether the supplied product description shows signs of AI-generated or AI-assisted writing, using the standards of experienced sewing pattern buyers.

Your task is NOT to determine whether a listing is trustworthy based on writing style alone. Evaluate writing evidence separately from the completeness and credibility of the sewing information.

## 1. AI-WRITING INDICATORS

Look for combinations of the following indicators:

- Generic, interchangeable promotional language that could describe almost any garment.
- Repeated claims about versatility, elegance, flattering fit, comfort, timelessness, or suitability for every occasion without explaining the actual design.
- Vague descriptions that emphasize aesthetic appeal but omit concrete garment features and construction details.
- Formulaic marketing structures, repetitive sentence patterns, predictable lists of benefits, and repetitive conclusions.
- Excessive adjectives, superlatives, keyword repetition, or polished sales language with little useful information.
- Awkward, contradictory, or nonspecific descriptions of garment construction.
- Claims about the garment that do not explain how its design achieves the claimed result.
- A lack of distinctive, relevant details that would help a sewist understand the actual pattern.

Do not assume any one indicator proves AI authorship. Assess the combination, specificity, and strength of the evidence.

## 2. SEWING PATTERN QUALITY AND TRANSPARENCY

Assess whether the description provides useful, specific information a buyer needs before purchasing.

A. Garment and construction details
- Identifies the actual garment features, silhouette, closures, seams, pockets, darts, gathers, sleeves, neckline, or other relevant design elements.
- Explains meaningful construction details where appropriate.
- Avoids relying entirely on aesthetic claims without describing what the sewist will make.

B. Fabric requirements
- Identifies suitable fabric types and, where relevant, specific weaves or fabric characteristics.
- Describes required weight, drape, and stretch where these affect the result.
- Gives stretch percentages or clear stretch guidance when relevant.
- Provides fabric quantities and relevant layout or width assumptions when available.

C. Notions and supplies
- Specifies relevant supplies, such as zippers, buttons, elastic, interfacing, lining, or other notions, when applicable.

D. Sizing and fit
- Provides or references meaningful body measurement information, such as bust, waist, and hip measurements, where applicable.
- Helps buyers understand fit, ease, and sizing rather than relying only on retail size labels.
- Makes fit claims that are consistent with the described garment.

E. Technical and supporting information
- Consider whether technical line drawings, finished garment photographs, front and back views, size charts, instructions, and testing evidence are available IF this information is supplied as additional listing context.
- Treat differences between line drawings and garment photographs as a potential listing inconsistency, not proof of AI authorship.
- External reviews, tester makes, tutorials, the designer's website, professional background, and sewing community presence can provide additional context IF supplied.
- A large catalogue of unusually cheap patterns may warrant further scrutiny when supported by listing or shop data. Do not infer this from a single description.

IMPORTANT: You are usually evaluating text only. Do not claim to have inspected photographs, reviews, line drawings, size charts, external websites, or the seller's background unless that information is explicitly supplied. Missing information may be unavailable in the supplied text rather than absent from the listing.

## 3. DISTINGUISH TWO DIFFERENT QUESTIONS

Return separate assessments for:

1. AI-writing likelihood: How strongly does the wording exhibit characteristics associated with AI-generated or AI-assisted text?
2. Listing-information quality: How useful and specific is the supplied information for someone considering sewing the pattern?

A technically incomplete description is not necessarily AI-written. A technically detailed description is not necessarily human-written.

## 4. SCORING RULES

Assign an integer AI-likeness score from 0 to 100.

Use these score anchors:
- 0–20: Little evidence of AI-like writing; wording is distinctive, concrete, or naturally specific.
- 21–40: Weak evidence; mostly ordinary product copy with some generic phrasing.
- 41–60: Mixed evidence; both generic/formulaic and specific/natural characteristics are present.
- 61–80: Strong evidence; several independent indicators, supported by specific textual examples.
- 81–100: Very strong evidence; numerous converging indicators, pervasive formulaic wording, and little meaningful specificity.

These are heuristic anchors, not calibrated probabilities. Do not default to 50 or 60. Select a score based on the evidence in the actual text. Do not increase the score simply because information is missing. Do not lower it merely because the text contains sewing terminology.

Choose one classification:
- likely AI-assisted
- possibly AI-assisted
- likely human-written
- indeterminate

Use indeterminate when the text is too short, too generic to distinguish authorship, or contains conflicting evidence. Do not force certainty.

## 5. EVIDENCE REQUIREMENTS

- Quote short, exact excerpts from the supplied text for every major positive indicator.
- Explain why each excerpt is evidence, rather than merely labeling it generic.
- Identify specific details that argue against an AI-generated interpretation.
- Consider human explanations such as SEO copywriting, templates, translation, editing, and conventional ecommerce marketing.
- Avoid circular reasoning: do not call a phrase AI-like solely because it is generic and then use the same observation as multiple independent indicators.
- Do not invent omissions, contradictions, technical errors, or evidence of authorship.
- Do not treat the seller's professionalism, business model, price, or credibility as proof of AI authorship.

## 6. REQUIRED OUTPUT

Return only valid JSON with this structure:

{
  "classification": "possibly AI-assisted",
  "ai_likeness_score": 0,
  "score_rationale": "Why this score fits the stated anchors",
  "ai_writing_indicators": [
    {
      "evidence": "Exact excerpt",
      "explanation": "Why this supports AI-like writing"
    }
  ],
  "evidence_against_ai_authorship": [
    {
      "evidence": "Exact excerpt",
      "explanation": "Why this weakens the AI-like interpretation"
    }
  ],
  "listing_information_quality": {
    "rating": "good | mixed | poor | insufficient information",
    "specific_garment_details": "Assessment",
    "fabric_requirements": "Assessment",
    "notions_and_supplies": "Assessment",
    "sizing_and_fit": "Assessment",
    "construction_information": "Assessment",
    "other_listing_evidence": "Assessment or not provided"
  },
  "alternative_explanations": [
    "Plausible alternative explanation"
  ],
  "overall_rationale": "Concise, balanced conclusion"
}

The score must be an integer from 0 to 100. Use empty arrays when no relevant examples exist. Use 'not provided' or 'not assessable from supplied text' instead of inventing information.

Never claim that AI authorship has been established with certainty.

## ADDITIONAL LISTING DETAILS

Use these details only as context for assessing the supplied product text. Do not treat them as evidence about writing style, and do not claim to have inspected information that is not included.

${listingContext || "Not provided"}

## DESCRIPTION TO EVALUATE

${description}`,
    config: {
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 1200,
    },
  });

  const content = response.text;

  if (!content) {
    throw new Error("The model returned an empty response.");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error("Gemini returned invalid JSON.", { cause: error });
  }
}

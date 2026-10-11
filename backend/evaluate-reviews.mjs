import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-3.5-flash-lite";

export async function evaluateReviews(reviewsAndImages) {
  if (!reviewsAndImages || typeof reviewsAndImages !== "object") {
    throw new Error("Reviews and images must be provided.");
  }

  const input = JSON.stringify(reviewsAndImages, null, 2);
  const response = await client.models.generateContent({
    model: MODEL,
    contents: `You are a critical, evidence-based evaluator of customer reviews for a sewing pattern listing. Evaluate what the supplied reviews can and cannot tell a prospective sewist about the quality of the pattern and the authenticity of the reported customer experience.

Do not decide that a listing, seller, or review is fraudulent based on writing style, a sparse review, missing photos, or any single signal. Assess review usefulness, reported sewing outcomes, review-writing AI-likelihood, and review-photo evidence as separate dimensions. These are cautious estimates from limited data, not proof of authenticity or deception.

## 1. UNDERSTAND THE INPUT

The supplied JSON is expected to contain:
- "ratings": optional listing-level rating summary text.
- "reviews": zero or more objects with "text" and "rating" fields.
- "images": listing product images, which are not necessarily customer review photos.
- "reviewImages": images collected from the listing's customer-photo section.

Use the actual fields and values provided. Some values may be empty or absent. Do not treat listing product images as customer review images. In this input shape, review images are a flat collection and are not associated with individual review objects. Do not claim which reviewer submitted a particular image or whether an image illustrates a particular review unless that relationship is explicitly represented in the input.

IMPORTANT IMAGE LIMITATION: This function supplies image URLs and alt text as JSON, not image pixels. You cannot visually inspect a photo or reliably determine whether it is AI-generated from a URL, filename, or alt text. Assess whether review photos are present and how frequently they occur only to the extent the supplied counts support it. Set visual AI-image assessment to "not assessable from supplied image metadata" unless actual image content is explicitly included and available to you. Never infer that an image is AI-generated from its URL, hosting domain, filename, or absence of metadata.

## 2. REVIEW USEFULNESS AND MEANINGFUL CONTENT

Assess whether each review communicates an actual customer experience rather than merely a transaction outcome.

Low-information examples include brief statements such as "Downloaded great", "Thanks", "Love it", or a star rating with no explanation. These may be genuine and positive, but provide little evidence about the pattern's quality or finished result. Do not call them fake just because they are short.

More informative reviews may describe relevant specifics such as:
- Whether the instructions were clear, complete, well illustrated, or easy to follow.
- Whether the pattern was easy or difficult to construct, and which steps or techniques affected that experience.
- Whether sizing, fit, measurements, or adjustments worked as expected, when the reviewer chooses to mention them.
- Fabric choice, notions, printing, assembling pattern pages, or other practical details, when relevant and actually stated.
- The finished garment's appearance, fit, function, or resemblance to the pattern/listing expectations.
- A concrete problem, workaround, success, or limitation, described in a way that sounds grounded in use.

Do not require reviewers to mention any particular topic. A review is not suspicious or low-credibility merely because it omits construction, instructions, fabric, sizing, or photos. Consider detail as a positive indicator of usefulness and potential grounding, not as a mandatory checklist or proof of truth. Do not reward length alone: repetitive, vague, or generic text may remain uninformative despite being long.

Separate these judgments:
- Helpfulness: how much practical information the review provides to another sewist.
- Experience specificity: how clearly the reviewer describes an individual use or outcome.
- Credibility indicators: whether details are coherent and plausibly connected to using a sewing pattern.
- Credibility concerns: concrete inconsistencies, generic repetition across reviews, or other evidence actually present in the supplied data.

A positive review can be useful even if brief; a detailed review can still be mistaken, subjective, incentivized, edited, or AI-assisted. Do not claim verified purchase or independent corroboration unless supplied.

## 3. REPORTED SEWING EXPERIENCE AND PRODUCT VALUE

Summarize what the reviews report about the experience and result. Give particular relevance to useful evidence that the pattern:
- Has instructions that are clear and well written.
- Is manageable or easy to construct, while preserving any stated caveats about skill level or difficult steps.
- Produces a finished garment that looks as expected, fits well, or matches the listing's represented result.
- Has useful sizing guidance, reliable pattern pieces, or other practical qualities.

Do not turn these into required topics. A review that does not mention them should be marked as not discussed, not as evidence of a bad product. Do not conclude the product is high quality solely from positive star ratings or praise. Distinguish direct customer-reported outcomes from your own inference. If reviews report mixed results, preserve the disagreement and describe the evidence on both sides.

## 4. REVIEW TEXT AND POSSIBLE AI ASSISTANCE

Evaluate whether the wording itself has observable characteristics sometimes associated with AI-generated or AI-assisted text. Consider the whole set and individual reviews, including:
- Generic praise that could apply to almost any digital product, with no personal or product-specific detail.
- Repeated, unusually similar phrasing, sentence structure, or sequences of claims across multiple reviews.
- Overly polished, promotional, or uniformly enthusiastic language that reads more like listing copy than a customer recounting an experience.
- Repetitive summaries, formulaic transitions, unnatural specificity, or unsupported claims.
- Conversely, concrete first-person process details, naturally varied wording, relevant caveats, or specific outcomes that are consistent with a plausible sewing experience.

These are weak and fallible cues. A real reviewer may use templates, translate text, write briefly, receive editing help, or use AI to polish wording. A detailed review can be AI-assisted; a generic review can be human-written. Repeated language may come from prompts, common review conventions, or platform UI. Do not treat grammar, spelling, language fluency, length, sentiment, or a high rating alone as proof of AI authorship. Assess text AI-likelihood independently from whether the described experience seems useful or credible.

When reporting concerns, quote short exact excerpts and explain the textual pattern. Avoid making an AI accusation about an identifiable reviewer. Never state authorship as fact.

## 5. REVIEW PHOTO COVERAGE AND IMAGE ASSESSMENT

- Report the number of review text entries and the number of reviewImages supplied.
- When both counts are available, calculate review-photo coverage as reviewImages count divided by review count. Return a numeric proportion from 0 to 1, rounded to two decimal places. If review count is zero, use null and explain that the rate is not calculable. This is a collection-level ratio, not proof that each image corresponds to one distinct reviewer or review.
- Describe photo frequency as a limited contextual observation. Photos can help prospective buyers see customer-made outcomes, but their presence does not verify a review, and their absence is not evidence of suspiciousness.
- Assess whether the provided fields allow any visual judgment about AI-generated imagery. With URL/alt-text-only metadata, return not assessable; do not inspect or imply inspection of the remote URL.
- If actual visual content is explicitly supplied, discuss only visible image evidence, use cautious language, and do not state that AI generation is established. A finished garment that looks polished, unusual, or similar to a listing image is not by itself evidence of AI generation.

## 6. SCORING

Assign an integer review-text AI-likeness score from 0 to 100 for the wording in the supplied reviews, not for the product, seller, star ratings, or image URLs.

Use these heuristic anchors:
- 0–20: Little observable AI-like textual evidence; wording is naturally varied or grounded in specific experience.
- 21–40: Weak evidence; mostly ordinary review language with some generic phrasing.
- 41–60: Mixed or ambiguous evidence; generic/formulaic traits coexist with natural or specific details, or the sample is limited.
- 61–80: Stronger evidence; multiple independent, concrete textual patterns support possible AI assistance.
- 81–100: Very strong textual indicators across sufficient material, such as pervasive formulaic writing and repeated near-identical language. This still is not proof.

Do not force a high score from a small sample. If there is too little text to assess, use classification "indeterminate", score 0, and explain that the score is a placeholder for insufficient evidence rather than evidence of human authorship. Do not increase the score because reviews are short, positive, lack photos, or omit technical topics.

Choose one classification: "likely AI-assisted", "possibly AI-assisted", "likely human-written", or "indeterminate". These labels describe only apparent textual style and are not calibrated probabilities or determinations of actual authorship.

Also assign an integer review-helpfulness score from 0 to 100 reflecting how much practical, pattern-specific information the set gives a prospective sewist. This is not a product-quality score and not a review-authenticity score. If no reviews are supplied, use 0 and mark the assessment insufficient.

## 7. EVIDENCE AND FAIRNESS RULES

- Ground every finding in the supplied reviews, rating summary, or image metadata. Quote short exact review excerpts when useful.
- Do not invent reviewer details, construction steps, image contents, relationships, or listing facts.
- Avoid double-counting one phrase as several independent AI indicators.
- Do not infer deception from lack of detail, lack of photos, a high rating, repeated common phrases, or positive sentiment alone.
- Do not require sewing-specific detail from every reviewer; evaluate usefulness based on what each person chose to share.
- Preserve uncertainty, contradictions, and differences among reviews. Do not let a majority erase meaningful negative or mixed experiences.
- Do not treat review count or photo count as proof of legitimacy, popularity, quality, or fraud.
- Use "not provided" or "not assessable from supplied data" wherever evidence is unavailable.

## 8. REQUIRED OUTPUT

Return only valid JSON with this structure and no markdown fences:

{
  "review_count": 0,
  "review_image_count": 0,
  "review_photo_coverage": null,
  "review_photo_coverage_note": "Not calculable or explain the collection-level ratio and its limitation",
  "review_text_ai_assessment": {
    "classification": "indeterminate",
    "ai_likeness_score": 0,
    "score_rationale": "Evidence-based explanation, including sample-size limits",
    "indicators": [
      {
        "review_index": 0,
        "evidence": "Short exact excerpt or cross-review pattern",
        "explanation": "Why this is or is not a meaningful textual indicator"
      }
    ],
    "evidence_against_ai_assistance": [
      {
        "review_index": 0,
        "evidence": "Short exact excerpt",
        "explanation": "Why this weakens the AI-like interpretation without proving human authorship"
      }
    ],
    "alternative_explanations": ["Plausible non-AI explanation"]
  },
  "review_helpfulness_score": 0,
  "review_helpfulness_rating": "good | mixed | limited | insufficient information",
  "review_usefulness": {
    "meaningful_experience_details": ["Specific information that helps another sewist"],
    "instruction_quality_reports": "What reviews say, or not discussed",
    "construction_difficulty_reports": "What reviews say, or not discussed",
    "fit_and_sizing_reports": "What reviews say, or not discussed",
    "finished_result_reports": "What reviews say, or not discussed",
    "other_practical_details": "What reviews say, or not discussed",
    "low_information_reviews": [
      {
        "review_index": 0,
        "evidence": "Short excerpt",
        "note": "Genuine-sounding sentiment may still provide little practical detail; this is not evidence of fakery"
      }
    ]
  },
  "reported_pattern_experience": {
    "positive_outcomes": ["Reported customer outcomes, with evidence"],
    "mixed_or_negative_outcomes": ["Reported issues or caveats, with evidence"],
    "overall_summary": "Balanced summary of what the reviews do and do not support"
  },
  "review_photo_assessment": {
    "frequency_summary": "Describe counts and coverage cautiously",
    "image_content_assessable": false,
    "ai_generated_image_assessment": "not assessable from supplied image metadata",
    "notes": "Explain that reviewImages are unassociated with individual reviews in this input shape"
  },
  "credibility_assessment": {
    "rating": "some supportive detail | mixed or limited evidence | insufficient information",
    "supporting_signals": ["Specific grounded indicators"],
    "limitations_or_concerns": ["Specific observable limitations, without unsupported accusations"]
  },
  "overall_rationale": "Concise, cautious conclusion about review usefulness and the reported customer experience, not a verdict on seller legitimacy"
}

Use empty arrays when no examples exist. Use null for an uncalculable photo coverage ratio. Scores must be integers from 0 to 100. Use review_index as a zero-based index into the supplied reviews array. Keep output valid JSON, with no trailing commas.

## REVIEWS AND ASSOCIATED LISTING REVIEW IMAGES TO EVALUATE

${input}`,
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

import { evaluateDescription } from "./backend/evaluate-description.mjs";

const description = `
Sew your new favorite everyday tote with the Saturday Market Bag!
This downloadable PDF sewing pattern includes Small, Medium, and Large sizes—perfect for grocery runs, farmer’s market hauls, beach days, errands, and everything in between.

Features:
-PDF sewing pattern with three sizes: Small, Medium & Large
-Fully lined, durable design
-Great for quilting cotton, canvas, linen, or home-decor fabric
-Detailed step-by-step written instructions
-Perfect reusable tote for everyday use

Finished Sizes (see measurements in image)
Small – great for lunch, small market trips, lightweight essentials
Medium – ideal daily carry or craft tote
Large – roomy grocery/farmer’s market bag

Skill Level: Confident Beginner/Intermediate sewist level:
If you can cut fabric, sew straight seams, box corners and use a mattress stitch.

What You Receive
-Instant digital download (PDF)
-Printable pattern pieces
-Step-by-step written instructions
-Diagrams to guide construction
-Fabric/cutting layout recommendations

Perfect For:
Grocery shopping
Farmer’s markets
Everyday errands
Library trips
Travel & beach days
Eco-friendly gift-making
Scrap-friendly sewing

⚠️ Please Note
This is a digital sewing pattern, not a finished bag.
Due to the nature of digital downloads, all sales are final.
`;

try {
  const result = await evaluateDescription(description);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Evaluation failed:", error.message);
}

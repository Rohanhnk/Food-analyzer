# Evaluation status — prompt meal-recognition-v1

## Available

60 synthetic text cases with explicit expected food identities/aliases, declared quantities, units and preparation basis. Coverage includes Indian regional dishes, compound dishes, multiple foods, decimal portions, grams vs kg, volumes, unknown dishes/amounts, raw vs cooked rice, non-food text and instruction-injection attempts.

The evaluation harness distinguishes unrun cases, provider failures, food precision/recall, declared quantity agreement and basis agreement. Unit tests exercise the scorer with known errors so a working scorer does not masquerade as model accuracy.

## Not yet measured

- No paid/live provider requests were executed during implementation: the recognition API key is not configured in this workspace.
- No real food photographs with measured portions were supplied. Image decoding, metadata removal, ownership and provider request formatting are tested using synthetic image fixtures; those are not a food recognition benchmark.
- Real photo classification accuracy, measured mass errors, nutrient errors, provider cost and production latency are unmeasured.

## Collecting the real-world corpus

Add authorized meal photographs with image consent/licensing recorded, stripped metadata, food labels, independently measured edible gram portions, raw/cooked basis, ingredient weights and cooked recipe yield where known. Include regional dishes, multiple dishes, low light, occlusion, oil/ghee variation and known plate/reference-object cases. Keep identity recognition, mass estimation and nutrient-reference errors separate. Reference nutrition must come from an audited catalog rather than the provisional bundled records.

Suggested record fields: `id`, `imagePath`, `permission`, `preparation`, `foods[{name, measuredGrams, basis, referenceSource, referenceVersion}]`, `conditions`, `measurementMethod`. Do not invent measurements or label model-generated estimates as ground truth.

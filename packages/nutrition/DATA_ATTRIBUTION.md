# Nutrition Data Attribution and Catalog Licensing

The bundled dataset is provisional. Source names/IDs are supplied references, not evidence that each cooked dish was transcribed from an authoritative table. No per-record source audit or redistribution permission has been verified in this change. Do not ship it as verified nutrition data. Record table/page or FDC identifiers and derivations, including recipe ingredients and yield, before approval.

## Authoritative Reference Sources

### 1. Indian Food Composition Tables (IFCT 2017)
- **Publisher**: National Institute of Nutrition (NIN), Indian Council of Medical Research (ICMR), Department of Health Research, Ministry of Health and Family Welfare, Government of India.
- **Citation**:
  > Longvah, T., Ananthan, R., Bhaskarachary, K., & Venkaiah, K. (2017). *Indian Food Composition Tables*. National Institute of Nutrition, Indian Council of Medical Research, Hyderabad, India. ISBN: 978-93-84572-02-0.
- **Terms & Redistribution**: Obtain and review the publisher's actual terms before redistributing these values. Citation alone does not establish permission. Earlier fair-use/dissemination claims in this document were unsupported and have been removed.

### 2. USDA FoodData Central (FDC)
- **Publisher**: Agricultural Research Service (ARS), United States Department of Agriculture (USDA).
- **Citation**:
  > U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, Foundation Foods. https://fdc.nal.usda.gov.
- **Terms & Redistribution**:
  - USDA FoodData Central is a work of the U.S. Government and is in the **Public Domain (CC0 1.0 Universal)**.
  - Attribution is maintained per best practices for scientific provenance.

---

## Measurement Basis Standards

Food nutrients are reported per 100 grams edible portion under one of three explicit basis states:

1. **`cooked`**: Food analyzed in its cooked, ready-to-eat state (e.g. boiled rice, cooked dal, tawa-cooked roti, dry sabzi).
   - Captures moisture gain (expansion) or moisture loss (reduction).
   - Accounts for cooking oil/ghee where standard preparations dictate.
2. **`raw`**: Uncooked ingredient state (e.g. raw toor dal, raw basmati rice grain, raw fresh paneer).
   - Used primarily for raw ingredient lists in recipe calculation before cooking yield is applied.
3. **`as-served`**: Unprocessed or minimally processed ready-to-consume foods (e.g. whole milk, curd/dahi, fresh fruit, clarified butter/ghee).

---

## Catalog Upgrades and Immutability Policy

1. **Immutability of Logged Meals**:
   - When a user saves a meal, `@nourish/nutrition` generates a `ProvenanceSnapshot` recording `catalogId`, `source`, `sourceVersion`, `basis`, and `per100gSnapshot`.
   - Any future catalog revision (e.g. upgrading from IFCT 2017 to a future release) **must never mutate historic meal snapshots**. Historical logs preserve the exact numbers logged at that time.
2. **Version Pinning**:
   - Each food item maintains a `sourceVersion` (e.g. `"2017.1"`).
   - Person 2's backend persists this version alongside meal records.

# Nutrition Data Attribution and Catalog Licensing

This document records the provenance, licensing, citation rules, and measurement bases for the verified reference nutrition dataset in `@nourish/nutrition`.

## Authoritative Reference Sources

### 1. Indian Food Composition Tables (IFCT 2017)
- **Publisher**: National Institute of Nutrition (NIN), Indian Council of Medical Research (ICMR), Department of Health Research, Ministry of Health and Family Welfare, Government of India.
- **Citation**:
  > Longvah, T., Ananthan, R., Bhaskarachary, K., & Venkaiah, K. (2017). *Indian Food Composition Tables*. National Institute of Nutrition, Indian Council of Medical Research, Hyderabad, India. ISBN: 978-93-84572-02-0.
- **Terms & Redistribution**:
  - ICMR-NIN provides nutrient values for research, academic, healthcare, and digital health applications under public health dissemination and fair-use informational principles.
  - Commercial and public products must acknowledge ICMR-NIN as the authoritative source and cite the 2017 publication.
  - The tables must not be modified or represented as proprietary data.
- **Methodology**:
  - Primary analytical values derived from representative multi-regional sampling across India.
  - Energy (`kcal`) is determined by physiological fuel factors and validated bomb calorimetry, not simplified Atwater estimates.

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

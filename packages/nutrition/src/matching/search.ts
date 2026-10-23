import type { FoodMatch, FoodRecord } from "../types";
import type { FoodRepository, FoodSearchOptions } from "../repository/interface";
import { normalizeText, tokenize, tokenOverlapRatio } from "./normalize";
import { isGenericCategoryQuery } from "./aliases";

type MatchCandidate = {
  food: FoodRecord;
  score: number;
  matchType: FoodMatch["matchType"];
  matchedTerm: string;
};

/**
 * Searches the food repository using normalized text and aliases.
 * Returns a ranked list of scored matches, with explicit ambiguity flags
 * and empty results when no items match.
 */
export async function searchFoods(
  query: string,
  repository: FoodRepository,
  options?: FoodSearchOptions
): Promise<FoodMatch[]> {
  const normQuery = normalizeText(query);
  if (!normQuery) {
    return [];
  }

  const queryTokens = tokenize(normQuery);
  const allFoods = await repository.listAll();
  const candidates: MatchCandidate[] = [];
  const isGeneric = isGenericCategoryQuery(normQuery);

  for (const food of allFoods) {
    const normName = normalizeText(food.name);
    const normAliases = food.aliases.map(a => normalizeText(a));

    // 1. Exact name match
    if (normName === normQuery) {
      candidates.push({
        food,
        score: 1.0,
        matchType: "exact_name",
        matchedTerm: food.name,
      });
      continue;
    }

    // 2. Exact alias match
    const exactAlias = normAliases.find(a => a === normQuery);
    if (exactAlias) {
      candidates.push({
        food,
        score: 0.98,
        matchType: "exact_alias",
        matchedTerm: exactAlias,
      });
      continue;
    }

    // 3. Name prefix match
    if (normName.startsWith(normQuery)) {
      candidates.push({
        food,
        score: 0.88,
        matchType: "prefix",
        matchedTerm: food.name,
      });
      continue;
    }

    // 4. Alias prefix match
    const prefixAlias = normAliases.find(a => a.startsWith(normQuery));
    if (prefixAlias) {
      candidates.push({
        food,
        score: 0.85,
        matchType: "prefix",
        matchedTerm: prefixAlias,
      });
      continue;
    }

    // 5. Token-level matching
    const nameTokens = tokenize(normName);
    const nameOverlap = tokenOverlapRatio(queryTokens, nameTokens);

    let bestAliasOverlap = 0;
    let bestAlias = "";
    for (const a of normAliases) {
      const aTokens = tokenize(a);
      const ratio = tokenOverlapRatio(queryTokens, aTokens);
      if (ratio > bestAliasOverlap) {
        bestAliasOverlap = ratio;
        bestAlias = a;
      }
    }

    const bestRatio = Math.max(nameOverlap, bestAliasOverlap);
    if (bestRatio >= 1.0) {
      // All query tokens are contained
      const score = nameOverlap >= 1.0 ? 0.80 : 0.75;
      candidates.push({
        food,
        score,
        matchType: "token_match",
        matchedTerm: nameOverlap >= 1.0 ? food.name : bestAlias,
      });
      continue;
    }

    // 6. Substring inclusion in name or alias
    if (normName.includes(normQuery)) {
      candidates.push({
        food,
        score: 0.65,
        matchType: "partial",
        matchedTerm: food.name,
      });
      continue;
    }

    const subAlias = normAliases.find(a => a.includes(normQuery));
    if (subAlias) {
      candidates.push({
        food,
        score: 0.60,
        matchType: "partial",
        matchedTerm: subAlias,
      });
      continue;
    }

    // 7. Partial token overlap (> 50%)
    if (bestRatio >= 0.5) {
      candidates.push({
        food,
        score: 0.35 + bestRatio * 0.2,
        matchType: "partial",
        matchedTerm: nameOverlap >= bestAliasOverlap ? food.name : bestAlias,
      });
    }
  }

  // Filter candidates by threshold
  const threshold = options?.threshold ?? 0.35;
  const filtered = candidates.filter(c => c.score >= threshold);

  if (!filtered.length) {
    return [];
  }

  // Sort descending by score
  filtered.sort((a, b) => b.score - a.score);

  // Determine ambiguity:
  // If the query is a generic umbrella category, or if the top 2 candidates have scores within 0.15 of each other
  // and there is no single unambiguous 1.0 exact match.
  const hasSingleExact = filtered.length === 1 || (filtered[0].score === 1.0 && (filtered.length === 1 || filtered[1].score < 0.95));
  const isAmbiguousQuery = isGeneric || (!hasSingleExact && filtered.length > 1 && (filtered[0].score - filtered[1].score <= 0.15));

  const limit = options?.limit ?? 10;
  const results: FoodMatch[] = filtered.slice(0, limit).map(c =>
    Object.freeze({
      food: c.food,
      score: Number(c.score.toFixed(3)),
      matchType: c.matchType,
      isAmbiguous: isAmbiguousQuery,
      matchedTerm: c.matchedTerm,
    })
  );

  return results;
}

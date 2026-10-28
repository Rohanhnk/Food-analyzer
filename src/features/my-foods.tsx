"use client";
import { useEffect, useState } from "react";
import type { FoodRecord, Nutrients, TrackerClient } from "@/lib/contracts";
import type { FoodInput } from "@/lib/food-input";
const blank = (): FoodInput => ({ name: "", aliases: [], basis: "as-served", source: "", referenceGrams: 100, nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 } });
export function MyFoods({ client }: { client: TrackerClient }) {
  const [draft, setDraft] = useState<FoodInput>(blank);
  const [id, setId] = useState<string>();
  const [foods, setFoods] = useState<FoodRecord[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; client.searchFoods("").then(f => { if (active) setFoods(f); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [client]);
  function edit(food: FoodRecord) {
    setId(food.id); setMessage("");
    setDraft({ name: food.name, aliases: food.aliases, basis: food.basis, source: food.source, referenceGrams: 100, nutrients: { ...food.per100g } });
  }
  return <div className="recipes-layout"><form className="card recipe-form" onSubmit={async e => {
    e.preventDefault(); if (!client.saveFood) return; setBusy(true); setError("");
    try { const saved = await client.saveFood(draft, id); setFoods(current => [...current.filter(f => f.id !== saved.id), saved]); setDraft(blank()); setId(undefined); setMessage("Food saved. You can now find it when logging a meal."); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }}><span className="eyebrow">YOUR REGULAR FOODS</span><h2>{id ? "Update a food" : "Add a food from its label"}</h2><p className="hint">Use packaging values or a reliable nutrition reference. Choose the same raw/cooked basis when weighing your portion.</p>
    <label>Food name<input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. My whey protein" /></label>
    <div className="form-row"><label>Label serving weight (g)<input required type="number" min="0.1" max="10000" step="any" value={draft.referenceGrams || ""} onChange={e => setDraft({ ...draft, referenceGrams: Number(e.target.value) })} /></label><label>Weighed basis<select value={draft.basis} onChange={e => setDraft({ ...draft, basis: e.target.value as FoodRecord["basis"] })}><option value="raw">Raw / dry</option><option value="cooked">Cooked</option><option value="as-served">As served</option></select></label></div>
    <p className="hint">Enter all values for the {draft.referenceGrams || "specified"} g serving above. They will be converted to per 100 g automatically. For liquids, use a weighed gram amount rather than assuming 1 ml = 1 g.</p>
    <div className="target-fields">{([["kcal", "Calories (kcal)"], ["protein", "Protein (g)"], ["carbs", "Carbs (g)"], ["fat", "Fat (g)"]] as [keyof Nutrients, string][]).map(([key, label]) => <label key={key}>{label}<input required type="number" step="any" min="0" value={Number.isNaN(draft.nutrients[key]) ? "" : draft.nutrients[key]} onChange={e => setDraft({ ...draft, nutrients: { ...draft.nutrients, [key]: e.target.value === "" ? NaN : Number(e.target.value) } })} /></label>)}</div>
    <label>Nutrition source<input required maxLength={500} value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Brand and product label, or reference URL" /></label>
    <label>Other names (comma separated)<input value={draft.aliases.join(",")} onChange={e => setDraft({ ...draft, aliases: e.target.value.split(",") })} /></label>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success-text" role="status">{message}</p>}
    <div className="form-actions"><button className="button primary" disabled={busy || !client.saveFood}>{busy ? "Saving…" : "Save food"}</button>{id && <button type="button" className="button ghost" onClick={() => { setDraft(blank()); setId(undefined); }}>Cancel edit</button>}</div>
  </form><section className="recipe-collection"><h2>Your saved foods</h2>{foods.filter(f => f.id.startsWith("personal_")).length ? foods.filter(f => f.id.startsWith("personal_")).map(f => <article key={f.id} className="card recipe-card"><h3>{f.name}</h3><p>{f.basis} · per 100 g</p><p>{f.per100g.kcal.toFixed(1)} kcal · Protein {f.per100g.protein.toFixed(1)} g · Carbs {f.per100g.carbs.toFixed(1)} g · Fat {f.per100g.fat.toFixed(1)} g</p><p>{f.source}</p><button className="button ghost" onClick={() => edit(f)}>Edit {f.name}</button></article>) : <div className="card empty-state"><h3>Start with foods you eat often</h3><p>Add your first label on the left, then choose it in Log a meal.</p></div>}<p className="hint">Updating a food affects new calculations. Previously saved meal snapshots retain their recorded nutrition.</p></section></div>;
}

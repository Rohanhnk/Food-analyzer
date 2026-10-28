"use client";
import { useState } from "react";
import { BookOpen, Check, Pencil, Trash2 } from "lucide-react";
import type { AppData, FoodRecord, MealItem, Nutrients, Recipe, TrackerClient } from "@/lib/contracts";
import { demoItem, sumNutrients, validGrams } from "@/lib/model";
import { FoodPicker } from "./meal-editor";
export function RecipeManager({ data, client, onChange }: { data: AppData; client: TrackerClient; onChange: (d: AppData) => void }) {
  const [name, setName] = useState(""); const [yieldGrams, setYieldGrams] = useState("500");
  const [ingredients, setIngredients] = useState<MealItem[]>([]); const [basis, setBasis] = useState<Record<string, Nutrients>>({});
  const [weights, setWeights] = useState<Record<string, string>>({}); const [editingId, setEditingId] = useState<string | null>(null);
  const [draftId, setDraftId] = useState(() => `temp_${crypto.randomUUID()}`);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [deleting, setDeleting] = useState<string | null>(null);
  const invalid = ingredients.some(i => !validGrams(Number(weights[i.id] ?? i.grams)));
  function reset() { setName(""); setYieldGrams("500"); setIngredients([]); setEditingId(null); setWeights({}); setBasis({}); setDraftId(`temp_${crypto.randomUUID()}`); }
  function add(food: FoodRecord) { const item = demoItem(food, food.servingGrams); setIngredients(current => [...current, item]); setBasis(current => ({ ...current, [item.id]: food.per100g })); }
  function edit(recipe: Recipe) {
    setEditingId(recipe.id); setName(recipe.name); setYieldGrams(String(recipe.cookedYieldGrams)); setIngredients(recipe.ingredients); setWeights({});
    setBasis(Object.fromEntries(recipe.ingredients.map(i => [i.id, { kcal: i.nutrients.kcal / i.grams * 100, protein: i.nutrients.protein / i.grams * 100, carbs: i.nutrients.carbs / i.grams * 100, fat: i.nutrients.fat / i.grams * 100 }])));
  }
  return <div className="recipes-layout"><form className="card recipe-form" onSubmit={async e => {
    e.preventDefault(); if (invalid) return; setBusy(true); setError("");
    try { onChange(await client.saveRecipe({ id: editingId ?? draftId, name: name.trim(), cookedYieldGrams: Number(yieldGrams), ingredients })); setMessage("Recipe saved to your collection. Add a portion from Log a meal."); reset(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }}><span className="eyebrow">FROM YOUR KITCHEN</span><h2>{editingId ? "Edit your recipe" : "Create a favourite"}</h2><div className="form-row"><label>Recipe name<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunday dal" /></label><label>Cooked yield (g)<input required type="number" min="1" max="10000" value={yieldGrams} onChange={e => setYieldGrams(e.target.value)} /></label></div><p className="hint">Weigh each ingredient on its stated raw/cooked basis. Include oil and ghee. Cooked yield is the weight of the entire finished dish.</p>
    <FoodPicker client={client} onAdd={add} />{ingredients.map(item => <div className="plate-item" key={item.id}><div><strong>{item.name}</strong><small>{item.basis}</small></div><label className="weight-input"><input aria-label={`Recipe grams of ${item.name}`} type="number" min="0.1" max="10000" step="0.1" required value={weights[item.id] ?? item.grams} onChange={e => {
      const value = e.target.value; setWeights(current => ({ ...current, [item.id]: value })); const grams = Number(value);
      if (validGrams(grams)) setIngredients(current => current.map(i => i.id === item.id ? { ...i, grams, nutrients: Object.fromEntries(Object.entries(basis[i.id]).map(([key, n]) => [key, n * grams / 100])) as Nutrients } : i));
    }} />g</label><button type="button" className="icon-button danger" aria-label={`Remove recipe ${item.name}`} onClick={() => setIngredients(ingredients.filter(i => i.id !== item.id))}><Trash2 size={16} /></button></div>)}
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success-text" role="status">{message}</p>}<div className="form-actions"><button className="button primary" disabled={busy || !ingredients.length || invalid}><Check size={16} />Save recipe</button>{editingId && <button type="button" className="button ghost" onClick={reset}>Cancel edit</button>}</div>
  </form><section className="recipe-collection"><div className="section-heading"><h2>Your collection</h2><span className="subtle-pill">{data.recipes.length} recipes</span></div>{data.recipes.length ? data.recipes.map(recipe => <article className="card recipe-card" key={recipe.id}><span className="recipe-icon"><BookOpen size={24} /></span><h3>{recipe.name}</h3><p>{recipe.ingredients.length} ingredients · {recipe.cookedYieldGrams} g cooked yield</p><strong>{Math.round(sumNutrients(recipe.ingredients.map(i => i.nutrients)).kcal / recipe.cookedYieldGrams * 100)} <small>kcal / 100 g {client.mode === "demo" ? "· demo estimate" : ""}</small></strong><div className="form-actions"><button className="button ghost" onClick={() => edit(recipe)}><Pencil size={15} />Edit</button><button className="icon-button danger" aria-label={`Delete recipe ${recipe.name}`} onClick={() => setDeleting(recipe.id)}><Trash2 size={16} /></button></div>{deleting === recipe.id && <div className="delete-confirm"><span>Delete this recipe?</span><button className="button danger-button" disabled={busy} onClick={async () => { setBusy(true); try { onChange(await client.deleteRecipe(recipe.id)); if (editingId === recipe.id) reset(); setDeleting(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Delete recipe</button><button className="button ghost" onClick={() => setDeleting(null)}>Keep recipe</button></div>}</article>) : <div className="card empty-state"><BookOpen size={32} /><h3>Your kitchen, captured.</h3><p>Create a recipe, then log a weighed serving from the meal entry screen.</p></div>}</section></div>;
}

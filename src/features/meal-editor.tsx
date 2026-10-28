"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import type { AnalysisResult, FoodRecord, Meal, MealItem, Recipe, TrackerClient } from "@/lib/contracts";
import { demoItem, localDate, mealTotal, validGrams } from "@/lib/model";

export function FoodPicker({ client, onAdd }: { client: TrackerClient; onAdd: (food: FoodRecord) => void }) {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState<FoodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    client.searchFoods(query).then(result => { if (active) { setFoods(result); setLoading(false); } }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [query, client]);
  return <div className="food-picker">
    <label className="search-field"><Search size={18} /><input aria-label="Search foods" placeholder="Search foods, like roti, dal or paneer…" value={query} onChange={e => { setQuery(e.target.value); setLoading(true); setError(""); }} /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <div className="food-results" aria-live="polite">
      {loading ? <p className="muted">Searching foods…</p> : foods.length ? foods.map(food => <button key={food.id} type="button" className="food-result" onClick={() => onAdd(food)} aria-label={`Add ${food.name}`}>
        <span className="food-symbol">{food.category === "Protein" ? "◒" : food.category === "Fruit" ? "◐" : "✳"}</span><span><strong>{food.name}</strong><small>{food.servingLabel} · {food.basis}</small></span><Plus size={18} />
      </button>) : <p className="empty-inline">No matching food. Add a label in My foods, then return here.</p>}
    </div>
  </div>;
}

export function MealEditor({ client, initial, recipes = [], onSave, onCancel }: { client: TrackerClient; initial?: Meal; recipes?: Recipe[]; onSave: (meal: Meal) => Promise<void>; onCancel?: () => void }) {
  const [draftId] = useState(() => initial?.id ?? `temp_${crypto.randomUUID()}`);
  const [tab, setTab] = useState<"manual" | "text" | "image">("manual");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? localDate());
  const [type, setType] = useState<Meal["type"]>(initial?.type ?? "Lunch");
  const [items, setItems] = useState<MealItem[]>(initial?.items ?? []);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [text, setText] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const photoUrl = useRef<string | null>(null);
  useEffect(() => () => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); }, []);
  const [preview, setPreview] = useState<{ signature: string; items?: MealItem[]; error?: string; warnings?: string[] } | null>(null);
  const signature = JSON.stringify(items.map(i => [i.id, i.foodId, i.recipeId, i.grams]));
  const previewReady = !client.previewMeal || (preview?.signature === signature && !!preview.items);
  const reviewedItems = preview?.signature === signature && preview.items ? preview.items : items;
  const totals = mealTotal({ items: reviewedItems });
  const invalidWeight = items.some(i => !validGrams(Number(weights[i.id] ?? i.grams)));
  useEffect(() => {
    if (!client.previewMeal || !items.length || invalidWeight) return;
    let active = true;
    client.previewMeal(items).then(result => { if (active) setPreview({ signature, items: result.items, warnings: result.warnings }); }).catch(e => { if (active) setPreview({ signature, error: e.message }); });
    return () => { active = false; };
  }, [client, items, invalidWeight, signature]);
  function addRecipe(recipe: Recipe) {
    const total = mealTotal({ items: recipe.ingredients });
    const food: FoodRecord = { id: recipe.id, name: recipe.name, aliases: [], category: "Recipe", basis: "cooked", source: "My recipe", sourceVersion: "1", servingGrams: 100, servingLabel: "100 g cooked", per100g: { kcal: total.kcal / recipe.cookedYieldGrams * 100, protein: total.protein / recipe.cookedYieldGrams * 100, carbs: total.carbs / recipe.cookedYieldGrams * 100, fat: total.fat / recipe.cookedYieldGrams * 100 } };
    setItems(current => [...current, { ...demoItem(food, 100), recipeId: recipe.id }]); setConfirmed(false);
  }
  function addFood(food: FoodRecord, grams = food.servingGrams) { setItems(current => [...current, demoItem(food, grams)]); setConfirmed(false); }
  function changeWeight(item: MealItem, value: string) {
    setWeights(w => ({ ...w, [item.id]: value })); setConfirmed(false);
    const grams = Number(value);
    if (validGrams(grams)) setItems(current => current.map(i => i.id === item.id ? { ...i, grams, nutrients: { kcal: i.nutrients.kcal * grams / i.grams, protein: i.nutrients.protein * grams / i.grams, carbs: i.nutrients.carbs * grams / i.grams, fat: i.nutrients.fat * grams / i.grams }, confirmed: false } : i));
  }
  async function reviewResult(result: AnalysisResult) {
    const notices = [...result.warnings];
    const candidates: MealItem[] = [];
    for (const detected of result.foods) {
      notices.push(...detected.warnings.map(w => `${detected.name}: ${w}`));
      if (detected.matches && !detected.matchedFoodId) { notices.push(`Select the correct preparation for “${detected.name}” below.`); continue; }
      const matches = await client.searchFoods(detected.name);
      const food = detected.matchedFoodId ? matches.find(f => f.id === detected.matchedFoodId) : matches.find(f => !detected.basis || f.basis === detected.basis);
      if (!food) { notices.push(`“${detected.name}” needs a manual match. Search below.`); continue; }
      // Live recognition never silently invents weights from counts/volumes.
      if (detected.matches && detected.unit !== "g") { notices.push(`Add ${food.name} below and confirm its weight in grams.`); continue; }
      const grams = detected.unit === "g" ? detected.quantity : detected.quantity ? detected.quantity * food.servingGrams : null;
      if (grams && validGrams(grams)) candidates.push(demoItem(food, grams));
      else notices.push(`Enter a weight for ${detected.name}.`);
    }
    setItems(current => [...current, ...candidates]); setWarnings(Array.from(new Set(notices))); setConfirmed(false);
  }
  async function analyze() {
    setBusy(true); setError("");
    try { await reviewResult(await client.analyzeText(text)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function analyzePhoto() {
    if (!photoFile || !client.analyzePhoto) return;
    setBusy(true); setError("");
    try { await reviewResult(await client.analyzePhoto(photoFile)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!items.length || !confirmed || invalidWeight || !previewReady) return;
    setBusy(true); setError("");
    try { await onSave({ id: draftId, title: title.trim() || `${type} plate`, date, type, items: reviewedItems.map(i => ({ ...i, confirmed: true })), inputType: initial?.inputType ?? tab, createdAt: initial?.createdAt ?? new Date().toISOString() }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="editor-grid" onSubmit={save}>
    <div className="card editor-main">
      <div className="card-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2>{initial ? "Edit your meal" : "What’s on your plate?"}</h2></div>{onCancel && <button type="button" className="icon-button" aria-label="Cancel editing" onClick={onCancel}><X size={20} /></button>}</div>
      <div className="tabs" aria-label="Meal input method">{([['manual', 'Find a food', Search], ['text', 'Describe it', Sparkles], ['image', 'Add a photo', Camera]] as const).filter(([key]) => client.mode !== "live" || process.env.NEXT_PUBLIC_ENABLE_AI === "true" || key === "manual").map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} />{label}</button>)}</div>
      {tab === "text" && <div className="input-panel"><label htmlFor="meal-description">Describe your meal</label><textarea id="meal-description" value={text} onChange={e => setText(e.target.value)} placeholder="2 rotis and 100g paneer" rows={3} maxLength={2000} /><p className="hint">{client.analyzePhoto ? "AI suggests foods for your review. Confirm all preparation details and portions." : "This demo recognizes a few common foods without calling an AI service."}</p><button type="button" className="button secondary" disabled={busy || !text.trim()} onClick={analyze}><Sparkles size={16} />{busy ? "Interpreting…" : (client.analyzePhoto ? "Interpret meal" : "Try demo interpretation")}</button></div>}
      {tab === "image" && <div className="input-panel"><label className="upload-zone"><Camera size={30} /><strong>Add a photo of your meal</strong><span>JPEG, PNG or WebP · up to 5 MB</span><input aria-label="Meal photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image no larger than 5 MB."); e.target.value = ""; return; }
        if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
        photoUrl.current = URL.createObjectURL(file); setPhoto(photoUrl.current); setPhotoFile(file); setError("");
      }} /></label>{photo && <div className="photo-preview"><Image src={photo} alt="Your selected meal" width={640} height={400} unoptimized /><button type="button" className="button ghost" onClick={() => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); photoUrl.current = null; setPhoto(null); setPhotoFile(null); }}>Remove photo</button></div>}{photoFile && client.analyzePhoto && <button type="button" className="button secondary" disabled={busy} onClick={analyzePhoto}><Sparkles size={16} />{busy ? "Analyzing photo…" : "Analyze photo"}</button>}<p className="hint">{client.analyzePhoto ? "Analyze sends this photo to the AI provider after metadata removal. The app deletes its temporary upload after analysis; it is not saved with the meal. Confirm foods and weights yourself." : "Photo preview only in demo mode. It stays on this device and is not saved with the meal."}</p></div>}
      {warnings.length > 0 && <div className="notice" role="status">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
      <FoodPicker client={client} onAdd={addFood} />
      {recipes.length > 0 && <div className="recipe-picker"><h3>Saved recipes</h3><div className="food-results">{recipes.map(recipe => <button type="button" className="food-result" key={recipe.id} onClick={() => addRecipe(recipe)} aria-label={`Add recipe ${recipe.name}`}><span><strong>{recipe.name}</strong><small>Start with 100 g cooked, then enter your portion</small></span><Plus size={16} /></button>)}</div></div>}
      <div className="section-label"><h3>Your plate</h3><span>{items.length} {items.length === 1 ? "item" : "items"}</span></div>
      {!items.length && <div className="empty-state small"><span className="empty-symbol">◌</span><h3>A fresh plate</h3><p>Choose a food above to start building your meal.</p></div>}
      {items.map((item, index) => <div className="plate-item" key={item.id}><div><strong>{item.name}</strong><small>{item.basis} · {Math.round(reviewedItems[index]?.nutrients.kcal ?? item.nutrients.kcal)} kcal</small></div><label className="weight-input"><input aria-label={`Grams of ${item.name}`} type="number" min="0.1" max="10000" step="0.1" value={weights[item.id] ?? item.grams} onChange={e => changeWeight(item, e.target.value)} required />g</label><button type="button" className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => { setItems(items.filter(i => i.id !== item.id)); setConfirmed(false); }}><Trash2 size={16} /></button></div>)}
      {invalidWeight && <p role="alert" className="error">Each weight must be greater than 0 and at most 10,000 g. Totals update after a valid weight is entered.</p>}
    </div>
    <aside className="card meal-review"><span className="eyebrow">A LITTLE CHECK-IN</span><h2>Review your meal</h2><label>Meal name<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My everyday thali" maxLength={80} /></label><div className="form-row"><label>Meal<select value={type} onChange={e => setType(e.target.value as Meal["type"])}>{["Breakfast", "Lunch", "Dinner", "Snack"].map(t => <option key={t}>{t}</option>)}</select></label><label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label></div>
      <div className="review-calories"><strong>{Math.round(totals.kcal)}</strong><span>kcal · {client.mode === "live" ? "from your saved food values" : "illustrative estimate"}</span></div><div className="macro-trio">{([['Protein', totals.protein], ['Carbs', totals.carbs], ['Fat', totals.fat]] as const).map(([label, value]) => <div key={label}><strong>{Math.round(value)}<small>g</small></strong><span>{label}</span></div>)}</div>
      <label className="checkbox"><input type="checkbox" disabled={!previewReady} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I’ve reviewed the foods and portion weights.</span></label>
      {client.previewMeal && items.length > 0 && !previewReady && !preview?.error && <p role="status" className="hint">Checking nutrition totals…</p>}
      {preview?.signature === signature && preview.error && <p role="alert" className="error">Could not calculate nutrition: {preview.error}. Change a weight to retry.</p>}
      {preview?.signature === signature && preview.warnings?.map((warning, index) => <p className="hint" key={index}>{warning}</p>)}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary full" type="submit" disabled={busy || !items.length || !confirmed || invalidWeight || !previewReady}>{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{initial ? "Save changes" : "Save meal"}</button><p className="hint">{client.mode === "live" ? "Your confirmed meal is stored in your private account. Label values and weighed portions determine the estimate." : "Demo records are saved in this browser. Nutrition values are illustrative, not verified food facts."}</p>
    </aside>
  </form>;
}

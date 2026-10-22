"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Camera, Check, LoaderCircle, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import type { FoodRecord, Meal, MealItem, TrackerClient } from "@/lib/contracts";
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
      {loading ? <p className="muted">Searching the demo catalog…</p> : foods.length ? foods.map(food => <button key={food.id} type="button" className="food-result" onClick={() => onAdd(food)} aria-label={`Add ${food.name}`}>
        <span className="food-symbol">{food.category === "Protein" ? "◒" : food.category === "Fruit" ? "◐" : "✳"}</span><span><strong>{food.name}</strong><small>{food.servingLabel} · {food.basis}</small></span><Plus size={18} />
      </button>) : <p className="empty-inline">No matching food in this demo catalog. Try “roti”, “paneer” or “rice”.</p>}
    </div>
  </div>;
}

export function MealEditor({ client, initial, onSave, onCancel }: { client: TrackerClient; initial?: Meal; onSave: (meal: Meal) => Promise<void>; onCancel?: () => void }) {
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
  const [photo, setPhoto] = useState<string | null>(null);
  const photoUrl = useRef<string | null>(null);
  useEffect(() => () => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); }, []);
  const totals = mealTotal({ items });
  const invalidWeight = items.some(i => !validGrams(Number(weights[i.id] ?? i.grams)));
  function addFood(food: FoodRecord, grams = food.servingGrams) { setItems(current => [...current, demoItem(food, grams)]); setConfirmed(false); }
  function changeWeight(item: MealItem, value: string) {
    setWeights(w => ({ ...w, [item.id]: value })); setConfirmed(false);
    const grams = Number(value);
    if (validGrams(grams)) setItems(current => current.map(i => i.id === item.id ? { ...i, grams, nutrients: { kcal: i.nutrients.kcal * grams / i.grams, protein: i.nutrients.protein * grams / i.grams, carbs: i.nutrients.carbs * grams / i.grams, fat: i.nutrients.fat * grams / i.grams }, confirmed: false } : i));
  }
  async function analyze() {
    setBusy(true); setError("");
    try {
      const result = await client.analyzeText(text);
      const notices = [...result.warnings];
      const candidates: MealItem[] = [];
      for (const detected of result.foods) {
        const matches = await client.searchFoods(detected.name);
        if (!matches.length) { notices.push(`“${detected.name}” needs a manual match. Search below.`); continue; }
        const food = matches[0];
        const grams = detected.unit === "g" ? detected.quantity : detected.quantity ? detected.quantity * food.servingGrams : food.servingGrams;
        if (grams && validGrams(grams)) candidates.push(demoItem(food, grams));
        else notices.push(`Check the quantity for ${detected.name}.`);
      }
      setItems(current => [...current, ...candidates]); setWarnings(notices); setConfirmed(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!items.length || !confirmed || invalidWeight) return;
    setBusy(true); setError("");
    try { await onSave({ id: initial?.id ?? crypto.randomUUID(), title: title.trim() || `${type} plate`, date, type, items: items.map(i => ({ ...i, confirmed: true })), inputType: initial?.inputType ?? tab, createdAt: initial?.createdAt ?? new Date().toISOString() }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="editor-grid" onSubmit={save}>
    <div className="card editor-main">
      <div className="card-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h2>{initial ? "Edit your meal" : "What’s on your plate?"}</h2></div>{onCancel && <button type="button" className="icon-button" aria-label="Cancel editing" onClick={onCancel}><X size={20} /></button>}</div>
      <div className="tabs" aria-label="Meal input method">{([['manual', 'Find a food', Search], ['text', 'Describe it', Sparkles], ['image', 'Add a photo', Camera]] as const).map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><Icon size={16} />{label}</button>)}</div>
      {tab === "text" && <div className="input-panel"><label htmlFor="meal-description">Describe your meal</label><textarea id="meal-description" value={text} onChange={e => setText(e.target.value)} placeholder="2 rotis and 100g paneer" rows={3} maxLength={2000} /><p className="hint">This demo recognizes a few common foods. Person 4 will connect AI interpretation.</p><button type="button" className="button secondary" disabled={busy || !text.trim()} onClick={analyze}><Sparkles size={16} />{busy ? "Interpreting…" : "Try demo interpretation"}</button></div>}
      {tab === "image" && <div className="input-panel"><label className="upload-zone"><Camera size={30} /><strong>Add a photo of your meal</strong><span>JPEG, PNG or WebP · up to 5 MB</span><input aria-label="Meal photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => {
        const file = e.target.files?.[0]; if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choose a JPEG, PNG or WebP image no larger than 5 MB."); e.target.value = ""; return; }
        if (photoUrl.current) URL.revokeObjectURL(photoUrl.current);
        photoUrl.current = URL.createObjectURL(file); setPhoto(photoUrl.current); setError("");
      }} /></label>{photo && <div className="photo-preview"><Image src={photo} alt="Your selected meal" width={640} height={400} unoptimized /><button type="button" className="button ghost" onClick={() => { if (photoUrl.current) URL.revokeObjectURL(photoUrl.current); photoUrl.current = null; setPhoto(null); }}>Remove photo</button></div>}<p className="hint">Photo preview only: it stays on this device and is not saved with the meal. Add foods below; recognition will be connected by Person 4.</p></div>}
      {warnings.length > 0 && <div className="notice" role="status">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
      <FoodPicker client={client} onAdd={addFood} />
      <div className="section-label"><h3>Your plate</h3><span>{items.length} {items.length === 1 ? "item" : "items"}</span></div>
      {!items.length && <div className="empty-state small"><span className="empty-symbol">◌</span><h3>A fresh plate</h3><p>Choose a food above to start building your meal.</p></div>}
      {items.map(item => <div className="plate-item" key={item.id}><div><strong>{item.name}</strong><small>{item.basis} · {Math.round(item.nutrients.kcal)} kcal</small></div><label className="weight-input"><input aria-label={`Grams of ${item.name}`} type="number" min="0.1" max="10000" step="0.1" value={weights[item.id] ?? item.grams} onChange={e => changeWeight(item, e.target.value)} required />g</label><button type="button" className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => { setItems(items.filter(i => i.id !== item.id)); setConfirmed(false); }}><Trash2 size={16} /></button></div>)}
      {invalidWeight && <p role="alert" className="error">Each weight must be greater than 0 and at most 10,000 g. Totals update after a valid weight is entered.</p>}
    </div>
    <aside className="card meal-review"><span className="eyebrow">A LITTLE CHECK-IN</span><h2>Review your meal</h2><label>Meal name<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My everyday thali" maxLength={80} /></label><div className="form-row"><label>Meal<select value={type} onChange={e => setType(e.target.value as Meal["type"])}>{["Breakfast", "Lunch", "Dinner", "Snack"].map(t => <option key={t}>{t}</option>)}</select></label><label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label></div>
      <div className="review-calories"><strong>{Math.round(totals.kcal)}</strong><span>kcal · illustrative estimate</span></div><div className="macro-trio">{([['Protein', totals.protein], ['Carbs', totals.carbs], ['Fat', totals.fat]] as const).map(([label, value]) => <div key={label}><strong>{Math.round(value)}<small>g</small></strong><span>{label}</span></div>)}</div>
      <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I’ve reviewed the foods and portion weights.</span></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button primary full" type="submit" disabled={busy || !items.length || !confirmed || invalidWeight}>{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}{initial ? "Save changes" : "Save meal"}</button><p className="hint">Demo records are saved in this browser. Nutrition values are illustrative, not verified food facts.</p>
    </aside>
  </form>;
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Coffee, Flame, History, LayoutDashboard, Leaf, LoaderCircle, Pencil, Plus, Salad, Sprout, Sun, Target, Trash2, Utensils, X } from "lucide-react";
import type { AppData, Goal, Meal, MealItem, Recipe, TrackerClient } from "@/lib/contracts";
import { getClient } from "@/lib/client";
import { demoFoods } from "@/lib/demo-foods";
import { demoItem, localDate, mealTotal, prettyDate, shiftDate, sumNutrients } from "@/lib/model";
import { FoodPicker, MealEditor } from "./meal-editor";
export type Section = "dashboard" | "add" | "history" | "recipes" | "goals" | "insights";
const nav = [
  { id: "dashboard", label: "Overview", href: "/", icon: LayoutDashboard },
  { id: "add", label: "Log a meal", href: "/add", icon: Plus },
  { id: "history", label: "Food diary", href: "/history", icon: History },
  { id: "recipes", label: "My recipes", href: "/recipes", icon: BookOpen },
  { id: "goals", label: "My goals", href: "/goals", icon: Target },
  { id: "insights", label: "Insights", href: "/insights", icon: BarChart3 },
] as const;
const headings: Record<Section, [string, string]> = {
  dashboard: ["A little more balanced.", "Small choices, a healthier you. Let’s see how today is shaping up."],
  add: ["Good food. Mindful portions.", "Build your plate, check the details, and make it count."],
  history: ["Your food story.", "Every meal is part of the bigger picture."],
  recipes: ["Made by you.", "Keep your everyday favourites close, down to the last ingredient."],
  goals: ["Find your balance.", "Set targets that fit your routine. You can always adjust them."],
  insights: ["See the bigger picture.", "A week of small choices, all in one place."],
};
export function TrackerApp({ section }: { section: Section }) {
  const router = useRouter();
  const [client, setClient] = useState<TrackerClient | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState("");
  const [date, setDate] = useState(localDate());
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      const service = getClient();
      return service.load().then(result => { if (active) { setClient(service); setData(result); setError(""); const selected = new URLSearchParams(window.location.search).get("date"); if (selected && /^\d{4}-\d{2}-\d{2}$/.test(selected) && !Number.isNaN(new Date(`${selected}T12:00:00`).getTime())) setDate(selected); } });
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [retry, section]);
  useEffect(() => {
    const handleStorage = () => { setRetry(n => n + 1); };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
  async function saveMeal(meal: Meal) {
    if (!client) return;
    setData(await client.saveMeal(meal));
    if (section === "add") router.push(`/history?date=${meal.date}`);
    else setMessage("Meal updated. Your daily totals are up to date.");
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Nourish home"><span className="brand-icon"><Sprout size={26} /></span>nourish<span className="brand-dot">.</span></Link>
      <div className="workspace-tag"><span className="status-dot" />YOUR EVERYDAY WELLNESS</div>
      <nav aria-label="Main navigation">{nav.map(({ id, label, href, icon: Icon }) => <Link key={id} href={href} aria-current={section === id ? "page" : undefined} className={`nav-item ${section === id ? "active" : ""}`}><Icon size={19} />{label}{id === "add" && <span className="nav-plus">+</span>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="gentle-card"><Leaf size={24} /><h3>Progress, at your pace.</h3><p>One balanced plate is a lovely place to start.</p><span className="gentle-leaf">❧</span></div><div className="profile"><span className="avatar">D</span><div><strong>Demo workspace</strong><small>Local to this browser</small></div><CircleHelp size={17} /></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Your workspace <span>/</span> <strong>{nav.find(n => n.id === section)?.label}</strong></div><span className="demo-badge"><span className="status-dot" />Interactive demo</span></header>
      <main id="main-content">
        <div className="page-header"><div><div className="eyebrow">{section === "dashboard" ? "A FRESH PERSPECTIVE, EVERY DAY" : "NOURISH YOUR EVERYDAY"}</div><h1>{headings[section][0]}</h1><p>{headings[section][1]}</p></div>{section !== "add" && <Link href="/add" className="button primary"><Plus size={18} />Log a meal</Link>}</div>
        <div className="demo-note"><span className="note-dot">i</span>Sample meals & illustrative nutrition. Explore freely — changes stay in this browser.</div>
        {message && <div className="success-message" role="status"><Check size={16} />{message}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setMessage("")}><X size={16} /></button></div>}
        {error ? <div className="card empty-state" role="alert"><h2>We couldn’t load your workspace</h2><p>{error}</p><button className="button secondary" onClick={() => setRetry(n => n + 1)}>Try again</button></div> : !data || !client ? <div className="card loading" role="status"><LoaderCircle className="spin" /> Preparing your plate…</div> : <>
          {section === "dashboard" && <Dashboard data={data} date={date} setDate={setDate} />}
          {section === "add" && <MealEditor client={client} onSave={saveMeal} />}
          {section === "history" && <Diary data={data} client={client} date={date} setDate={setDate} onSave={saveMeal} onChange={setData} />}
          {section === "goals" && <Goals data={data} client={client} onChange={setData} onMessage={setMessage} />}
          {section === "recipes" && <Recipes data={data} client={client} onChange={setData} />}
          {section === "insights" && <Insights data={data} date={date} />}
        </>}
        <footer><span><Sprout size={15} /> Made for real food. And real life.</span><span>Be kind to your body.</span></footer>
      </main>
    </div>
  </div>;
}
function DatePicker({ date, setDate }: { date: string; setDate: (date: string) => void }) {
  return <div className="date-picker"><button className="icon-button" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft size={17} /></button><label><span>{date === localDate() ? "Today, " : ""}{prettyDate(date)}</span><input aria-label="Selected date" type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value); }} /></label><button className="icon-button" aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight size={17} /></button></div>;
}
function Dashboard({ data, date, setDate }: { data: AppData; date: string; setDate: (s: string) => void }) {
  const meals = data.meals.filter(m => m.date === date);
  const total = sumNutrients(meals.map(mealTotal));
  const remaining = data.goals.kcal - total.kcal;
  const progress = Math.min(total.kcal / data.goals.kcal, 1);
  return <>
    <div className="section-heading"><h2>Your daily balance <span className="subtle-pill">{data.goals.mode === "maintain" ? "Maintenance" : data.goals.mode === "cut" ? "Cutting" : "Bulking"}</span></h2><DatePicker date={date} setDate={setDate} /></div>
    <div className="balance-grid">
      <section className="card calorie-card"><div className="card-heading"><span className="card-label"><Flame size={17} />Daily energy</span><span className="muted tiny">KCAL</span></div><div className="energy-content"><div className="energy-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="76" className="ring-track" /><circle cx="90" cy="90" r="76" className="ring-progress" strokeDasharray={`${progress * 477.5} 477.5`} /></svg><div><strong>{Math.round(total.kcal).toLocaleString()}</strong><span>of {data.goals.kcal.toLocaleString()} kcal</span></div></div><div className="energy-copy"><span className="eyebrow">{remaining >= 0 ? "ROOM TO NOURISH" : "ABOVE YOUR TARGET"}</span><strong>{Math.round(Math.abs(remaining)).toLocaleString()} <small>kcal</small></strong><p>{remaining >= 0 ? "left in your daily target" : "over your daily target"}</p><span className="soft-label"><Leaf size={13} />{meals.length} meals logged</span></div></div><div className="card-foot"><span className="status-dot" />A little awareness goes a long way.</div></section>
      <div className="macro-cards">{([
        ["Protein", "protein", "For strength & recovery", "protein"],
        ["Carbs", "carbs", "Fuel for your everyday", "carbs"],
        ["Fats", "fat", "A little essential balance", "fat"],
      ] as const).map(([label, key, subtitle, style]) => <section className={`card macro-card ${style}`} key={key}><div className="macro-icon">{key === "protein" ? <Utensils size={17} /> : key === "carbs" ? <Sun size={19} /> : <Leaf size={18} />}</div><div className="macro-info"><div className="macro-title"><strong>{label}</strong><span>{Math.round(total[key])}<small> / {data.goals[key]} g</small></span></div><div className="progress-track"><div style={{ width: `${data.goals[key] > 0 ? Math.min(total[key] / data.goals[key] * 100, 100) : 0}%` }} /></div><p>{subtitle}</p></div></section>)}</div>
    </div>
    <div className="lower-grid"><section className="card meals-card"><div className="card-heading"><div><h2>On your plate</h2><p className="muted">A delicious little record of your day.</p></div><Link href="/history" className="text-link">View diary <ArrowRight size={15} /></Link></div>{meals.length ? meals.map(m => <MealRow key={m.id} meal={m} />) : <div className="empty-state small"><Salad size={32} /><h3>Your day is a fresh page</h3><p>Add your first meal to see your daily balance.</p></div>}<Link className="add-meal-row" href="/add"><Plus size={17} />Make room for your next meal</Link></section>
      <aside className="inspiration-card"><span className="eyebrow">ROOTED IN YOUR ROUTINE</span><h2>Familiar food.<br />A fresh perspective.</h2><p>From your morning idli to your everyday dal. Balance belongs on every kind of plate.</p><div className="plate-art" aria-hidden="true"><div className="plate-inner"><div className="art-rice" /><div className="art-dal" /><div className="art-green" /><div className="art-roti" /><div className="art-tomato" /></div><span className="herb one">✳</span><span className="herb two">✳</span></div><Link className="text-link" href="/recipes">Make it your own <ArrowRight size={16} /></Link></aside>
    </div>
    <WeeklyChart data={data} date={date} />
  </>;
}
function MealRow({ meal, actions }: { meal: Meal; actions?: React.ReactNode }) {
  const totals = mealTotal(meal);
  return <div className="meal-row"><div className={`meal-icon ${meal.type.toLowerCase()}`}>{meal.type === "Breakfast" ? <Coffee size={22} /> : meal.type === "Snack" ? <Leaf size={22} /> : <Salad size={23} />}</div><div className="meal-details"><span className="meal-type">{meal.type}</span><strong>{meal.title}</strong><p>{meal.items.map(i => `${i.name} (${i.grams} g)`).join(" · ")}</p></div><div className="meal-calories"><strong>{Math.round(totals.kcal)} <small>kcal</small></strong><span>P {Math.round(totals.protein)} · C {Math.round(totals.carbs)} · F {Math.round(totals.fat)}</span></div>{actions}</div>;
}
function Diary({ data, client, date, setDate, onSave, onChange }: { data: AppData; client: TrackerClient; date: string; setDate: (s: string) => void; onSave: (m: Meal) => Promise<void>; onChange: (d: AppData) => void }) {
  const [editing, setEditing] = useState<Meal | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meals = data.meals.filter(m => m.date === date);
  if (editing) return <MealEditor key={editing.id} initial={editing} client={client} onCancel={() => setEditing(null)} onSave={async meal => { await onSave(meal); setDate(meal.date); setEditing(null); }} />;
  return <><div className="section-heading"><h2>Daily food diary <span className="subtle-pill">{meals.length} meals</span></h2><DatePicker date={date} setDate={setDate} /></div>{error && <p className="error" role="alert">{error}</p>}<section className="card">{meals.length ? meals.map(meal => <div key={meal.id}><MealRow meal={meal} actions={<div className="row-actions"><button className="icon-button" aria-label={`Edit ${meal.title}`} onClick={() => setEditing(meal)}><Pencil size={16} /></button><button className="icon-button danger" aria-label={`Delete ${meal.title}`} onClick={() => setDeleting(meal.id)}><Trash2 size={16} /></button></div>} />{deleting === meal.id && <div className="delete-confirm" role="group" aria-label="Confirm meal deletion"><span>Delete “{meal.title}” from your diary?</span><button className="button danger-button" disabled={busy} onClick={async () => { setBusy(true); try { onChange(await client.deleteMeal(meal.id)); setDeleting(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Delete meal</button><button className="button ghost" disabled={busy} onClick={() => setDeleting(null)}>Keep meal</button></div>}</div>) : <div className="empty-state"><BookOpen size={35} /><h2>No meals for this day yet</h2><p>A new day, a fresh plate. Start with whatever you enjoyed.</p><Link className="button primary" href="/add"><Plus size={17} />Log a meal</Link></div>}</section>{meals.length > 0 && <div className="diary-summary"><span>Daily total</span><strong>{Math.round(sumNutrients(meals.map(mealTotal)).kcal)} kcal</strong><span>Saved nutrition snapshots · demo data</span></div>}</>;
}
function Goals({ data, client, onChange, onMessage }: { data: AppData; client: TrackerClient; onChange: (d: AppData) => void; onMessage: (m: string) => void }) {
  const [draft, setDraft] = useState<Goal>(data.goals);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="goals-grid"><form className="card goal-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { onChange(await client.saveGoals(draft)); onMessage("Your goals have been saved."); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><span className="eyebrow">YOUR DIRECTION</span><h2>What are you working towards?</h2><div className="goal-options">{([['cut', 'Cutting', 'A little lighter', ArrowDownLeft], ['maintain', 'Maintenance', 'Keep your balance', Leaf], ['bulk', 'Bulking', 'Room to grow', ArrowUpRight]] as const).map(([mode, label, description, Icon]) => <button key={mode} type="button" aria-pressed={draft.mode === mode} className={`goal-option ${draft.mode === mode ? "selected" : ""}`} onClick={() => setDraft({ ...draft, mode })}><Icon size={23} /><strong>{label}</strong><span>{description}</span></button>)}</div><h3>Your daily targets</h3><p className="muted">Enter targets you’ve chosen for yourself. Selecting a goal does not calculate a calorie prescription.</p><div className="target-fields">{([['kcal', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']] as const).map(([key, label, unit]) => <label key={key}>{label}<div className="input-unit"><input aria-label={`${label} target`} type="number" min={key === "kcal" ? 1 : 0} max={key === "kcal" ? 20000 : 5000} step="1" required value={Number.isNaN(draft[key]) ? "" : draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value === "" ? NaN : Number(e.target.value) })} /><span>{unit}</span></div></label>)}</div>{error && <p className="error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />}Save my goals</button></form><aside className="card goal-note"><Target size={30} /><h2>A compass, not a scorecard.</h2><p>Your targets are a guide for your day. They can evolve with your routine, appetite and goals.</p><div className="notice">This demo uses one current target across all dates. Person 2 will add effective-dated goal history.</div><Link href="/" className="text-link">Back to your balance <ArrowRight size={16} /></Link></aside></div>;
}
function Recipes({ data, client, onChange }: { data: AppData; client: TrackerClient; onChange: (d: AppData) => void }) {
  const [name, setName] = useState("");
  const [yieldGrams, setYieldGrams] = useState("500");
  const [ingredients, setIngredients] = useState<MealItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  function reset() { setName(""); setYieldGrams("500"); setIngredients([]); setEditingId(null); }
  function edit(recipe: Recipe) { setEditingId(recipe.id); setName(recipe.name); setYieldGrams(String(recipe.cookedYieldGrams)); setIngredients(recipe.ingredients); }
  return <div className="recipes-layout"><form className="card recipe-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { onChange(await client.saveRecipe({ id: editingId ?? crypto.randomUUID(), name: name.trim(), cookedYieldGrams: Number(yieldGrams), ingredients })); setMessage("Recipe saved to your collection."); reset(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><span className="eyebrow">FROM YOUR KITCHEN</span><h2>{editingId ? "Edit your recipe" : "Create a favourite"}</h2><div className="form-row"><label>Recipe name<input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunday dal" required maxLength={80} /></label><label>Cooked yield (g)<input type="number" min="1" max="10000" value={yieldGrams} onChange={e => setYieldGrams(e.target.value)} required /></label></div><p className="hint">Use ingredient weights on the stated raw/cooked basis. Cooked yield is the weight of the complete finished dish.</p><FoodPicker client={client} onAdd={food => setIngredients([...ingredients, demoItem(food, food.servingGrams)])} />{ingredients.map(item => <div className="plate-item" key={item.id}><div><strong>{item.name}</strong><small>{item.basis}</small></div><label className="weight-input"><input aria-label={`Recipe grams of ${item.name}`} type="number" min="0.1" max="10000" step="0.1" required value={item.grams || ""} onChange={e => { const grams = Number(e.target.value); setIngredients(ingredients.map(i => i.id === item.id ? { ...i, grams, nutrients: grams > 0 && grams <= 10000 ? demoItem(demoFoods.find(f => f.id === i.foodId)!, grams).nutrients : i.nutrients } : i)); }} />g</label><button type="button" className="icon-button danger" aria-label={`Remove recipe ${item.name}`} onClick={() => setIngredients(ingredients.filter(i => i.id !== item.id))}><Trash2 size={16} /></button></div>)}{error && <p className="error" role="alert">{error}</p>}{message && <p className="success-text" role="status">{message}</p>}<div className="form-actions"><button type="submit" className="button primary" disabled={busy || !ingredients.length}><Check size={16} />Save recipe</button>{editingId && <button type="button" className="button ghost" onClick={reset}>Cancel edit</button>}</div></form><section className="recipe-collection"><div className="section-heading"><h2>Your collection</h2><span className="subtle-pill">{data.recipes.length} recipes</span></div>{data.recipes.length ? data.recipes.map(recipe => <article className="card recipe-card" key={recipe.id}><span className="recipe-icon"><BookOpen size={24} /></span><h3>{recipe.name}</h3><p>{recipe.ingredients.length} ingredients · {recipe.cookedYieldGrams} g cooked yield</p><strong>{Math.round(sumNutrients(recipe.ingredients.map(i => i.nutrients)).kcal / recipe.cookedYieldGrams * 100)} <small>kcal / 100 g · demo estimate</small></strong><div className="form-actions"><button className="button ghost" onClick={() => edit(recipe)}><Pencil size={15} />Edit</button><button className="icon-button danger" aria-label={`Delete recipe ${recipe.name}`} onClick={() => setDeleting(recipe.id)}><Trash2 size={16} /></button></div>{deleting === recipe.id && <div className="delete-confirm"><span>Delete this recipe?</span><button className="button danger-button" disabled={busy} onClick={async () => { setBusy(true); try { onChange(await client.deleteRecipe(recipe.id)); if (editingId === recipe.id) reset(); setDeleting(null); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Delete recipe</button><button className="button ghost" onClick={() => setDeleting(null)}>Keep recipe</button></div>}</article>) : <div className="card empty-state"><BookOpen size={32} /><h3>Your kitchen, captured.</h3><p>Save your first recipe and make familiar meals easier to track.</p></div>}<p className="hint">Recipe storage and yield previews work locally. Logging recipe portions will connect to the nutrition engine.</p></section></div>;
}
function WeeklyChart({ data, date }: { data: AppData; date: string }) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 6));
  const totals = days.map(day => sumNutrients(data.meals.filter(m => m.date === day).map(mealTotal)).kcal);
  const max = Math.max(data.goals.kcal, ...totals, 1);
  return <section className="card weekly-card"><div className="card-heading"><div><h2>A week at a glance</h2><p className="muted">Your logged energy, one day at a time.</p></div><span className="chart-legend"><span className="status-dot" />Consumed <span className="legend-line" />Current target</span></div><div className="chart" role="img" aria-label={`Seven days of calories: ${days.map((day, i) => `${prettyDate(day)}: ${Math.round(totals[i])} kcal`).join('; ')}. Current target ${data.goals.kcal} kcal.`}><div className="target-line" style={{ bottom: `${data.goals.kcal / max * 100}%` }} /><div className="bars">{days.map((day, i) => <div className="bar-column" key={day}><span className="bar-value">{Math.round(totals[i])}</span><div className={`bar ${day === date ? "today" : ""}`} style={{ height: `${Math.max(totals[i] / max * 100, 1)}%` }} /><span className="bar-label">{new Date(`${day}T12:00:00`).toLocaleDateString("en", { weekday: "short" })}</span></div>)}</div></div><p className="hint">Empty days show no logged intake. Sample records are partial meals, not complete daily diets.</p></section>;
}
function Insights({ data, date }: { data: AppData; date: string }) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(date, -i));
  const meals = data.meals.filter(m => days.includes(m.date));
  const loggedDays = new Set(meals.map(m => m.date)).size;
  const total = sumNutrients(meals.map(mealTotal));
  return <><div className="insight-stats">{[["Days with a meal", `${loggedDays} / 7`, "Every entry adds perspective"], ["Average logged calories", `${loggedDays ? Math.round(total.kcal / loggedDays) : 0} kcal`, "Across days with entries only"], ["Meals remembered", String(meals.length), "Over the last seven days"]].map(([label, value, note]) => <section className="card insight-stat" key={label}><span>{label}</span><strong>{value}</strong><p>{note}</p></section>)}</div><WeeklyChart data={data} date={date} /><div className="notice">These figures reflect logged meals only. Missing entries can make daily totals incomplete. Weight trends and personalized recommendations are planned for a later release.</div></>;
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Calendar, Plus, Bell, Check, X, Pencil, Moon, Mail, Smartphone } from "lucide-react";
import styles from "./events.module.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Reminder = {
  frequency: string; firstRunAt: string; timeZone: string; channels: string[];
  offsetMinutes: number | null; target: string | null; rule: { interval?: number; weekdays?: number[] } | null;
  repeatUntil: string | null; nextRunAt?: string | null; lastSentAt?: string | null;
  deliveries?: { channel: string; status: string; error: string | null }[];
};
type EventItem = {
  id: string; title: string; notes: string | null; category: string | null; location: string | null; url: string | null;
  startsAt: string | null; endsAt: string | null; dueAt: string | null; allDay: boolean;
  autoCompleteOnDue: boolean; status: string; completionSource: string | null; completedAt: string | null;
  reminders: Reminder[]; nextEvent: { id: string } | null;
};
const categories = ["Personal", "Meeting", "Appointment", "Deadline", "Shopping", "Movie", "Birthday", "Anniversary", "Bill", "Travel", "Habit"];
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function local(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function iso(value: string | null) { return value ? new Date(value).toISOString() : null; }
const freshEvent = () => ({ title: "", notes: "", category: "Personal", location: "", url: "", startsAt: "", endsAt: "", dueAt: "", allDay: false, autoCompleteOnDue: false });
const newReminder = (): Reminder => ({ frequency: "ONCE", firstRunAt: local(new Date(Date.now() + 3600_000).toISOString()), timeZone: zone(), channels: ["EMAIL"], offsetMinutes: null, target: null, rule: { interval: 1 }, repeatUntil: null });
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
async function api(path: string, method = "GET", value?: unknown) {
  const response = await fetch(path, { method, headers: value ? { "Content-Type": "application/json" } : undefined, body: value ? JSON.stringify(value) : undefined, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Request failed.");
  return result;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [form, setForm] = useState(freshEvent);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [filter, setFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [browserZone, setBrowserZone] = useState("your local timezone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [followup, setFollowup] = useState<string | null>(null);
  const [nextDeadline, setNextDeadline] = useState("");
  const [settings, setSettings] = useState<{ emailConfigured: boolean; pushConfigured: boolean; publicKey: string | null } | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const load = useCallback(async () => {
    const data = await api("/api/events"); setEvents(data.events);
  }, []);
  useEffect(() => {
    setBrowserZone(zone());
    let active = true;
    Promise.all([api("/api/events"), api("/api/reminders/preferences")]).then(async ([data, prefs]) => {
      if (!active) return;
      setEvents(data.events); setSettings(prefs); setEmailEnabled(prefs.preferences?.emailEnabled ?? true);
      setQuietStart(prefs.preferences?.quietHoursStart?.toString() ?? ""); setQuietEnd(prefs.preferences?.quietHoursEnd?.toString() ?? "");
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (active && registration) setPushEnabled(Boolean(await registration.pushManager.getSubscription()));
      }
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function perform(task: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  function begin(event?: EventItem) {
    setEditing(event?.id ?? null); setRequestKey(crypto.randomUUID()); setShowForm(true); setError("");
    setForm(event ? { title: event.title, notes: event.notes ?? "", category: event.category ?? "", location: event.location ?? "", url: event.url ?? "", startsAt: local(event.startsAt), endsAt: local(event.endsAt), dueAt: local(event.dueAt), allDay: event.allDay, autoCompleteOnDue: event.autoCompleteOnDue } : freshEvent());
    setReminders(event ? event.reminders.map(r => ({ ...r, firstRunAt: local(r.firstRunAt), repeatUntil: local(r.repeatUntil) })) : []);
  }
  function save(e: FormEvent) {
    e.preventDefault();
    void perform(async () => {
      const data = { ...form, startsAt: iso(form.startsAt), endsAt: iso(form.endsAt), dueAt: iso(form.dueAt), requestKey,
        reminders: reminders.map(r => ({ ...r, firstRunAt: iso(r.firstRunAt), repeatUntil: iso(r.repeatUntil) })) };
      await api(editing ? `/api/events/${editing}` : "/api/events", editing ? "PATCH" : "POST", editing ? { action: "update", event: data } : data);
      setShowForm(false); await load(); setNotice(editing ? "Event updated." : "Event created.");
    });
  }
  function patchReminder(index: number, patch: Partial<Reminder>) { setReminders(current => current.map((r, i) => i === index ? { ...r, ...patch } : r)); }
  async function togglePush() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Browser push is unavailable here. On iPhone/iPad, open the installed Home Screen app.");
    const registration = await navigator.serviceWorker.register("/reminders-sw.js");
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (pushEnabled && subscription) {
      await api("/api/reminders/preferences", "POST", { action: "unsubscribe", endpoint: subscription.endpoint });
      await subscription.unsubscribe(); setPushEnabled(false); return;
    }
    if (!settings?.publicKey) throw new Error("Browser push has not been configured.");
    if (await Notification.requestPermission() !== "granted") throw new Error("Allow notifications in your browser settings first.");
    if (!subscription) {
      const raw = atob(settings.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, c => c.charCodeAt(0));
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    await api("/api/reminders/preferences", "POST", { action: "subscribe", ...subscription.toJSON() });
    setPushEnabled(true);
  }
  const displayDate = (value: string | null) => value ? new Date(value).toLocaleString() : "No deadline";
  return <div className={`${styles.page} space-y-8`}>
    <header className={styles.header}><div><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Calendar className="h-6 w-6" /></span><h1>Events</h1></div><p className={styles.subtitle}>Your plans, deadlines and reminders, together.</p></div><Button onClick={() => begin()} disabled={busy}><Plus className="mr-2 h-4 w-4" />New event</Button></header>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-secondary p-4 text-sm">{notice}</p>}
    <details className={styles.settings}><summary className="cursor-pointer"><span className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-primary" />Notification settings</span></summary>
      <div className={styles.settingsGrid}>
        <section className={styles.settingsPanel} aria-labelledby="email-heading">
          <div className={styles.sectionHeading}><Mail className="h-5 w-5 text-primary" /><h3 id="email-heading">Email reminders</h3></div>
          <p className={styles.help}>Send reminders to your account’s email address.</p>
          {settings && !settings.emailConfigured && <p className={styles.setupNotice}>Email delivery will be available after Gmail is connected.</p>}
          <label className={styles.checkbox}><input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} />Enable email reminders</label>
          <div className={styles.quietHours}>
            <div className={styles.sectionHeading}><Moon className="h-4 w-4 text-muted-foreground" /><h4>Quiet hours</h4></div>
            <p className={styles.help}>Pause email overnight or whenever you need a break.</p>
            <div className="grid grid-cols-2 gap-4">
              <label className={styles.field}>From<select className={selectClass} value={quietStart} onChange={e => setQuietStart(e.target.value)}><option value="">No start time</option>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
              <label className={styles.field}>Until<select className={selectClass} value={quietEnd} onChange={e => setQuietEnd(e.target.value)}><option value="">No end time</option>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
            </div>
            <p className={styles.help}>Uses each reminder’s timezone. Leave both blank to turn quiet hours off; matching times also disable them.</p>
          </div>
          <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { await api("/api/reminders/preferences", "POST", { action: "email", emailEnabled, quietHoursStart: quietStart === "" ? null : Number(quietStart), quietHoursEnd: quietEnd === "" ? null : Number(quietEnd) }); setNotice("Email preferences saved."); })}>Save email preferences</Button>
        </section>
        <section className={styles.settingsPanel} aria-labelledby="browser-heading">
          <div className={styles.sectionHeading}><Smartphone className="h-5 w-5 text-primary" /><h3 id="browser-heading">Browser notifications</h3></div>
          <p className={styles.help}>Get a notification on this device, even when this page is closed. Quiet hours affect email only.</p>
          <span className={styles.badge}>{!settings ? "Checking availability…" : !settings.pushConfigured ? "Not connected" : pushEnabled ? "Enabled on this browser" : "Ready to enable"}</span>
          <Button variant="outline" className="w-full sm:w-auto" disabled={busy || !settings?.pushConfigured} onClick={() => void perform(togglePush)}>{pushEnabled ? "Disable on this browser" : "Enable on this browser"}</Button>
          {settings && !settings.pushConfigured && <p className={styles.setupNotice}>Browser notifications aren’t available yet. You can still use email reminders.</p>}
        </section>
      </div>
    </details>
    {showForm && <form onSubmit={save} className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 md:p-7">
      <div className="flex items-center justify-between"><h2 className="text-h2">{editing ? "Edit event" : "New event"}</h2><Button type="button" variant="ghost" disabled={busy} onClick={() => setShowForm(false)} aria-label="Close event form"><X className="h-4 w-4" /></Button></div>
      <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Title<Input required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Category<Input list="event-categories" maxLength={100} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /><datalist id="event-categories">{categories.map(c => <option key={c} value={c} />)}</datalist></label></div>
      <label className="grid gap-2 text-sm font-medium">Notes<Textarea maxLength={10000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <p className="text-sm text-muted-foreground">Dates and times are entered in your browser’s timezone ({browserZone}). All date fields are optional.</p>
      <div className="grid gap-4 md:grid-cols-3">{([['startsAt', 'Starts'], ['endsAt', 'Ends'], ['dueAt', 'Deadline']] as const).map(([key, label]) => <label key={key} className="grid gap-2 text-sm font-medium">{label}<Input type="datetime-local" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
      <div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.allDay} onChange={e => setForm({ ...form, allDay: e.target.checked })} />All-day event</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.autoCompleteOnDue} onChange={e => setForm({ ...form, autoCompleteOnDue: e.target.checked })} />Automatically complete at the deadline</label></div>
      {form.allDay && <p className="text-sm text-muted-foreground">All-day events still use explicitly chosen reminder times.</p>}
      <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Location<Input maxLength={500} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label><label className="grid gap-2 text-sm font-medium">Link<Input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></label></div>
      <div className="flex items-center justify-between"><h3 className="text-h3 flex items-center gap-2"><Bell className="h-4 w-4" />Reminders</h3><Button type="button" variant="outline" disabled={reminders.length >= 10} onClick={() => setReminders([...reminders, newReminder()])}>Add reminder</Button></div>
      {!reminders.length && <p className="text-sm text-muted-foreground">No reminders. Add up to 10 independent schedules.</p>}
      {reminders.map((r, i) => <fieldset key={i} className="space-y-4 rounded-lg border border-border p-4"><legend className="px-2 text-sm">Reminder {i + 1}</legend>
        <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-2 text-sm font-medium">Timing<select className={selectClass} value={r.offsetMinutes === null ? "EXPLICIT" : r.target ?? "DUE"} onChange={e => patchReminder(i, { target: e.target.value === "EXPLICIT" ? null : e.target.value, offsetMinutes: e.target.value === "EXPLICIT" ? null : 0 })}><option value="EXPLICIT">Choose date/time</option><option value="START">Relative to start</option><option value="DUE">Relative to deadline</option><option value="END">Relative to end</option></select></label>
          {r.offsetMinutes === null ? <label className="grid gap-2 text-sm font-medium">First reminder<Input required type="datetime-local" value={r.firstRunAt} onChange={e => patchReminder(i, { firstRunAt: e.target.value })} /></label> : <label className="grid gap-2 text-sm font-medium">Offset in minutes (− before, + after)<Input required type="number" min={-5256000} max={5256000} value={r.offsetMinutes} onChange={e => patchReminder(i, { offsetMinutes: Number(e.target.value) })} /></label>}
          <label className="grid gap-2 text-sm font-medium">Repeat<select className={selectClass} value={r.frequency} onChange={e => patchReminder(i, { frequency: e.target.value, rule: { interval: r.rule?.interval ?? 1 } })}>{["ONCE", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"].map(f => <option key={f} value={f}>{f.toLowerCase()}</option>)}</select></label></div>
        {r.frequency !== "ONCE" && <div className="grid gap-4 md:grid-cols-3"><label className="grid gap-2 text-sm font-medium">Every N periods<Input required type="number" min={1} max={100} value={r.rule?.interval ?? 1} onChange={e => patchReminder(i, { rule: { ...r.rule, interval: Number(e.target.value) } })} /></label><label className="grid gap-2 text-sm font-medium">Repeat until (optional)<Input type="datetime-local" value={r.repeatUntil ?? ""} onChange={e => patchReminder(i, { repeatUntil: e.target.value || null })} /></label><label className="grid gap-2 text-sm font-medium">Recurrence timezone<Input required value={r.timeZone} onChange={e => patchReminder(i, { timeZone: e.target.value })} /></label></div>}
        {r.frequency === "WEEKLY" && <div className="flex flex-wrap gap-3 text-sm">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, d) => <label key={day} className="flex items-center gap-1"><input type="checkbox" checked={r.rule?.weekdays?.includes(d) ?? false} onChange={e => { const days = e.target.checked ? [...(r.rule?.weekdays ?? []), d] : r.rule?.weekdays?.filter(v => v !== d) ?? []; patchReminder(i, { rule: { interval: r.rule?.interval ?? 1, ...(days.length ? { weekdays: days } : {}) } }); }} />{day}</label>)}<span className="text-muted-foreground">No selection = first reminder’s weekday.</span></div>}
        <div className="flex flex-wrap items-center gap-4 text-sm">{["EMAIL", "WEB_PUSH"].map(channel => <label key={channel} className="flex items-center gap-2"><input type="checkbox" checked={r.channels.includes(channel)} disabled={channel === "WEB_PUSH" && !settings?.pushConfigured} onChange={e => patchReminder(i, { channels: e.target.checked ? [...r.channels, channel] : r.channels.filter(c => c !== channel) })} />{channel === "EMAIL" ? "Email" : "Browser push"}</label>)}<Button type="button" variant="ghost" onClick={() => setReminders(reminders.filter((_, index) => index !== i))}>Remove</Button></div>
      </fieldset>)}
      <p className="text-sm text-muted-foreground">Reminders stop when an event is completed or cancelled. Monthly reminders on missing dates and February 29 reminders in non-leap years are skipped.</p>
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create event"}</Button>
    </form>}
    <div className="flex flex-wrap gap-2" aria-label="Filter events">{["ACTIVE", "COMPLETED", "CANCELLED", "ALL"].map(value => <Button key={value} variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value.toLowerCase()} {value === "ALL" ? events.length : events.filter(e => e.status === value).length}</Button>)}</div>
    {loading ? <p role="status">Loading events…</p> : <div className="grid gap-4 md:grid-cols-2">{events.filter(e => filter === "ALL" || e.status === filter).map(event => <article key={event.id} className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
      <div className={styles.eventHeading}><div className="flex flex-wrap gap-2"><span className={styles.badge}>{event.category ?? "Personal"}</span><span className={`${styles.badge} capitalize`}>{event.status.toLowerCase()}</span>{event.allDay && <span className={styles.badge}>All day</span>}</div><h2>{event.title}</h2><div className={styles.eventDates}><Calendar className="mt-0.5 h-4 w-4 shrink-0" /><div><p>{event.dueAt ? `Due ${displayDate(event.dueAt)}` : event.startsAt ? `Starts ${displayDate(event.startsAt)}` : "No fixed date"}</p>{event.endsAt && <p>Ends {displayDate(event.endsAt)}</p>}</div></div></div>
      {event.notes && <p className="whitespace-pre-wrap break-words text-sm">{event.notes}</p>}{event.location && <p className="text-sm">{event.location}</p>}{event.url && <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Open event link</a>}
      {event.autoCompleteOnDue && event.status === "ACTIVE" && <p className="text-sm text-muted-foreground">Automatically completes at its deadline.</p>}
      {event.status === "COMPLETED" && <p className="text-sm text-muted-foreground">{event.completionSource === "AUTOMATIC" ? "Automatically completed" : "Completed"} {displayDate(event.completedAt)}</p>}
      {event.reminders.map((r, i) => <div key={i} className="rounded-md bg-secondary/50 p-3 text-xs"><p>{r.frequency.toLowerCase()} · {r.channels.map(c => c === "EMAIL" ? "email" : "browser push").join(" + ")}</p><p className="mt-1">{r.nextRunAt ? `Next: ${displayDate(r.nextRunAt)}` : "No pending reminder"}</p>{r.lastSentAt && <p>Last sent: {displayDate(r.lastSentAt)}</p>}{r.deliveries?.filter(d => d.error).map((d, j) => <p key={j} className="mt-1 text-muted-foreground">{d.channel === "EMAIL" ? "Email" : "Browser"}: {d.error}</p>)}</div>)}
      <div className="flex flex-wrap gap-2">{event.status === "ACTIVE" && <><Button size="sm" disabled={busy} onClick={() => void perform(async () => { await api(`/api/events/${event.id}`, "PATCH", { action: "complete" }); await load(); setFollowup(event.id); setNextDeadline(""); setFilter("COMPLETED"); })}><Check className="mr-1 h-4 w-4" />Complete</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => begin(event)}><Pencil className="mr-1 h-3 w-3" />Edit</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void perform(async () => { await api(`/api/events/${event.id}`, "PATCH", { action: "cancel" }); await load(); })}>Cancel event</Button></>}{event.status === "COMPLETED" && !event.nextEvent && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setFollowup(event.id); setNextDeadline(""); }}>Set next deadline</Button>}{event.nextEvent && <span className="text-sm text-muted-foreground">Next event created</span>}</div>
      {followup === event.id && !event.nextEvent && <form className="space-y-3 border-t pt-4" onSubmit={e => { e.preventDefault(); void perform(async () => { await api(`/api/events/${event.id}`, "PATCH", { action: "followup", dueAt: iso(nextDeadline) }); setFollowup(null); await load(); setNotice("Next event created. Your completed event is preserved."); setFilter("ACTIVE"); }); }}><label className="grid gap-2 text-sm font-medium">Would you like to set another deadline?<Input required type="datetime-local" value={nextDeadline} onChange={e => setNextDeadline(e.target.value)} /></label><p className="text-xs text-muted-foreground">A new event will copy the details and reminder settings. Your completed event stays in history.</p><div className="flex gap-2"><Button size="sm" disabled={busy}>Create next event</Button><Button size="sm" type="button" variant="ghost" onClick={() => setFollowup(null)}>Not now</Button></div></form>}
    </article>)}{!events.some(e => filter === "ALL" || e.status === filter) && <div className="rounded-xl border border-dashed border-border p-10 text-center md:col-span-2"><Calendar className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="text-h3">No {filter === "ALL" ? "" : filter.toLowerCase()} events yet</h2><p className="text-body mt-2">Create a plan with a deadline, or keep it dateless and add a reminder.</p></div>}</div>}
  </div>;
}


const SUPABASE_URL = "https://owxmfrqojzbbzjoulmcv.supabase.co";
const SUPABASE_KEY = "sb_publishable_Sf4_VSl1Yfjq4qA5cIWRew_-R-me5-E";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// LOGIN
const loginScreen = document.querySelector("#login-screen");
const loginForm = document.querySelector("#login-form");
const app = document.querySelector(".app");
const loginError = document.querySelector("#login-error");

app.style.display = "none";

async function checkLogin() {
 const { data, error } = await db.auth.getUser();

 if (!error && data.user) {
  loginScreen.style.display = "none";
  app.style.display = "block";
  await loadEvents();
 } else {
  loginScreen.style.display = "block";
  app.style.display = "none";
 }
}

loginForm.addEventListener("submit", async (e) => {
 e.preventDefault();

 const email = document.querySelector("#login-email").value;
 const password = document.querySelector("#login-password").value;

 loginError.textContent = "Logger ind...";

 const { error } = await db.auth.signInWithPassword({
  email,
  password
 });

 if (error) {
  loginError.textContent = "Login fejlede: " + error.message;
  return;
 }

 loginError.textContent = "";
 await checkLogin();
});

// KALENDER
const monthTitle = document.querySelector("#month-title");
const daysEl = document.querySelector("#days");
const eventsEl = document.querySelector("#events");
const selectedTitle = document.querySelector("#selected-title");
const dialog = document.querySelector("#editor");
const form = document.querySelector("#event-form");

const pad = n => String(n).padStart(2, "0");

const dateKey = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = new Date();

let selected = dateKey(today);
let displayed = new Date(today.getFullYear(), today.getMonth(), 1);
let editingId = null;
let events = [];

// HENT AFTALER FRA SUPABASE
async function loadEvents() {
 const { data, error } = await db
     .from("events")
     .select("*")
     .order("start_time", { ascending: true });

 if (error) {
  console.error("Fejl ved hentning af aftaler:", error.message);
  return;
 }

 events = data.map(event => {
  const start = new Date(event.start_time);

  return {
   id: event.id,
   title: event.title,
   description: event.description || "",
   date: start.toLocaleDateString("sv-SE", {
    timeZone: "Europe/Copenhagen"
   }),
   time: start.toLocaleTimeString("da-DK", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
   })
  };
 });

 render();
}

// VIS KALENDER
function render() {
 monthTitle.textContent = displayed.toLocaleDateString("da-DK", {
  month: "long",
  year: "numeric"
 });

 daysEl.replaceChildren();

 const first = (displayed.getDay() + 6) % 7;

 for (let i = 0; i < first; i++) {
  daysEl.append(document.createElement("div"));
 }

 const count = new Date(
     displayed.getFullYear(),
     displayed.getMonth() + 1,
     0
 ).getDate();

 for (let d = 1; d <= count; d++) {
  const key = dateKey(
      new Date(displayed.getFullYear(), displayed.getMonth(), d)
  );

  const button = document.createElement("button");

  button.className =
      "day" +
      (key === selected ? " selected" : "") +
      (key === dateKey(today) ? " today" : "");

  button.setAttribute("aria-label", key);
  button.setAttribute("aria-pressed", String(key === selected));

  const num = document.createElement("span");
  num.className = "number";
  num.textContent = d;
  button.append(num);

  const dots = document.createElement("span");
  dots.className = "dots";

  for (const event of events.filter(e => e.date === key).slice(0, 3)) {
   const dot = document.createElement("span");
   dot.className = "dot";
   dots.append(dot);
  }

  button.append(dots);

  button.addEventListener("click", () => {
   selected = key;
   render();
  });

  daysEl.append(button);
 }

 // VALGT DATO
 const [y, m, d] = selected.split("-").map(Number);

 selectedTitle.textContent = new Date(y, m - 1, d)
     .toLocaleDateString("da-DK", {
      weekday: "long",
      day: "numeric",
      month: "long"
     });

 eventsEl.replaceChildren();

 const daily = events
     .filter(e => e.date === selected)
     .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

 if (!daily.length) {
  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = "Ingen aftaler endnu ❤️";
  eventsEl.append(empty);
 }

 // VIS AFTALER MED REDIGER OG SLET
 for (const event of daily) {
  const row = document.createElement("div");
  row.className = "event";

  const content = document.createElement("div");

  const name = document.createElement("strong");
  name.textContent = event.title;

  const details = document.createElement("p");
  details.textContent = [event.time, event.description]
      .filter(Boolean)
      .join(" · ");

  content.append(name, details);

  // REDIGER-KNAP
  const edit = document.createElement("button");
  edit.textContent = "Rediger";
  edit.addEventListener("click", () => openEditor(event));

  // SLET-KNAP
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Slet 🗑️";

  deleteButton.addEventListener("click", async () => {
   if (!confirm("Er du sikker på, at du vil slette aftalen?")) {
    return;
   }

   const { data: deleted, error } = await db
       .from("events")
       .delete()
       .eq("id", event.id)
       .select("id");

   if (error) {
    alert("Kunne ikke slette aftalen: " + error.message);
    return;
   }

   if (!deleted || deleted.length === 0) {
    alert("Aftalen blev ikke slettet. Tjek dine tilladelser.");
    return;
   }

   await loadEvents();
  });

  row.append(content, edit, deleteButton);
  eventsEl.append(row);
 }
}

// ÅBN REDIGERING
function openEditor(event = null) {
 editingId = event?.id || null;

 document.querySelector("#form-title").textContent =
     event ? "Rediger aftale" : "Ny aftale";

 form.reset();

 document.querySelector("#title").value = event?.title || "";
 document.querySelector("#date").value = event?.date || selected;
 document.querySelector("#time").value = event?.time || "";
 document.querySelector("#description").value =
     event?.description || "";

 dialog.showModal();
}

// UGEDAGE
document.querySelector("#weekdays").replaceChildren(
    ...["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map(name => {
     const el = document.createElement("div");
     el.textContent = name;
     return el;
    })
);

// NAVIGATION
document.querySelector("#prev").addEventListener("click", () => {
 displayed = new Date(
     displayed.getFullYear(),
     displayed.getMonth() - 1,
     1
 );
 render();
});

document.querySelector("#next").addEventListener("click", () => {
 displayed = new Date(
     displayed.getFullYear(),
     displayed.getMonth() + 1,
     1
 );
 render();
});

document.querySelector("#add").addEventListener("click", () => {
 openEditor();
});

document.querySelector("#cancel").addEventListener("click", () => {
 dialog.close();
});

// GEM ELLER REDIGER AFTALE
form.addEventListener("submit", async (e) => {
 e.preventDefault();

 const title = document.querySelector("#title").value.trim();
 const date = document.querySelector("#date").value;
 const time = document.querySelector("#time").value;
 const description = document.querySelector("#description").value.trim();

 if (!title || !date) return;

 const {
  data: { user },
  error: authError
 } = await db.auth.getUser();

 if (authError || !user) {
  alert("Du skal være logget ind.");
  return;
 }

 const startTime = new Date(
     `${date}T${time || "12:00"}:00`
 ).toISOString();

 const eventData = {
  title,
  description,
  start_time: startTime
 };

 let error;

 if (editingId) {
  ({ error } = await db
      .from("events")
      .update(eventData)
      .eq("id", editingId));
 } else {
  ({ error } = await db
      .from("events")
      .insert({
       ...eventData,
       created_by: user.id
      }));
 }

 if (error) {
  console.error(error);
  alert("Kunne ikke gemme aftalen: " + error.message);
  return;
 }

 selected = date;

 const [year, month] = date.split("-").map(Number);
 displayed = new Date(year, month - 1, 1);

 dialog.close();
 await loadEvents();
});

// START KALENDEREN
render();
checkLogin();

// AUTOMATISK SYNKRONISERING HVERT 15. SEKUND
setInterval(async () => {
 const { data: { session }, error } = await db.auth.getSession();

 if (!error && session) {
  await loadEvents();
 }
}, 15000);

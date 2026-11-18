/* Meal Prep Helper — app logic
   Plain JavaScript, no libraries, no server, no AI, no keys.
   All data lives in this browser's localStorage. */

'use strict';

/* =========================================================
   1. SAVED DATA
   ========================================================= */

const STORAGE_KEY = 'mealPrepHelper.v1';

// state.recipes:  [{ id, name, servings, ingredients: ["2 cups rice", ...], steps: [{ text, minutes }] }]
// state.selected: ids of recipes ticked on the Shopping tab
// state.checked:  shopping-list items already checked off
let state = loadState();

function emptyState() {
  return { recipes: [], selected: [], checked: [] };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    return {
      recipes: Array.isArray(data.recipes) ? data.recipes.map(cleanRecipe).filter(Boolean) : [],
      selected: Array.isArray(data.selected) ? data.selected : [],
      checked: Array.isArray(data.checked) ? data.checked : [],
    };
  } catch (err) {
    return emptyState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    showToast('Could not save. This browser may be blocking storage.');
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function findRecipe(id) {
  return state.recipes.find(r => r.id === id);
}

// Checks a recipe object (from storage or an imported file) and returns a safe copy, or null.
function cleanRecipe(r) {
  if (!r || typeof r.name !== 'string' || !r.name.trim()) return null;
  const servings = parseInt(r.servings, 10);
  return {
    id: typeof r.id === 'string' && r.id ? r.id : makeId(),
    name: r.name.trim().slice(0, 80),
    servings: servings > 0 ? Math.min(servings, 99) : 1,
    ingredients: Array.isArray(r.ingredients)
      ? r.ingredients.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim())
      : [],
    steps: Array.isArray(r.steps)
      ? r.steps
          .filter(s => s && typeof s.text === 'string' && s.text.trim())
          .map(s => ({ text: s.text.trim(), minutes: Math.max(0, Number(s.minutes) || 0) }))
      : [],
  };
}

/* =========================================================
   2. SMALL HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

// Builds an HTML element. Text is always added as text (never as HTML),
// so anything a user types can't break the page.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

let toastTimer = null;
function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

function formatMinutes(totalMinutes) {
  if (totalMinutes > 0 && totalMinutes < 1) return Math.round(totalMinutes * 60) + ' sec';
  const m = Math.round(totalMinutes);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return h + ' hr' + (rest ? ' ' + rest + ' min' : '');
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
}

function totalMinutes(recipe) {
  return recipe.steps.reduce((sum, s) => sum + s.minutes, 0);
}

/* =========================================================
   3. READING WHAT THE USER TYPES
   ========================================================= */

// Common units, so "2 cups rice" and "1 cup rice" are treated as the same unit.
const UNITS = {
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  can: 'can', cans: 'can',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  pinch: 'pinch', pinches: 'pinch',
  bunch: 'bunch', bunches: 'bunch',
  package: 'package', packages: 'package', pkg: 'package',
};

const UNICODE_FRACTIONS = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3' };

// "1 1/2" -> 1.5, "3/4" -> 0.75, "2.5" -> 2.5
function parseAmount(text) {
  let m;
  if ((m = text.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  if ((m = text.match(/^(\d+)\/(\d+)$/))) return Number(m[1]) / Number(m[2]);
  return Number(text);
}

// "2 cups rice" -> { qty: 2, unit: "cup", item: "rice" }
// "salt"        -> { qty: null, unit: "", item: "salt" }
function parseIngredient(line) {
  let text = line.trim();
  for (const [symbol, fraction] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.replace(new RegExp('(\\d)?\\s*' + symbol), (_, whole) => (whole ? whole + ' ' : '') + fraction);
  }
  const match = text.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s+(.+)$/);
  if (!match) return { qty: null, unit: '', item: text };

  const qty = parseAmount(match[1]);
  const words = match[2].trim().split(/\s+/);
  let unit = '';
  const firstWord = words[0].toLowerCase().replace(/\.$/, '');
  if (UNITS[firstWord] && words.length > 1) {
    unit = UNITS[firstWord];
    words.shift();
  }
  const item = words.join(' ').replace(/^of\s+/i, '');
  return { qty, unit, item };
}

// "Chop vegetables - 10 min" -> { text: "Chop vegetables", minutes: 10 }
// "Bake for 25 minutes"      -> { text: "Bake for", minutes: 25 }  (time at the end is used)
// "Preheat oven to 400"      -> { text: "Preheat oven to 400", minutes: 0 } (no "min", no dash)
function parseStep(line) {
  const text = line.trim();
  const withUnit = text.match(/^(.*?)[\s,:\-–—]*(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\.?$/i);
  const withDash = text.match(/^(.*?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
  const match = withUnit || withDash;
  if (match && match[1].trim()) {
    return { text: match[1].trim().replace(/[\s,:\-–—]+$/, ''), minutes: Number(match[2]) };
  }
  return { text, minutes: 0 };
}

function stepToLine(step) {
  return step.minutes > 0 ? step.text + ' - ' + step.minutes + ' min' : step.text;
}

function splitLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

/* =========================================================
   4. TABS
   ========================================================= */

function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.hidden = panel.id !== 'tab-' + name;
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  });
  if (name === 'shop') renderShop();
  if (name === 'timer') renderTimerPicker();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});

/* =========================================================
   5. RECIPES TAB
   ========================================================= */

let editingId = null; // null = adding a new recipe

function openForm(recipe) {
  editingId = recipe ? recipe.id : null;
  $('form-title').textContent = recipe ? 'Edit recipe' : 'New recipe';
  $('f-name').value = recipe ? recipe.name : '';
  $('f-servings').value = recipe ? recipe.servings : 4;
  $('f-ingredients').value = recipe ? recipe.ingredients.join('\n') : '';
  $('f-steps').value = recipe ? recipe.steps.map(stepToLine).join('\n') : '';
  $('form-error').textContent = '';
  $('recipe-form').hidden = false;
  $('new-recipe-btn').hidden = true;
  $('recipe-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('f-name').focus({ preventScroll: true });
}

function closeForm() {
  editingId = null;
  $('recipe-form').hidden = true;
  $('new-recipe-btn').hidden = false;
}

$('new-recipe-btn').addEventListener('click', () => openForm(null));
$('cancel-btn').addEventListener('click', closeForm);

$('recipe-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('f-name').value.trim();
  const ingredients = splitLines($('f-ingredients').value);
  const steps = splitLines($('f-steps').value).map(parseStep);
  const servings = parseInt($('f-servings').value, 10);

  if (!name) return showFormError('Please give the recipe a name.');
  if (ingredients.length === 0) return showFormError('Please add at least one ingredient.');

  const recipe = cleanRecipe({ id: editingId || makeId(), name, servings, ingredients, steps });

  if (editingId) {
    const index = state.recipes.findIndex(r => r.id === editingId);
    state.recipes[index] = recipe;
    if (timer.recipeId === editingId) resetTimer(null);
    showToast('Recipe updated');
  } else {
    state.recipes.push(recipe);
    showToast('Recipe saved');
  }
  saveState();
  closeForm();
  renderRecipes();
});

function showFormError(message) {
  $('form-error').textContent = message;
}

function deleteRecipe(recipe) {
  if (!confirm('Delete "' + recipe.name + '"? This cannot be undone.')) return;
  state.recipes = state.recipes.filter(r => r.id !== recipe.id);
  state.selected = state.selected.filter(id => id !== recipe.id);
  if (timer.recipeId === recipe.id) resetTimer(null);
  saveState();
  renderRecipes();
  showToast('Recipe deleted');
}

function renderRecipes() {
  const list = $('recipe-list');
  list.replaceChildren();

  if (state.recipes.length === 0) {
    list.append(
      el('div', { class: 'card empty' },
        el('p', {}, 'No recipes yet. Tap “+ New recipe” to add one.'),
        el('button', { type: 'button', class: 'btn', onclick: addSampleRecipe }, 'Add a sample recipe')
      )
    );
    return;
  }

  for (const recipe of state.recipes) {
    const timeText = totalMinutes(recipe) > 0 ? ' · ' + formatMinutes(totalMinutes(recipe)) : '';
    list.append(
      el('details', { class: 'card recipe' },
        el('summary', {},
          el('span', { class: 'name' }, recipe.name),
          el('span', { class: 'meta' },
            plural(recipe.servings, 'serving') + ' · ' +
            plural(recipe.ingredients.length, 'ingredient') + ' · ' +
            plural(recipe.steps.length, 'step') + timeText)
        ),
        el('div', { class: 'body' },
          el('h3', {}, 'Ingredients'),
          el('ul', {}, recipe.ingredients.map(i => el('li', {}, i))),
          el('h3', {}, 'Steps'),
          recipe.steps.length
            ? el('ol', {}, recipe.steps.map(s =>
                el('li', {}, s.text, s.minutes > 0 ? el('span', { class: 'muted' }, ' — ' + formatMinutes(s.minutes)) : null)))
            : el('p', { class: 'muted' }, 'No steps added.'),
          el('div', { class: 'row' },
            el('button', { type: 'button', class: 'btn primary', onclick: () => startRecipeInTimer(recipe.id) }, 'Prep with timer'),
            el('button', { type: 'button', class: 'btn', onclick: () => openForm(recipe) }, 'Edit'),
            el('button', { type: 'button', class: 'btn danger', onclick: () => deleteRecipe(recipe) }, 'Delete')
          )
        )
      )
    );
  }
}

function addSampleRecipe() {
  state.recipes.push(cleanRecipe({
    name: 'Chicken & Rice Bowls',
    servings: 4,
    ingredients: [
      '2 cups rice',
      '1 1/2 lb chicken breast',
      '2 cups broccoli',
      '3 cloves garlic',
      '2 tbsp soy sauce',
      '1 tbsp olive oil',
      'salt',
    ],
    steps: [
      { text: 'Rinse rice and start cooking', minutes: 2 },
      { text: 'Chop chicken and broccoli', minutes: 10 },
      { text: 'Cook chicken with garlic and oil', minutes: 12 },
      { text: 'Steam broccoli', minutes: 5 },
      { text: 'Portion into containers', minutes: 0 },
    ],
  }));
  saveState();
  renderRecipes();
  showToast('Sample recipe added');
}

/* ---------- Export / Import ---------- */

$('export-btn').addEventListener('click', () => {
  if (state.recipes.length === 0) return showToast('No recipes to export yet.');
  const data = {
    app: 'Meal Prep Helper',
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes: state.recipes,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: 'meal-prep-helper-recipes.json' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Exported ' + plural(state.recipes.length, 'recipe'));
});

$('import-btn').addEventListener('click', () => $('import-input').click());

$('import-input').addEventListener('change', event => {
  const file = event.target.files[0];
  event.target.value = ''; // lets the same file be chosen again later
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : data.recipes;
      incoming = Array.isArray(list) ? list.map(cleanRecipe).filter(Boolean) : [];
    } catch (err) {
      incoming = [];
    }
    if (incoming.length === 0) {
      showToast('That file has no recipes this app can read.');
      return;
    }

    const updates = incoming.filter(r => findRecipe(r.id)).length;
    const message = 'Import ' + plural(incoming.length, 'recipe') + '?' +
      (updates ? '\n' + plural(updates, 'recipe') + ' you already have will be replaced with the imported version.' : '');
    if (!confirm(message)) return;

    for (const recipe of incoming) {
      const index = state.recipes.findIndex(r => r.id === recipe.id);
      if (index >= 0) state.recipes[index] = recipe;
      else state.recipes.push(recipe);
      if (timer.recipeId === recipe.id) resetTimer(null);
    }
    saveState();
    renderRecipes();
    showToast('Imported ' + plural(incoming.length, 'recipe'));
  };
  reader.onerror = () => showToast('Could not read that file.');
  reader.readAsText(file);
});

/* =========================================================
   6. SHOPPING LIST TAB
   ========================================================= */

// Combines ingredients from all ticked recipes.
// Same item + same unit -> amounts are added together.
function buildShoppingList() {
  const combined = new Map();
  for (const recipe of state.recipes) {
    if (!state.selected.includes(recipe.id)) continue;
    for (const line of recipe.ingredients) {
      const { qty, unit, item } = parseIngredient(line);
      const key = unit + '|' + item.toLowerCase();
      if (!combined.has(key)) combined.set(key, { key, item, unit, qty: 0, hasQty: false, from: [] });
      const entry = combined.get(key);
      if (qty != null && !Number.isNaN(qty)) {
        entry.qty += qty;
        entry.hasQty = true;
      }
      if (!entry.from.includes(recipe.name)) entry.from.push(recipe.name);
    }
  }
  return [...combined.values()].sort((a, b) => a.item.localeCompare(b.item));
}

function formatQty(n) {
  return String(Math.round(n * 100) / 100);
}

// Units that get an "s" (or "es") when there's more than one: 3 cups, 2 pinches
const UNIT_PLURALS = { cup: 'cups', can: 'cans', clove: 'cloves', slice: 'slices', pinch: 'pinches', bunch: 'bunches', package: 'packages' };

function shoppingLabel(entry) {
  if (!entry.hasQty) return entry.item;
  const unit = entry.qty > 1 && UNIT_PLURALS[entry.unit] ? UNIT_PLURALS[entry.unit] : entry.unit;
  return [formatQty(entry.qty), unit, entry.item].filter(Boolean).join(' ');
}

function renderShop() {
  const picker = $('shop-recipes');
  picker.replaceChildren();

  if (state.recipes.length === 0) {
    picker.append(el('p', { class: 'muted' }, 'Add recipes on the Recipes tab first.'));
  }
  for (const recipe of state.recipes) {
    const checkbox = el('input', { type: 'checkbox', checked: state.selected.includes(recipe.id) });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selected.push(recipe.id);
      else state.selected = state.selected.filter(id => id !== recipe.id);
      saveState();
      renderShop();
    });
    picker.append(el('label', { class: 'check-row' }, checkbox, el('span', {}, recipe.name)));
  }

  const list = $('shop-list');
  list.replaceChildren();
  const items = buildShoppingList();
  $('clear-checks-btn').hidden = items.length === 0;

  if (items.length === 0) {
    list.append(el('li', { class: 'muted' }, 'Tick one or more recipes above to see your list.'));
    return;
  }
  for (const entry of items) {
    const isChecked = state.checked.includes(entry.key);
    const checkbox = el('input', { type: 'checkbox', checked: isChecked });
    const li = el('li', { class: isChecked ? 'done' : '' },
      el('label', { class: 'check-row' },
        checkbox,
        el('span', {},
          el('span', { class: 'label-text' }, shoppingLabel(entry)),
          el('span', { class: 'from' }, entry.from.join(', '))
        )
      )
    );
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.checked.push(entry.key);
      else state.checked = state.checked.filter(k => k !== entry.key);
      li.className = checkbox.checked ? 'done' : '';
      saveState();
    });
    list.append(li);
  }
}

$('clear-checks-btn').addEventListener('click', () => {
  state.checked = [];
  saveState();
  renderShop();
});

/* =========================================================
   7. PREP TIMER TAB
   ========================================================= */

const timer = {
  recipeId: null,
  index: 0,          // which step we're on
  remainingMs: 0,    // time left on the current step
  endAt: null,       // clock time the step ends (only while running)
  intervalId: null,
  finished: false,
};

function timerRecipe() {
  return timer.recipeId ? findRecipe(timer.recipeId) : null;
}

function isRunning() {
  return timer.endAt !== null;
}

function renderTimerPicker() {
  const select = $('timer-recipe');
  select.replaceChildren(el('option', { value: '' }, '— Choose a recipe —'));
  for (const recipe of state.recipes) {
    select.append(el('option', { value: recipe.id }, recipe.name));
  }
  select.value = timer.recipeId || '';
  select.disabled = state.recipes.length === 0;
  renderTimer();
}

$('timer-recipe').addEventListener('change', event => {
  resetTimer(event.target.value || null);
});

function startRecipeInTimer(id) {
  resetTimer(id);
  showTab('timer');
}

// Load a recipe (or nothing) into the timer, stopped at step 1.
function resetTimer(recipeId) {
  stopTicking();
  timer.recipeId = recipeId;
  timer.index = 0;
  timer.finished = false;
  const recipe = timerRecipe();
  timer.remainingMs = recipe && recipe.steps.length ? recipe.steps[0].minutes * 60000 : 0;
  renderTimer();
}

function startTimer() {
  unlockAudio();
  if (timer.remainingMs <= 0) return;
  timer.endAt = Date.now() + timer.remainingMs;
  timer.intervalId = setInterval(tick, 250);
  keepScreenOn(true);
  renderTimer();
}

function pauseTimer() {
  if (isRunning()) timer.remainingMs = Math.max(0, timer.endAt - Date.now());
  stopTicking();
  renderTimer();
}

function stopTicking() {
  clearInterval(timer.intervalId);
  timer.intervalId = null;
  timer.endAt = null;
  keepScreenOn(false);
}

function tick() {
  timer.remainingMs = Math.max(0, timer.endAt - Date.now());
  if (timer.remainingMs <= 0) {
    alertStepDone();
    goToNextStep(true);
  } else {
    renderTimer();
  }
}

// Move to the next step. If keepRunning is true, the next timed step starts automatically.
function goToNextStep(keepRunning) {
  const recipe = timerRecipe();
  stopTicking();
  timer.index += 1;
  if (!recipe || timer.index >= recipe.steps.length) {
    timer.finished = true;
    timer.remainingMs = 0;
    renderTimer();
    return;
  }
  timer.remainingMs = recipe.steps[timer.index].minutes * 60000;
  if (keepRunning && timer.remainingMs > 0) startTimer();
  else renderTimer();
}

$('timer-start').addEventListener('click', () => (isRunning() ? pauseTimer() : startTimer()));
$('timer-skip').addEventListener('click', () => {
  unlockAudio();
  goToNextStep(isRunning());
});
$('timer-reset').addEventListener('click', () => resetTimer(timer.recipeId));

function renderTimer() {
  const recipe = timerRecipe();
  const panel = $('timer-panel');
  const empty = $('timer-empty');

  if (!recipe) {
    panel.hidden = true;
    empty.textContent = state.recipes.length
      ? 'Choose a recipe above to start prepping.'
      : 'Add a recipe on the Recipes tab first.';
    document.title = 'Meal Prep Helper';
    return;
  }

  empty.textContent = '';
  panel.hidden = false;
  panel.classList.toggle('finished', timer.finished);
  const clock = $('timer-clock');

  if (recipe.steps.length === 0) {
    $('timer-progress').textContent = '';
    $('timer-step').textContent = 'This recipe has no steps';
    clock.textContent = '—';
    clock.className = 'clock untimed';
    $('timer-note').textContent = 'Edit the recipe to add prep steps.';
    $('timer-start').hidden = true;
    $('timer-skip').hidden = true;
    $('timer-total').textContent = '';
    $('timer-next').textContent = '';
    $('timer-reset').hidden = true;
    return;
  }

  $('timer-reset').hidden = false;

  if (timer.finished) {
    $('timer-progress').textContent = recipe.name;
    $('timer-step').textContent = 'All steps done!';
    clock.textContent = '✓';
    clock.className = 'clock';
    $('timer-note').textContent = 'Nice work. Tap “Start over” to run it again.';
    $('timer-start').hidden = true;
    $('timer-skip').hidden = true;
    $('timer-total').textContent = '';
    $('timer-next').textContent = '';
    document.title = 'Done · Meal Prep Helper';
    return;
  }

  const step = recipe.steps[timer.index];
  const untimed = step.minutes <= 0;
  const isLast = timer.index === recipe.steps.length - 1;

  $('timer-progress').textContent = recipe.name + ' · Step ' + (timer.index + 1) + ' of ' + recipe.steps.length;
  $('timer-step').textContent = step.text;

  if (untimed) {
    clock.textContent = 'No timer for this step';
    clock.className = 'clock untimed';
    $('timer-note').textContent = 'Tap “' + (isLast ? 'Finish' : 'Next step') + '” when you are done.';
  } else {
    clock.textContent = formatClock(timer.remainingMs);
    clock.className = 'clock';
    $('timer-note').textContent = isRunning() ? '' : (timer.remainingMs < step.minutes * 60000 ? 'Paused' : 'Ready');
  }

  const startBtn = $('timer-start');
  startBtn.hidden = untimed;
  startBtn.textContent = isRunning() ? 'Pause' : (timer.remainingMs < step.minutes * 60000 ? 'Resume' : 'Start');

  const skipBtn = $('timer-skip');
  skipBtn.hidden = false;
  skipBtn.textContent = untimed ? (isLast ? 'Finish' : 'Next step') : (isLast ? 'Finish' : 'Skip');
  skipBtn.className = untimed ? 'btn primary big' : 'btn big';

  // Total time left = what's left on this step + all later steps
  const laterMs = recipe.steps.slice(timer.index + 1).reduce((sum, s) => sum + s.minutes * 60000, 0);
  const totalLeft = timer.remainingMs + laterMs;
  $('timer-total').textContent = totalLeft > 0 ? 'Total time left: ' + formatClock(totalLeft) : '';

  const next = recipe.steps[timer.index + 1];
  $('timer-next').textContent = next
    ? 'Up next: ' + next.text + (next.minutes > 0 ? ' (' + formatMinutes(next.minutes) + ')' : '')
    : 'This is the last step.';

  document.title = isRunning() ? formatClock(timer.remainingMs) + ' · ' + step.text : 'Meal Prep Helper';
}

/* ---------- Beep, vibrate, keep screen awake ---------- */

let audioCtx = null;

// Browsers only allow sound after the user taps something, so we set up audio on Start/Skip.
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (err) {
    audioCtx = null;
  }
}

function alertStepDone() {
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  if (!audioCtx) return;
  try {
    const start = audioCtx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, start + i * 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.35 + 0.25);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start + i * 0.35);
      osc.stop(start + i * 0.35 + 0.25);
    }
  } catch (err) { /* sound is a nice-to-have */ }
}

// Asks the phone not to dim the screen while a timer runs (works on most modern phones).
let wakeLock = null;
async function keepScreenOn(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (err) { /* not supported or not allowed: ignore */ }
}

// If the phone was locked, refresh the clock as soon as the page is visible again.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isRunning()) {
    tick();
    keepScreenOn(true);
  }
});

/* =========================================================
   8. START THE APP
   ========================================================= */

renderRecipes();

// Turn on offline mode (see sw.js). Browsers only allow this on https:// or localhost,
// so it quietly does nothing when index.html is opened straight from a folder.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline mode is a bonus; the app still works without it */
    });
  });
}

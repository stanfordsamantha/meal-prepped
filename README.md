# Meal Prep Helper

A simple, phone-friendly web app for meal prep. You can:

1. **Save recipes:** name, servings, ingredients, and prep steps with times.
2. **Build a shopping list:** tick the recipes you're prepping, and the app combines their ingredients into one list you can check off.
3. **Time your prep:** a step-by-step countdown that beeps when each step ends (and vibrates on Android; iPhones don't let websites vibrate) and moves on to the next one.
4. **Back up your recipes:** export them to a file, and import that file on another device or browser.
5. **Install it like an app:** add it to your phone's home screen. It opens in its own window and works with no internet connection.

It is plain HTML, CSS and JavaScript. It uses no server, no AI service, no accounts and no secret keys.

## Files

| File | What it does |
|---|---|
| `index.html` | The page and its three tabs |
| `style.css` | The look: cream "poster" with postage-stamp cards in orange, pink and purple, hand-drawn lettering, phone-first, with automatic dark mode |
| `app.js` | All the logic: saving, combining ingredients, the timer, export/import |
| `manifest.webmanifest` | Tells phones the app's name, colors and icon, and to open it in its own window |
| `sw.js` | The "service worker": saves a copy of the app on the phone so it opens offline |
| `icons/` | The app icon (a purple postage stamp) in the sizes phones need |
| `README.md` | This file |

## How to type recipes

**Ingredients:** one per line, with the amount first.
```
2 cups rice
1 1/2 lb chicken breast
3 cloves garlic
salt
```

**Steps:** one per line. End a line with a time to give that step a timer.
```
Rinse rice - 2 min
Cook rice - 18 min
Portion into containers
```
A step with no time (like the last one) has no countdown. You tap **Next step** when you're done with it.

## Install it on your phone

This only works once the app is published at an `https://` address, such as GitHub Pages. It does not work from a file opened straight from a folder.

- **iPhone (Safari):** open the app's address, tap the **Share** button (square with an arrow), then **Add to Home Screen** → **Add**.
- **Android (Chrome):** open the app's address, then tap **Install app** when Chrome offers it, or open the **⋮** menu → **Install app** (or **Add to Home screen**).

The **Meal Prep** icon appears on your home screen. It opens full-screen, without the browser's address bar.

**Offline:** after the app has been opened once with internet, it saves a copy of itself on the phone. Later it opens and works with no signal, including the fonts. When you publish changes, the phone picks them up in the background and shows them the next time the app is opened. If a change ever doesn't show up, change the version number on the `CACHE` line at the top of `sw.js` (for example `v1` → `v2`) and publish again.

## Privacy and data

- Your recipes are saved **only in this browser on this device**, using the browser's built-in storage (`localStorage`). Nothing is sent anywhere.
- The app loads two free fonts (Fraunces and Patrick Hand) from Google Fonts. No key is needed. After the first visit, the app keeps its own copy of the fonts for offline use; if they never loaded, it uses built-in fonts and still works. Loading fonts lets Google see your device's IP address, as with any website that uses Google Fonts.
- Clearing your browser data, or using a private window, erases them. Use **Export recipes** to keep a backup file.
- Recipes don't sync between devices automatically. To move them, export on one device and import on the other.

## Known limits (by design, to keep it small)

- No unit conversion. `1 cup rice` and `4 tbsp rice` stay as separate lines on the shopping list.
- Items are combined only when the name matches exactly (ignoring capital letters). `1 egg` and `2 eggs` stay separate.
- Some phones pause web pages while the screen is locked. The timer shows the correct time again when you return, but the beep may not sound while the phone is locked. The app asks the phone to keep the screen on while a timer runs.

## How to test it

Open `index.html` in a web browser (double-click it). On a computer, use your browser's phone view to check the phone layout (in Chrome: right-click → Inspect → the phone icon).

- [ ] **Empty start:** The Recipes tab says "No recipes yet" and offers **Add a recipe**, which adds a ready-made example recipe.
- [ ] **Add your own recipe:** Tap **+ New recipe**, fill it in, and save. It appears in the list. Tap it to see the ingredients and steps.
- [ ] **Form checks:** Saving with no name, or with no ingredients, shows a red message.
- [ ] **Edit / Delete:** Edit a recipe and confirm the change shows. Delete it and confirm it asks first.
- [ ] **Shopping list combines amounts:** Add two recipes that both use `cups rice` (e.g. `2 cups rice` and `1 cup rice`). Tick both on the Shopping tab. The list shows **3 cups rice**.
- [ ] **Check off items:** Tick an item and it gets crossed out. **Uncheck all** clears the ticks.
- [ ] **Timer:** On the Timer tab, choose a recipe and tap **Start**. The clock counts down. **Pause** and **Resume** work. **Skip** moves to the next step. Tip: make a test recipe with a step like `Test - 0.1 min` (6 seconds) to see it beep and move on by itself.
- [ ] **Untimed step:** A step with no time shows "No timer for this step" and a **Next step** button.
- [ ] **Finish:** After the last step it shows **All steps done!** **Start over** goes back to step 1.
- [ ] **Saved after reload:** Refresh the page. Your recipes, ticked recipes and checked items are still there.
- [ ] **Export:** **Export recipes** downloads `meal-prep-helper-recipes.json`.
- [ ] **Import:** Delete a recipe, then **Import recipes** and pick that file. It asks to confirm, and the recipe comes back.
- [ ] **Bad import:** Importing a file that isn't a recipe export shows "That file has no recipes this app can read."

**After publishing (on your phone):**

- [ ] **Install:** Follow "Install it on your phone" above. The stamp icon appears on the home screen, and the app opens without an address bar.
- [ ] **Offline:** Open the installed app once, close it, turn on Airplane Mode, and open it again. It loads, and your recipes are still there.
- [ ] **Fresh eyes:** Hand your phone to someone who has never seen the app and ask them to add a recipe and start the timer, without help. Note where they get stuck.

## Publishing on GitHub Pages (later)

All links between the files are relative, so the app works from a GitHub Pages address like `https://yourusername.github.io/meal-prep-helper/` with no changes. Upload all the files and the `icons` folder to the root of a repository, then turn on Pages in the repository's **Settings → Pages** (deploy from the main branch, root folder).

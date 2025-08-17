// Nore's Interface Enhancements v2.9.3
const MOD_ID = "nore-interface-enhancements";
const MOD_TITLE = "Nore's Interface Enhancements";

/** Setting keys */
const S = {
defaultTab: "defaultTab",
  expandOnStart: "expandOnStart",
  lowerPause: "lowerPause",
  hotbarToggle: "hotbarToggle",
  hotbarStartCollapsed: "hotbarStartCollapsed",
  lastTab: "lastTab",
  pausePosition: "pausePosition"
};

function getS(key){ return game.settings.get(MOD_ID, key); }
function setS(key,v){ return game.settings.set(MOD_ID, key, v); }

Hooks.once("init", () => {
  applyPausePosition();
  // Settings from v2.1.1
  game.settings.register(MOD_ID, S.defaultTab, {
    name: "Default sidebar tab",
    hint: "Choose a tab for startup or use Last open tab.",
    scope: "world", config: true, type: String, default: "last",
    choices: () => {
      const c = {
        last: "Last open tab",
        chat: "Chat Messages",
        combat: "Combat Encounters",
        scenes: "Scenes",
        actors: "Actors",
        items: "Items",
        journal: "Journal",
        tables: "Rollable Tables",
        cards: "Card Stacks",
        macros: "Macros",
        playlists: "Playlists",
        compendium: "Compendium Packs",
        settings: "Game Settings"
      };
      if (!game.user.isGM) delete c.scenes;
      return c;
    },
    requiresReload: true
  });

  game.settings.register(MOD_ID, S.expandOnStart, {
    name: "Expand sidebar on load",
    hint: "Open the sidebar when the world finishes loading.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: true
  });

  game.settings.register(MOD_ID, S.hotbarToggle, {
    name: "Enable collapsible hotbars",
    hint: "Adds a button to collapse or expand the hotbar.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: true
  });

  game.settings.register(MOD_ID, S.hotbarStartCollapsed, {
    name: "Start hotbars collapsed",
    hint: "When collapsible hotbars are enabled, begin in the collapsed state.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: true
  });

  game.settings.register(MOD_ID, S.pausePosition, {
    name: "Pause banner position",
    hint: "Choose Default, Top, or Bottom for the 'Game Paused' overlay.",
    scope: "world", config: true, type: String, default: "default",
    choices: { "default": "Default", "top": "Top", "bottom": "Bottom" },
    requiresReload: true
  });
game.settings.register(MOD_ID, S.lastTab, { scope: "world", config: false, type: String, default: "" });
});

function applyPausePosition(){
  try {
    const pos = game.settings.get("nore-interface-enhancements", "pausePosition");
    document.body.classList.toggle("nie-pause-top", pos === "top");
    document.body.classList.toggle("nie-pause-bottom", pos === "bottom");
  } catch(e) {}
}



Hooks.once("setup", () => { applyPausePosition(); });
Hooks.once("ready", () => {
  try { if (getS(S.defaultTab) === "default") setS(S.defaultTab, "last"); } catch(e){}
  Hooks.on("changeSidebarTab", tab => setS(S.lastTab, tab.id));
  // Migrate legacy boolean to new dropdown once (no await here)
  try {
    const legacy = (typeof S !== "undefined" && S.lowerPause) ? getS(S.lowerPause) : false;
    if (getS(S.pausePosition) === "default" && legacy) {
      setS(S.pausePosition, "bottom");
    }
  } catch(e) {}
  const pos = getS(S.pausePosition);
  document.body.classList.toggle("nie-pause-top", pos === "top");
  document.body.classList.toggle("nie-pause-bottom", pos === "bottom");

});

// Sidebar behavior
Hooks.on("renderSidebar", () => {
  if (getS(S.expandOnStart)) {
    try { ui.sidebar.expand(); } catch(e){ console.warn(MOD_ID, "expand failed", e); }
  }
  const desired = getS(S.defaultTab);
  const target = desired === "last" ? getS(S.lastTab) : (desired === "packs" ? "compendium" : desired);
  if (target) {
    try { ui.sidebar.activateTab(target); }
    catch(e){ console.warn(MOD_ID, "activateTab failed", target, e); }
  }
});

/* ---------------- Module Management toolbar from v1.4.6 ---------------- */
Hooks.on("renderModuleManagement", (app, htmlEl) => {
  try {
    const html = htmlEl instanceof HTMLElement ? htmlEl : htmlEl[0];
    if (html.querySelector(".nie-modbar-row")) return;

    const content = html.querySelector(".window-content") || html;

    const listContainer = content.querySelector(".package-list, .packages, .package-list-container, .form .package-list, .listing, ol.packages, ul.packages, .packages-container");
    const firstRow = content.querySelector(".package, li.package, .package-row");
    let anchor = listContainer || firstRow;
    if (firstRow && !listContainer) anchor = firstRow.parentElement;

    const row = document.createElement("div");
    row.className = "nie-modbar-row";

    const bar = document.createElement("div");
    bar.className = "nie-modbar nie-native";
    bar.innerHTML = `
      <div class="nie-left nie-title">${MOD_TITLE}</div>
      <div class="nie-right">
        <button type="button" class="nie-btn nie-check-all" title="Check all modules" aria-label="Check all">${iconCheckAll(20)}</button>
        <button type="button" class="nie-btn nie-uncheck-all" title="Uncheck all except this module" aria-label="Uncheck all">${iconUncheckAll(20)}</button>
        <button type="button" class="nie-btn nie-copy" title="Copy active modules to clipboard" aria-label="Copy active">${iconCopy(20)}</button>
        <button type="button" class="nie-btn nie-export" title="Export active modules as JSON" aria-label="Export JSON">${iconDownload(20)}</button>
        <button type="button" class="nie-btn nie-import" title="Import JSON and check matching ids" aria-label="Import JSON">${iconUpload(20)}</button>
        <input type="file" accept="application/json" class="nie-import-input" style="display:none" />
      </div>
    `;
    row.appendChild(bar);

    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(row, anchor);
    } else {
      content.appendChild(row);
    }

    row.style.gridColumn = "1 / -1";
    row.style.flex = "1 0 100%";

    const getBoxForModule = (id) => {
      const root = html;
      const selectors = [
        `input[type="checkbox"][name="module.${id}"]`,
        `input[type="checkbox"][name="module-${id}"]`,
        `input[type="checkbox"][data-package-id="${id}"]`,
        `input[type="checkbox"][data-module-id="${id}"]`,
        `[data-package-id="${id}"] input[type="checkbox"]`,
        `[data-module-id="${id}"] input[type="checkbox"]`
      ];
      for (const sel of selectors) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
      const fallback = Array.from(root.querySelectorAll('input[type="checkbox"]')).find(cb => {
        const n = cb.getAttribute("name") || "";
        return n === `module.${id}` || n === `module-${id}`;
      });
      return fallback || null;
    };

    function setBoxes(predicate) {
      let touched = 0;
      for (const m of game.modules) {
        const cb = getBoxForModule(m.id);
        if (!cb) continue;
        const desired = !!predicate(m);
        if (cb.checked !== desired) {
          cb.checked = desired;
          touched++;
          // No change event here. User will press Save.
        }
      }
      ui.notifications.info(`Checked state updated for ${touched} modules. Click Save Modules to apply.`);
    }

    const barEl = bar;
    barEl.querySelector(".nie-check-all").addEventListener("click", () => setBoxes(() => true));
    barEl.querySelector(".nie-uncheck-all").addEventListener("click", () => setBoxes(m => m.id === MOD_ID));
    barEl.querySelector(".nie-copy").addEventListener("click", async () => {
      const list = activeModuleListText();
      try {
        await navigator.clipboard?.writeText(list);
        ui.notifications.info("Active modules copied to clipboard");
      } catch (e) {
        console.log(list);
        ui.notifications.warn("Clipboard blocked. Copied list printed to console.");
      }
    });
    barEl.querySelector(".nie-export").addEventListener("click", async () => {
      const data = activeModuleJson();
      const filename = "active-modules.json";
      saveDataToFile(JSON.stringify(data, null, 2), "application/json", filename);
    });
    const importBtn = barEl.querySelector(".nie-import");
    const importInput = barEl.querySelector(".nie-import-input");
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async (ev) => {
      const file = ev.currentTarget.files?.[0];
      if (!file) return;
      const text = await file.text();
      let ids;
      try {
        const parsed = JSON.parse(text);
        ids = Array.isArray(parsed) ? parsed : parsed.ids;
        if (!Array.isArray(ids)) throw new Error("Invalid JSON. Expect array of ids or { ids: [] }.");
      } catch (e) {
        ui.notifications.error("Could not parse JSON");
        console.error(e);
        return;
      }
      const idSet = new Set(ids.concat([MOD_ID]));
      setBoxes(m => idSet.has(m.id));
      importInput.value = "";
    });

  } catch (e) {
    console.error(`${MOD_ID} failed to render ModuleManagement controls`, e);
  }
});

// Icons for the Module Management toolbar
function iconCheckAll(size=20){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.2"/>
    <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" opacity="0.2"/>
    <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" opacity="0.2"/>
    <path d="M14.5 17l2 2 4-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function iconUncheckAll(size=20){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" fill="none"/>
    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" fill="none"/>
    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" fill="none"/>
    <path d="M13 13l8 8M21 13l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
function iconCopy(size=20){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="12" rx="2" stroke="currentColor" fill="none"/>
    <rect x="4" y="4" width="11" height="12" rx="2" stroke="currentColor" fill="none"/>
  </svg>`;
}
function iconDownload(size=20){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 11l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 20h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}
function iconUpload(size=20){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M8 13l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 4h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

// Helpers for Module Management toolbar
function activeModuleListText() {
  const list = Array.from(game.modules)
    .filter(m => m.active)
    .map(m => `${m.id}: ${m.title} v${m.version}`)
    .join("\n");
  return list;
}
function activeModuleJson() {
  const ids = Array.from(game.modules).filter(m => m.active).map(m => m.id);
  return { ids };
}


/* ===== NIE Hotbar Reflow v2.8.1 (isolation layer) ===== */
(() => {
  const MODID = "nore-interface-enhancements";
  const BOTTOM_CLASS = "nie-bottom-row2";
  const TOGGLE_CLASS = "nie-hb-toggle2";
  const BOUND = "nieBound_v280";

  function getS2(key, d=false){ try { return game.settings.get(MODID, key); } catch { return d; } }

  function ensureBottomRow(left){
    let row = left.querySelector("."+BOTTOM_CLASS);
    if (!row){
      row = document.createElement("div");
      row.className = BOTTOM_CLASS+" flexrow";
      row.style.gap = "4px";
      row.style.alignItems = "center";
      row.style.justifyContent = "flex-end";
      const firstBtn = left.querySelector("button.ui-control, a.ui-control");
      if (firstBtn) firstBtn.insertAdjacentElement("afterend", row);
      else left.appendChild(row);
    }
    return row;
  }

  function buildToggle(dir){
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ui-control fa-solid fa-angle-down icon "+TOGGLE_CLASS;
    b.dataset.action = "nie-toggle";
    if (dir) b.setAttribute("data-tooltip-direction", dir);
    b.removeAttribute("title");
    b.setAttribute("data-tooltip", "Collapse Hotbar");
    return b;
  }

  function reflow(){
    const enabled = !!getS2("hotbarToggle", false);
    const hotbar = document.getElementById("hotbar");
    const left = hotbar?.querySelector("#hotbar-controls-left");
    if (!hotbar || !left) return false;

    if (!enabled){
      left.querySelectorAll("."+TOGGLE_CLASS+", ."+BOTTOM_CLASS).forEach(n => n.remove());
      const audio = left.querySelector('button.ui-control[data-action="mute"]');
      if (audio) audio.style.removeProperty("align-self");
      hotbar.classList.remove("nie-hb-collapsed");
      return false;
    }

    hotbar.querySelectorAll(".nie-hb-toggle, #hotbar-controls-right .nie-hb-toggle, #hotbar-page-controls .nie-hb-toggle").forEach(n => n.remove());

    const row = ensureBottomRow(left);
    const menu = left.querySelector('button.ui-control[data-action="menu"]');
    if (menu && menu.parentElement !== row) row.appendChild(menu);

    let toggle = row.querySelector("."+TOGGLE_CLASS);
    if (!toggle){
      const dir = left.getAttribute("data-tooltip-direction") || "LEFT";
      toggle = buildToggle(dir);
      row.prepend(toggle);
    }else{
      toggle.removeAttribute("title");
      toggle.setAttribute("data-tooltip", toggle.classList.contains("fa-angle-up") ? "Expand Hotbar" : "Collapse Hotbar");
      if (!toggle.getAttribute("data-tooltip-direction")) toggle.setAttribute("data-tooltip-direction", left.getAttribute("data-tooltip-direction") || "LEFT");
    }

    const audio = left.querySelector('button.ui-control[data-action="mute"]');
    if (audio){
      audio.style.alignSelf = "flex-end";
      if (!audio.getAttribute("data-tooltip")) audio.setAttribute("data-tooltip", "HOTBAR.MUTE");
    }

    if (!hotbar.dataset.nieInit_v280){
      if (getS2("hotbarStartCollapsed", false)) hotbar.classList.add("nie-hb-collapsed");
      hotbar.dataset.nieInit_v280 = "1";
    }

    const collapsed = hotbar.classList.contains("nie-hb-collapsed");
    toggle.classList.toggle("fa-angle-down", !collapsed);
    toggle.classList.toggle("fa-angle-up", collapsed);
    toggle.setAttribute("data-tooltip", collapsed ? "Expand Hotbar" : "Collapse Hotbar");

    if (!toggle.dataset[BOUND]){
      toggle.addEventListener("click", () => {
        const c = hotbar.classList.toggle("nie-hb-collapsed");
        toggle.classList.toggle("fa-angle-down", !c);
        toggle.classList.toggle("fa-angle-up", c);
        toggle.setAttribute("data-tooltip", c ? "Expand Hotbar" : "Collapse Hotbar");
      });
      toggle.dataset[BOUND] = "1";
    }
    return true;
  }

  function attach(){
    [0, 50, 150, 300].forEach(ms => setTimeout(reflow, ms));
    const hotbar = document.getElementById("hotbar");
    const left = hotbar?.querySelector("#hotbar-controls-left");
    if (left && !left.dataset.nieObs_v280){
      const obs = new MutationObserver(() => reflow());
      obs.observe(left, { childList: true });
      left.dataset.nieObs_v280 = "1";
    }
    window.NIE_forceMount = () => (reflow(), true);
  }

  Hooks.on("ready", attach);
  Hooks.on("renderHotbar", attach);
})();
/* ===== End NIE Hotbar Reflow v2.8.1 ===== */

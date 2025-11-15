// Nore's Interface Enhancements v3.1.1
const MOD_ID = "nores-interface-enhancements";
const MOD_TITLE = "Nore's Interface Enhancements";

/** Setting keys */
const S = {
  defaultTab: "defaultTab",
  expandOnStart: "expandOnStart",
  lowerPause: "lowerPause",        // legacy key kept for one-time migration
  hotbarToggle: "hotbarToggle",
  hotbarStartCollapsed: "hotbarStartCollapsed",
  lastTab: "lastTab",
  pausePosition: "pausePosition",
  preventActiveTabClose: "preventActiveTabClose",
  hideChatPeek: "hideChatPeek",
  autoUnpauseOnGM: "autoUnpauseOnGM"
};

function getS(key){ return game.settings.get(MOD_ID, key); }
function setS(key,v){ return game.settings.set(MOD_ID, key, v); }

/* ---------------- Pause banner helpers ---------------- */
function applyPausePosition(){
  try {
    const pos = game.settings.get(MOD_ID, S.pausePosition);
    document.body.classList.toggle("nie-pause-top", pos === "top");
    document.body.classList.toggle("nie-pause-bottom", pos === "bottom");
  } catch(e) {}
}

/* ---------------- Hotbar alignment helpers ---------------- */
let NIE_hotbarBaseCenter = null;

function NIE_realignHotbar() {
  try {
    // Only do anything if "hide mini chat" is on
    if (!getS(S.hideChatPeek)) {
      NIE_hotbarBaseCenter = null;
      const hbClear = document.getElementById("hotbar");
      if (hbClear) {
        hbClear.style.position = "";
        hbClear.style.left = "";
        hbClear.style.transform = "";
      }
      return;
    }

    const hb = document.getElementById("hotbar");
    if (!hb) return;

    const rect = hb.getBoundingClientRect();
    if (!rect || !rect.width) return;

    const center = rect.left + rect.width / 2;

    // First measurement becomes our baseline
    if (NIE_hotbarBaseCenter === null) {
      NIE_hotbarBaseCenter = center;
      hb.style.position = "";
      hb.style.left = "";
      hb.style.transform = "";
      return;
    }

    const delta = NIE_hotbarBaseCenter - center;

    hb.style.position = "relative";
    hb.style.transform = `translateX(${delta}px)`;
  } catch (e) {
    console.error(MOD_ID, "NIE_realignHotbar error", e);
  }
}

/* ---------------- Chat peek helpers ---------------- */
function ensureChatPeekStyle(){
  // Inject a small stylesheet once; relies on a body class toggle
  if (document.getElementById("nie-chatpeek-style")) return;
  const css = `
    /* Completely hide mini chat and kill its layout footprint */
    body.nie-hide-chatpeek #chat-notifications {
      display: none !important;
      width: 0 !important;
      max-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `.trim();
  const style = document.createElement("style");
  style.id = "nie-chatpeek-style";
  style.textContent = css;
  document.head.appendChild(style);
}
function applyHideChatPeek(){
  try {
    ensureChatPeekStyle();
    const enabled = !!getS(S.hideChatPeek);
    document.body.classList.toggle("nie-hide-chatpeek", enabled);
    // After toggling this, fix the hotbar alignment
    setTimeout(NIE_realignHotbar, 25);
  } catch(e) {}
}
function watchChatPeekMount(){
  // Ensure the rule applies even if the node mounts later
  if (document.body.dataset.nieChatPeekObs) return;
  const obs = new MutationObserver(() => {
    applyHideChatPeek();
    setTimeout(NIE_realignHotbar, 25);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  document.body.dataset.nieChatPeekObs = "1";
}

/* ---------------- Sidebar collapse gating ---------------- */
function NIE_patchCollapseGate() {
  try {
    const enabled = getS(S.preventActiveTabClose);
    const sb = ui?.sidebar;
    if (!sb) return;

    const proto = Object.getPrototypeOf(sb);
    if (!proto) return;

    // unwrap on disable
    if (!enabled) {
      if (proto.collapse && proto.collapse.__nieWrapped && proto.collapse.__nieOriginal) proto.collapse = proto.collapse.__nieOriginal;
      if (proto.expand && proto.expand.__nieWrapped && proto.expand.__nieOriginal) proto.expand = proto.expand.__nieOriginal;
      if (proto._onClickTab && proto._onClickTab.__nieWrapped && proto._onClickTab.__nieOriginal) proto._onClickTab = proto._onClickTab.__nieOriginal;
      return;
    }

    // wrap expand to record a short cooldown
    if (!(proto.expand && proto.expand.__nieWrapped)) {
      const originalExpand = proto.expand;
      if (typeof originalExpand === "function") {
        const wrappedExpand = function(...args) {
          const out = originalExpand.apply(this, args);
          try { window.NIE_recentExpand = Date.now(); } catch(e) {}
          return out;
        };
        wrappedExpand.__nieWrapped = true;
        wrappedExpand.__nieOriginal = originalExpand;
        proto.expand = wrappedExpand;
      }
    }

    // wrap collapse to block unless allowed and not within cooldown
    if (!(proto.collapse && proto.collapse.__nieWrapped)) {
      const originalCollapse = proto.collapse;
      if (typeof originalCollapse === "function") {
        const wrappedCollapse = function(...args) {
          try {
            const allow = !!window.NIE_allowSidebarCollapse;
            const recent = typeof window.NIE_recentExpand === "number" && (Date.now() - window.NIE_recentExpand) < 400;
            if (getS(S.preventActiveTabClose) && (!allow || recent)) {
              try { this.expand(); } catch(e) {}
              return;
            }
          } catch (e) {
            console.error(MOD_ID, "collapse gate error", e);
          } finally {
            window.NIE_allowSidebarCollapse = false;
          }
          return originalCollapse.apply(this, args);
        };
        wrappedCollapse.__nieWrapped = true;
        wrappedCollapse.__nieOriginal = originalCollapse;
        proto.collapse = wrappedCollapse;
      }
    }

    // wrap _onClickTab to swallow clicks on current tab
    if (!(proto._onClickTab && proto._onClickTab.__nieWrapped)) {
      const originalOnClick = proto._onClickTab;
      if (typeof originalOnClick === "function") {
        const wrappedClick = function(ev) {
          try {
            if (!getS(S.preventActiveTabClose)) return originalOnClick.call(this, ev);
            const el = ev?.currentTarget?.dataset?.tab ? ev.currentTarget : (ev?.target?.closest ? ev.target.closest("a.item") : null);
            const tab = el?.dataset?.tab;
            if (!tab) return originalOnClick.call(this, ev);
            const isActive = tab === this.activeTab;
            const collapsed = this.element?.[0]?.classList?.contains("collapsed") || this._collapsed || false;
            if (isActive) {
              ev?.preventDefault?.(); ev?.stopImmediatePropagation?.(); ev?.stopPropagation?.();
              if (!collapsed) {
                // Already open on that tab; keep it open
                this.activateTab(tab);
                return;
              } else {
                // If collapsed, expand and start cooldown to avoid bounce
                try { this.expand(); } catch(e) {}
                window.NIE_recentExpand = Date.now();
                return;
              }
            }
          } catch (e) {
            console.error(MOD_ID, "_onClickTab guard error", e);
          }
          return originalOnClick.call(this, ev);
        };
        wrappedClick.__nieWrapped = true;
        wrappedClick.__nieOriginal = originalOnClick;
        proto._onClickTab = wrappedClick;
      }
    }

    // mark clicks on collapse control as allowed
    const root = document.getElementById("sidebar");
    if (root && !root.dataset.nieCollapseGate) {
      const mark = (ev) => {
        const btn = ev.target?.closest?.('[data-action="collapse"], .collapse, button[aria-label="Collapse Sidebar"]');
        if (btn) {
          window.NIE_allowSidebarCollapse = true;
          setTimeout(() => { window.NIE_allowSidebarCollapse = false; }, 250);
        }
      };
      root.addEventListener("pointerdown", mark, true);
      root.addEventListener("click", mark, true);
      root.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") mark(ev);
      }, true);
      root.dataset.nieCollapseGate = "1";
    }
  } catch (e) {
    console.error(MOD_ID, "NIE_patchCollapseGate failed", e);
  }
}

/* ---- Auto-unpause on GM login ---- */
function NIE_tryAutoUnpause() {
  try {
    if (!getS(S.autoUnpauseOnGM)) return;
    if (!game.user?.isGM) return;

    const doUnpause = () => {
      try {
        const isPaused = !!game.paused || !!game.isPaused;
        if (!isPaused) return true;
        if (typeof game.togglePause === "function") {
          try { game.togglePause(false); } catch (e) { game.togglePause(); }
        } else {
          const btn = document.querySelector('[data-action="pause"], #pause, .control-tool.toggle[data-action="pause"]');
          if (btn) btn.click();
        }
        return !(!!game.paused || !!game.isPaused);
      } catch (e) {
        console.error(MOD_ID, "auto-unpause error", e);
        return false;
      }
    };

    let tries = 0;
    const tick = () => {
      tries++;
      const ok = doUnpause();
      if (ok || tries >= 6) return;
      setTimeout(tick, tries < 3 ? 150 : 300);
    };
    tick();
  } catch (e) {
    console.error(MOD_ID, "NIE_tryAutoUnpause failed", e);
  }
}

/* ---------------- Init ---------------- */
Hooks.once("init", () => {
  applyPausePosition();
  ensureChatPeekStyle();

  // Default tab
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

  // Expand sidebar on load
  game.settings.register(MOD_ID, S.expandOnStart, {
    name: "Expand sidebar on load",
    hint: "Open the sidebar when the world finishes loading.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: true
  });

  // Do not close active tab on re click
  game.settings.register(MOD_ID, S.preventActiveTabClose, {
    name: "Do not close active tab on re click",
    hint: "Only the Collapse control may close the sidebar; re clicking the active tab keeps it open.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: true
  });

  // Collapsible hotbars
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

  // Pause position
  game.settings.register(MOD_ID, S.pausePosition, {
    name: "Pause banner position",
    hint: "Choose Default, Top, or Bottom for the Game Paused overlay.",
    scope: "world", config: true, type: String, default: "default",
    choices: { "default": "Default", "top": "Top", "bottom": "Bottom" },
    requiresReload: true,
    onChange: () => applyPausePosition()
  });

  // Hide small chat window (chat peek)
  game.settings.register(MOD_ID, S.hideChatPeek, {
    name: "Hide small chat window",
    hint: "Hide the mini chat overlay that appears when you are not on the Chat tab.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: false,
    onChange: () => applyHideChatPeek()
  });

  // Auto unpause for GMs
  game.settings.register(MOD_ID, S.autoUnpauseOnGM, {
    name: "Start unpaused for GMs",
    hint: "When a GM loads in, automatically clear pause so the world starts unpaused.",
    scope: "world", config: true, type: Boolean, default: false, requiresReload: false,
    onChange: () => NIE_tryAutoUnpause()
  });

  // internal
  game.settings.register(MOD_ID, S.lastTab, {
    scope: "client",   // important: client, so no player perms issues
    config: false,
    type: String,
    default: ""
  });
});

Hooks.once("setup", () => {
  applyPausePosition();
  applyHideChatPeek();
  watchChatPeekMount();
  NIE_tryAutoUnpause();
});

Hooks.once("ready", () => {
  try { if (getS(S.defaultTab) === "default") setS(S.defaultTab, "last"); } catch(e){}

  Hooks.on("changeSidebarTab", tab => {
    try { setS(S.lastTab, tab.id); } catch(e){}
    // Every time they change tab, fix hotbar alignment if needed
    setTimeout(NIE_realignHotbar, 25);
  });

  // Migrate legacy boolean lowerPause => pausePosition
  try {
    const legacy = (typeof S !== "undefined" && S.lowerPause) ? getS(S.lowerPause) : false;
    if (getS(S.pausePosition) === "default" && legacy) {
      setS(S.pausePosition, "bottom");
    }
  } catch(e) {}

  const pos = getS(S.pausePosition);
  document.body.classList.toggle("nie-pause-top", pos === "top");
  document.body.classList.toggle("nie-pause-bottom", pos === "bottom");

  applyHideChatPeek();
  watchChatPeekMount();
  NIE_patchCollapseGate();
  NIE_tryAutoUnpause();
  setTimeout(NIE_realignHotbar, 50);
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
  // Re apply guards if sidebar is re rendered by other code
  NIE_patchCollapseGate();
  applyHideChatPeek();
  setTimeout(NIE_realignHotbar, 25);
});

/* ---------------- Module Management toolbar (from v1.4.6) ---------------- */
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
          // User will press Save to apply changes; no change events here.
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

// Helpers for the Module Management toolbar
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
  const MODID = MOD_ID;
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

/* ===================== NIE: Hover Lite (fixes) — whole pane hover, no sticky focus, arrow left only visible when idle ===================== */
/* Settings are preserved; if missing, register with native reloads. */
Hooks.once("init", () => {
  try {
    if (!game.settings.settings.get(`${MOD_ID}.playerListVisibility`)) {
      game.settings.register(MOD_ID, "playerListVisibility", {
        name: "Show player list",
        hint: "Enabled shows it normally. Disable hides it completely. Hover Only hides it until you hover the player panel.",
        scope: "world",
        config: true,
        type: String,
        default: "enabled",
        choices: { enabled: "Enabled", disabled: "Disable", hover: "Hover Only" },
        requiresReload: true
      });
    }
    if (!game.settings.settings.get(`${MOD_ID}.hidePerformanceStats`)) {
      game.settings.register(MOD_ID, "hidePerformanceStats", {
        name: "Hide performance readouts",
        hint: "Hide Latency and FPS counters in the player list.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        requiresReload: true
      });
    }
  } catch (e) { console.error(MOD_ID, "settings register failed", e); }
});

(function(){
  function removeOldHoverArtifacts(){
    const ids = [
      "nie-playerlist-visibility-style","nie-players-hover-v4-style","nie-playerlist-hover-v3-style",
      "nie-playerlist-hover-css-style","nie-players-hover-css-fixes","nie-consolidated-style",
      "nie-consolidated-refined-style","nie-hover-precision-refined-style","nie-settings-hover-perf-style",
      "nie-hover-area-polish-style","nie-hover-lite-style"
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.body.classList.remove("nie-hide-players","nie-show-players","nie-players-off","nie-players-hover","nie-perf-hide","nie-hover-lite","nie-perf-hide-lite");
  }

  const CSS = `
    /* Disabled: hide whole aside safely */
    body.nie-hover-lite-disabled #players,
    body.nie-hover-lite-disabled section#players { display: none !important; }

    /* Hover Lite: keep container in layout with a reliable hover area */
    body.nie-hover-lite #players,
    body.nie-hover-lite section#players {
      position: relative !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      outline: none !important;
      overflow: visible !important;
      min-width: var(--nie-hover-width, 220px) !important;
      min-height: var(--nie-hover-height, 110px) !important;
      pointer-events: auto !important;
    }

    /* Only the expand arrow remains visible when idle */
    body.nie-hover-lite #players #players-inactive,
    body.nie-hover-lite #players #players-active,
    body.nie-hover-lite #players #performance-stats > :not(#players-expand) {
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    body.nie-hover-lite #players #players-expand {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
    }

    /* Move the arrow to the left in the footer */
    body.nie-hover-lite #players #performance-stats {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      min-height: 18px !important;
    }
    body.nie-hover-lite #players #players-expand {
      order: -1 !important;
      margin-right: auto !important;
    }

    /* Reveal the entire pane when hovering anywhere over the players panel */
    body.nie-hover-lite #players:hover #players-inactive,
    body.nie-hover-lite #players:hover #players-active,
    body.nie-hover-lite #players:hover #performance-stats > :not(#players-expand) {
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
    }

    /* IMPORTANT: do not suppress hover when focused — no focus-based rules here */

    /* Performance readouts toggle (lite) */
    body.nie-perf-hide-lite #players #performance-stats #latency,
    body.nie-perf-hide-lite #players #performance-stats #fps {
      display: none !important;
    }
    body.nie-perf-hide-lite #players #performance-stats { min-height: 18px !important; }

    /* Prevent clipping */
    #players, section#players { overflow: visible !important; }
    #players-inactive { margin-bottom: 4px !important; }
  `;

  function ensureStyle(){
    let el = document.getElementById("nie-hover-lite-fix2-style");
    if (!el){
      el = document.createElement("style");
      el.id = "nie-hover-lite-fix2-style";
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }

  function applyFromSettings(){
    try {
      removeOldHoverArtifacts();
      ensureStyle();
      const vis = (game.settings.get(MOD_ID, "playerListVisibility") || "enabled").toString();
      const perf = !!game.settings.get(MOD_ID, "hidePerformanceStats");

      document.body.classList.remove("nie-hover-lite-disabled","nie-hover-lite","nie-perf-hide-lite");
      if (vis === "disabled") document.body.classList.add("nie-hover-lite-disabled");
      else if (vis === "hover") document.body.classList.add("nie-hover-lite");
      if (perf) document.body.classList.add("nie-perf-hide-lite");
    } catch (e) { console.error(MOD_ID, e); }
  }

  Hooks.on("ready", applyFromSettings);
  Hooks.on("renderPlayers", applyFromSettings);
})();

/* ===================== NIE: Hover Lite UPWARDS — persistent arrow, normal backgrounds, inactive expands UP above active ===================== */
(() => {
  const STYLE_ID = "nie-hover-lite-upwards-style";

  function installStyles(){
    const CSS = `
      /* Keep pane in normal flow and preserve theme visuals */
      body.nie-hover-lite #players,
      body.nie-hover-lite section#players {
        position: relative !important;
        overflow: visible !important;
        margin-top: var(--nie-players-offset, 12px) !important; /* baked-in offset tweak */
      }

      /* Footer steady; arrow persistent and left aligned */
      body.nie-hover-lite #players #performance-stats {
        display: flex !important; align-items: center !important; gap: 6px !important; min-height: 22px !important;
      }
      body.nie-hover-lite #players #players-expand {
        order: -1 !important; margin-right: auto !important;
        opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;
        position: relative !important; z-index: 5 !important;
      }
      body.nie-hover-lite #players:hover #players-expand { opacity: 1 !important; visibility: visible !important; }

      /* Idle: hide active list and perf children but keep their space */
      body.nie-hover-lite #players:not(:hover) #players-active { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
      body.nie-hover-lite #players:not(:hover) #performance-stats > :not(#players-expand) { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }

      /* Inactive list is positioned ABSOLUTELY to expand UP above the active list */
      body.nie-hover-lite #players #players-inactive {
        position: absolute !important;
        left: 0 !important; right: 0 !important;
        bottom: var(--nie-inactive-bottom, 22px) !important;
        z-index: 6 !important;
        display: none !important;
        overflow: visible !important;
      }
      body.nie-hover-lite #players.expanded:hover #players-inactive {
        display: block !important;
      }

      /* Hover: reveal active list and perf items with normal visuals */
      body.nie-hover-lite #players:hover #players-active { visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }
      body.nie-hover-lite #players:hover #performance-stats > :not(#players-expand) { visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; }

      /* Performance hide but keep footer height */
      body.nie-perf-hide-lite #players #performance-stats #latency,
      body.nie-perf-hide-lite #players #performance-stats #fps { display: none !important; }
      body.nie-perf-hide-lite #players #performance-stats { min-height: 22px !important; }

      /* Never clip */
      #players, section#players, #players-active, #players-inactive { overflow: visible !important; }
    `;
    let el = document.getElementById(STYLE_ID);
    if (!el){
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }

  function computeInactiveBottom(){
    try {
      const players = document.getElementById("players");
      if (!players) return;
      const active = players.querySelector("#players-active");
      if (!active) return;
      const bottomOffset = players.clientHeight - active.offsetTop;
      players.style.setProperty("--nie-inactive-bottom", `${bottomOffset}px`);
    } catch(e){ console.error("NIE Hover Lite Upwards compute error", e); }
  }

  Hooks.on("ready", () => {
    try {
      const vis = (game.settings.get(MOD_ID, "playerListVisibility") || "enabled").toString();
      const perf = !!game.settings.get(MOD_ID, "hidePerformanceStats");
      document.body.classList.toggle("nie-hover-lite", vis === "hover");
      document.body.classList.toggle("nie-perf-hide-lite", perf);
      const aside = document.getElementById("players") || document.querySelector("section#players");
      if (aside) aside.style.display = (vis === "disabled") ? "none" : "";
    } catch {}
    installStyles();
    computeInactiveBottom();
    window.addEventListener("resize", computeInactiveBottom);
  });

  Hooks.on("renderPlayers", () => {
    installStyles();
    setTimeout(computeInactiveBottom, 0);
  });
})();

/* ===================== NIE: Hover Lite — Force Lower Position (append only) =====================
   Uses `top` with relative positioning to move the entire player pane lower,
   in case theme/flex rules ignore margin. Keeps everything else intact.
*/
(() => {
  const STYLE_ID = "nie-hover-lite-force-lower-style";
  function installLoweringStyles(){
    const CSS = `
      /* Ensure relative positioning and apply a downward shift.
         Also neutralize any previous margin top so we do not double apply. */
      body.nie-hover-lite section#players,
      body.nie-hover-lite #players {
        position: relative !important;
        margin-top: 0 !important;
        top: var(--nie-players-shift, 54px) !important; /* tweak via console if desired */
      }
    `;
    let el = document.getElementById(STYLE_ID);
    if (!el){
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }
  Hooks.on("ready", installLoweringStyles);
  Hooks.on("renderPlayers", installLoweringStyles);
})();

/* NIE append: Arrow to the right in Hover Only, leave Enabled untouched */
(() => {
  const STYLE_ID = "nie-arrow-right-hoveronly-strict-style";
  function inject(){
    const CSS = `
      /* Ensure footer is a flex row when Hover Only is active */
      body.nie-hover-lite #players #performance-stats {
        display: flex !important;
        align-items: center !important;
        min-height: 18px !important;
      }
      /* Put the expand arrow at the right edge in Hover Only */
      body.nie-hover-lite #players #performance-stats #players-expand {
        order: 9999 !important;
        margin-left: auto !important;
        margin-right: 0 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        position: relative !important;
        z-index: 5 !important;
        display: inline-flex !important;
      }
      /* Keep the arrow right aligned even when performance is hidden */
      body.nie-hover-lite.nie-perf-hide-lite #players #performance-stats #players-expand {
        margin-left: auto !important;
        margin-right: 0 !important;
        order: 9999 !important;
      }
    `;
    let el = document.getElementById(STYLE_ID);
    if (!el){
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }
  Hooks.on("ready", inject);
  Hooks.on("renderPlayers", inject);
})();

/* Money Tracker v1 — data stays on this device */
(function () {
  "use strict";

  const STORE_KEY = "jatin-money-tracker-v1";
  const DEFAULT_CATEGORIES = [
    "Food", "Shopping", "Travel", "Bills", "Fuel",
    "Entertainment", "Health", "EMI", "Rent", "Investment", "Other"
  ];
  const DEFAULT_METHODS = [
    "Axis Privilege", "Axis Neo", "OneCard", "UPI", "Cash", "Debit card", "Other"
  ];
  const METHOD_CHART_ORDER = ["Axis Privilege", "Axis Neo", "OneCard", "UPI", "Cash"];
  const CAT_COLOR = {
    Food: "#F59E0B", Shopping: "#8B5CF6", Travel: "#06B6D4", Bills: "#3B82F6",
    Fuel: "#EF4444", Health: "#10B981", Entertainment: "#EC4899", Other: "#94A3B8",
    EMI: "#6366F1", Rent: "#0EA5E9", Investment: "#2FBF71"
  };
  const MERCHANT_GUESS = [
    [/swiggy|zomato|dominos|domino'?s|pizza|starbucks|cafe|restaurant|mcdonald|kfc|burger|blinkit|eatsure|box8/i, "Food"],
    [/amazon|flipkart|myntra|ajio|nykaa|meesho|tata cliq|croma/i, "Shopping"],
    [/irctc|makemytrip|goibibo|uber|ola|indigo|airindia|air india|booking|cleartrip|rapido|redbus/i, "Travel"],
    [/electric|bsnl|jio(?!mart)|airtel|wifi|broadband|\bgas\b|bharat gas|indane|dth|bescom/i, "Bills"],
    [/petrol|diesel|hpcl|iocl|bpcl|shell|indian oil|hp pay|fuel/i, "Fuel"],
    [/netflix|bookmyshow|spotify|youtube|prime|hotstar|sonyliv|sony liv|pvr|inox/i, "Entertainment"],
    [/pharmeasy|1mg|apollo|pharmacy|hospital|practo|medplus|netmeds/i, "Health"],
    [/zerodha|groww|upstox|kuvera|\bnps\b|mutual fund|\bsip\b/i, "Investment"],
    [/\brent\b|nobroker|housing\.com/i, "Rent"],
    [/\bemi\b|loan instal|loan emi/i, "EMI"]
  ];

  const ICON_PATHS = {
    Food: '<path d="M4 10h7v11H4zM8 3v7M16 3v18M16 8c3 0 4-2 4-5"/>',
    Shopping: '<path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
    Travel: '<path d="M3 13h18M12 4l2 9H10l2-9zM8 13l-3 7M16 13l3 7"/>',
    Bills: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    Fuel: '<path d="M7 4h8v16H7z"/><path d="M15 8h2a2 2 0 0 1 2 2v6a2 2 0 1 0 2-2"/>',
    Entertainment: '<path d="M5 8h14v10H5z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    Health: '<path d="M12 4v16M4 12h16"/>',
    EMI: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    Rent: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10.5V20h12v-9.5"/>',
    Investment: '<path d="M4 18V8l5 4 4-8 3 5 4-3v12z"/>',
    Other: '<circle cx="12" cy="12" r="8"/>'
  };

  const charts = { cat: null, daily: null, trend: null, method: null };
  let state = emptyState();
  let viewMonth = currentMonthKey();
  let listFilter = "all";
  let listQuery = "";
  let listCat = "all";
  let listMethod = "all";
  let formType = "expense";
  let formCategory = "Food";
  let formMethod = "UPI";
  let confirmModel = null;
  let currentPage = "home";

  function emptyState() {
    return {
      entries: [],
      review: [],
      budgets: {},
      categories: DEFAULT_CATEGORIES.slice(),
      methods: DEFAULT_METHODS.slice(),
      merchantRules: {},
      lastBackup: null,
      lastMonthNudge: null,
      theme: "system"
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyState();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.entries)) return emptyState();
      const base = emptyState();
      return Object.assign(base, data, {
        entries: Array.isArray(data.entries) ? data.entries : [],
        review: Array.isArray(data.review) ? data.review : [],
        budgets: data.budgets || {},
        categories: Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories,
        methods: Array.isArray(data.methods) && data.methods.length ? data.methods : base.methods,
        merchantRules: data.merchantRules || {},
        theme: data.theme || "system"
      });
    } catch (e) {
      return emptyState();
    }
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function purgeReview() {
    const now = Date.now();
    const before = state.review.length;
    state.review = (state.review || []).filter((r) => !r.expiresAt || new Date(r.expiresAt).getTime() > now);
    if (state.review.length !== before) save();
  }

  function uid(prefix) {
    return (prefix || "e") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    return toISODate(d);
  }

  function toISODate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function currentMonthKey() {
    return todayISO().slice(0, 7);
  }

  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  function shiftMonth(key, delta) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function formatINR(n) {
    const num = Number(n) || 0;
    const abs = Math.abs(num);
    return "\u20B9" + abs.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: abs % 1 === 0 ? 0 : 2
    });
  }

  function parseAmount(str) {
    if (typeof str === "number") return isFinite(str) && str > 0 ? Math.round(str * 100) / 100 : null;
    const cleaned = String(str || "").replace(/[\u20B9,\s]/g, "").replace(/rs\.?|inr/ig, "");
    const n = parseFloat(cleaned);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  function parseAmountFromText(text) {
    const s = String(text || "");
    const patterns = [
      /(?:rs\.?|inr|\u20B9)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      /(?:debited|credited|spent|paid|received|deposited)\s+(?:by|with|for|of)?\s*(?:rs\.?|inr|\u20B9)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i,
      /([0-9][0-9,]*(?:\.\d{1,2})?)\s*(?:rs\.?|inr|\u20B9)/i
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) {
        const amt = parseAmount(m[1]);
        if (amt != null) return amt;
      }
    }
    return null;
  }

  function guessTypeFromRaw(raw, fallback) {
    const s = String(raw || "");
    if (/credited|has been credited|received|refund|deposited/i.test(s) && !/debited/i.test(s)) return "income";
    if (fallback) return fallback;
    return "expense";
  }

  function guessMerchantFromRaw(raw) {
    const s = String(raw || "");
    const patterns = [
      /\bat\s+([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/i,
      /\bto\s+([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/i,
      /\btowards\s+([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/i,
      /\bUPI[-\s]([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/i,
      /\binfo[:\s]+([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/i
    ];
    for (const re of patterns) {
      const m = s.match(re);
      if (m) return cleanMerchant(m[1]);
    }
    return "";
  }

  function cleanMerchant(s) {
    return String(s || "").replace(/\s+(on|avbl|avl|info|refno|ref).*$/i, "").replace(/[.,;]+$/, "").trim();
  }

  function guessMethodFromRaw(raw, fallback) {
    const s = String(raw || "") + " " + String(fallback || "");
    if (/onecard|one card/i.test(s)) return "OneCard";
    if (/axis\s*neo|\bneo\b/i.test(s)) return "Axis Neo";
    if (/privilege/i.test(s)) return "Axis Privilege";
    if (/\bupi\b|@ok|@axis|@ybl|@paytm|@ibl/i.test(s)) return "UPI";
    if (/debit card/i.test(s)) return "Debit card";
    if (/\bcash\b/i.test(s)) return "Cash";
    if (fallback && state.methods.includes(fallback)) return fallback;
    return fallback || "UPI";
  }

  function normalizeMerchant(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function guessCategory(merchant, raw) {
    const m = normalizeMerchant(merchant);
    if (m && state.merchantRules[m]) return state.merchantRules[m];
    for (const key of Object.keys(state.merchantRules || {})) {
      if (m && (m.includes(key) || key.includes(m))) return state.merchantRules[key];
    }
    const text = (merchant || "") + " " + (raw || "");
    for (const [re, cat] of MERCHANT_GUESS) {
      if (re.test(text) && state.categories.includes(cat)) return cat;
    }
    return mostUsedCategory() || "Other";
  }

  function mostUsedCategory() {
    const counts = {};
    state.entries.filter((e) => e.type === "expense").forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return sorted[0] || "Food";
  }

  function mostUsedCategories(n) {
    const counts = {};
    state.categories.forEach((c) => { counts[c] = 0; });
    state.entries.forEach((e) => { if (counts[e.category] != null) counts[e.category] += 1; });
    return state.categories.slice().sort((a, b) => (counts[b] - counts[a]) || a.localeCompare(b)).slice(0, n);
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  function entriesInMonth(key) {
    return state.entries.filter((e) => (e.date || "").startsWith(key));
  }

  function totals(list) {
    const t = { income: 0, expense: 0, saving: 0 };
    list.forEach((e) => {
      if (t[e.type] != null) t[e.type] += Number(e.amount) || 0;
    });
    t.net = t.income - t.expense;
    t.rate = t.income > 0 ? (t.saving / t.income) * 100 : 0;
    return t;
  }

  function catColor(name) {
    return CAT_COLOR[name] || CAT_COLOR.Other;
  }

  const CAT_EMOJI = {
    Food: "\uD83C\uDF54", Shopping: "\uD83D\uDECD\uFE0F", Travel: "\uD83D\uDE95", Bills: "\uD83E\uDDFE",
    Fuel: "\u26FD", Health: "\uD83D\uDC8A", Entertainment: "\uD83C\uDFAC", EMI: "\uD83D\uDCB3",
    Rent: "\uD83C\uDFE0", Investment: "\uD83D\uDCC8", Other: "\uD83D\uDCE6"
  };
  function catIcon(name) {
    const emo = CAT_EMOJI[name] || "\u2728";
    return '<span class="cat-icon em" aria-hidden="true">' + emo + "</span>";
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") !== "light";
  }

  /* ---------- theme ---------- */
  function resolveTheme(pref) {
    if (pref === "light" || pref === "dark") return pref;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function applyTheme() {
    const resolved = resolveTheme(state.theme || "system");
    document.documentElement.setAttribute("data-theme", resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#070B24" : "#F7F8FC");
    const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (bar) bar.setAttribute("content", resolved === "dark" ? "black-translucent" : "default");
    document.querySelectorAll("#themeSeg button").forEach((b) => {
      b.classList.toggle("active", b.dataset.themeVal === (state.theme || "system"));
    });
  }

  /* ---------- navigation ---------- */
  function showPage(name) {
    currentPage = name;
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.dataset.page === name));
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
    const fab = document.getElementById("fabAdd");
    fab.classList.toggle("show", name === "home" || name === "activity");
    document.getElementById("monthNav").style.display = name === "settings" ? "none" : "";
  }

  /* ---------- deep links ---------- */
  function parseParamBag(searchish) {
    const params = {};
    const src = String(searchish || "").replace(/^\?/, "");
    if (!src) return params;
    new URLSearchParams(src).forEach((v, k) => { params[k.toLowerCase()] = v; });
    return params;
  }

  function parseDeepLink() {
    const hash = (location.hash || "").replace(/^#/, "");
    let action = null;
    let params = {};
    if (hash) {
      const m = hash.match(/^(confirm|add)\b(.*)$/i);
      if (m) {
        action = m[1].toLowerCase();
        let rest = m[2] || "";
        if (rest.startsWith("&") || rest.startsWith("?")) rest = rest.slice(1);
        params = parseParamBag(rest);
      }
    }
    if (!action) {
      const q = parseParamBag(location.search);
      if (q.confirm === "1" || q.confirm === "true") action = "confirm";
      else if (q.add === "1" || q.add === "true") action = "add";
      if (action) params = Object.assign({}, q, params);
    }
    if (!action) return null;
    return { action, params };
  }

  function clearDeepLink() {
    const clean = location.pathname;
    if (location.hash || location.search) history.replaceState({}, "", clean);
  }

  function findDuplicate(amount, atTime) {
    if (amount == null) return null;
    const t = atTime ? new Date(atTime).getTime() : Date.now();
    if (!isFinite(t)) return null;
    const windowMs = 10 * 60 * 1000;
    return state.entries.find((e) => {
      if (Math.abs(Number(e.amount) - amount) > 0.009) return false;
      const et = new Date(e.createdAt || (e.date + "T12:00:00")).getTime();
      return isFinite(et) && Math.abs(et - t) <= windowMs;
    }) || null;
  }

  function buildDraftFromParams(params) {
    const raw = params.raw || params.sms || params.text || "";
    let amount = parseAmount(params.amount);
    if (amount == null) amount = parseAmountFromText(raw);
    const merchant = cleanMerchant(params.merchant || params.payee || guessMerchantFromRaw(raw) || "");
    const typeParam = String(params.type || "").toLowerCase();
    let type;
    if (typeParam === "savings") type = "saving";
    else if (typeParam === "income" || typeParam === "saving" || typeParam === "expense") type = typeParam;
    else type = guessTypeFromRaw(raw, "expense");
    const method = guessMethodFromRaw(raw, params.method || "");
    const date = normalizeDate(params.date) || todayISO();
    const note = params.note || "";
    const categoryParam = params.category || "";
    const guessed = categoryParam || guessCategory(merchant, raw);
    return {
      amount,
      amountText: amount != null ? String(amount) : (params.amount || ""),
      merchant,
      method: method || "UPI",
      date,
      note,
      type,
      raw,
      category: guessed,
      guessedCategory: guessed,
      offerRule: false,
      rememberRule: false,
      duplicate: amount != null ? findDuplicate(amount, params.time || params.created || Date.now()) : null,
      saved: false,
      source: "confirm"
    };
  }

  function normalizeDate(s) {
    if (!s) return null;
    const str = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const d = new Date(str);
    if (!isNaN(d)) return toISODate(d);
    return null;
  }

  function ensureInList(listName, value) {
    const v = String(value || "").trim();
    if (!v) return;
    if (!state[listName].includes(v)) state[listName].push(v);
  }

  function handleDeepLink() {
    const link = parseDeepLink();
    if (!link) return;
    const draft = buildDraftFromParams(link.params);
    if (link.action === "add" && draft.amount != null) {
      const entry = commitEntry({
        type: draft.type,
        amount: draft.amount,
        category: draft.category,
        method: draft.method,
        date: draft.date,
        note: draft.note,
        merchant: draft.merchant,
        source: "shortcut"
      });
      viewMonth = entry.date.slice(0, 7);
      clearDeepLink();
      renderAll();
      toast("Saved " + formatINR(entry.amount) + (entry.category ? " \u00b7 " + entry.category : ""));
      return;
    }
    openConfirm(draft);
  }

  /* ---------- confirm screen ---------- */
  function openConfirm(model) {
    confirmModel = model;
    document.body.classList.add("confirm-open");
    document.getElementById("confirmOverlay").classList.add("show");
    renderConfirm();
    if (model.amount == null) {
      setTimeout(function () {
        const inp = document.getElementById("confirmAmount");
        if (inp) { inp.focus(); if (inp.select) inp.select(); }
      }, 200);
    }
  }

  function closeConfirm(clearLink) {
    document.getElementById("confirmOverlay").classList.remove("show");
    document.body.classList.remove("confirm-open");
    confirmModel = null;
    if (clearLink) clearDeepLink();
  }

  function formatConfirmDate(iso) {
    const [y, m, d] = (iso || todayISO()).split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function displayConfirmAmount(cur) {
    if (!cur) return "\u20B90";
    if (/^\d+$/.test(cur)) return formatINR(Number(cur));
    return "\u20B9" + cur;
  }

  function applyConfirmAmountText(cur) {
    confirmModel.amountText = cur;
    confirmModel.amount = parseAmount(cur);
    const text = document.getElementById("confirmAmtText");
    const inp = document.getElementById("confirmAmount");
    if (text) text.textContent = displayConfirmAmount(cur);
    if (inp) inp.value = cur;
  }

  function renderConfirm() {
    const m = confirmModel;
    const body = document.getElementById("confirmBody");
    const foot = document.getElementById("confirmFoot");
    if (!m) return;
    if (m.saved) {
      body.innerHTML = '<div class="saved-check"><div class="mark">\u2713</div><h2>Saved</h2><p>You can go back to Messages now.</p></div>';
      foot.innerHTML = '<div class="confirm-actions"><button class="btn btn-primary" type="button" id="confirmDone">Done</button></div>';
      document.getElementById("confirmDone").onclick = function () { closeConfirm(true); renderAll(); };
      return;
    }
    const rawText = (m.amountText != null && String(m.amountText) !== "")
      ? String(m.amountText)
      : (m.amount != null ? String(m.amount) : "");
    const kicker = m.type === "income" ? "Log this income?" : "Log this spend?";
    const amtBlock =
      '<div class="confirm-kicker">' + kicker + "</div>" +
      '<div class="confirm-amt money"><span id="confirmAmtText">' + displayConfirmAmount(rawText) + '</span>' +
      '<input id="confirmAmount" class="confirm-amt-sr" inputmode="decimal" value="' + escapeAttr(rawText) + '" placeholder="0" aria-label="Amount" /></div>';
    const dup = m.duplicate
      ? '<div class="dup-banner glass" id="dupBanner"><strong>Possible duplicate</strong>Looks like a duplicate of ' + formatINR(m.duplicate.amount) + (m.duplicate.merchant || m.duplicate.category ? " \u00b7 " + escapeHtml(m.duplicate.merchant || m.duplicate.category) : "") + ". Save anyway?</div>"
      : "";
    const used = mostUsedCategories(8);
    if (m.category && state.categories.includes(m.category)) {
      const ix = used.indexOf(m.category);
      if (ix >= 0) used.splice(ix, 1);
      used.unshift(m.category);
    }
    const chips = used.filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 8).map(function (c) {
      return '<button type="button" class="chip glass' + (c === m.category ? " sel active" : "") + '" data-conf-cat="' + escapeAttr(c) + '">' + catIcon(c) + " " + escapeHtml(c) + "</button>";
    }).join("");
    const rule = (m.offerRule && m.merchant)
      ? '<div class="rule-banner glass">Always use ' + escapeHtml(m.category) + " for " + escapeHtml(m.merchant) + '? <button class="btn btn-primary" type="button" id="rememberRule" style="height:36px;width:auto;">Yes</button></div>'
      : "";
    const noteOpen = m.noteOpen || m.note;
    const keyLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
    const keysHtml = '<div class="keys">' + keyLabels.map(function (k) {
      return '<button type="button" class="glass" data-key="' + k + '">' + (k === "back" ? "\u232B" : k) + "</button>";
    }).join("") + "</div>";
    body.innerHTML = amtBlock +
      '<div class="confirm-merchant">' + (m.merchant ? escapeHtml(m.merchant) : "Unknown merchant") +
      " \u00b7 <button type=\"button\" class=\"method-chip pill navy\" id=\"confirmMethodBtn\">" + escapeHtml(m.method || "UPI") + "</button></div>" +
      '<div class="confirm-meta">Detected from SMS \u00b7 ' + escapeHtml(formatConfirmDate(m.date)) + "</div>" +
      dup + rule +
      '<div class="cat-scroll">' + chips +
      '<button type="button" class="chip glass" id="confirmMore">More</button></div><div class="more-grid hidden" id="confirmMoreGrid"></div>' +
      '<button class="note-toggle glass confirm-note" type="button" id="toggleNote">' + (noteOpen ? "Hide note" : "\u270E Add a note") + "</button>" +
      '<div class="note-box ' + (noteOpen ? "" : "hidden") + '" id="confirmNoteWrap"><input id="confirmNote" maxlength="120" placeholder="Optional note" value="' + escapeAttr(m.note || "") + '" /></div>' +
      '<div class="field confirm-type"><label>Type</label><div class="seg glass" id="confirmType">' +
      '<button type="button" data-ctype="expense" class="expense' + (m.type === "expense" ? " active" : "") + '">Expense</button>' +
      '<button type="button" data-ctype="income" class="income' + (m.type !== "expense" ? " active" : "") + '">Income</button></div></div>' +
      "";
    const saveLabel = m.duplicate ? "Save anyway" : "Save";
    foot.innerHTML = keysHtml +
      '<div class="confirm-actions"><button class="btn-ghost btn glass" type="button" id="confirmSkip">Skip</button><button class="btn btn-primary" type="button" id="confirmSave">' + saveLabel + "</button></div>";

    const amtInp = document.getElementById("confirmAmount");
    if (amtInp) {
      amtInp.addEventListener("input", function () {
        applyConfirmAmountText(amtInp.value);
      });
    }
    foot.querySelectorAll("[data-key]").forEach(function (b) {
      b.addEventListener("click", function () {
        const k = b.getAttribute("data-key");
        let cur = confirmModel.amountText != null ? String(confirmModel.amountText) : (confirmModel.amount != null ? String(confirmModel.amount) : "");
        if (k === "back") cur = cur.slice(0, -1);
        else if (k === ".") {
          if (cur.indexOf(".") >= 0) return;
          cur = cur ? cur + "." : "0.";
        } else {
          const dec = cur.split(".")[1];
          if (dec && dec.length >= 2) return;
          cur = (cur === "0") ? k : cur + k;
        }
        applyConfirmAmountText(cur);
      });
    });
    body.querySelectorAll("[data-conf-cat]").forEach(function (b) {
      b.addEventListener("click", function () { pickConfirmCategory(b.getAttribute("data-conf-cat")); });
    });
    const more = document.getElementById("confirmMore");
    const grid = document.getElementById("confirmMoreGrid");
    more.addEventListener("click", function () {
      const open = grid.classList.contains("hidden");
      if (open) {
        grid.innerHTML = state.categories.map(function (c) {
          return '<button type="button" class="chip glass' + (c === m.category ? " sel active" : "") + '" data-conf-cat="' + escapeAttr(c) + '">' + catIcon(c) + " " + escapeHtml(c) + "</button>";
        }).join("");
        grid.classList.remove("hidden");
        grid.querySelectorAll("[data-conf-cat]").forEach(function (b) {
          b.addEventListener("click", function () { pickConfirmCategory(b.getAttribute("data-conf-cat")); });
        });
      } else grid.classList.add("hidden");
    });
    document.getElementById("toggleNote").addEventListener("click", function () {
      confirmModel.noteOpen = !confirmModel.noteOpen;
      const inp = document.getElementById("confirmNote");
      if (inp) confirmModel.note = inp.value;
      renderConfirm();
    });
    const noteInp = document.getElementById("confirmNote");
    if (noteInp) noteInp.addEventListener("input", function () { confirmModel.note = noteInp.value; });
    document.querySelectorAll("#confirmType button").forEach(function (b) {
      b.addEventListener("click", function () { confirmModel.type = b.dataset.ctype; renderConfirm(); });
    });
    document.getElementById("confirmMethodBtn").addEventListener("click", function () {
      const next = state.methods[(state.methods.indexOf(confirmModel.method) + 1) % state.methods.length];
      confirmModel.method = next;
      renderConfirm();
    });
    const remember = document.getElementById("rememberRule");
    if (remember) remember.addEventListener("click", function () {
      const key = normalizeMerchant(confirmModel.merchant);
      if (key) {
        state.merchantRules[key] = confirmModel.category;
        save();
        confirmModel.offerRule = false;
        confirmModel.rememberRule = true;
        toast("Got it \u2014 " + confirmModel.category + " for " + confirmModel.merchant);
        renderConfirm();
      }
    });
    document.getElementById("confirmSave").addEventListener("click", saveConfirm);
    document.getElementById("confirmSkip").addEventListener("click", skipConfirm);
    if (m.amount == null || m.forceAmountEdit) {
      setTimeout(function () {
        const inp = document.getElementById("confirmAmount");
        if (inp) inp.focus();
      }, 30);
    }
  }

  function pickConfirmCategory(cat) {
    confirmModel.category = cat;
    if (confirmModel.merchant && cat !== confirmModel.guessedCategory) confirmModel.offerRule = true;
    renderConfirm();
  }

  function readConfirmAmount() {
    const inp = document.getElementById("confirmAmount");
    if (inp) {
      confirmModel.amountText = inp.value;
      confirmModel.amount = parseAmount(inp.value);
    }
    const note = document.getElementById("confirmNote");
    if (note) confirmModel.note = note.value;
    return confirmModel.amount;
  }

  function saveConfirm() {
    const amount = readConfirmAmount();
    if (amount == null) {
      confirmModel.forceAmountEdit = true;
      renderConfirm();
      setTimeout(function () {
        const inp = document.getElementById("confirmAmount");
        if (inp) inp.focus();
      }, 50);
      toast("Enter the amount");
      return;
    }
    const entry = commitEntry({
      type: confirmModel.type === "income" ? "income" : "expense",
      amount: amount,
      category: confirmModel.category,
      method: confirmModel.method,
      date: confirmModel.date,
      note: confirmModel.note,
      merchant: confirmModel.merchant,
      source: "confirm"
    });
    if (confirmModel.rememberRule && confirmModel.merchant) {
      state.merchantRules[normalizeMerchant(confirmModel.merchant)] = confirmModel.category;
      save();
    }
    viewMonth = entry.date.slice(0, 7);
    confirmModel.saved = true;
    clearDeepLink();
    renderConfirm();
    setTimeout(function () {
      if (confirmModel && confirmModel.saved) {
        closeConfirm(true);
        renderAll();
      }
    }, 1600);
  }

  function skipConfirm() {
    readConfirmAmount();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    state.review.push({
      id: uid("r"),
      type: confirmModel.type,
      amount: confirmModel.amount,
      amountText: confirmModel.amountText,
      category: confirmModel.category,
      method: confirmModel.method,
      date: confirmModel.date,
      note: confirmModel.note,
      merchant: confirmModel.merchant,
      raw: confirmModel.raw,
      createdAt: new Date().toISOString(),
      expiresAt: expires.toISOString()
    });
    save();
    clearDeepLink();
    closeConfirm(true);
    renderAll();
    toast("Moved to Needs review");
  }

  function commitEntry(fields) {
    const amount = parseAmount(fields.amount);
    if (amount == null) return null;
    let type = String(fields.type || "expense").toLowerCase();
    if (type === "savings") type = "saving";
    if (type !== "expense" && type !== "income" && type !== "saving") type = "expense";
    const category = String(fields.category || "Other").trim() || "Other";
    const method = String(fields.method || "Other").trim() || "Other";
    const date = normalizeDate(fields.date) || todayISO();
    ensureInList("categories", category);
    ensureInList("methods", method);
    const entry = {
      id: fields.id || uid("e"),
      type: type,
      amount: amount,
      category: category,
      method: method,
      date: date,
      note: String(fields.note || "").trim(),
      merchant: String(fields.merchant || "").trim(),
      createdAt: fields.createdAt || new Date().toISOString(),
      source: fields.source || "manual"
    };
    const existing = state.entries.findIndex((e) => e.id === entry.id);
    if (existing >= 0) state.entries[existing] = entry;
    else state.entries.unshift(entry);
    save();
    return entry;
  }

  /* ---------- render ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function renderRing(pct) {
    const r = 15, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, pct));
    const dash = (p / 100) * c;
    const track = "rgba(255,255,255,.18)";
    const gold = "#F5D27A";
    document.getElementById("rateRing").innerHTML =
      '<svg viewBox="0 0 36 36" aria-hidden="true">' +
      '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + track + '" stroke-width="4"/>' +
      '<circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + gold + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + dash + " " + c + '"/>' +
      '</svg><div class="ring-center"><div class="ring-val">' + Math.round(p) + '%</div></div>';
  }

  function renderSummary() {
    document.getElementById("monthLabel").textContent = monthLabel(viewMonth);
    const t = totals(entriesInMonth(viewMonth));
    document.getElementById("sumIncome").textContent = formatINR(t.income);
    document.getElementById("sumExpense").textContent = formatINR(t.expense);
    document.getElementById("sumSaving").textContent = formatINR(t.saving);
    const netEl = document.getElementById("sumNet");
    netEl.textContent = (t.net < 0 ? "\u2212" : "") + formatINR(Math.abs(t.net));
    netEl.className = "stat-v money " + (t.net >= 0 ? "pos" : "neg");
    document.getElementById("sumRateLabel").textContent = "Savings rate " + (Math.round(t.rate * 10) / 10) + "%";
    const heroLab = document.getElementById("heroSavedLabel");
    if (heroLab) heroLab.textContent = "Saved in " + monthLabel(viewMonth).split(" ")[0];
    const totalB = Object.values(state.budgets).reduce(function (s, n) { return s + (Number(n) || 0); }, 0);
    const leftEl = document.getElementById("sumBudgetLeft");
    if (leftEl) {
      if (!totalB) leftEl.textContent = "\u2014";
      else {
        const left = totalB - t.expense;
        leftEl.textContent = (left < 0 ? "\u2212" : "") + formatINR(Math.abs(left));
        leftEl.style.color = left < 0 ? "var(--expense)" : "";
      }
    }
    renderRing(t.rate);
  }

  function renderBanners() {
    purgeReview();
    const rev = document.getElementById("reviewBanner");
    const n = state.review.length;
    if (n) {
      rev.innerHTML = '<button class="banner glass warn" type="button" id="openReview"><span>\u26A1 ' + n + ' spend' + (n === 1 ? '' : 's') + ' need review</span><span class="pill gold">Review</span></button>';
      document.getElementById("openReview").onclick = openReviewList;
    } else rev.innerHTML = "";

    const nudge = document.getElementById("nudgeBanner");
    const thisMonth = currentMonthKey();
    const prev = shiftMonth(thisMonth, -1);
    const shouldNudge = state.lastMonthNudge !== thisMonth && entriesInMonth(prev).length > 0;
    if (shouldNudge) {
      const t = totals(entriesInMonth(prev));
      nudge.innerHTML = '<div class="banner info"><span><strong>' + escapeHtml(monthLabel(prev)) + ' in brief</strong><span>Income ' + formatINR(t.income) + " \u00b7 Spent " + formatINR(t.expense) + " \u00b7 Saved " + formatINR(t.saving) + "</span></span></div>" +
        '<div class="banner-actions" style="margin-bottom:8px"><button class="btn btn-primary" type="button" id="nudgeExcel">Export Excel</button><button class="btn" type="button" id="nudgeDismiss">Dismiss</button></div>';
      document.getElementById("nudgeExcel").onclick = function () { downloadExcel(); dismissNudge(); };
      document.getElementById("nudgeDismiss").onclick = dismissNudge;
    } else nudge.innerHTML = "";

    const bak = document.getElementById("backupBanner");
    const due = backupDue();
    if (due) {
      bak.innerHTML = '<button class="banner warn" type="button" id="openBackupHint"><span><strong>Time for a backup</strong><span>' + escapeHtml(due) + '</span></span><span class="chev">\u203a</span></button>';
      document.getElementById("openBackupHint").onclick = function () { showPage("settings"); };
    } else bak.innerHTML = "";

    const alerts = document.getElementById("budgetAlerts");
    const spend = spendByCategory(viewMonth);
    const overs = Object.keys(state.budgets).filter(function (cat) {
      const b = Number(state.budgets[cat]) || 0;
      return b > 0 && (spend[cat] || 0) > b;
    });
    alerts.innerHTML = overs.map(function (cat) {
      const b = Number(state.budgets[cat]);
      const s = spend[cat] || 0;
      return '<div class="banner warn" style="margin-top:8px"><span><strong>Over budget \u00b7 ' + escapeHtml(cat) + "</strong><span>" + formatINR(s) + " of " + formatINR(b) + "</span></span></div>";
    }).join("");
  }

  function dismissNudge() {
    state.lastMonthNudge = currentMonthKey();
    save();
    renderBanners();
  }

  function backupDue() {
    if (!state.lastBackup) return "You have not made a JSON backup yet. iPhone can clear site data after about a week if this is not on your Home Screen.";
    const t = new Date(state.lastBackup).getTime();
    if (!isFinite(t)) return "Please make a fresh backup.";
    const days = (Date.now() - t) / 86400000;
    if (days >= 14) return "Last backup was " + Math.floor(days) + " days ago.";
    return null;
  }

  function spendByCategory(monthKey) {
    const spend = {};
    entriesInMonth(monthKey).filter((e) => e.type === "expense").forEach((e) => {
      spend[e.category] = (spend[e.category] || 0) + e.amount;
    });
    return spend;
  }

  function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
  }

  function chartTheme() {
    const dark = isDark();
    return {
      text: dark ? "rgba(243,245,251,.55)" : "rgba(11,26,92,.55)",
      grid: dark ? "rgba(255,255,255,.08)" : "rgba(11,26,92,.08)",
      income: "#2440B8",
      expense: "#E8B33A",
      gold: "#E8B33A",
      navy: "#0B1A5C"
    };
  }
  const CHART_PALETTE = ["#0B1A5C", "#1B2C8A", "#2440B8", "#3A56C8", "#C98E12", "#E8B33A", "#F5D27A", "#F7D984", "#8A9AD4", "#5C6FBF"];

  function setEmpty(wrapId, canvasId, message, hasData) {
    const wrap = document.getElementById(wrapId);
    const canvas = document.getElementById(canvasId);
    if (!wrap) return;
    let empty = wrap.querySelector(".chart-empty");
    if (hasData) {
      if (empty) empty.remove();
      if (canvas) canvas.style.display = "";
    } else {
      if (canvas) canvas.style.display = "none";
      if (!empty) { empty = document.createElement("div"); empty.className = "chart-empty"; wrap.appendChild(empty); }
      empty.textContent = message;
    }
  }

  function renderCharts() {
    const monthEntries = entriesInMonth(viewMonth);
    const expenses = monthEntries.filter((e) => e.type === "expense");
    const colors = chartTheme();
    const tick = { color: colors.text, font: { size: 11 } };
    const grid = { color: colors.grid };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const anim = reduced ? false : { duration: 180 };

    destroyChart("cat");
    const catMap = {};
    expenses.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
    const catLabels = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);
    setEmpty("catChartWrap", "catChart", "No expenses this month yet", catLabels.length > 0);
    if (catLabels.length) {
      charts.cat = new Chart(document.getElementById("catChart"), {
        type: "doughnut",
        data: {
          labels: catLabels,
          datasets: [{ data: catLabels.map((k) => catMap[k]), backgroundColor: catLabels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]), borderWidth: 0 }]
        },
        options: {
          animation: anim, responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => " " + ctx.label + ": " + formatINR(ctx.parsed) } }
          }
        }
      });
    }

    const top = document.getElementById("topCats");
    const topRows = catLabels.slice(0, 5);
    const total = topRows.reduce((s, k) => s + catMap[k], 0) || 1;
    if (!topRows.length) top.innerHTML = "";
    else top.innerHTML = topRows.map(function (k) {
      const pct = Math.round((catMap[k] / total) * 100);
      return '<li class="top-item cat-row">' + catIcon(k) + '<div class="grow"><div style="display:flex;justify-content:space-between;gap:8px"><span class="name">' + escapeHtml(k) + '</span><span class="amt money">' + formatINR(catMap[k]) + '</span></div><div class="bar"><span style="width:' + pct + '%"></span></div></div><div class="pct-lab">' + pct + "%</div></li>";
    }).join("");

    destroyChart("daily");
    const parts = viewMonth.split("-").map(Number);
    const yy = parts[0], mm = parts[1];
    const daysInMonth = new Date(yy, mm, 0).getDate();
    const perDay = Array(daysInMonth).fill(0);
    expenses.forEach((e) => {
      const d = Number((e.date || "").slice(8, 10));
      if (d >= 1 && d <= daysInMonth) perDay[d - 1] += e.amount;
    });
    setEmpty("dailyChartWrap", "dailyChart", "No spending this month yet", true);
    document.getElementById("dailyChart").style.display = "";
    const emptyD = document.getElementById("dailyChartWrap").querySelector(".chart-empty");
    if (emptyD) emptyD.remove();
    charts.daily = new Chart(document.getElementById("dailyChart"), {
      type: "bar",
      data: { labels: perDay.map((_, i) => String(i + 1)), datasets: [{ label: "Spend", data: perDay, backgroundColor: colors.expense, borderRadius: 4 }] },
      options: {
        animation: anim, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatINR(ctx.parsed.y) } } },
        scales: {
          x: { ticks: tick, grid: { display: false } },
          y: { ticks: Object.assign({}, tick, { callback: (v) => (v >= 1000 ? (v / 1000) + "k" : v) }), grid: grid, beginAtZero: true }
        }
      }
    });

    destroyChart("trend");
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(viewMonth, -i));
    charts.trend = new Chart(document.getElementById("trendChart"), {
      type: "bar",
      data: {
        labels: months.map(function (k) {
          const p = k.split("-");
          return new Date(p[0], p[1] - 1, 1).toLocaleDateString("en-IN", { month: "short" });
        }),
        datasets: [
          { label: "Income", data: months.map((k) => totals(entriesInMonth(k)).income), backgroundColor: colors.income, borderRadius: 6 },
          { label: "Expenses", data: months.map((k) => totals(entriesInMonth(k)).expense), backgroundColor: colors.expense, borderRadius: 6 }
        ]
      },
      options: {
        animation: anim, responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text, boxWidth: 12 } },
          tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ": " + formatINR(ctx.parsed.y) } }
        },
        scales: {
          x: { ticks: tick, grid: { display: false } },
          y: { ticks: Object.assign({}, tick, { callback: (v) => (v >= 1000 ? (v / 1000) + "k" : v) }), grid: grid, beginAtZero: true }
        }
      }
    });

    destroyChart("method");
    const methMap = {};
    expenses.forEach((e) => { methMap[e.method] = (methMap[e.method] || 0) + e.amount; });
    let methLabels = METHOD_CHART_ORDER.filter((k) => methMap[k]);
    Object.keys(methMap).forEach((k) => { if (!methLabels.includes(k)) methLabels.push(k); });
    methLabels.sort((a, b) => (methMap[b] || 0) - (methMap[a] || 0));
    setEmpty("methodChartWrap", "methodChart", "No expenses this month yet", methLabels.length > 0);
    if (methLabels.length) {
      document.getElementById("methodChart").style.display = "";
      charts.method = new Chart(document.getElementById("methodChart"), {
        type: "bar",
        data: { labels: methLabels, datasets: [{ label: "Spend", data: methLabels.map((k) => methMap[k] || 0), backgroundColor: "#E8B33A", borderRadius: 6 }] },
        options: {
          indexAxis: "y", animation: anim, responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatINR(ctx.parsed.x) } } },
          scales: {
            x: { ticks: Object.assign({}, tick, { callback: (v) => (v >= 1000 ? (v / 1000) + "k" : v) }), grid: grid, beginAtZero: true },
            y: { ticks: tick, grid: { display: false } }
          }
        }
      });
    }
  }

  function dayTitle(iso) {
    const today = todayISO();
    const yest = toISODate(new Date(Date.now() - 86400000));
    if (iso === today) return "Today";
    if (iso === yest) return "Yesterday";
    const p = iso.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function filteredActivity() {
    let list = entriesInMonth(viewMonth).slice();
    if (listFilter !== "all") list = list.filter((e) => e.type === listFilter);
    if (listCat !== "all") list = list.filter((e) => e.category === listCat);
    if (listMethod !== "all") list = list.filter((e) => e.method === listMethod);
    const q = listQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(function (e) {
        const bag = [e.note, e.merchant, e.category, e.method, e.type, String(e.amount), formatINR(e.amount)].join(" ").toLowerCase();
        return bag.includes(q);
      });
    }
    return list.sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  }

  function entryRow(e) {
    const sign = e.type === "expense" ? "\u2212" : "+";
    const title = e.merchant || e.category;
    const bits = [e.category, e.method];
    if (e.note) bits.push(e.note);
    return '<div class="swipe-row" data-id="' + escapeAttr(e.id) + '"><div class="swipe-bg">Delete</div>' +
      '<div class="tx-item" data-open="' + escapeAttr(e.id) + '">' + catIcon(e.category) +
      '<div class="grow"><div class="tx-title">' + escapeHtml(title) + '</div><div class="tx-meta">' + escapeHtml(bits.join(" \u00b7 ")) + "</div></div>" +
      '<div class="amt ' + e.type + ' money">' + sign + formatINR(e.amount) + "</div></div></div>";
  }

  function renderActivity() {
    const list = filteredActivity();
    const root = document.getElementById("activityList");
    if (!list.length) {
      root.innerHTML = '<div class="empty"><strong>No entries this month</strong>Tap + to add a spend, income or saving.</div>';
      return;
    }
    const groups = {};
    list.forEach((e) => { (groups[e.date] = groups[e.date] || []).push(e); });
    const days = Object.keys(groups).sort().reverse();
    root.innerHTML = days.map(function (day) {
      const spent = groups[day].filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      const inc = groups[day].filter((e) => e.type !== "expense").reduce((s, e) => s + e.amount, 0);
      let total;
      if (spent && inc) total = "\u2212" + formatINR(spent) + "  +" + formatINR(inc);
      else if (inc) total = "+" + formatINR(inc);
      else total = "\u2212" + formatINR(spent);
      return '<div class="day-group"><div class="day-head"><div class="d">' + escapeHtml(dayTitle(day)) + '</div><div class="day-total money">' + total + "</div></div>" +
        '<div class="card glass" style="padding:0;overflow:hidden">' + groups[day].map(entryRow).join("") + "</div></div>";
    }).join("");
    bindSwipe(root);
    root.querySelectorAll("[data-open]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (el.dataset.swiping === "1") return;
        const entry = state.entries.find((x) => x.id === el.getAttribute("data-open"));
        if (entry) openSheet(entry);
      });
    });
    renderExtraFilters();
  }

  function renderExtraFilters() {
    const el = document.getElementById("extraFilters");
    const cats = ["all"].concat(state.categories);
    el.innerHTML = cats.map(function (c) {
      return '<button class="chip' + (listCat === c ? " active" : "") + '" type="button" data-lcat="' + escapeAttr(c) + '">' + (c === "all" ? "All categories" : escapeHtml(c)) + "</button>";
    }).join("");
    el.querySelectorAll("[data-lcat]").forEach(function (b) {
      b.addEventListener("click", function () { listCat = b.getAttribute("data-lcat"); renderActivity(); });
    });
  }

  function bindSwipe(root) {
    let startX = 0, startY = 0, item = null, dx = 0, locked = null;
    root.addEventListener("touchstart", function (ev) {
      const row = ev.target.closest(".tx-item");
      if (!row) return;
      item = row;
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
      dx = 0; locked = null;
      item.style.transition = "none";
    }, { passive: true });
    root.addEventListener("touchmove", function (ev) {
      if (!item) return;
      const x = ev.touches[0].clientX - startX;
      const y = ev.touches[0].clientY - startY;
      if (locked == null && (Math.abs(x) > 8 || Math.abs(y) > 8)) locked = Math.abs(x) > Math.abs(y) ? "x" : "y";
      if (locked !== "x") return;
      dx = Math.min(0, x);
      item.style.transform = "translateX(" + dx + "px)";
      item.classList.toggle("swiped", dx < -8);
      item.dataset.swiping = "1";
    }, { passive: true });
    root.addEventListener("touchend", function () {
      if (!item) return;
      item.style.transition = "transform 0.18s ease-out";
      const row = item.closest(".swipe-row");
      if (dx < -80) {
        const id = row.getAttribute("data-id");
        const entry = state.entries.find((x) => x.id === id);
        item.style.transform = "translateX(-96px)";
        const hold = item;
        setTimeout(function () {
          if (entry && confirm("Delete this " + entry.type + " of " + formatINR(entry.amount) + "?")) {
            state.entries = state.entries.filter((x) => x.id !== id);
            save();
            renderAll();
            toast("Entry deleted");
          } else {
            hold.style.transform = "";
            hold.classList.remove("swiped");
          }
        }, 80);
      } else {
        item.style.transform = "";
        item.classList.remove("swiped");
        const el = item;
        setTimeout(function () { el.dataset.swiping = "0"; }, 80);
      }
      item = null;
    });
  }

  function renderBudgets() {
    const spend = spendByCategory(viewMonth);
    const totalB = Object.values(state.budgets).reduce((s, n) => s + (Number(n) || 0), 0);
    const totalS = Object.values(spend).reduce((s, n) => s + n, 0);
    document.getElementById("budgetTotalAmt").textContent = totalB ? formatINR(totalB) : "No limit";
    document.getElementById("budgetTotalFig").textContent = totalB
      ? formatINR(totalS) + " spent of " + formatINR(totalB)
      : "No budgets set yet. Tap a category to add one.";
    const pct = totalB ? Math.min(100, (totalS / totalB) * 100) : 0;
    const bar = document.getElementById("budgetTotalBar");
    bar.className = "bar " + barClass(totalB, totalS);
    document.getElementById("budgetTotalFill").style.width = (totalB ? pct : 0) + "%";
    const usedEl = document.getElementById("budgetUsedPct");
    if (usedEl) usedEl.textContent = totalB ? Math.round(pct) + "%" : "\u2014";

    document.getElementById("budgetList").innerHTML = state.categories.map(function (cat) {
      const b = Number(state.budgets[cat]) || 0;
      const s = spend[cat] || 0;
      const p = b > 0 ? Math.min(100, (s / b) * 100) : 0;
      const over = b > 0 && s > b;
      return '<button class="budget-item" type="button" data-edit-budget="' + escapeAttr(cat) + '">' +
        '<div class="cat-row" style="padding:0">' + catIcon(cat) + '<div class="grow">' +
        '<div class="row"><div class="cat">' + escapeHtml(cat) + '</div><div class="amt money' + (over ? " expense" : "") + '" style="' + (over ? "color:var(--expense)" : "") + '">' +
        formatINR(s) + (b ? ' <span class="mut">/ ' + formatINR(b) + "</span>" : "") + "</div></div>" +
        '<div class="bar ' + barClass(b, s) + '"><span style="width:' + (b ? p : 0) + '%"></span></div>' +
        (over ? '<div class="warn-text">Over budget by ' + formatINR(s - b) + "</div>" : "") +
        "</div></div></button>";
    }).join("");

    const methBox = document.getElementById("methodSummary");
    if (methBox) {
      const methMap = {};
      entriesInMonth(viewMonth).filter(function (e) { return e.type === "expense"; }).forEach(function (e) {
        methMap[e.method] = (methMap[e.method] || 0) + e.amount;
      });
      const labels = Object.keys(methMap).sort(function (a, b) { return methMap[b] - methMap[a]; });
      methBox.innerHTML = labels.length
        ? labels.map(function (m) {
            return '<div class="set-row"><span>' + escapeHtml(m) + '</span><span class="amt money">' + formatINR(methMap[m]) + "</span></div>";
          }).join("")
        : '<div class="empty" style="border:0;background:transparent">No expenses this month.</div>';
    }
  }

  function barClass(budget, spent) {
    if (!budget) return "";
    const p = spent / budget;
    if (p > 1) return "red";
    if (p >= 0.75) return "amber";
    return "";
  }

  function renderPills() {
    document.getElementById("catPills").innerHTML = state.categories.map(function (c) {
      return '<span class="pill">' + escapeHtml(c) + '<button type="button" data-rm-cat="' + escapeAttr(c) + '" aria-label="Remove">\u00d7</button></span>';
    }).join("");
    document.getElementById("methodPills").innerHTML = state.methods.map(function (m) {
      return '<span class="pill">' + escapeHtml(m) + '<button type="button" data-rm-method="' + escapeAttr(m) + '" aria-label="Remove">\u00d7</button></span>';
    }).join("");
    const keys = Object.keys(state.merchantRules || {});
    document.getElementById("rulePills").innerHTML = keys.length
      ? keys.map(function (k) {
          return '<span class="pill">' + escapeHtml(k) + " \u2192 " + escapeHtml(state.merchantRules[k]) + '<button type="button" data-rm-rule="' + escapeAttr(k) + '" aria-label="Remove">\u00d7</button></span>';
        }).join("")
      : '<span class="hint">No rules yet.</span>';
    const lab = document.getElementById("lastBackupLabel");
    if (state.lastBackup) {
      const d = new Date(state.lastBackup);
      lab.textContent = isNaN(d) ? "Saved" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    } else lab.textContent = "Never";
  }

  function appBase() {
    if (location.protocol === "http:" || location.protocol === "https:") {
      const path = location.pathname.replace(/index\.html$/, "");
      return location.origin + path;
    }
    return "https://neuraljatin.github.io/money-tracker/";
  }

  function renderShortcutSteps() {
    const base = appBase();
    document.getElementById("shortcutSteps").innerHTML =
      '<div class="step-card"><h3><span class="n">1</span>Add to Home Screen first</h3>' +
      "<p>Open this page in Safari, tap Share, then Add to Home Screen. iPhone can wipe a normal Safari site\u2019s saved data after about 7 days without a visit. A home-screen app is mostly kept.</p></div>" +
      '<div class="step-card"><h3><span class="n">2</span>Make a \u201cLog Spend\u201d shortcut</h3>' +
      "<p>In Shortcuts, Ask for Input (amount), Choose from Menu (category), Choose from Menu (payment method), optional note. URL-encode each value, then Open URLs:</p>" +
      '<p style="word-break:break-all;margin-top:6px;color:var(--text)">' + escapeHtml(base) + "#add&amp;type=expense&amp;amount=AMOUNT&amp;category=CATEGORY&amp;method=METHOD&amp;note=NOTE</p></div>" +
      '<div class="step-card"><h3><span class="n">3</span>Or log a bank SMS</h3>' +
      "<p>If the shortcut reads an SMS, open this instead (amount, merchant, method and the raw text go after #, so they never reach a server):</p>" +
      '<p style="word-break:break-all;margin-top:6px;color:var(--text)">' + escapeHtml(base) + "#confirm&amp;amount=AMOUNT&amp;merchant=MERCHANT&amp;method=METHOD&amp;raw=RAW</p>" +
      '<p style="margin-top:6px">A \u201ccredited\u201d SMS is treated as income. If the amount can\u2019t be read, the confirm screen opens with the amount box focused.</p></div>' +
      '<div class="step-card"><h3><span class="n">4</span>Put it one tap away</h3>' +
      "<p>Add the shortcut to your Home Screen, use Back Tap (Settings \u2192 Accessibility \u2192 Touch \u2192 Back Tap), or Add to Siri.</p></div>" +
      '<p class="hint">Full steps are in SHORTCUT.md in the app folder.</p>';
  }

  function renderAll() {
    applyTheme();
    renderSummary();
    renderBanners();
    renderCharts();
    renderActivity();
    renderBudgets();
    renderPills();
    renderShortcutSteps();
  }

  /* ---------- sheet (manual add/edit) ---------- */
  function renderFormChips() {
    document.getElementById("catChips").innerHTML = state.categories.map(function (c) {
      return '<button type="button" class="chip' + (c === formCategory ? " active" : "") + '" data-cat="' + escapeAttr(c) + '">' + escapeHtml(c) + "</button>";
    }).join("");
    document.getElementById("methodChips").innerHTML = state.methods.map(function (m) {
      return '<button type="button" class="chip' + (m === formMethod ? " active" : "") + '" data-method="' + escapeAttr(m) + '">' + escapeHtml(m) + "</button>";
    }).join("");
  }

  function openSheet(entry) {
    document.getElementById("sheetTitle").textContent = entry ? "Edit entry" : "Add entry";
    document.getElementById("entryId").value = entry ? entry.id : "";
    formType = entry ? entry.type : "expense";
    formCategory = entry ? entry.category : (state.categories[0] || "Other");
    formMethod = entry ? entry.method : (state.methods.includes("UPI") ? "UPI" : (state.methods[0] || "Other"));
    document.getElementById("amount").value = entry ? String(entry.amount) : "";
    document.getElementById("date").value = entry ? entry.date : todayISO();
    document.getElementById("note").value = entry ? (entry.note || "") : "";
    document.getElementById("merchant").value = entry ? (entry.merchant || "") : "";
    document.querySelectorAll("#typeSeg button").forEach(function (b) { b.classList.toggle("active", b.dataset.type === formType); });
    document.getElementById("deleteEntry").classList.toggle("hidden", !entry);
    renderFormChips();
    document.getElementById("backdrop").classList.add("show");
    document.getElementById("sheet").classList.add("show");
    setTimeout(function () { document.getElementById("amount").focus(); }, 200);
  }

  function closeSheet() {
    document.getElementById("sheet").classList.remove("show");
    document.getElementById("backdrop").classList.remove("show");
  }

  function openReviewList() {
    const body = document.getElementById("reviewBody");
    document.getElementById("reviewOverlay").classList.add("show");
    document.body.classList.add("confirm-open");
    if (!state.review.length) {
      body.innerHTML = '<div class="empty"><strong>All clear</strong>Nothing is waiting for review.</div>';
      return;
    }
    body.innerHTML = state.review.map(function (r) {
      return '<div class="card"><div class="confirm-amt" style="font-size:28px;text-align:left">' + (r.amount != null ? formatINR(r.amount) : "No amount") + "</div>" +
        '<div class="sub">' + escapeHtml(r.merchant || "Unknown") + " \u00b7 " + escapeHtml(r.method || "") + " \u00b7 " + escapeHtml(r.date || "") + "</div>" +
        '<div class="btn-row" style="grid-template-columns:1fr 1fr;margin-top:12px">' +
        '<button class="btn" type="button" data-dismiss-rev="' + escapeAttr(r.id) + '">Dismiss</button>' +
        '<button class="btn btn-primary" type="button" data-review-open="' + escapeAttr(r.id) + '">Review</button></div></div>';
    }).join("");
    body.querySelectorAll("[data-review-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        const r = state.review.find((x) => x.id === b.getAttribute("data-review-open"));
        if (!r) return;
        state.review = state.review.filter((x) => x.id !== r.id);
        save();
        document.getElementById("reviewOverlay").classList.remove("show");
        openConfirm(buildDraftFromParams({
          amount: r.amount != null ? String(r.amount) : (r.amountText || ""),
          merchant: r.merchant, method: r.method, date: r.date, note: r.note,
          type: r.type, raw: r.raw, category: r.category
        }));
      });
    });
    body.querySelectorAll("[data-dismiss-rev]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.review = state.review.filter((x) => x.id !== b.getAttribute("data-dismiss-rev"));
        save();
        if (!state.review.length) {
          document.getElementById("reviewOverlay").classList.remove("show");
          document.body.classList.remove("confirm-open");
          renderAll();
        } else openReviewList();
      });
    });
  }

  /* ---------- excel / backup ---------- */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function parseISODate(iso) {
    const p = String(iso).split("-").map(Number);
    if (!p[0] || !p[1] || !p[2]) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function decorateSheet(ws, colWidths) {
    ws["!cols"] = colWidths.map(function (wch) { return { wch: wch }; });
    const ref = ws["!ref"] || "A1";
    ws["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
    ws["!autofilter"] = { ref: ref };
  }

  function applyFormats(ws, rows, spec) {
    for (let r = 2; r <= rows; r++) {
      Object.keys(spec).forEach(function (col) {
        const cell = ws[col + r];
        if (!cell) return;
        if (spec[col] === "inr") {
          if (typeof cell.v === "number") cell.z = '"\u20B9"#,##,##0.00';
        } else if (spec[col] === "date" && cell.v instanceof Date) {
          cell.t = "d"; cell.z = "dd-mmm-yyyy";
        } else if (spec[col] === "month" && cell.v instanceof Date) {
          cell.t = "d"; cell.z = "mmm-yyyy";
        } else if (spec[col] === "pct" && typeof cell.v === "number") {
          cell.z = '0.00"%"';
        }
      });
    }
  }

  function monthKeysFromEntries() {
    const set = new Set(state.entries.map((e) => (e.date || "").slice(0, 7)).filter(Boolean));
    return Array.from(set).sort();
  }

  function buildWorkbook() {
    const wb = XLSX.utils.book_new();
    const sorted = state.entries.slice().sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));

    const txRows = [["Date", "Type", "Amount (INR)", "Category", "Payment Method", "Merchant", "Note"]];
    sorted.forEach(function (e) {
      txRows.push([parseISODate(e.date) || e.date, e.type, e.amount, e.category, e.method, e.merchant || "", e.note || ""]);
    });
    const wsTx = XLSX.utils.aoa_to_sheet(txRows, { cellDates: true });
    decorateSheet(wsTx, [12, 10, 16, 16, 18, 20, 30]);
    applyFormats(wsTx, txRows.length, { A: "date", C: "inr" });
    XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

    const msRows = [["Month", "Income", "Expenses", "Savings", "Net", "Savings rate %"]];
    monthKeysFromEntries().forEach(function (k) {
      const t = totals(entriesInMonth(k));
      const p = k.split("-").map(Number);
      msRows.push([new Date(p[0], p[1] - 1, 1), t.income, t.expense, t.saving, t.net, Math.round(t.rate * 100) / 100]);
    });
    const wsMs = XLSX.utils.aoa_to_sheet(msRows, { cellDates: true });
    decorateSheet(wsMs, [12, 14, 14, 14, 14, 16]);
    applyFormats(wsMs, msRows.length, { A: "month", B: "inr", C: "inr", D: "inr", E: "inr", F: "pct" });
    XLSX.utils.book_append_sheet(wb, wsMs, "Monthly Summary");

    const catMap = {};
    state.entries.forEach(function (e) {
      if (!catMap[e.category]) catMap[e.category] = { income: 0, expense: 0, saving: 0, count: 0 };
      catMap[e.category][e.type] = (catMap[e.category][e.type] || 0) + e.amount;
      catMap[e.category].count += 1;
    });
    const totalExp = state.entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0) || 0;
    const csRows = [["Category", "Income", "Expenses", "Savings", "Entry count", "% of all expenses"]];
    Object.keys(catMap).sort().forEach(function (c) {
      const r = catMap[c];
      csRows.push([c, r.income, r.expense, r.saving, r.count, totalExp ? Math.round((r.expense / totalExp) * 10000) / 100 : 0]);
    });
    const wsCs = XLSX.utils.aoa_to_sheet(csRows);
    decorateSheet(wsCs, [16, 14, 14, 14, 12, 18]);
    applyFormats(wsCs, csRows.length, { B: "inr", C: "inr", D: "inr", F: "pct" });
    XLSX.utils.book_append_sheet(wb, wsCs, "Category Summary");

    const methMap = {};
    state.entries.forEach(function (e) {
      if (!methMap[e.method]) methMap[e.method] = { income: 0, expense: 0, saving: 0, count: 0 };
      methMap[e.method][e.type] = (methMap[e.method][e.type] || 0) + e.amount;
      methMap[e.method].count += 1;
    });
    const pmRows = [["Payment Method", "Income", "Expenses", "Savings", "Entry count", "% of all expenses"]];
    Object.keys(methMap).sort().forEach(function (m) {
      const r = methMap[m];
      pmRows.push([m, r.income, r.expense, r.saving, r.count, totalExp ? Math.round((r.expense / totalExp) * 10000) / 100 : 0]);
    });
    const wsPm = XLSX.utils.aoa_to_sheet(pmRows);
    decorateSheet(wsPm, [20, 14, 14, 14, 12, 18]);
    applyFormats(wsPm, pmRows.length, { B: "inr", C: "inr", D: "inr", F: "pct" });
    XLSX.utils.book_append_sheet(wb, wsPm, "Payment Method Summary");
    return wb;
  }

  function crc32(u8) {
    let c = ~0;
    for (let i = 0; i < u8.length; i++) {
      c ^= u8[i];
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
    return (~c) >>> 0;
  }

  function inflateRaw(u8) {
    return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function deflateRaw(u8) {
    return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  function readU32(v, o) { return v[o] | (v[o+1] << 8) | (v[o+2] << 16) | (v[o+3] << 24); }
  function readU16(v, o) { return v[o] | (v[o+1] << 8); }
  function writeU32(v, o, n) { v[o] = n & 255; v[o+1] = (n >>> 8) & 255; v[o+2] = (n >>> 16) & 255; v[o+3] = (n >>> 24) & 255; }

  async function freezeXlsxHeaders(buf) {
    if (typeof DecompressionStream === "undefined" || typeof CompressionStream === "undefined") return buf;
    const src = new Uint8Array(buf);
    const files = [];
    let offset = 0;
    while (offset + 4 <= src.length && readU32(src, offset) === 0x04034b50) {
      const method = readU16(src, offset + 8);
      const crc = readU32(src, offset + 14) >>> 0;
      const compSize = readU32(src, offset + 18) >>> 0;
      const uncompSize = readU32(src, offset + 22) >>> 0;
      const nameLen = readU16(src, offset + 26);
      const extraLen = readU16(src, offset + 28);
      const name = new TextDecoder().decode(src.subarray(offset + 30, offset + 30 + nameLen));
      const headerEnd = offset + 30 + nameLen + extraLen;
      const data = src.subarray(headerEnd, headerEnd + compSize);
      const header = src.subarray(offset, headerEnd);
      files.push({ name: name, method: method, crc: crc, compSize: compSize, uncompSize: uncompSize, header: header, data: data });
      offset = headerEnd + compSize;
    }
    const cdStart = offset;
    const needle = '<sheetView workbookViewId="0"/>';
    const repl = '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>';
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(f.name)) continue;
      let raw;
      if (f.method === 8) raw = await inflateRaw(f.data);
      else if (f.method === 0) raw = f.data.slice();
      else continue;
      const text = new TextDecoder().decode(raw);
      if (text.indexOf(needle) < 0) continue;
      const next = new TextEncoder().encode(text.replace(needle, repl));
      const comp = await deflateRaw(next);
      const header = new Uint8Array(f.header);
      writeU32(header, 14, crc32(next));
      writeU32(header, 18, comp.length);
      writeU32(header, 22, next.length);
      header[8] = 8; header[9] = 0; // deflate
      f.header = header;
      f.data = comp;
      f.compSize = comp.length;
      f.uncompSize = next.length;
      f.crc = crc32(next);
      f.method = 8;
    }
    // rebuild zip: local files + original CD rewritten + EOCD
    const locals = [];
    let pos = 0;
    files.forEach(function (f) {
      f.localOffset = pos;
      locals.push(f.header, f.data);
      pos += f.header.length + f.data.length;
    });
    // parse original central directory entries in order
    const cdEntries = [];
    let cdo = cdStart;
    while (cdo + 4 <= src.length && readU32(src, cdo) === 0x02014b50) {
      const nameLen = readU16(src, cdo + 28);
      const extraLen = readU16(src, cdo + 30);
      const commentLen = readU16(src, cdo + 32);
      const entLen = 46 + nameLen + extraLen + commentLen;
      cdEntries.push(src.subarray(cdo, cdo + entLen));
      cdo += entLen;
    }
    const eocdStart = cdo;
    const newCD = [];
    for (let i = 0; i < cdEntries.length && i < files.length; i++) {
      const ent = new Uint8Array(cdEntries[i]);
      const f = files[i];
      writeU32(ent, 16, f.crc);
      writeU32(ent, 20, f.compSize);
      writeU32(ent, 24, f.uncompSize);
      writeU32(ent, 42, f.localOffset);
      ent[10] = f.method & 255; ent[11] = 0;
      newCD.push(ent);
    }
    const cdBuf = new Uint8Array(newCD.reduce(function (s, a) { return s + a.length; }, 0));
    let cpos = 0;
    newCD.forEach(function (a) { cdBuf.set(a, cpos); cpos += a.length; });
    const eocd = new Uint8Array(src.subarray(eocdStart));
    writeU32(eocd, 12, cdBuf.length); // this is size of CD? wait EOCD: 8=this disk entries, 10=total entries, 12=cd size, 16=cd offset
    writeU32(eocd, 16, pos);
    const out = new Uint8Array(pos + cdBuf.length + eocd.length);
    let o = 0;
    locals.forEach(function (part) { out.set(part, o); o += part.length; });
    out.set(cdBuf, o); o += cdBuf.length;
    out.set(eocd, o);
    return out;
  }

  function downloadExcel() {
    if (typeof XLSX === "undefined") { toast("Excel library failed to load"); return; }
    const wb = buildWorkbook();
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array", cellDates: true });
    function finish(bytes) {
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      downloadBlob(blob, "money-tracker-" + todayISO() + ".xlsx");
      state.lastBackup = new Date().toISOString();
      save();
      renderPills();
      renderBanners();
      toast("Excel file downloaded");
    }
    Promise.resolve(freezeXlsxHeaders(out)).then(finish).catch(function () { finish(out); });
  }

  function downloadBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    downloadBlob(blob, "money-tracker-backup-" + todayISO() + ".json");
    state.lastBackup = new Date().toISOString();
    save();
    renderPills();
    renderBanners();
    toast("JSON backup downloaded");
  }

  function restoreFromJson(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.entries)) throw new Error("Not a valid backup file");
    const base = emptyState();
    state = Object.assign(base, data, {
      entries: data.entries,
      review: Array.isArray(data.review) ? data.review : [],
      budgets: data.budgets || {},
      categories: Array.isArray(data.categories) && data.categories.length ? data.categories : base.categories,
      methods: Array.isArray(data.methods) && data.methods.length ? data.methods : base.methods,
      merchantRules: data.merchantRules || {},
      theme: data.theme || state.theme || "system"
    });
    save();
    renderAll();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", inQ = false;
    const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQ) {
        if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
        else cell += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
  }

  function importCsv(text) {
    const rows = parseCsv(text);
    if (!rows.length) throw new Error("Empty CSV");
    const header = rows[0].map((h) => String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, ""));
    const idx = function (names) { for (let i = 0; i < names.length; i++) { const j = header.indexOf(names[i]); if (j >= 0) return j; } return -1; };
    const iDate = idx(["date", "txndate", "transactiondate", "valuedate"]);
    const iType = idx(["type", "drcr", "creditdebit"]);
    const iAmt = idx(["amount", "amountinr", "amt", "inramount"]);
    const iCat = idx(["category"]);
    const iMethod = idx(["method", "paymentmethod", "mode"]);
    const iNote = idx(["note", "narration", "description", "remarks", "particulars"]);
    const iMerch = idx(["merchant", "payee"]);
    if (iAmt < 0) throw new Error("CSV needs an Amount column");
    let added = 0;
    rows.slice(1).forEach(function (r) {
      const amount = parseAmount(r[iAmt]);
      if (amount == null) return;
      let type = "expense";
      if (iType >= 0) {
        const t = String(r[iType] || "").toLowerCase();
        if (t === "income" || t === "credit" || t === "cr") type = "income";
        else if (t === "saving" || t === "savings") type = "saving";
      }
      commitEntry({
        type: type, amount: amount,
        date: iDate >= 0 ? r[iDate] : todayISO(),
        category: iCat >= 0 && r[iCat] ? r[iCat] : "Other",
        method: iMethod >= 0 && r[iMethod] ? r[iMethod] : "Other",
        note: iNote >= 0 ? r[iNote] : "",
        merchant: iMerch >= 0 ? r[iMerch] : "",
        source: "csv"
      });
      added += 1;
    });
    renderAll();
    return added;
  }

  /* ---------- events ---------- */
  function bindEvents() {
    document.getElementById("prevMonth").addEventListener("click", function () { viewMonth = shiftMonth(viewMonth, -1); renderAll(); });
    document.getElementById("nextMonth").addEventListener("click", function () { viewMonth = shiftMonth(viewMonth, 1); renderAll(); });

    let hx = 0, hy = 0;
    const home = document.getElementById("page-home");
    home.addEventListener("touchstart", function (ev) { hx = ev.touches[0].clientX; hy = ev.touches[0].clientY; }, { passive: true });
    home.addEventListener("touchend", function (ev) {
      const x = ev.changedTouches[0].clientX - hx;
      const y = ev.changedTouches[0].clientY - hy;
      if (Math.abs(x) > 60 && Math.abs(x) > Math.abs(y) * 1.5) {
        viewMonth = shiftMonth(viewMonth, x < 0 ? 1 : -1);
        renderAll();
      }
    }, { passive: true });

    document.querySelectorAll(".tab-btn").forEach(function (b) {
      b.addEventListener("click", function () { showPage(b.dataset.nav); });
    });
    document.getElementById("fabAdd").addEventListener("click", function () { openSheet(null); });
    document.getElementById("backdrop").addEventListener("click", closeSheet);
    document.getElementById("cancelSheet").addEventListener("click", closeSheet);
    document.getElementById("confirmClose").addEventListener("click", function () { closeConfirm(true); });
    document.getElementById("reviewClose").addEventListener("click", function () {
      document.getElementById("reviewOverlay").classList.remove("show");
      document.body.classList.remove("confirm-open");
      renderAll();
    });

    document.querySelectorAll("#typeSeg button").forEach(function (b) {
      b.addEventListener("click", function () {
        formType = b.dataset.type;
        document.querySelectorAll("#typeSeg button").forEach(function (x) { x.classList.toggle("active", x === b); });
      });
    });
    document.getElementById("catChips").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-cat]"); if (!b) return;
      formCategory = b.getAttribute("data-cat"); renderFormChips();
    });
    document.getElementById("methodChips").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-method]"); if (!b) return;
      formMethod = b.getAttribute("data-method"); renderFormChips();
    });
    document.getElementById("quickAddCat").addEventListener("click", function () {
      const name = prompt("New category name"); if (!name || !name.trim()) return;
      ensureInList("categories", name.trim()); formCategory = name.trim(); save(); renderFormChips(); renderPills();
    });
    document.getElementById("quickAddMethod").addEventListener("click", function () {
      const name = prompt("New payment method"); if (!name || !name.trim()) return;
      ensureInList("methods", name.trim()); formMethod = name.trim(); save(); renderFormChips(); renderPills();
    });

    document.getElementById("entryForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      const id = document.getElementById("entryId").value;
      const existing = id ? state.entries.find((e) => e.id === id) : null;
      const entry = commitEntry({
        id: id || undefined,
        createdAt: existing ? existing.createdAt : undefined,
        type: formType,
        amount: document.getElementById("amount").value,
        category: formCategory,
        method: formMethod,
        date: document.getElementById("date").value,
        note: document.getElementById("note").value,
        merchant: document.getElementById("merchant").value,
        source: existing ? existing.source : "manual"
      });
      if (!entry) { toast("Enter a valid amount greater than 0"); return; }
      viewMonth = entry.date.slice(0, 7);
      closeSheet();
      renderAll();
      toast("Saved " + formatINR(entry.amount) + " \u00b7 " + entry.category);
    });

    document.getElementById("deleteEntry").addEventListener("click", function () {
      const id = document.getElementById("entryId").value;
      if (!id) return;
      state.entries = state.entries.filter((e) => e.id !== id);
      save(); closeSheet(); renderAll(); toast("Entry deleted");
    });

    document.getElementById("typeFilters").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-filter]"); if (!b) return;
      listFilter = b.dataset.filter;
      document.querySelectorAll("#typeFilters .chip").forEach(function (c) { c.classList.toggle("active", c === b); });
      renderActivity();
    });
    document.getElementById("search").addEventListener("input", function (ev) {
      listQuery = ev.target.value; renderActivity();
    });

    document.getElementById("budgetList").addEventListener("click", function (ev) {
      const btn = ev.target.closest("[data-edit-budget]"); if (!btn) return;
      const cat = btn.getAttribute("data-edit-budget");
      const current = state.budgets[cat] || "";
      const val = prompt("Monthly budget for " + cat + " (leave empty to clear)", current);
      if (val == null) return;
      const n = parseAmount(val);
      if (n == null) delete state.budgets[cat];
      else state.budgets[cat] = n;
      save(); renderBudgets(); renderBanners();
    });

    document.getElementById("themeSeg").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-theme-val]"); if (!b) return;
      state.theme = b.dataset.themeVal;
      save(); applyTheme(); renderCharts(); renderRing(totals(entriesInMonth(viewMonth)).rate);
    });

    document.getElementById("btnExcel").addEventListener("click", downloadExcel);
    document.getElementById("btnBackup").addEventListener("click", downloadBackup);
    document.getElementById("btnRestore").addEventListener("click", function () { document.getElementById("fileRestore").click(); });
    document.getElementById("btnCsv").addEventListener("click", function () { document.getElementById("fileCsv").click(); });
    document.getElementById("fileRestore").addEventListener("change", function (ev) {
      const file = ev.target.files[0]; ev.target.value = ""; if (!file) return;
      if (!confirm("Restore will replace all current entries. Continue?")) return;
      const reader = new FileReader();
      reader.onload = function () {
        try { restoreFromJson(String(reader.result)); toast("Backup restored"); }
        catch (err) { toast("Could not restore: " + err.message); }
      };
      reader.readAsText(file);
    });
    document.getElementById("fileCsv").addEventListener("change", function (ev) {
      const file = ev.target.files[0]; ev.target.value = ""; if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const n = importCsv(String(reader.result));
          toast(n + " entr" + (n === 1 ? "y" : "ies") + " imported");
        } catch (err) { toast("Could not import: " + err.message); }
      };
      reader.readAsText(file);
    });

    document.getElementById("addCat").addEventListener("click", function () {
      const inp = document.getElementById("newCat"); const name = inp.value.trim(); if (!name) return;
      ensureInList("categories", name); inp.value = ""; save(); renderPills(); renderBudgets();
    });
    document.getElementById("addMethod").addEventListener("click", function () {
      const inp = document.getElementById("newMethod"); const name = inp.value.trim(); if (!name) return;
      ensureInList("methods", name); inp.value = ""; save(); renderPills();
    });
    document.getElementById("addRule").addEventListener("click", function () {
      const mer = normalizeMerchant(document.getElementById("ruleMerchant").value);
      const cat = document.getElementById("ruleCategory").value.trim();
      if (!mer || !cat) { toast("Add a merchant and a category"); return; }
      ensureInList("categories", cat);
      state.merchantRules[mer] = cat;
      document.getElementById("ruleMerchant").value = "";
      document.getElementById("ruleCategory").value = "";
      save(); renderPills();
    });
    document.getElementById("catPills").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-rm-cat]"); if (!b) return;
      if (state.categories.length <= 1) { toast("Keep at least one category"); return; }
      state.categories = state.categories.filter((c) => c !== b.getAttribute("data-rm-cat"));
      save(); renderPills(); renderBudgets();
    });
    document.getElementById("methodPills").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-rm-method]"); if (!b) return;
      if (state.methods.length <= 1) { toast("Keep at least one method"); return; }
      state.methods = state.methods.filter((c) => c !== b.getAttribute("data-rm-method"));
      save(); renderPills();
    });
    document.getElementById("rulePills").addEventListener("click", function (ev) {
      const b = ev.target.closest("[data-rm-rule]"); if (!b) return;
      delete state.merchantRules[b.getAttribute("data-rm-rule")];
      save(); renderPills();
    });
    document.getElementById("btnClear").addEventListener("click", function () {
      if (!confirm("Delete all entries, budgets and rules on this device?")) return;
      const theme = state.theme;
      state = emptyState();
      state.theme = theme;
      save(); renderAll(); toast("All data cleared");
    });

    window.addEventListener("hashchange", handleDeepLink);
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      if ((state.theme || "system") === "system") { applyTheme(); renderCharts(); }
    });
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  function init() {
    state = load();
    purgeReview();
    applyTheme();
    bindEvents();
    handleDeepLink();
    renderAll();
    registerSW();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.__moneyTracker = {
    getState: function () { return state; },
    renderAll: renderAll,
    formatINR: formatINR,
    parseDeepLink: parseDeepLink,
    findDuplicate: findDuplicate,
    load: function () { state = load(); renderAll(); }
  };
})();

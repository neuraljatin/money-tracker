/* Money Tracker — reading bank SMS text. Pure functions, no storage, no network.
   Loaded before app.js in the browser (window.MTParse) and by tests/parse.test.js in Node. */
(function (root) {
  "use strict";

  const NUM = "([0-9][0-9,]*(?:\\.\\d{1,2})?)";
  const CUR = "(?:rs\\.?|inr|\\u20B9)";
  /* words that mean money actually moved */
  const TXN_WORDS = /\b(debited|credited|spent|paid|sent|charged|withdrawn|received|deposited|purchase|transferred|refund(?:ed)?|reversed)\b/i;
  /* words placed right before a balance / limit figure */
  const BALANCE_BEFORE = /(?:\bavl\.?|\bavbl\.?|\bavailable|\bbal\.?|\bbalance|\blimit|\blmt\.?|\bclosing|\bopening)[^0-9a-z]{0,6}(?:bal(?:ance)?\.?|limit|lmt\.?)?[^0-9a-z]{0,6}(?:is|of|:)?\s*(?:rs\.?|inr|\u20B9)?\s*$/i;
  /* words placed right before or after the real spend */
  const SPEND_NEAR = /\b(debited|credited|spent|paid|sent|charged|withdrawn|received|deposited|purchase|transferred|refund(?:ed)?|txn|transaction|payment|amt|amount)\b/i;

  function parseAmount(str) {
    if (typeof str === "number") return isFinite(str) && str > 0 ? Math.round(str * 100) / 100 : null;
    const cleaned = String(str || "").replace(/[\u20B9,\s]/g, "").replace(/rs\.?|inr/ig, "");
    const n = parseFloat(cleaned);
    if (!isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  /* Every money figure in the text, with whether it is a balance and whether a spend word sits next to it. */
  function amountCandidates(text) {
    const s = String(text || "");
    const out = [];
    const seen = {};
    const res = [
      new RegExp(CUR + "\\s*" + NUM, "ig"),
      new RegExp(NUM + "\\s*" + CUR + "(?![a-z])", "ig"),
      /(?:debited|credited|spent|paid|received|deposited|sent|charged|withdrawn)\s+(?:by|with|for|of)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)(?![0-9a-z])/ig
    ];
    res.forEach(function (re) {
      let m;
      while ((m = re.exec(s))) {
        const amount = parseAmount(m[1]);
        if (amount == null) continue;
        const start = m.index;
        if (seen[start] || Object.keys(seen).some(function (k) { return Math.abs(Number(k) - start) <= 4 && seen[k] === amount; })) continue;
        seen[start] = amount;
        const before = s.slice(Math.max(0, start - 30), start);
        const after = s.slice(start + m[0].length, start + m[0].length + 25);
        out.push({
          amount: amount,
          index: start,
          isBalance: BALANCE_BEFORE.test(before),
          nearSpend: SPEND_NEAR.test(before.slice(-22)) || SPEND_NEAR.test(after)
        });
      }
    });
    out.sort(function (a, b) { return a.index - b.index; });
    return out;
  }

  /* The spend amount: prefer a figure next to debited/spent/paid…, never a balance. */
  function parseAmountFromText(text) {
    const c = amountCandidates(text).filter(function (x) { return !x.isBalance; });
    if (!c.length) return null;
    const near = c.find(function (x) { return x.nearSpend; });
    return (near || c[0]).amount;
  }

  /* True when the amount is one the text calls a balance (e.g. a Shortcut that grabbed the first number). */
  function isBalanceAmount(text, amount) {
    if (amount == null) return false;
    const c = amountCandidates(text);
    return c.some(function (x) { return x.isBalance && Math.abs(x.amount - amount) < 0.005; }) &&
      !c.some(function (x) { return !x.isBalance && Math.abs(x.amount - amount) < 0.005; });
  }

  /* Is this SMS a real spend/income? Returns { log: true } or { log: false, reason, message }. */
  function classifySms(raw) {
    const s = String(raw || "").replace(/\s+/g, " ").trim();
    if (!s) return { log: true };
    const no = function (reason, message) { return { log: false, reason: reason, message: message }; };
    if (/\b(otp|one[\s-]?time[\s-]?(?:password|passcode|pin)|verification code|secure code)\b/i.test(s)) {
      return no("otp", "OTP message, not a spend. Nothing logged.");
    }
    if (/\b(failed|declined|unsuccessful|not successful|could not be (?:processed|completed)|was rejected|has been rejected)\b/i.test(s)) {
      return no("failed", "Failed payment, no money left your account. Nothing logged.");
    }
    if (/\bself[\s-]?transfer\b|\bto self\b|\b(?:to|from|into|between) your own\b|\bown (?:a\/c|ac|acct|account)s?\b|\bbetween your accounts\b/i.test(s)) {
      return no("self", "Transfer between your own accounts. Nothing logged.");
    }
    const moved = TXN_WORDS.test(s);
    if (!moved && /\b(cashback|offer|offers|shop now|apply now|win|winner|pre-?approved|limited period|voucher|coupon|click here|hurry|reward points?|upgrade now|eligible)\b/i.test(s)) {
      return no("promo", "Offer or promo message, not a spend. Nothing logged.");
    }
    if (!moved && /\b(avl\.?|avbl\.?|available|bal\.?|balance)\b/i.test(s)) {
      return no("balance", "Balance alert, not a spend. Nothing logged.");
    }
    return { log: true };
  }

  function guessTypeFromRaw(raw, fallback) {
    const s = String(raw || "");
    if (/credited|has been credited|received|refund|deposited/i.test(s) && !/debited/i.test(s)) return "income";
    if (fallback) return fallback;
    return "expense";
  }

  /* Cut a merchant name at words that are not part of it ("via UPI", "today", "Do not share", ref numbers …). */
  function cleanMerchant(s) {
    let m = String(s || "").replace(/\s+/g, " ").trim();
    m = m.replace(/\.(?=\s|$).*$/, "");                       /* "AMAZON. Do not share" → "AMAZON" */
    m = m.replace(/\s*[(\[|].*$/, "");                         /* "(self transfer)", "[ref]" */
    m = m.replace(/\s+(?:on|via|using|thru|through|today|yesterday|avbl|avl|available|info|ref|refno|ref\s*no|upi\s*ref|rrn|txn|transaction|for|is|has|was|credited|debited|not\s+you|do\s+not|call|sms|bal|balance|from\s+(?:a\/c|ac|acct|account|card)|towards|dated?)\b.*$/i, "");
    m = m.replace(/\s+(?:no\.?\s*)?[0-9]{6,}.*$/i, "");       /* trailing reference numbers */
    m = m.replace(/[\s.,;:!?\-_/&]+$/, "").replace(/^[\s.,;:\-_/&]+/, "");
    return m.trim();
  }

  /* Matches that are the user's own account/card, not a merchant */
  const NOT_MERCHANT = /^(?:(?:your|ur|a\/c|ac|acct|account|card|self|own|bank)\b|x{2,}|x+\d|\d|the\s+(?:a\/c|account|card)\b)/i;

  function guessMerchantFromRaw(raw) {
    const s = String(raw || "");
    const patterns = [
      /\bat\s+([A-Za-z0-9][A-Za-z0-9 &.'_\/-]{1,40})/ig,
      /\bto\s+([A-Za-z0-9][A-Za-z0-9 &.'_\/-]{1,40})/ig,
      /\btowards\s+([A-Za-z0-9][A-Za-z0-9 &.'_\/-]{1,40})/ig,
      /\bfrom\s+([A-Za-z0-9][A-Za-z0-9 &.'_\/-]{1,40})/ig,
      /\bUPI[-\s]([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/ig,
      /\binfo[:\s]+([A-Za-z0-9][A-Za-z0-9 &._-]{1,40})/ig
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(s))) {
        const candidate = m[1];
        if (NOT_MERCHANT.test(candidate)) continue;
        const clean = cleanMerchant(candidate);
        if (clean && clean.length >= 2 && !NOT_MERCHANT.test(clean) && !/^(?:upi|neft|imps|rtgs|pos)$/i.test(clean)) return clean;
      }
    }
    return "";
  }

  const api = {
    parseAmount: parseAmount,
    amountCandidates: amountCandidates,
    parseAmountFromText: parseAmountFromText,
    isBalanceAmount: isBalanceAmount,
    classifySms: classifySms,
    guessTypeFromRaw: guessTypeFromRaw,
    cleanMerchant: cleanMerchant,
    guessMerchantFromRaw: guessMerchantFromRaw
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MTParse = api;
})(typeof window !== "undefined" ? window : this);

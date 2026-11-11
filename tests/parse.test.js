/* Run: node tests/parse.test.js  — checks how bank SMS are read (Round 2 bugs + earlier cases). */
"use strict";
const assert = require("assert");
const P = require("../sms-parse.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok   " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const read = (sms) => ({
  cls: P.classifySms(sms),
  amount: P.parseAmountFromText(sms),
  merchant: P.guessMerchantFromRaw(sms),
  type: P.guessTypeFromRaw(sms, "expense")
});

console.log("Spends that must still be read");
t("T01 Rs.450.00 debited at SWIGGY", () => { const r = read("Rs.450.00 debited from A/c XX1234 at SWIGGY on 11-11-26"); assert.ok(r.cls.log); assert.strictEqual(r.amount, 450); assert.strictEqual(r.merchant, "SWIGGY"); assert.strictEqual(r.type, "expense"); });
t("T02 Rs 450 debited at SWIGGY", () => { const r = read("Rs 450 debited from A/c XX1234 at SWIGGY"); assert.strictEqual(r.amount, 450); assert.strictEqual(r.merchant, "SWIGGY"); });
t("T03 INR 1,23,456.50 spent at CROMA", () => { const r = read("INR 1,23,456.50 spent on Axis Privilege card at CROMA"); assert.strictEqual(r.amount, 123456.5); assert.strictEqual(r.merchant, "CROMA"); });
t("T05a spend first, balance after", () => { const r = read("Rs 450.00 debited from A/c XX1234 at SWIGGY. Avl Bal Rs 12,340.00"); assert.ok(r.cls.log); assert.strictEqual(r.amount, 450); assert.strictEqual(r.merchant, "SWIGGY"); });
t("T06 no amount -> still opens, amount empty", () => { const r = read("Your card was used at SWIGGY today"); assert.ok(r.cls.log); assert.strictEqual(r.amount, null); assert.strictEqual(r.merchant, "SWIGGY"); });
t("Setup 'Test it' sample SMS", () => { const r = read("Rs.249.00 debited from A/c XX1234 on 11 Nov via UPI to SWIGGY. Not you? Call your bank."); assert.ok(r.cls.log); assert.strictEqual(r.amount, 249); assert.strictEqual(r.merchant, "SWIGGY"); });
t("T11 salary credited -> income", () => { const r = read("Rs 25,000.00 credited to A/c XX1234 by NEFT from ACME PVT LTD"); assert.ok(r.cls.log); assert.strictEqual(r.amount, 25000); assert.strictEqual(r.type, "income"); assert.strictEqual(r.merchant, "ACME PVT LTD"); });
t("Credit card spend with Avl Lmt after", () => { const r = read("INR 1,299.00 spent on OneCard XX55 at MYNTRA on 11-11. Avl Lmt INR 48,701.00"); assert.strictEqual(r.amount, 1299); assert.strictEqual(r.merchant, "MYNTRA"); });

console.log("BUG-02 non-spend SMS are ignored");
t("T07 OTP", () => { const r = read("123456 is your OTP for a transaction of Rs 2,000.00 at AMAZON. Do not share."); assert.strictEqual(r.cls.log, false); assert.strictEqual(r.cls.reason, "otp"); });
t("OTP worded 'One Time Password'", () => { assert.strictEqual(P.classifySms("Your One Time Password for Rs 999 at FLIPKART is 445566").reason, "otp"); });
t("T08 failed / declined", () => { const r = read("Transaction of Rs 1,500.00 at FLIPKART failed / declined due to insufficient funds"); assert.strictEqual(r.cls.log, false); assert.strictEqual(r.cls.reason, "failed"); });
t("unsuccessful payment", () => { assert.strictEqual(P.classifySms("Your UPI payment of Rs 300 to SWIGGY was unsuccessful").reason, "failed"); });
t("T09 balance-only alert", () => { const r = read("Avl Bal in A/c XX1234 is Rs 12,340.00 as on 11-11-26"); assert.strictEqual(r.cls.log, false); assert.strictEqual(r.cls.reason, "balance"); });
t("T10 cashback promo", () => { const r = read("Get 10% cashback up to Rs 500 on Axis cards. Shop now!"); assert.strictEqual(r.cls.log, false); assert.strictEqual(r.cls.reason, "promo"); });
t("real cashback credit is NOT ignored", () => { const r = read("Cashback of Rs 50.00 credited to your Axis card"); assert.ok(r.cls.log); assert.strictEqual(r.amount, 50); assert.strictEqual(r.type, "income"); });

console.log("BUG-03 balance before spend");
t("T05b Avl Bal first -> 450, not 12,340", () => { const r = read("A/c XX1234 Avl Bal Rs 12,340.00 after Rs 450.00 debited at SWIGGY"); assert.ok(r.cls.log); assert.strictEqual(r.amount, 450); assert.strictEqual(r.merchant, "SWIGGY"); });
t("Available balance is Rs … first", () => { assert.strictEqual(P.parseAmountFromText("Available balance is Rs 9,000.00. Rs 120 paid to RAPIDO"), 120); });
t("Bal: INR first", () => { assert.strictEqual(P.parseAmountFromText("Bal: INR 8,000.50 | INR 75.00 debited for UBER"), 75); });
t("Shortcut passed the balance as amount -> flagged", () => { assert.ok(P.isBalanceAmount("A/c XX1234 Avl Bal Rs 12,340.00 after Rs 450.00 debited at SWIGGY", 12340)); assert.ok(!P.isBalanceAmount("A/c XX1234 Avl Bal Rs 12,340.00 after Rs 450.00 debited at SWIGGY", 450)); });

console.log("BUG-04 self transfer");
t("T13 own A/c (self transfer)", () => { const r = read("Rs 5,000.00 transferred from A/c XX1234 to your own A/c XX9876 (self transfer)"); assert.strictEqual(r.cls.log, false); assert.strictEqual(r.cls.reason, "self"); });
t("UPI to self", () => { assert.strictEqual(P.classifySms("Rs 2,000 debited from A/c XX1234 via UPI to self").reason, "self"); });
t("credit side of own transfer", () => { assert.strictEqual(P.classifySms("Rs 5,000 credited to A/c XX9876 from your own A/c XX1234").reason, "self"); });

console.log("BUG-05 merchant names");
t("T04 'ZOMATO via UPI' -> ZOMATO", () => { const r = read("\u20b999 paid to ZOMATO via UPI"); assert.strictEqual(r.amount, 99); assert.strictEqual(r.merchant, "ZOMATO"); });
t("'AMAZON. Do not share' -> AMAZON", () => { assert.strictEqual(P.cleanMerchant("AMAZON. Do not share"), "AMAZON"); });
t("'SWIGGY today' -> SWIGGY", () => { assert.strictEqual(P.cleanMerchant("SWIGGY today"), "SWIGGY"); });
t("T12 refund merchant skips 'your Axis card'", () => { const r = read("Refund of Rs 349.00 from SWIGGY credited to your Axis card"); assert.strictEqual(r.merchant, "SWIGGY"); assert.strictEqual(r.type, "income"); assert.strictEqual(r.amount, 349); });
t("ref number tail removed", () => { assert.strictEqual(P.cleanMerchant("BLINKIT Ref No 431298765012"), "BLINKIT"); assert.strictEqual(P.cleanMerchant("BLINKIT 431298765012"), "BLINKIT"); });
t("punctuation tail removed", () => { assert.strictEqual(P.cleanMerchant("DMART -"), "DMART"); assert.strictEqual(P.cleanMerchant("PVR!"), "PVR"); });
t("domain names kept", () => { assert.strictEqual(P.cleanMerchant("AMAZON.IN"), "AMAZON.IN"); });
t("UPI on date", () => { assert.strictEqual(P.guessMerchantFromRaw("Rs 60 sent to CHAI POINT on 11-11-26 UPI Ref 123456789012"), "CHAI POINT"); });

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

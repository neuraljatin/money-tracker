# Log a spend from your iPhone

**App address:** https://neuraljatin.github.io/money-tracker/

Amounts, merchants and the original message go after a `#` in the link, so they stay on your phone and are never sent to a server.

The app asks you to confirm before it saves. Skip keeps the item in **Needs review** for 7 days. A “credited” message is treated as income.

## 1. Add the app to your Home Screen (do this first)

iPhone can wipe a normal Safari site’s saved data after about 7 days if you don’t visit it. A Home Screen app is mostly kept.

1. Open the app address in **Safari** (not Chrome).
2. Tap the Share button (the square with an arrow).
3. Tap **Add to Home Screen**, then Add.
4. Open Money Tracker from the new icon so it runs like an app.

Use **Settings → Download JSON backup** now and then so you have a copy.

## 2. Automatic: ask me when I spend

This is the main setup. Your iPhone watches bank SMS and Apple Wallet, asks “Log this?”, and only then opens the app.

You will make four automations: three for Messages (**debited**, **spent**, **credited**) and one for Wallet. They are almost the same.

### (a) Bank SMS — start with “debited”

1. Open the **Shortcuts** app and tap **Automation**.
2. Tap **+**, then **Create Personal Automation**.
3. Choose **Message**.
4. Set **Message Contains** to `debited`. Leave the sender as **Any**.
5. Tap Next. Choose **Run Immediately**. Turn **Notify When Run** on (so you see it). Turn **Ask Before Running** off — you will get a Yes/No menu instead. Tap Next, then add these actions, in this order.

**Read the message**

- Add **Get Text from Input**. Set the input to **Shortcut Input**. This is the full SMS. You’ll also need it later as `raw`.

**Pick out the amount**

- Add **Match Text**.
- Text: the message text from the step above.
- Pattern (paste this):

```
(?:Rs\.?|INR|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)
```

- Add **Get Group from Matched Text** (or **Get Group at Index**). Set the group to **1**. That is the amount.

**Pick out the merchant**

- Add another **Match Text**, again on the same message text.
- Pattern (paste this):

```
(?:at|to|towards|on)\s+([A-Za-z0-9 &.*'-]{2,40}?)(?:\s+on|\s+via|\.|,|$)
```

- Add **Get Group from Matched Text**, group **1**. That is the merchant.

**Ask first**

- Add **Choose from Menu**.
- Prompt (insert the amount and merchant Magic Variables):

```
Log ₹[amount] at [merchant]?
```

- Menu items: **Yes** and **No**.

**If you tap Yes**

Under **Yes**:

1. Add a **URL Encode** action for the amount, one for the merchant, and one for the full message text (`raw`).
2. Add **URL** (or a **Text** action, then **URL**) with this, on one line — insert the encoded values:

```
https://neuraljatin.github.io/money-tracker/#confirm&amount=AMOUNT&merchant=MERCHANT&raw=RAW
```

3. Add **Open URLs**.

The app opens the confirm screen with the amount, merchant and a guessed category. Tap **Save** or **Skip**.

**If you tap No**

Under **No**, add **Stop This Shortcut** (or **Stop**). Nothing is saved.

Tap **Done** to save the automation.

**Repeat for “spent” and “credited”**

Duplicate the **debited** automation twice (open it, use the share/menu button if you see **Duplicate**, or create two new automations with the same actions).

- In the first copy, change **Message Contains** to `spent`. Keep the Yes URL the same.
- In the second copy, change **Message Contains** to `credited`, and in the Yes URL add `&type=income` at the end:

```
https://neuraljatin.github.io/money-tracker/#confirm&amount=AMOUNT&merchant=MERCHANT&raw=RAW&type=income
```

### (b) Apple Wallet (Axis cards)

1. In **Shortcuts**, go to **Automation** and tap **+**.
2. Choose **Transaction** (under Wallet).
3. Select your **Axis** cards (Privilege, Neo, or any Axis card you use).
4. Choose **Run Immediately**. Turn **Notify When Run** on, and **Ask Before Running** off. Tap Next.

**Actions**

- You do not need regex here. Use **Shortcut Input** — it already has the **amount** and the **merchant**.
- Add **Choose from Menu**.
- Prompt: `Log ₹[amount] at [merchant]?` (insert those Magic Variables from Shortcut Input).
- Items: **Yes** and **No**.

Under **Yes**:

1. **URL Encode** the amount and the merchant.
2. **URL** / **Open URLs** with this, on one line (this marks the payment method as Axis):

```
https://neuraljatin.github.io/money-tracker/#confirm&amount=AMOUNT&merchant=MERCHANT&method=Axis
```

Under **No**, add **Stop This Shortcut**.

Tap **Done**.

If both a bank SMS and Apple Pay fire for the same spend, the app will flag a **Possible duplicate** so you can decide whether to save it twice.

## 3. Backup: a manual “Log Spend” shortcut

Use this when a payment is not in SMS or Wallet, or you want to type it yourself.

1. Open **Shortcuts** and tap **+**. Name it **Log Spend**.
2. Add **Ask for Input** — Question: `How much?` — Input Type: **Number**.
3. Add **Choose from Menu** — Prompt: `Category` — items: Food, Shopping, Travel, Bills, Fuel, Entertainment, Health, EMI, Rent, Investment, Other.
4. Add another **Choose from Menu** — Prompt: `Paid with` — items: Axis Privilege, Axis Neo, OneCard, UPI, Cash, Debit card, Other.
5. Add **Ask for Input** — Question: `Note (optional)` — Input Type: **Text**. Allow an empty answer if your iPhone offers that.
6. **URL Encode** the amount, category, method and note.
7. **URL** / **Open URLs** with this, on one line:

```
https://neuraljatin.github.io/money-tracker/#add&type=expense&amount=AMOUNT&category=CATEGORY&method=METHOD&note=NOTE
```

This saves the entry straight away and shows a confirmation.

If you would rather confirm in the app first, use `#confirm` instead of `#add`, and include `merchant` if you have it:

```
https://neuraljatin.github.io/money-tracker/#confirm&amount=AMOUNT&merchant=MERCHANT&method=METHOD&raw=RAW
```

### Put “Log Spend” one tap away

In the Shortcut editor, tap the info or share button and turn on any of these:

- **Add to Home Screen** — a one-tap icon.
- **Add to Siri** — say “Hey Siri, Log Spend”.
- **Back Tap**: go to **Settings → Accessibility → Touch → Back Tap → Double Tap** (or Triple Tap) and choose **Log Spend**.

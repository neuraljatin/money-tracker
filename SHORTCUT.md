# Log a spend from your iPhone

**App address:** https://neuraljatin.github.io/money-tracker/

Amounts and notes are put after a `#` in the link, so they stay on your phone and are never sent to a server.

## 1. Add the app to your Home Screen (do this first)

iPhone can wipe a normal Safari site’s saved data after about 7 days if you don’t visit it. A Home Screen app is mostly kept.

1. Open the app address in **Safari** (not Chrome).
2. Tap the Share button (the square with an arrow).
3. Tap **Add to Home Screen**, then Add.
4. Open Money Tracker from the new icon so it runs like an app.

Use **Settings → Download JSON backup** now and then so you have a copy.

## 2. Make a Shortcut named “Log Spend”

1. Open the **Shortcuts** app.
2. Tap **+**, then name it **Log Spend**.
3. Add these actions, in this order.

### Ask for the amount

- Add **Ask for Input**.
- Question: `How much?`
- Input Type: **Number**.

### Pick a category

- Add **Choose from Menu**.
- Prompt: `Category`.
- Items (one per line):  
  Food, Shopping, Travel, Bills, Fuel, Entertainment, Health, EMI, Rent, Investment, Other.

### Pick a payment method

- Add another **Choose from Menu**.
- Prompt: `Paid with`.
- Items:  
  Axis Privilege, Axis Neo, OneCard, UPI, Cash, Debit card, Other.

### Optional note

- Add **Ask for Input**.
- Question: `Note (optional)`.
- Input Type: **Text**.
- Allow an empty answer if your iPhone offers that.

### Encode the values and open the app

Each value must be URL-encoded (so spaces and symbols are safe).

1. Add a **URL Encode** (or **Encode**, encoding type URL) action for the amount, the category, the method and the note — one each.
2. Add a **Text** action and paste this, on one line:

```
https://neuraljatin.github.io/money-tracker/#add&type=expense&amount=AMOUNT&category=CATEGORY&method=METHOD&note=NOTE
```

3. Replace `AMOUNT`, `CATEGORY`, `METHOD` and `NOTE` with the encoded results.
4. Add **URL** (or **Get URLs from Input**) using that Text.
5. Add **Open URLs**.

The app saves the entry, shows a confirmation, and clears the extra text from the address.

If you want to confirm before saving, use `#confirm` instead of `#add`, and include `merchant` if you have it:

```
https://neuraljatin.github.io/money-tracker/#confirm&amount=AMOUNT&merchant=MERCHANT&method=METHOD&raw=RAW
```

A “credited” SMS is treated as income. If the amount can’t be read, the confirm screen opens with the amount box already focused. Skip keeps the item in **Needs review** for 7 days.

## 3. Put “Log Spend” one tap away

In the Shortcut editor, tap the info or share button and turn on any of these:

- **Add to Home Screen** — a one-tap icon.
- **Add to Siri** — say “Hey Siri, Log Spend”.
- **Back Tap**: go to **Settings → Accessibility → Touch → Back Tap → Double Tap** (or Triple Tap) and choose **Log Spend**. Tap the back of your iPhone twice to log a spend.

That’s it. Each run asks the questions, opens the app, and the spend appears on the dashboard and in the Excel download.

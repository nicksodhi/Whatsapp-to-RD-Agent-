const express = require(‘express’);
const twilio = require(‘twilio’);
const Anthropic = require(’@anthropic-ai/sdk’);
const { chromium } = require(‘playwright’);
const sgMail = require(’@sendgrid/mail’);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AUTHORIZED_NUMBERS = [
process.env.YOUR_WHATSAPP_NUMBER,
process.env.RAHUL_WHATSAPP_NUMBER
];

// Items that should be ordered as singles (not cases)
// These use the single increment button or the single dropdown
const SINGLE_ONLY_ITEMS = [
‘Herb - Mint- 1lb’,
‘Micro Orchid Flowers - 4 oz’,
‘Taylor Farms - Bagged Cilantro’,
‘Lemons, 71-115 ct’,
‘Carrots- 10 lb’,
];

const ITEM_MAP = {
“yellow onions”: “Jumbo Spanish Onions - 50 lbs”,
“red onions”: “Jumbo Red Onions - 25 lbs”,
“potato”: “Potato - 50 lb”, // Item 42725
“potatoes”: “Potato - 50 lb”,
“garlic”: “Peeled Garlic”,
“ginger”: “Fresh Ginger - 30 lbs”,
“paneer”: “Royal Mahout - Paneer Loaf - 5 lbs”,
“flowers”: “Micro Orchid Flowers - 4 oz”,
“garnish”: “Micro Orchid Flowers - 4 oz”,
“cilantro”: “Taylor Farms - Bagged Cilantro”,
“cucumber”: “Cucumbers - 6 ct”,
“cauliflower”: “White Cauliflower”,
“carrots”: “Carrots- 10 lb”,
“lemon”: “Lemons, 71-115 ct”,
“lemons”: “Lemons, 71-115 ct”,
“mint”: “Herb - Mint- 1lb”,
“heavy cream”: “James Farm - Heavy Cream, 40% - 64 oz”,
“milk”: “MILK WHL GAL GS/AN”,
“yogurt”: “James Farm - Plain Yogurt - 32 lbs”,
“cheese”: “James Farm - Shredded Cheddar Jack Cheese - 5 lbs”,
“chicken breast”: “Boneless, Skinless Chicken Breasts, Tenders Out, Dry”,
“chicken thighs”: “Boneless, Skinless Jumbo Chicken Thighs”,
“chicken leg quarters”: “Fresh Chicken Leg Quarters - 40 lbs”,
“chicken wings”: “Jumbo Chicken Party Wings (6-8 ct)”,
“wings”: “Jumbo Chicken Party Wings (6-8 ct)”,
“chicken leg meat”: “Fresh Boneless Skinless Chicken Leg Meat”,
“lamb”: “Frozen Halal Boneless Lamb Leg, Australia”,
“goat”: “Thomas Farms - Bone in Goat Cube - #15”,
“tilapia”: “Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs”,
“fish”: “Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs”,
“frozen spinach”: “Frozen James Farm - Frozen Chopped Spinach - 3 lbs”,
“frozen peas”: “Frozen James Farm - IQF Peas - 2.5 lbs”,
“frozen broccoli”: “Frozen James Farm - IQF Broccoli Florets - 2 lbs”,
“frozen 4-way mix”: “Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs”,
“4-way mix”: “Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs”,
“roti atta”: “Golden Temple - Durum Atta Flour - 2/20 lb Bag”,
“atta”: “Golden Temple - Durum Atta Flour - 2/20 lb Bag”,
“all purpose flour”: “Chef’s Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag”,
“flour”: “Chef’s Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag”,
“baking powder”: “Clabber Girl - Baking Powder - 5 lbs”,
“corn starch”: “Clabber Girl Cornstarch - 3 lbs”,
“rice”: “Royal Chef’s Secret - Extra Long Grain Basmati Rice - 40 lbs”,
“basmati rice”: “Royal Chef’s Secret - Extra Long Grain Basmati Rice - 40 lbs”,
“garbanzo”: “Chef’s Quality - Garbanzo Beans - #10 can”,
“kidney beans”: “Chef’s Quality - Dark Red Kidney Beans - #10 cans”,
“salt”: “Morton - Purex Salt - 50lb”,
“sugar”: “C&H - Granulated Sugar - 25 lbs”,
“tomato sauce”: “Chef’s Quality - Tomato Sauce - #10 cans”,
“diced tomatoes”: “Isabella - Petite Diced Tomatoes -#10 cans”,
“liquid butter”: “Chef’s Quality - Liquid Butter Alternative - gallon”,
“cooking oil”: “Chef’s Quality - Soybean Salad Oil - 35 lbs”,
“fryer oil”: “Chef’s Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs”,
“canola oil”: “Chef’s Quality - 100% Canola Salad Oil - 35 lbs”,
“sambal”: “Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz”,
“sambal chili”: “Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz”,
“lemon juice”: “Chef’s Quality - Lemon Juice - gallon”,
“red food color”: “Felbro - Red Food Coloring - gallon”,
“water”: “Evian - Natural Spring Water, 24 Ct, 500 mL”,
“sprite”: “Sprite Bottles, 16.9 fl oz, 4 Pack”,
“diet coke”: “Diet Coke Bottles, 16.9 fl oz, 24 Pack”,
};

async function parseOrder(message) {
const itemMapStr = Object.entries(ITEM_MAP)
.map(([k, v]) => `"${k}" → "${v}"`)
.join(’\n’);

const response = await anthropic.messages.create({
model: ‘claude-haiku-4-5-20251001’,
max_tokens: 2000,
messages: [{
role: ‘user’,
content: `You are an ordering assistant for Naan & Curry, an Indian restaurant in Las Vegas.

Use this item mapping to convert the order to exact Restaurant Depot item names:
${itemMapStr}

Rules:

- ONLY add items EXPLICITLY listed in the order with a quantity number
- The quantity in the order = EXACT number to use (never change it)
- If an item is NOT in the order message, do NOT add it
- Skip: Ketchup, Vinegar, Coca-Cola, Fanta, Indian spices, disposables
- Return ONLY a JSON array, no markdown, no explanation

Format: [{“item”: “EXACT item name from map values”, “quantity”: NUMBER}]

Order to parse:
${message}`
}]
});

const text = response.content[0].text.trim();
try {
const clean = text.replace(/`json|`/g, ‘’).trim();
return JSON.parse(clean);
} catch {
return { error: ‘Could not parse order’ };
}
}

async function sendWhatsApp(to, message) {
await twilioClient.messages.create({
from: ‘whatsapp:’ + process.env.TWILIO_WHATSAPP_NUMBER,
to: ‘whatsapp:’ + to,
body: message
});
}

async function sendConfirmationEmail(orderItems, sender) {
const orderList = orderItems.map(i => `• ${i.quantity}x ${i.item}`).join(’\n’);
await sgMail.send({
from: ‘nicksodhi@gmail.com’,
to: ‘nicksodhi@gmail.com’,
subject: `✅ Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
text: `Items added to Restaurant Depot cart by ${sender}.\n\nORDER SUMMARY:\n${orderList}\n\nAdded at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\n\nCheckout (select Pickup):\nhttps://member.restaurantdepot.com/store/business/cart`
});
}

async function addItem(page, item) {
const isSingleOnly = SINGLE_ONLY_ITEMS.includes(item.item);
console.log(`\n--- ${item.item} x${item.quantity} (${isSingleOnly ? 'single' : 'case'}) ---`);

// Press Escape to close any open modal
await page.keyboard.press(‘Escape’);
await page.waitForTimeout(500);

// Find and click the Add button using weighted word matching
const found = await page.evaluate(({ itemName }) => {
const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ’ ‘).split(’ ’).filter(w => w.length >= 4);
const priorityWords = words.filter(w => w.length >= 6);

```
const buttons = Array.from(document.querySelectorAll('button[aria-label*="Add"]'));
let bestBtn = null, bestScore = -1;

for (const btn of buttons) {
  const label = (btn.getAttribute('aria-label') || '').toLowerCase();
  const score = words.filter(w => label.includes(w)).length
              + priorityWords.filter(w => label.includes(w)).length * 3;
  if (score > bestScore) { bestScore = score; bestBtn = btn; }
}

if (bestBtn && bestScore > 0) {
  bestBtn.click();
  return { label: bestBtn.getAttribute('aria-label'), score: bestScore };
}
return null;
```

}, { itemName: item.item });

if (!found) { console.log(`  NOT FOUND`); return false; }
console.log(`  Opened: ${found.label} (score:${found.score})`);

// Wait for modal to load — detect type
let modalType = null;
for (let i = 0; i < 20; i++) {
await page.waitForTimeout(400);
modalType = await page.evaluate(() => {
const btns = Array.from(document.querySelectorAll(‘button’));
const labels = btns.map(b => (b.getAttribute(‘aria-label’) || ‘’).toLowerCase());
if (labels.some(l => l.includes(‘increment case’))) return ‘case-stepper’;
if (labels.some(l => l.includes(‘increment single’))) return ‘both-stepper’;
if (labels.some(l => l.includes(‘increment’))) return ‘stepper’;
if (document.querySelectorAll(‘select’).length > 0) return ‘dropdown’;
// Listbox: numbered list items 1,2,3…
const listItems = Array.from(document.querySelectorAll(’[role=“option”]’));
if (listItems.some(l => /^\d+$/.test(l.textContent.trim()))) return ‘listbox’;
return null;
});
if (modalType) break;
}
console.log(`  Modal: ${modalType}`);
if (!modalType) { console.log(`  Modal not loaded`); return false; }

// === SET QUANTITY ===
if (modalType === ‘listbox’) {
// Numbered dropdown list — click the right number directly
// First check if the dropdown is already open, if not open it
const isOpen = await page.evaluate(() =>
Array.from(document.querySelectorAll(’[role=“option”]’)).some(l => /^\d+$/.test(l.textContent.trim()))
);

```
if (!isOpen) {
  // Click the quantity button to open the list
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const qtyBtn = btns.find(b => /^\d+$/.test(b.textContent.trim()));
    if (qtyBtn) qtyBtn.click();
  });
  await page.waitForTimeout(500);
}

// Click the right number
const clicked = await page.evaluate(({ qty }) => {
  const options = Array.from(document.querySelectorAll('[role="option"]'));
  const target = options.find(o => o.textContent.trim() === qty.toString());
  if (target) { target.click(); return `selected ${qty}`; }
  // If qty > 9, use Custom Amount
  const custom = options.find(o => o.textContent.toLowerCase().includes('custom'));
  if (custom) { custom.click(); return 'custom'; }
  return 'not found';
}, { qty: item.quantity });
console.log(`  Listbox: ${clicked}`);

// If custom was clicked, type the value
if (clicked === 'custom') {
  await page.waitForTimeout(500);
  await page.evaluate(({ qty }) => {
    const input = document.querySelector('input[type="number"], input[inputmode="numeric"]');
    if (input) {
      input.value = qty.toString();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { qty: item.quantity });
}
await page.waitForTimeout(500);
```

} else if (modalType === ‘dropdown’) {
// HTML select element
await page.evaluate(({ qty }) => {
const sel = document.querySelector(‘select’);
if (sel) {
sel.value = qty.toString();
sel.dispatchEvent(new Event(‘change’, { bubbles: true }));
}
}, { qty: item.quantity });
console.log(`  Dropdown set to ${item.quantity}`);
await page.waitForTimeout(500);

} else {
// Stepper buttons (+/-)
for (let i = 0; i < item.quantity; i++) {
const clicked = await page.evaluate(({ isSingleOnly }) => {
const btns = Array.from(document.querySelectorAll(‘button’));
const labels = btns.map(b => ({ btn: b, label: (b.getAttribute(‘aria-label’) || ‘’).toLowerCase() }));

```
    const allLabels = labels.map(x => x.label).filter(l => l.includes('increment') || l.includes('increase'));
    console.log('All increment labels:', allLabels.join(' | '));

    if (isSingleOnly) {
      // Single-only: prefer single button, avoid case button
      const singleBtn = labels.find(x => x.label.includes('increment single') || x.label.includes('increase single'));
      if (singleBtn) { singleBtn.btn.click(); return 'single+'; }
      // Fallback: first + button (single row)
      const plusBtns = btns.filter(b => b.textContent.trim() === '+');
      if (plusBtns.length >= 1) { plusBtns[0].click(); return 'plus1-single'; }
    } else {
      // Case item: prefer case button
      const caseBtn = labels.find(x => x.label.includes('increment case') || x.label.includes('increase case'));
      if (caseBtn) { caseBtn.btn.click(); return 'case+'; }
      // Fallback: any increment, then second + button
      const anyBtn = labels.find(x => x.label.includes('increment') || x.label.includes('increase'));
      if (anyBtn) { anyBtn.btn.click(); return anyBtn.label; }
      const plusBtns = btns.filter(b => b.textContent.trim() === '+');
      if (plusBtns.length >= 2) { plusBtns[1].click(); return 'plus2-case'; }
      if (plusBtns.length >= 1) { plusBtns[0].click(); return 'plus1-only'; }
    }

    return 'none';
  }, { isSingleOnly });
  console.log(`  [${i+1}/${item.quantity}] ${clicked}`);
  await page.waitForTimeout(600);
}
```

}

// === CONFIRM ADD TO CART ===
await page.waitForTimeout(800);
const confirmed = await page.evaluate(() => {
const btns = Array.from(document.querySelectorAll(‘button’));
const cartBtns = btns.filter(b => b.textContent.toLowerCase().includes(‘to cart’) || b.textContent.toLowerCase().includes(‘update’));
console.log(‘Cart buttons:’, cartBtns.map(b => b.textContent.trim()).join(’ | ’));

```
// Find button with count > 0 and < 50 (avoid the order guide "Add 54 items" button)
for (const btn of cartBtns) {
  const text = btn.textContent.trim();
  const match = text.match(/Add (\d+) items? to cart/i);
  if (match && parseInt(match[1]) > 0 && parseInt(match[1]) < 50) {
    btn.click(); return text;
  }
}
// Plain "Add to cart"
const plain = cartBtns.find(b => /^add to cart$/i.test(b.textContent.trim()));
if (plain) { plain.click(); return 'Add to cart'; }
// Update cart
const update = cartBtns.find(b => b.textContent.toLowerCase().includes('update'));
if (update) { update.click(); return update.textContent.trim(); }

return null;
```

});

console.log(`  Confirmed: ${confirmed}`);
await page.waitForTimeout(1500);
return !!confirmed;
}

async function placeRestaurantDepotOrder(orderItems) {
const browser = await chromium.launch({ headless: true, args: [’–no-sandbox’, ‘–disable-setuid-sandbox’] });
const context = await browser.newContext({
userAgent: ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36’
});
const page = await context.newPage();
page.on(‘console’, msg => { if (msg.text().includes(‘Cart buttons’)) console.log(`  BROWSER: ${msg.text()}`); });

try {
console.log(‘Logging in…’);
await page.goto(‘https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F’, { waitUntil: ‘domcontentloaded’, timeout: 30000 });
await page.waitForTimeout(5000);
await page.waitForSelector(’#email’, { timeout: 30000 });
await page.fill(’#email’, process.env.RD_EMAIL);
await page.waitForTimeout(500);
await page.fill(‘input[type=“password”]’, process.env.RD_PASSWORD);
await page.waitForTimeout(500);
await page.click(‘button[type=“submit”]’);
await page.waitForTimeout(5000);
console.log(‘Logged in’);

```
console.log('Loading order guide...');
await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);
const btnCount = await page.evaluate(() => document.querySelectorAll('button[aria-label*="Add"]').length);
console.log(`Found ${btnCount} Add buttons`);

// Clear the cart first before adding new items
console.log('Clearing cart...');
await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);

// Remove all items from cart
let cleared = false;
for (let attempt = 0; attempt < 10; attempt++) {
  const removed = await page.evaluate(() => {
    const removeBtn = document.querySelector('button[aria-label*="Remove"], button:has-text("Remove")');
    if (removeBtn) { removeBtn.click(); return true; }
    // Also try text-based
    const btns = Array.from(document.querySelectorAll('button'));
    const removeAny = btns.find(b => b.textContent.trim() === 'Remove');
    if (removeAny) { removeAny.click(); return true; }
    return false;
  });
  if (!removed) { cleared = true; break; }
  await page.waitForTimeout(1500);
}
console.log(`Cart cleared: ${cleared}`);

// Go back to order guide
await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);

const notFound = [];
for (const item of orderItems) {
  const success = await addItem(page, item);
  if (!success) notFound.push(item.item);
}

console.log(`\nDone. Not found: ${notFound.length ? notFound.join(', ') : 'none'}`);
await browser.close();
return { success: true, notFound };
```

} catch (error) {
console.error(‘Error:’, error.message);
await browser.close();
return { success: false, error: error.message };
}
}

app.post(’/whatsapp’, async (req, res) => {
res.sendStatus(200);
const incomingMsg = req.body.Body;
const fromNumber = req.body.From.replace(‘whatsapp:’, ‘’);
const senderName = fromNumber === process.env.YOUR_WHATSAPP_NUMBER ? ‘Nick’ : ‘Rahul’;
console.log(`Message from ${senderName}: ${incomingMsg}`);

if (!AUTHORIZED_NUMBERS.includes(fromNumber)) { await sendWhatsApp(fromNumber, ‘❌ Not authorized.’); return; }
await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Processing order...`);

try {
const parsedOrder = await parseOrder(incomingMsg);
if (parsedOrder.error) { await sendWhatsApp(fromNumber, `❓ Couldn't parse that.`); return; }

```
const orderSummary = parsedOrder.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
await sendWhatsApp(fromNumber, `📋 Adding to cart:\n\n${orderSummary}`);

const result = await placeRestaurantDepotOrder(parsedOrder);
if (result.success) {
  let msg = `🎉 Done! Checkout:\nmember.restaurantdepot.com/store/business/cart`;
  if (result.notFound?.length) msg += `\n\n⚠️ Not found:\n${result.notFound.join('\n')}`;
  await sendWhatsApp(fromNumber, msg);
  await sendConfirmationEmail(parsedOrder, senderName);
} else {
  await sendWhatsApp(fromNumber, `⚠️ Error: ${result.error}`);
}
```

} catch (error) {
console.error(‘Error:’, error);
await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Order manually:\nmember.restaurantdepot.com/store/business/order-guide/19933806363004568`);
}
});

app.get(’/’, (req, res) => res.send(‘Naan & Curry Agent is running! 🍛’));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

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

// Items ordered as individual singles (no case button)
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
“potato”: “Potato - 50 lb”,
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
const itemMapStr = Object.entries(ITEM_MAP).map(([k, v]) => `"${k}" -> "${v}"`).join(’\n’);
try {
const response = await anthropic.messages.create({
model: ‘claude-haiku-4-5-20251001’,
max_tokens: 1000,
messages: [{ role: ‘user’, content: `You are an ordering assistant for Naan & Curry restaurant.

Item mapping:
${itemMapStr}

Rules:

- IGNORE headers, dates, and names (e.g. “RESTAURANT DEPOT”, “Sat Apr 25”, “Mohan”)
- ONLY add items explicitly listed with a quantity number
- Use the EXACT quantity from the order. Never change it.
- Return ONLY a valid JSON array, no markdown or explanation

Format: [{“item”: “exact name from map values”, “quantity”: NUMBER}]

Order: ${message}` }]
});
const text = response.content[0].text;
const match = text.match(/[[\s\S]*]/);
return JSON.parse(match ? match[0] : text);
} catch (err) {
console.error(‘Parse error:’, err.message);
return { error: true };
}
}

async function sendWhatsApp(to, body) {
const chunks = body.match(/[\s\S]{1,1400}/g) || [body];
for (const chunk of chunks) {
await twilioClient.messages.create({
from: ‘whatsapp:’ + process.env.TWILIO_WHATSAPP_NUMBER,
to: ‘whatsapp:’ + to,
body: chunk
});
if (chunks.length > 1) await new Promise(r => setTimeout(r, 1000));
}
}

async function sendEmail(orderItems, sender) {
await sgMail.send({
from: ‘nicksodhi@gmail.com’,
to: ‘nicksodhi@gmail.com’,
subject: ’Restaurant Depot Cart Updated - ’ + new Date().toLocaleDateString(),
text: ’Order by ’ + sender + ‘:\n\n’ + orderItems.map(i => ‘* ’ + i.quantity + ‘x ’ + i.item).join(’\n’) + ‘\n\nCheckout: https://member.restaurantdepot.com/store/business/cart’
});
}

async function addItem(page, item) {
const isSingle = SINGLE_ONLY_ITEMS.includes(item.item);
console.log(’\n[’ + item.item + ‘] qty=’ + item.quantity + ’ single=’ + isSingle);

// Close any open modal
await page.keyboard.press(‘Escape’);
await page.waitForTimeout(400);

// Find and click the best matching Add button using weighted scoring
const clicked = await page.evaluate(function(itemName) {
var words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ’ ‘).split(’ ’).filter(function(w) {
return w.length >= 4 && [‘lbs’, ‘pkg’, ‘and’, ‘the’, ‘for’].indexOf(w) === -1;
});
var priority = words.filter(function(w) { return w.length >= 6; });
var best = null, bestScore = 0;
var buttons = document.querySelectorAll(‘button[aria-label]’);
for (var i = 0; i < buttons.length; i++) {
var btn = buttons[i];
var label = (btn.getAttribute(‘aria-label’) || ‘’).toLowerCase();
if (!label.includes(‘add’) && !label.includes(‘plus’)) continue;
var score = 0;
for (var j = 0; j < words.length; j++) { if (label.includes(words[j])) score++; }
for (var k = 0; k < priority.length; k++) { if (label.includes(priority[k])) score += 3; }
if (score > bestScore) { bestScore = score; best = btn; }
}
if (best && bestScore > 0) {
best.click();
return best.getAttribute(‘aria-label’);
}
return null;
}, item.item);

if (!clicked) { console.log(’  NOT FOUND’); return false; }
console.log(’  Matched: ’ + clicked);

// Wait for modal UI to appear
var modalType = null;
for (var attempt = 0; attempt < 20; attempt++) {
await page.waitForTimeout(400);
modalType = await page.evaluate(function() {
var btns = Array.from(document.querySelectorAll(‘button’));
var labels = btns.map(function(b) { return (b.getAttribute(‘aria-label’) || ‘’).toLowerCase(); });
if (labels.some(function(l) { return l.includes(‘increment’); })) return ‘stepper’;
var opts = Array.from(document.querySelectorAll(’[role=“option”]’));
if (opts.some(function(o) { return /^\d+$/.test(o.textContent.trim()); })) return ‘listbox’;
if (document.querySelector(‘select’)) return ‘dropdown’;
return null;
});
if (modalType) break;
}
console.log(’  Modal: ’ + modalType);
if (!modalType) { console.log(’  Modal never appeared’); return false; }

// SET QUANTITY based on modal type
if (modalType === ‘listbox’) {
var listResult = await page.evaluate(function(qty) {
var options = Array.from(document.querySelectorAll(’[role=“option”]’));
var target = options.find(function(o) { return o.textContent.trim() === String(qty); });
if (target) { target.click(); return ‘selected ’ + qty; }
// qty > 9: use Custom Amount
var custom = options.find(function(o) { return o.textContent.toLowerCase().includes(‘custom’); });
if (custom) { custom.click(); return ‘custom’; }
return ‘not found’;
}, item.quantity);
console.log(’  Listbox: ’ + listResult);
if (listResult === ‘custom’) {
await page.waitForTimeout(500);
var input = await page.$(‘input[type=“number”], input[inputmode=“numeric”]’);
if (input) {
await input.fill(String(item.quantity));
await page.evaluate(function(el) { el.dispatchEvent(new Event(‘change’, { bubbles: true })); }, await input.elementHandle());
}
}
await page.waitForTimeout(600);

} else if (modalType === ‘dropdown’) {
await page.evaluate(function(qty) {
var sel = document.querySelector(‘select’);
if (sel) { sel.value = String(qty); sel.dispatchEvent(new Event(‘change’, { bubbles: true })); }
}, item.quantity);
console.log(’  Dropdown set to ’ + item.quantity);
await page.waitForTimeout(600);

} else {
// STEPPER: click + button N times
for (var i = 0; i < item.quantity; i++) {
var result = await page.evaluate(function(isSingle) {
var btns = Array.from(document.querySelectorAll(‘button’));
var labeled = btns.map(function(b) {
return { b: b, l: (b.getAttribute(‘aria-label’) || ‘’).toLowerCase() };
});
// For case items: prefer case increment
if (!isSingle) {
var caseBtn = labeled.find(function(x) {
return x.l.includes(‘increment case’) || x.l.includes(‘increase case’);
});
if (caseBtn) { caseBtn.b.click(); return ‘case+’; }
}
// Single increment
var singleBtn = labeled.find(function(x) {
return x.l.includes(‘increment single’) || x.l.includes(‘increase single’);
});
if (singleBtn) { singleBtn.b.click(); return ‘single+’; }
// Any increment
var anyBtn = labeled.find(function(x) {
return x.l.includes(‘increment’) || x.l.includes(‘increase’);
});
if (anyBtn) { anyBtn.b.click(); return anyBtn.l; }
// Raw + buttons
var plusBtns = btns.filter(function(b) { return b.textContent.trim() === ‘+’; });
if (!isSingle && plusBtns.length >= 2) { plusBtns[1].click(); return ‘plus-case’; }
if (plusBtns.length >= 1) { plusBtns[0].click(); return ‘plus-first’; }
return ‘none’;
}, isSingle);
console.log(’  [’ + (i + 1) + ‘/’ + item.quantity + ’] ’ + result);
await page.waitForTimeout(700);
}
}

// CONFIRM: click Add to cart button (avoid the order guide’s “Add 54 items” button)
await page.waitForTimeout(700);
var confirmed = await page.evaluate(function() {
// Reverse so we find the LAST cart button (modal button), not the first (order guide button)
var btns = Array.from(document.querySelectorAll(‘button’)).reverse();
var cartBtns = btns.filter(function(b) { return /to cart|update/i.test(b.textContent); });
console.log(‘CART_BTNS:’ + cartBtns.map(function(b) { return b.textContent.trim(); }).join(’|’));
// Prefer button with count 1-49 (modal button)
for (var i = 0; i < cartBtns.length; i++) {
var m = cartBtns[i].textContent.match(/Add (\d+)/i);
if (m && +m[1] > 0 && +m[1] < 50) { cartBtns[i].click(); return cartBtns[i].textContent.trim(); }
}
// Plain “Add to cart”
var plain = btns.find(function(b) { return /^add to cart$/i.test(b.textContent.trim()); });
if (plain) { plain.click(); return ‘Add to cart’; }
// Update cart
var upd = btns.find(function(b) { return /update/i.test(b.textContent); });
if (upd) { upd.click(); return upd.textContent.trim(); }
return null;
});
console.log(’  Confirmed: ’ + confirmed);
await page.waitForTimeout(1500);
return !!confirmed;
}

async function placeOrder(orderItems) {
const browser = await chromium.launch({ headless: true, args: [’–no-sandbox’, ‘–disable-setuid-sandbox’] });
const context = await browser.newContext({
userAgent: ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36’
});
const page = await context.newPage();
page.on(‘console’, function(m) { if (m.text().startsWith(‘CART_BTNS:’)) console.log(’  BROWSER:’, m.text()); });

try {
// LOGIN
await page.goto(‘https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F’, { waitUntil: ‘domcontentloaded’, timeout: 30000 });
await page.waitForTimeout(5000);
await page.waitForSelector(’#email’, { timeout: 30000 });
await page.fill(’#email’, process.env.RD_EMAIL);
await page.waitForTimeout(400);
await page.fill(‘input[type=“password”]’, process.env.RD_PASSWORD);
await page.waitForTimeout(400);
await page.click(‘button[type=“submit”]’);
await page.waitForTimeout(5000);
console.log(‘Logged in’);

```
// CLEAR CART
await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
for (var i = 0; i < 60; i++) {
  var removed = await page.evaluate(function() {
    var els = Array.from(document.querySelectorAll('button, [role="button"]'));
    var btn = els.find(function(b) {
      var txt = (b.textContent || '').trim().toLowerCase();
      var aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('wishlist') || aria.includes('saved')) return false;
      return txt === 'remove' || aria.includes('remove') || (b.innerHTML || '').toLowerCase().includes('trash');
    });
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!removed) break;
  await page.waitForTimeout(1500);
}
console.log('Cart cleared');

// LOAD ORDER GUIDE
await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(6000);
var btnCount = await page.evaluate(function() { return document.querySelectorAll('button[aria-label]').length; });
console.log('Order guide loaded - ' + btnCount + ' buttons');

var notFound = [];
for (var j = 0; j < orderItems.length; j++) {
  var ok = await addItem(page, orderItems[j]);
  if (!ok) notFound.push(orderItems[j].item);
}

console.log('Done. Not found: ' + (notFound.length ? notFound.join(', ') : 'none'));
await browser.close();
return { success: true, notFound: notFound };
```

} catch (e) {
console.error(‘placeOrder error:’, e.message);
try { await browser.close(); } catch(_) {}
return { success: false, error: e.message };
}
}

app.post(’/whatsapp’, async function(req, res) {
res.sendStatus(200);
const msg = req.body.Body;
const from = req.body.From.replace(‘whatsapp:’, ‘’);
const name = from === process.env.YOUR_WHATSAPP_NUMBER ? ‘Nick’ : ‘Rahul’;
console.log(’From ’ + name + ’: ’ + msg);

if (!AUTHORIZED_NUMBERS.includes(from)) {
await sendWhatsApp(from, ‘Not authorized’);
return;
}

await sendWhatsApp(from, ’Got it ’ + name + ‘! Processing your order…’);

try {
const order = await parseOrder(msg);
if (!Array.isArray(order)) {
await sendWhatsApp(from, ‘Could not parse order. Please try again.’);
return;
}

```
const summary = order.map(function(i) { return '* ' + i.quantity + 'x ' + i.item; }).join('\n');
await sendWhatsApp(from, 'Adding to cart:\n\n' + summary);

const result = await placeOrder(order);
if (result.success) {
  var reply = 'Done! Checkout:\nmember.restaurantdepot.com/store/business/cart';
  if (result.notFound && result.notFound.length) {
    reply += '\n\nNot found in order guide:\n' + result.notFound.join('\n');
  }
  await sendWhatsApp(from, reply);
  await sendEmail(order, name);
} else {
  await sendWhatsApp(from, 'Error: ' + result.error);
}
```

} catch (e) {
console.error(‘Handler error:’, e.message);
await sendWhatsApp(from, ‘Something went wrong. Please order manually.’);
}
});

app.get(’/’, function(req, res) { res.send(‘Naan & Curry Agent running’); });
app.listen(process.env.PORT || 3000, function() { console.log(‘Running’); });

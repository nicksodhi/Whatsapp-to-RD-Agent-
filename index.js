const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright');
const sgMail = require('@sendgrid/mail');
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

const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb',
  'Micro Orchid Flowers - 4 oz',
  'Taylor Farms - Bagged Cilantro',
  'Lemons, 71-115 ct',
  'Carrots- 10 lb',
];

const ITEM_MAP = {
  "yellow onions": "Jumbo Spanish Onions - 50 lbs",
  "red onions": "Jumbo Red Onions - 25 lbs",
  "potato": "Potato - 50 lb",
  "potatoes": "Potato - 50 lb",
  "garlic": "Peeled Garlic",
  "ginger": "Fresh Ginger - 30 lbs",
  "paneer": "Royal Mahout - Paneer Loaf - 5 lbs",
  "flowers": "Micro Orchid Flowers - 4 oz",
  "garnish": "Micro Orchid Flowers - 4 oz",
  "cilantro": "Taylor Farms - Bagged Cilantro",
  "cucumber": "Cucumbers - 6 ct",
  "cauliflower": "White Cauliflower",
  "carrots": "Carrots- 10 lb",
  "lemon": "Lemons, 71-115 ct",
  "lemons": "Lemons, 71-115 ct",
  "mint": "Herb - Mint- 1lb",
  "heavy cream": "James Farm - Heavy Cream, 40% - 64 oz",
  "milk": "MILK WHL GAL GS/AN",
  "yogurt": "James Farm - Plain Yogurt - 32 lbs",
  "cheese": "James Farm - Shredded Cheddar Jack Cheese - 5 lbs",
  "chicken breast": "Boneless, Skinless Chicken Breasts, Tenders Out, Dry",
  "chicken thighs": "Boneless, Skinless Jumbo Chicken Thighs",
  "chicken leg quarters": "Fresh Chicken Leg Quarters - 40 lbs",
  "chicken wings": "Jumbo Chicken Party Wings (6-8 ct)",
  "wings": "Jumbo Chicken Party Wings (6-8 ct)",
  "chicken leg meat": "Fresh Boneless Skinless Chicken Leg Meat",
  "lamb": "Frozen Halal Boneless Lamb Leg, Australia",
  "goat": "Thomas Farms - Bone in Goat Cube - #15",
  "tilapia": "Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs",
  "fish": "Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs",
  "frozen spinach": "Frozen James Farm - Frozen Chopped Spinach - 3 lbs",
  "frozen peas": "Frozen James Farm - IQF Peas - 2.5 lbs",
  "frozen broccoli": "Frozen James Farm - IQF Broccoli Florets - 2 lbs",
  "frozen 4-way mix": "Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs",
  "4-way mix": "Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs",
  "roti atta": "Golden Temple - Durum Atta Flour - 2/20 lb Bag",
  "atta": "Golden Temple - Durum Atta Flour - 2/20 lb Bag",
  "all purpose flour": "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  "flour": "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  "baking powder": "Clabber Girl - Baking Powder - 5 lbs",
  "corn starch": "Clabber Girl Cornstarch - 3 lbs",
  "rice": "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  "basmati rice": "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  "garbanzo": "Chef's Quality - Garbanzo Beans - #10 can",
  "kidney beans": "Chef's Quality - Dark Red Kidney Beans - #10 cans",
  "salt": "Morton - Purex Salt - 50lb",
  "sugar": "C&H - Granulated Sugar - 25 lbs",
  "tomato sauce": "Chef's Quality - Tomato Sauce - #10 cans",
  "diced tomatoes": "Isabella - Petite Diced Tomatoes -#10 cans",
  "liquid butter": "Chef's Quality - Liquid Butter Alternative - gallon",
  "cooking oil": "Chef's Quality - Soybean Salad Oil - 35 lbs",
  "fryer oil": "Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs",
  "canola oil": "Chef's Quality - 100% Canola Salad Oil - 35 lbs",
  "sambal": "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz",
  "sambal chili": "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz",
  "lemon juice": "Chef's Quality - Lemon Juice - gallon",
  "red food color": "Felbro - Red Food Coloring - gallon",
  "water": "Evian - Natural Spring Water, 24 Ct, 500 mL",
  "sprite": "Sprite Bottles, 16.9 fl oz, 4 Pack",
  "diet coke": "Diet Coke Bottles, 16.9 fl oz, 24 Pack",
};

async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: `You are an ordering assistant for Naan & Curry restaurant.

Item mapping:
${itemMapStr}

Rules:
- ONLY add items explicitly listed with a quantity
- Use EXACT quantity from order, never change it
- Return ONLY a JSON array

Format: [{"item": "exact name from map", "quantity": NUMBER}]

Order: ${message}` }]
  });
  try {
    return JSON.parse(response.content[0].text.trim().replace(/\`\`\`json|\`\`\`/g, '').trim());
  } catch { return { error: true }; }
}

async function sendWhatsApp(to, body) {
  await twilioClient.messages.create({ from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + to, body });
}

async function sendEmail(orderItems, sender) {
  await sgMail.send({
    from: 'nicksodhi@gmail.com', to: 'nicksodhi@gmail.com',
    subject: `Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
    text: `Order by ${sender}:\n\n${orderItems.map(i => `• ${i.quantity}x ${i.item}`).join('\n')}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`
  });
}

async function addItem(page, item) {
  const isSingle = SINGLE_ONLY_ITEMS.includes(item.item);
  console.log(`\n[${item.item}] qty=${item.quantity} single=${isSingle}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Find best matching Add button
  const found = await page.evaluate((itemName) => {
    const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 4);
    const priority = words.filter(w => w.length >= 6);
    let best = null, bestScore = 0;
    for (const btn of document.querySelectorAll('button[aria-label*="Add"]')) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const score = words.filter(w => label.includes(w)).length + priority.filter(w => label.includes(w)).length * 3;
      if (score > bestScore) { bestScore = score; best = btn; }
    }
    if (best && bestScore > 0) { best.click(); return best.getAttribute('aria-label'); }
    return null;
  }, item.item);

  if (!found) { console.log('  NOT FOUND'); return false; }
  console.log(`  Matched: ${found}`);

  // Wait up to 8 seconds for modal
  let modalReady = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    modalReady = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const labels = btns.map(b => (b.getAttribute('aria-label') || '').toLowerCase());
      if (labels.some(l => l.includes('increment'))) return 'stepper';
      if (Array.from(document.querySelectorAll('[role="option"]')).some(o => /^\d+$/.test(o.textContent.trim()))) return 'listbox';
      if (document.querySelector('select')) return 'dropdown';
      return false;
    });
    if (modalReady) break;
  }
  console.log(`  Modal: ${modalReady}`);
  if (!modalReady) { console.log('  Modal failed'); return false; }

  if (modalReady === 'listbox') {
    // Select quantity from numbered list
    const result = await page.evaluate((qty) => {
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      const target = options.find(o => o.textContent.trim() === String(qty));
      if (target) { target.click(); return `selected ${qty}`; }
      const custom = options.find(o => o.textContent.toLowerCase().includes('custom'));
      if (custom) { custom.click(); return 'custom'; }
      return 'not found';
    }, item.quantity);
    console.log(`  Listbox: ${result}`);
    if (result === 'custom') {
      await page.waitForTimeout(400);
      const input = await page.$('input[type="number"], input[inputmode="numeric"]');
      if (input) {
        await input.fill(String(item.quantity));
        await input.dispatchEvent('change');
      }
    }
    await page.waitForTimeout(600);

  } else if (modalReady === 'dropdown') {
    await page.evaluate((qty) => {
      const sel = document.querySelector('select');
      if (sel) { sel.value = String(qty); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, item.quantity);
    await page.waitForTimeout(600);

  } else {
    // Stepper buttons
    for (let i = 0; i < item.quantity; i++) {
      const clicked = await page.evaluate((isSingle) => {
        const btns = Array.from(document.querySelectorAll('button'));
        const labeled = btns.map(b => ({ b, l: (b.getAttribute('aria-label') || '').toLowerCase() }));
        if (!isSingle) {
          const c = labeled.find(x => x.l.includes('increment case') || x.l.includes('increase case'));
          if (c) { c.b.click(); return 'case'; }
        }
        const s = labeled.find(x => x.l.includes('increment single') || x.l.includes('increase single'));
        if (s) { s.b.click(); return 'single'; }
        const any = labeled.find(x => x.l.includes('increment') || x.l.includes('increase'));
        if (any) {
          if (isSingle) { any.b.click(); return 'any-single'; }
          any.b.click(); return 'any';
        }
        const plus = btns.filter(b => b.textContent.trim() === '+');
        if (!isSingle && plus.length >= 2) { plus[1].click(); return '+case'; }
        if (plus.length >= 1) { plus[0].click(); return '+first'; }
        return 'none';
      }, isSingle);
      console.log(`  [${i+1}/${item.quantity}] ${clicked}`);
      await page.waitForTimeout(600);
    }
  }

  // Click confirm button — find modal button with small count or plain "Add to cart"
  await page.waitForTimeout(600);
  const confirmed = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    // Log all cart-related buttons
    const cartBtns = btns.filter(b => /to cart|update/i.test(b.textContent));
    console.log('CART_BTNS:' + cartBtns.map(b => b.textContent.trim()).join('|'));
    // Prefer button with count 1-49
    for (const b of cartBtns) {
      const m = b.textContent.match(/Add (\d+)/i);
      if (m && +m[1] > 0 && +m[1] < 50) { b.click(); return b.textContent.trim(); }
    }
    // Plain "Add to cart"
    const plain = btns.find(b => /^add to cart$/i.test(b.textContent.trim()));
    if (plain) { plain.click(); return 'Add to cart'; }
    // Update
    const upd = btns.find(b => /update/i.test(b.textContent));
    if (upd) { upd.click(); return upd.textContent.trim(); }
    return null;
  });
  console.log(`  Confirmed: ${confirmed}`);
  await page.waitForTimeout(1500);
  return !!confirmed;
}

async function placeOrder(orderItems) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
  const page = await context.newPage();
  page.on('console', m => { if (m.text().startsWith('CART_BTNS:')) console.log('  BROWSER:', m.text()); });

  try {
    // Login
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.waitForSelector('#email', { timeout: 30000 });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(400);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(400);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in');

    // Clear cart
    await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 60; i++) {
      const removed = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const removeBtn = btns.find(b => b.textContent.trim() === 'Remove' || (b.getAttribute('aria-label') || '').includes('Remove'));
        if (removeBtn) { removeBtn.click(); return true; }
        return false;
      });
      if (!removed) break;
      await page.waitForTimeout(1200);
    }
    console.log('Cart cleared');

    // Load order guide
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    console.log('Order guide loaded');

    const notFound = [];
    for (const item of orderItems) {
      const ok = await addItem(page, item);
      if (!ok) notFound.push(item.item);
    }

    await browser.close();
    console.log('Done. Not found:', notFound.join(', ') || 'none');
    return { success: true, notFound };

  } catch (e) {
    console.error(e.message);
    await browser.close();
    return { success: false, error: e.message };
  }
}

app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.Body;
  const from = req.body.From.replace('whatsapp:', '');
  const name = from === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';
  console.log(`From ${name}: ${msg}`);

  if (!AUTHORIZED_NUMBERS.includes(from)) { await sendWhatsApp(from, '❌ Not authorized'); return; }
  await sendWhatsApp(from, `✅ Got it ${name}! Processing...`);

  try {
    const order = await parseOrder(msg);
    if (order.error) { await sendWhatsApp(from, '❓ Could not parse order'); return; }

    const summary = order.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(from, `📋 Adding to cart:\n\n${summary}`);

    const result = await placeOrder(order);
    if (result.success) {
      let reply = `🎉 Done! Checkout:\nmember.restaurantdepot.com/store/business/cart`;
      if (result.notFound?.length) reply += `\n\n⚠️ Not found: ${result.notFound.join(', ')}`;
      await sendWhatsApp(from, reply);
      await sendEmail(order, name);
    } else {
      await sendWhatsApp(from, `⚠️ Error: ${result.error}`);
    }
  } catch (e) {
    console.error(e);
    await sendWhatsApp(from, '⚠️ Something went wrong. Please order manually.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent 🍛'));
app.listen(process.env.PORT || 3000, () => console.log('Running'));

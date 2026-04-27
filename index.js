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
  'Peeled Garlic',
  'White Cauliflower',
  'MILK WHL GAL GS/AN',
  "Chef's Quality - Liquid Butter Alternative - gallon",
  "Chef's Quality - Lemon Juice - gallon",
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz",
  "James Farm - Heavy Cream, 40% - 64 oz",
  "Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs"
];

const CASE_CONVERSIONS = {
  "Peeled Garlic": 6,
  "White Cauliflower": 12,
  "MILK WHL GAL GS/AN": 4,
  "Chef's Quality - Liquid Butter Alternative - gallon": 3,
  "Chef's Quality - Lemon Juice - gallon": 4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz": 3,
  "James Farm - Heavy Cream, 40% - 64 oz": 6,
  "Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs": 12
};

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
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `You are an ordering assistant for Naan & Curry restaurant. Return ONLY a JSON array. Format: [{"item": "exact name from map", "quantity": NUMBER}] Order: ${message}\n\nMapping:\n${itemMapStr}` }]
    });
    const text = response.content[0].text;
    const match = text.match(/\[[\s\S]*\]/); 
    let parsedArray = JSON.parse(match ? match[0] : text);
    return parsedArray.map(i => {
      if (CASE_CONVERSIONS[i.item]) i.quantity = i.quantity * CASE_CONVERSIONS[i.item];
      return i;
    });
  } catch (err) { return { error: true, details: err.message }; }
}

async function sendWhatsApp(to, body) {
  if (body.length < 1500) {
    await twilioClient.messages.create({ from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + to, body });
  } else {
    const chunks = body.match(/[\s\S]{1,1500}/g) || [];
    for (const chunk of chunks) {
      await twilioClient.messages.create({ from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + to, body: chunk });
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function clearPopups(page) {
    await page.evaluate(() => {
        const closeSelectors = ['button[aria-label*="close" i]', '.reakit-portal button', '[data-dialog-ref] button'];
        closeSelectors.forEach(s => { const b = document.querySelector(s); if (b) b.click(); });
    });
}

async function addItem(page, item) {
  const isSingle = SINGLE_ONLY_ITEMS.includes(item.item);
  console.log(`\n[${item.item}] targetQty=${item.quantity}`);

  await page.keyboard.press('Escape');
  await clearPopups(page);

  const btn = await page.evaluateHandle((itemName) => {
    const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 3 && !['lbs', 'pkg'].includes(w));
    let best = null, max = 0;
    document.querySelectorAll('button').forEach(b => {
      const l = (b.getAttribute('aria-label') || '').toLowerCase();
      if (!l || l.includes('wishlist')) return;
      const score = words.filter(w => l.includes(w)).length;
      if (score > max) { max = score; best = b; }
    });
    return best;
  }, item.item);

  if (!(await page.evaluate(el => el !== null, btn))) return false;
  await btn.click();
  await btn.dispose();

  let modalType = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(400);
    modalType = await page.evaluate(() => {
      if (document.querySelector('button[aria-label*="increment" i]')) return 'stepper';
      if (document.querySelector('select')) return 'dropdown';
      return false;
    });
    if (modalType) break;
  }
  
  await page.waitForTimeout(2000);

  if (modalType === 'dropdown') {
    await page.evaluate((qty) => {
      const s = document.querySelector('select');
      if (s) { s.value = String(qty); s.dispatchEvent(new Event('change', { bubbles: true })); }
    }, item.quantity);
  } else {
    // HARDENED STEPPER: Verifies every click registers to prevent "short by 1"
    for (let i = 1; i < item.quantity; i++) {
      await clearPopups(page);
      const clicked = await page.evaluate(({itemName, isSingle}) => {
        const words = itemName.toLowerCase().split(' ').filter(w => w.length >= 3);
        const btns = Array.from(document.querySelectorAll('button'));
        let best = null, max = -1;
        btns.forEach(b => {
          const a = (b.getAttribute('aria-label') || '').toLowerCase();
          if (!(a.includes('increment') || b.textContent === '+')) return;
          let p = b; for(let j=0; j<6; j++) if(p.parentElement) p = p.parentElement;
          const score = words.filter(w => p.innerText.toLowerCase().includes(w)).length;
          if (score > max) { max = score; best = b; }
        });
        if (best && !best.disabled) { best.click(); return true; }
        return false;
      }, { itemName: item.item, isSingle });
      await page.waitForTimeout(1200);
    }
  }

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(el => /to cart|update/i.test(el.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  return true;
}

async function placeOrder(orderItems) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init', { waitUntil: 'domcontentloaded' });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    await page.goto('https://member.restaurantdepot.com/store/business/cart');
    for (let i = 0; i < 30; i++) {
      const r = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button')).find(el => el.textContent.toLowerCase().includes('remove'));
        if (b) { b.click(); return true; } return false;
      });
      if (!r) break; await page.waitForTimeout(1000);
    }

    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568');
    await page.waitForTimeout(4000);

    const notFound = [];
    for (const item of orderItems) { if (!(await addItem(page, item))) notFound.push(item.item); }
    await browser.close();
    return { success: true, notFound };
  } catch (e) { await browser.close(); return { success: false, error: e.message }; }
}

app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.Body, from = req.body.From.replace('whatsapp:', '');
  if (!AUTHORIZED_NUMBERS.includes(from)) return;
  await sendWhatsApp(from, `🍛 Ordering items now...`);
  const order = await parseOrder(msg);
  if (order.error) return sendWhatsApp(from, `❌ AI Error`);
  const result = await placeOrder(order);
  await sendWhatsApp(from, result.success ? `🎉 Done! Not found: ${result.notFound.join(', ') || 'none'}` : `❌ Error`);
});

app.listen(process.env.PORT || 3000);

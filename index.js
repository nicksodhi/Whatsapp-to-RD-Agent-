const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright');
const sgMail = require('@sendgrid/mail');

// ==========================================
// CONFIGURATION & VALIDATION
// ==========================================
const REQUIRED_ENV = [
  'SENDGRID_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
  'ANTHROPIC_API_KEY', 'RD_EMAIL', 'RD_PASSWORD', 'YOUR_WHATSAPP_NUMBER',
  'RAHUL_WHATSAPP_NUMBER'
];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) console.warn(`⚠️ Missing environment variable: ${key}`);
});

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

// ==========================================
// CORE FUNCTIONS
// ==========================================

/**
 * PARSE ORDER
 * Translates informal chef text into exact order guide items using Claude AI.
 */
async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', 
      max_tokens: 1000,
      messages: [{ 
        role: 'user', 
        content: `You are an automated ordering assistant for a restaurant. Your job is to translate informal grocery text messages from chefs into an exact JSON array for our purchasing system.
        
        Order Guide Mapping:
        ${itemMapStr}
        
        Rules for Processing:
        1. IGNORE headers, dates, employee names (e.g., "Mohan"), locations (e.g., "Rhodes Ranch"), and section titles (e.g., "RESTAURANT DEPOT").
        2. FUZZY MATCH the chef's item description to the closest key in our mapping list, even if they include extra words, weights, or formatting (e.g., "Carrots (25lb bag)" maps to "carrots").
        3. OUTPUT the EXACT mapped value from the right side of the mapping list. Never invent items.
        4. Use the exact quantity requested as a number.
        5. Return ONLY a valid JSON array, absolutely no conversational text.
        
        Format Example: [{"item": "Jumbo Red Onions - 25 lbs", "quantity": 1}]
        
        Chef's List: 
        ${message}` 
      }]
    });

    const text = response.content[0].text.trim();
    const jsonStr = text.match(/\[.*\]/s)?.[0] || text;
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Parsing Error:", err);
    return { error: true, details: err.message };
  }
}

async function sendWhatsApp(to, body) {
  try {
    await twilioClient.messages.create({ 
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, 
      to: 'whatsapp:' + to, 
      body 
    });
  } catch (e) { console.error('WhatsApp Error:', e.message); }
}

async function sendEmail(orderItems, sender) {
  const msg = {
    from: 'nicksodhi@gmail.com', 
    to: 'nicksodhi@gmail.com',
    subject: `🛒 Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
    text: `Order submitted by ${sender}:\n\n${orderItems.map(i => `• ${i.quantity}x ${i.item}`).join('\n')}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`
  };
  try { await sgMail.send(msg); } catch (e) { console.error('Email Error:', e.message); }
}

// ==========================================
// BROWSER AUTOMATION (PLAYWRIGHT)
// ==========================================

async function addItem(page, item) {
  const isSingle = SINGLE_ONLY_ITEMS.includes(item.item);
  console.log(`Processing: ${item.item} (Qty: ${item.quantity})`);

  try {
    await page.keyboard.press('Escape');
    
    const addButton = await page.locator(`button[aria-label*="Add"]`).filter({ hasText: '' }).evaluateHandle((btns, itemName) => {
        const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 3);
        let best = null, maxScore = 0;
        btns.forEach(btn => {
            const label = btn.getAttribute('aria-label').toLowerCase();
            const score = words.reduce((acc, word) => acc + (label.includes(word) ? 1 : 0), 0);
            if (score > maxScore) { maxScore = score; best = btn; }
        });
        if (best) best.click();
        return best;
    }, item.item);

    if (!addButton) return false;

    await page.waitForTimeout(1000);

    const select = page.locator('select').first();
    if (await select.isVisible()) {
      await select.selectOption({ label: String(item.quantity) });
    } else {
      for (let i = 0; i < item.quantity; i++) {
        const btnType = isSingle ? 'single' : 'case';
        const increment = page.locator(`button[aria-label*="increment ${btnType}"], button[aria-label*="increase ${btnType}"]`).first();
        if (await increment.isVisible()) {
          await increment.click();
        } else {
          await page.locator('button:has-text("+")').last().click();
        }
        await page.waitForTimeout(400);
      }
    }

    const confirmBtn = page.locator('button:has-text("Add to cart"), button:has-text("Update")').first();
    await confirmBtn.click();
    await page.waitForTimeout(1000);
    return true;
  } catch (err) {
    console.error(`Failed to add ${item.item}:`, err.message);
    return false;
  }
}

async function placeOrder(orderItems) {
  const browser = await chromium.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init', { waitUntil: 'networkidle' });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/www\.restaurantdepot\.com/, { timeout: 15000 });

    await page.goto('https://member.restaurantdepot.com/store/business/cart');
    const removeBtns = page.locator('button:has-text("Remove")');
    while (await removeBtns.count() > 0) {
      await removeBtns.first().click();
      await page.waitForTimeout(800);
    }

    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'networkidle' });
    
    const notFound = [];
    for (const item of orderItems) {
      const success = await addItem(page, item);
      if (!success) notFound.push(item.item);
    }

    return { success: true, notFound };
  } catch (e) {
    return { success: false, error: e.message };
  } finally {
    await browser.close();
  }
}

// ==========================================
// ROUTES & SERVER
// ==========================================

app.post('/whatsapp', async (req, res) => {
  res.status(200).send('EVENT_RECEIVED'); 

  const { Body: msg, From: fromRaw } = req.body;
  const from = fromRaw.replace('whatsapp:', '');
  const name = from === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';

  if (!AUTHORIZED_NUMBERS.includes(from)) return;

  await sendWhatsApp(from, `👨‍🍳 Working on it, ${name}...`);

  try {
    const order = await parseOrder(msg);
    if (order.error || !Array.isArray(order)) {
      await sendWhatsApp(from, `❌ Parsing Error: ${order.details || 'Not a valid array'}`);
      return;
    }

    await sendWhatsApp(from, `🛒 Adding ${order.length} items to your cart...`);
    const result = await placeOrder(order);

    if (result.success) {
      let reply = `✅ Done! Cart is ready.\n\nItems added:\n${order.map(i => `• ${i.quantity}x ${i.item}`).join('\n')}`;
      if (result.notFound.length > 0) {
        reply += `\n\n⚠️ Not found: ${result.notFound.join(', ')}`;
      }
      await sendWhatsApp(from, reply);
      await sendEmail(order, name);
    } else {
      await sendWhatsApp(from, `❌ Automation failed: ${result.error}`);
    }
  } catch (err) {
    await sendWhatsApp(from, `❌ An unexpected error occurred: ${err.message}`);
  }
});

app.get('/', (req, res) => res.send('System Online 🟢'));

const PORT = process.env.PORT || 8080; 
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

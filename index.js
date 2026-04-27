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

const ITEM_MAP = {
  "yellow onions": "Jumbo Spanish Onions - 50 lbs",
  "red onions": "Jumbo Red Onions - 25 lbs",
  "potato": "Russet Potato - 50 lb Bag, 6oz Min, US #2",
  "potatoes": "Russet Potato - 50 lb Bag, 6oz Min, US #2",
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
  const itemMapStr = Object.entries(ITEM_MAP)
    .map(([k, v]) => `"${k}" → "${v}"`)
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are an ordering assistant for Naan & Curry, an Indian restaurant in Las Vegas.

Use this item mapping to convert the order to exact Restaurant Depot item names:
${itemMapStr}

Rules:
- ONLY add items EXPLICITLY listed in the order with a quantity number
- The quantity in the order = EXACT number to use (never change it)
- If an item is NOT in the order message, do NOT add it
- Skip: Ketchup, Vinegar, Coca-Cola, Fanta, Indian spices, disposables
- Return ONLY a JSON array, no markdown, no explanation

Format: [{"item": "EXACT item name from map values", "quantity": NUMBER}]

Order to parse:
${message}`
    }]
  });

  const text = response.content[0].text.trim();
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return { error: 'Could not parse order' };
  }
}

async function sendWhatsApp(to, message) {
  await twilioClient.messages.create({
    from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
    to: 'whatsapp:' + to,
    body: message
  });
}

async function sendConfirmationEmail(orderItems, sender) {
  const orderList = orderItems.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
  await sgMail.send({
    from: 'nicksodhi@gmail.com',
    to: 'nicksodhi@gmail.com',
    subject: `✅ Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
    text: `Items added to Restaurant Depot cart by ${sender}.\n\nORDER SUMMARY:\n${orderList}\n\nAdded at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\n\nCheckout (select Pickup):\nhttps://member.restaurantdepot.com/store/business/cart`
  });
}

async function addItem(page, item) {
  console.log(`\n--- ${item.item} x${item.quantity} ---`);

  // Close any open modal first by pressing Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Find matching Add button on order guide
  const found = await page.evaluate(({ itemName }) => {
    const searchWords = itemName.toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(' ')
      .filter(w => w.length > 2);

    const buttons = Array.from(document.querySelectorAll('button[aria-label*="Add"]'));
    let bestBtn = null;
    let bestScore = 0;

    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const score = searchWords.filter(w => label.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestBtn = btn;
      }
    }

    if (bestBtn && bestScore > 0) {
      bestBtn.click();
      return { label: bestBtn.getAttribute('aria-label'), score: bestScore };
    }
    return null;
  }, { itemName: item.item });

  if (!found) {
    console.log(`  NOT FOUND`);
    return false;
  }
  console.log(`  Opened: ${found.label}`);

  // Wait for modal - specifically wait for the input stepper to appear
  // The modal has number inputs for single and case quantities
  let modalType = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    await page.waitForTimeout(400);
    modalType = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const labels = btns.map(b => (b.getAttribute('aria-label') || '').toLowerCase());
      if (labels.some(l => l.includes('increment case'))) return 'case';
      if (labels.some(l => l.includes('increment single'))) return 'single-case';
      if (labels.some(l => l.includes('increment'))) return 'single';
      // Check for + buttons as fallback
      const plusBtns = btns.filter(b => b.textContent.trim() === '+');
      if (plusBtns.length > 0) return `plus-${plusBtns.length}`;
      return null;
    });
    if (modalType) break;
  }
  console.log(`  Modal type: ${modalType}`);

  if (!modalType) {
    console.log(`  Modal never loaded`);
    return false;
  }

  // Click the right button based on modal type
  for (let i = 0; i < item.quantity; i++) {
    const clicked = await page.evaluate(({ modalType }) => {
      const btns = Array.from(document.querySelectorAll('button'));

      // Case button (items sold in cases)
      if (modalType === 'case' || modalType === 'single-case') {
        const caseBtn = btns.find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('increment case'));
        if (caseBtn) { caseBtn.click(); return 'case'; }
      }

      // Single button
      if (modalType === 'single' || modalType === 'single-case') {
        const singleBtn = btns.find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('increment single'));
        if (singleBtn) { singleBtn.click(); return 'single'; }
      }

      // Fallback: + buttons
      const plusBtns = btns.filter(b => b.textContent.trim() === '+');
      if (modalType && modalType.startsWith('plus-')) {
        const count = parseInt(modalType.split('-')[1]);
        if (count >= 2) { plusBtns[1].click(); return 'plus-case'; }
        if (count === 1) { plusBtns[0].click(); return 'plus-single'; }
      }

      return 'none';
    }, { modalType });

    console.log(`  [${i+1}/${item.quantity}] ${clicked}`);
    await page.waitForTimeout(500);
  }

  // Now click Add to cart — find the modal's button specifically
  // Key: look for button containing "items to cart" with number matching our quantity
  await page.waitForTimeout(800);

  const confirmed = await page.evaluate(({ qty }) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const results = [];

    for (const btn of btns) {
      const text = btn.textContent.trim();
      if (text.toLowerCase().includes('to cart')) {
        results.push(text);
      }
    }

    // Log all cart buttons for debugging
    console.log('Cart buttons found:', results.join(' | '));

    // Find button with our quantity (or close to it)
    for (const btn of btns) {
      const text = btn.textContent.trim();
      const match = text.match(/Add (\d+) items? to cart/i);
      if (match) {
        const count = parseInt(match[1]);
        // The modal button should have count = qty * itemsPerCase
        // It must be less than the total order guide items (50+)
        if (count > 0 && count < 50) {
          btn.click();
          return text;
        }
      }
    }

    // Fallback: simple "Add to cart"
    const simple = btns.find(b => {
      const t = b.textContent.trim();
      return t === 'Add to cart' || t === 'Add 0 items to cart';
    });
    // Only click if it's not "Add 0"
    if (simple && !simple.textContent.includes('0')) {
      simple.click();
      return simple.textContent.trim();
    }

    return null;
  }, { qty: item.quantity });

  console.log(`  Confirmed: ${confirmed}`);
  await page.waitForTimeout(1500);
  return !!confirmed;
}

async function placeRestaurantDepotOrder(orderItems) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Capture browser console logs
  page.on('console', msg => {
    if (msg.text().includes('Cart buttons')) console.log(`  BROWSER: ${msg.text()}`);
  });

  try {
    console.log('Logging in...');
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(5000);
    await page.waitForSelector('#email', { timeout: 30000 });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(500);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in');

    console.log('Loading order guide...');
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(6000);
    console.log(`Order guide loaded`);

    const notFound = [];
    for (const item of orderItems) {
      const success = await addItem(page, item);
      if (!success) notFound.push(item.item);
    }

    console.log(`\nDone. Not found: ${notFound.length > 0 ? notFound.join(', ') : 'none'}`);
    await browser.close();
    return { success: true, notFound };

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
    return { success: false, error: error.message };
  }
}

app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);

  const incomingMsg = req.body.Body;
  const fromNumber = req.body.From.replace('whatsapp:', '');
  const senderName = fromNumber === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';

  console.log(`Message from ${senderName}: ${incomingMsg}`);

  if (!AUTHORIZED_NUMBERS.includes(fromNumber)) {
    await sendWhatsApp(fromNumber, '❌ Not authorized.');
    return;
  }

  await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Processing order...`);

  try {
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ Couldn't parse that. Try forwarding the order list directly.`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 Adding to cart:\n\n${orderSummary}`);

    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      let msg = `🎉 Done! Checkout:\nmember.restaurantdepot.com/store/business/cart`;
      if (result.notFound && result.notFound.length > 0) {
        msg += `\n\n⚠️ Not found:\n${result.notFound.join('\n')}`;
      }
      await sendWhatsApp(fromNumber, msg);
      await sendConfirmationEmail(parsedOrder, senderName);
    } else {
      await sendWhatsApp(fromNumber, `⚠️ Error: ${result.error}`);
    }

  } catch (error) {
    console.error('Error:', error);
    await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Order manually:\nmember.restaurantdepot.com/store/business/order-guide/19933806363004568`);
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent is running! 🍛'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

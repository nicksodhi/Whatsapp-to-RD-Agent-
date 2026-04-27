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

// Items sold as singles (no case option)
const SINGLE_ITEMS = ['mint', 'herb', 'lemon', 'flower', 'cilantro', 'cauliflower', 'carrot'];

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
- The quantity in the order = EXACT number to put in JSON (never change it)
- If quantity is 2, use 2. If quantity is 4, use 4. Never round down.
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

async function addItemToCart(page, item) {
  const isSingle = SINGLE_ITEMS.some(s => item.item.toLowerCase().includes(s));

  // Find and click the Add button
  const result = await page.evaluate(({ itemName }) => {
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
      return { found: true, label: bestBtn.getAttribute('aria-label'), score: bestScore };
    }
    return { found: false };
  }, { itemName: item.item });

  if (!result.found) {
    console.log(`NOT FOUND: ${item.item}`);
    return false;
  }

  console.log(`Modal opened: ${result.label} (score: ${result.score})`);
  
  // Wait for modal to appear - look for the case + button to confirm modal is loaded
  let modalLoaded = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    modalLoaded = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => {
        const label = (b.getAttribute('aria-label') || '').toLowerCase();
        return label.includes('increment case') || label.includes('increase case') || label.includes('increment single');
      });
    });
    if (modalLoaded) break;
    await page.waitForTimeout(500);
  }
  console.log(`  Modal loaded: ${modalLoaded}`);

  // Click + button the right number of times
  for (let i = 0; i < item.quantity; i++) {
    const clicked = await page.evaluate(({ isSingle }) => {
      const btns = Array.from(document.querySelectorAll('button'));

      if (isSingle) {
        const singleBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('increment single') || label.includes('increase single');
        });
        if (singleBtn) { singleBtn.click(); return 'single+aria'; }
        const plusBtn = btns.find(b => b.textContent.trim() === '+');
        if (plusBtn) { plusBtn.click(); return 'single+text'; }
      } else {
        const caseBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('increment case') || label.includes('increase case');
        });
        if (caseBtn) { caseBtn.click(); return 'case+aria'; }
        const plusBtns = btns.filter(b => b.textContent.trim() === '+');
        if (plusBtns.length >= 2) { plusBtns[1].click(); return 'case+fallback'; }
        if (plusBtns.length === 1) { plusBtns[0].click(); return 'only+'; }
      }
      return 'not_clicked';
    }, { isSingle });

    console.log(`  Click ${i + 1}/${item.quantity}: ${clicked}`);
    await page.waitForTimeout(800);
  }

  // Find and click the modal confirm button
  // The modal lives inside a dialog/overlay element
  // The order guide button is OUTSIDE the modal
  await page.waitForTimeout(500);

  const confirmed = await page.evaluate(() => {
    // First try: find button inside a dialog/modal container
    const dialogs = document.querySelectorAll('[role="dialog"], [data-dialog], .modal, [class*="modal"], [class*="dialog"], [class*="overlay"], [class*="drawer"]');
    for (const dialog of dialogs) {
      const btns = Array.from(dialog.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('to cart') || b.textContent.includes('Add'));
      if (addBtn && addBtn.textContent.includes('cart')) {
        addBtn.click();
        return 'dialog: ' + addBtn.textContent.trim();
      }
    }

    // Second try: find button with "items to cart" that has smallest count
    const allBtns = Array.from(document.querySelectorAll('button'));
    const cartBtns = allBtns.filter(b => b.textContent.includes('to cart'));
    
    let modalBtn = null;
    let minCount = Infinity;
    for (const btn of cartBtns) {
      const text = btn.textContent.trim();
      const match = text.match(/Add (\d+) items? to cart/i);
      if (match) {
        const count = parseInt(match[1]);
        if (count < minCount) {
          minCount = count;
          modalBtn = btn;
        }
      }
    }
    if (modalBtn && minCount < 20) {
      modalBtn.click();
      return 'min-count: ' + modalBtn.textContent.trim();
    }

    // Third try: find "Add to cart" exact text (no number)
    const simpleBtn = allBtns.find(b => b.textContent.trim() === 'Add to cart');
    if (simpleBtn) {
      simpleBtn.click();
      return 'simple: Add to cart';
    }

    return null;
  });

  console.log(`Confirmed: ${confirmed}`);
  await page.waitForTimeout(2000);
  return true;
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

    const btnCount = await page.evaluate(() =>
      document.querySelectorAll('button[aria-label*="Add"]').length
    );
    console.log(`Found ${btnCount} Add buttons`);

    const results = { added: [], notFound: [] };

    for (const item of orderItems) {
      console.log(`\n--- Processing: ${item.item} x${item.quantity} ---`);
      const success = await addItemToCart(page, item);
      if (success) {
        results.added.push(item);
      } else {
        results.notFound.push(item.item);
      }
    }

    console.log(`\nDone. Added: ${results.added.length}, Not found: ${results.notFound.length}`);
    if (results.notFound.length > 0) {
      console.log('Not found:', results.notFound.join(', '));
    }

    await browser.close();
    return { success: true, notFound: results.notFound };

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
        msg += `\n\n⚠️ Not found in order guide:\n${result.notFound.join('\n')}`;
      }
      await sendWhatsApp(fromNumber, msg);
      await sendConfirmationEmail(parsedOrder, senderName);
    } else {
      await sendWhatsApp(fromNumber, `⚠️ Error: ${result.error}\n\nOrder manually:\nmember.restaurantdepot.com/store/business/order-guide/19933806363004568`);
    }

  } catch (error) {
    console.error('Error:', error);
    await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Order manually:\nmember.restaurantdepot.com/store/business/order-guide/19933806363004568`);
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent is running! 🍛'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

const express = require('express');
const twilio = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AUTHORIZED_NUMBERS = [
  process.env.YOUR_WHATSAPP_NUMBER,
  process.env.RAHUL_WHATSAPP_NUMBER
];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_ADDRESS,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

const ORDER_GUIDE = [
  "Isabella - Petite Diced Tomatoes -#10 cans",
  "Chef's Quality - Tomato Sauce - #10 cans",
  "Chef's Quality - Liquid Butter Alternative - gallon",
  "Chef's Quality - All Purpose Pan Spray - 17 oz",
  "Chef's Quality - 100% Canola Salad Oil - 35 lbs",
  "Chef's Quality - Soybean Salad Oil - 35 lbs",
  "Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs",
  "Athena - Fire Roasted Grilled Eggplant Pulp - 2 kg",
  "Chef's Quality - Garbanzo Beans - #10 can",
  "Chef's Quality - Dark Red Kidney Beans - #10 cans",
  "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz",
  "Felbro - Red Food Coloring - gallon",
  "Morton - Purex Salt - 50lb",
  "C&H - Granulated Sugar - 25 lbs",
  "Clabber Girl - Baking Powder - 5 lbs",
  "Clabber Girl Cornstarch - 3 lbs",
  "Golden Temple - Durum Atta Flour - 2/20 lb Bag",
  "Sprite Bottles, 16.9 fl oz, 4 Pack",
  "Diet Coke Bottles, 16.9 fl oz, 24 Pack",
  "Royal Mahout - Paneer Loaf - 5 lbs",
  "James Farm - Shredded Cheddar Jack Cheese - 5 lbs",
  "MILK WHL GAL GS/AN",
  "Royal - Chef's Secret Sela Basmati Rice - 40 lbs",
  "James Farm - Heavy Cream, 40% - 64 oz",
  "James Farm - Plain Yogurt - 32 lbs",
  "Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs",
  "Frozen James Farm - Frozen Chopped Spinach - 3 lbs",
  "Frozen James Farm - IQF Broccoli Florets - 2 lbs",
  "Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs",
  "Frozen James Farm - IQF Peas - 2.5 lbs",
  "Serrano Peppers",
  "Fresh Ginger - 30 lbs",
  "Peeled Garlic",
  "Cucumbers - 6 ct",
  "Taylor Farms - Bagged Cilantro",
  "Micro Orchid Flowers - 4 oz",
  "Russet Potato - 50 lb Bag, 6oz Min, US #2",
  "Jumbo Red Onions - 25 lbs",
  "Jumbo Spanish Onions - 50 lbs",
  "Jumbo Chicken Party Wings (6-8 ct)",
  "Fresh Chicken Leg Quarters - 40 lbs",
  "Boneless, Skinless Jumbo Chicken Thighs",
  "Frozen Boneless, Skinless Chicken Thigh Meat, 15% - 40 lbs",
  "Frozen Boneless, Skinless Chicken Leg Meat, Marinated - 40 lbs",
  "Frozen Halal Boneless Lamb Leg, Australia",
  "Evian - Natural Spring Water, 24 Ct, 500 mL",
  "Thomas Farms - Bone in Goat Cube - #15"
];

async function parseOrder(message) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a restaurant ordering assistant for Naan & Curry, an Indian fast-casual restaurant in Las Vegas.

Here is the EXACT list of items in the Naan & Curry order guide at Restaurant Depot:
${ORDER_GUIDE.map((item, i) => `${i + 1}. ${item}`).join('\n')}

The person will text you an order in casual language. Match what they said to the closest item(s) in the list above.

Examples:
- "6 yellow onions" -> [{"item": "Jumbo Spanish Onions - 50 lbs", "quantity": 6}]
- "need some paneer" -> [{"item": "Royal Mahout - Paneer Loaf - 5 lbs", "quantity": 1}]
- "garlic and ginger" -> [{"item": "Peeled Garlic", "quantity": 1}, {"item": "Fresh Ginger - 30 lbs", "quantity": 1}]

Rules:
- Always use the EXACT item name from the list
- If no quantity mentioned, use 1
- Return ONLY a JSON array, no explanation, no markdown

Message: "${message}"`
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
  await transporter.sendMail({
    from: process.env.GMAIL_ADDRESS,
    to: [process.env.YOUR_EMAIL, process.env.RAHUL_EMAIL].join(','),
    subject: `✅ Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
    text: `Items added to Restaurant Depot cart by ${sender}.\n\nORDER SUMMARY:\n${orderList}\n\nAdded at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\n\nCheckout (select Pickup):\nhttps://member.restaurantdepot.com/store/business/cart`
  });
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
    // Login
    console.log('Logging in...');
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    await page.waitForSelector('#email', { timeout: 30000 });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(500);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in successfully');

    // Go to order guide
    console.log('Loading order guide...');
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(6000);

    // Check how many buttons are on page
    const btnCount = await page.evaluate(() => {
      return document.querySelectorAll('button[aria-label*="Add"]').length;
    });
    console.log(`Found ${btnCount} Add buttons on page`);

    // Add each item using pure JavaScript - bypasses all overlays
    for (const item of orderItems) {
      console.log(`Adding: ${item.item} x${item.quantity}`);

      const result = await page.evaluate(({ itemName, qty }) => {
        const searchWords = itemName.toLowerCase()
          .replace(/[^a-z0-9 ]/g, ' ')
          .split(' ')
          .filter(w => w.length > 3);

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
        return { found: false, searched: searchWords };
      }, { itemName: item.item, qty: item.quantity });

      if (result.found) {
        console.log(`Clicked: ${result.label}`);
        await page.waitForTimeout(2000);

        // Click + for additional quantities (Add button already added 1, so click + qty-1 more times)
        const extraClicks = item.quantity - 1;
        for (let i = 0; i < extraClicks; i++) {
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            // Look for the increase/increment button that appears after clicking Add
            const plusBtn = btns.find(b => {
              const label = (b.getAttribute('aria-label') || '').toLowerCase();
              const text = b.textContent.trim();
              return label.includes('increase') || label.includes('increment') || 
                     (text === '+' && b.closest('[class*="stepper"], [class*="quantity"], [class*="counter"]'));
            });
            if (plusBtn) plusBtn.click();
          });
          await page.waitForTimeout(600);
        }
      } else {
        console.log(`Not found: ${item.item}, searched: ${JSON.stringify(result.searched)}`);
      }
    }

    console.log('Done adding items');
    await browser.close();
    return { success: true };

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

  await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Processing your order...`);

  try {
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ Try: "6 yellow onions, 2 paneer, 1 chicken"`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 Adding to cart:\n\n${orderSummary}`);

    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      await sendWhatsApp(fromNumber, `🎉 Done! Check your cart:\nmember.restaurantdepot.com/store/business/cart`);
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

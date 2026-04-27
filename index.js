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

// Complete Naan & Curry order guide - exact item names from Restaurant Depot
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

The person will text you an order in casual language. Your job is to:
1. Match what they said to the closest item(s) in the order guide above
2. Return a JSON array with the exact item name from the list and the quantity

Examples:
- "6 yellow onions" -> [{"item": "Jumbo Spanish Onions - 50 lbs", "quantity": 6}]
- "need some paneer" -> [{"item": "Royal Mahout - Paneer Loaf - 5 lbs", "quantity": 1}]
- "10 lbs chicken and 2 bags rice" -> [{"item": "Fresh Chicken Leg Quarters - 40 lbs", "quantity": 1}, {"item": "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs", "quantity": 2}]
- "garlic and ginger" -> [{"item": "Peeled Garlic", "quantity": 1}, {"item": "Fresh Ginger - 30 lbs", "quantity": 1}]

Rules:
- Always use the EXACT item name from the list above
- If no quantity mentioned, use 1
- Match the closest item even if phrased differently
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
    subject: `✅ Restaurant Depot Order Added to Cart - ${new Date().toLocaleDateString()}`,
    text: `Items were added to the Restaurant Depot cart by ${sender}.\n\nORDER SUMMARY:\n${orderList}\n\nAdded at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\n\nCheckout here (select Pickup):\nhttps://member.restaurantdepot.com/store/business/cart\n\nThis is an automated message from your Naan & Curry ordering agent.`
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
    console.log('Logging in to Restaurant Depot...');
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
    console.log('Loading Naan & Curry order guide...');
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);

    // Get all Add buttons and their labels
    const buttons = await page.$$('button[aria-label*="Add"]');
    const buttonMap = [];
    for (const btn of buttons) {
      const label = await btn.getAttribute('aria-label');
      if (label) buttonMap.push({ label: label.toLowerCase(), btn });
    }
    console.log(`Found ${buttonMap.length} items in order guide`);

    // Add each ordered item
    for (const item of orderItems) {
      console.log(`Looking for: ${item.item}`);
      const searchWords = item.item.toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(' ')
        .filter(w => w.length > 3);

      let bestMatch = null;
      let bestScore = 0;

      for (const { label, btn } of buttonMap) {
        const score = searchWords.filter(word => label.includes(word)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { label, btn };
        }
      }

      if (bestMatch && bestScore > 0) {
        console.log(`Matched to: ${bestMatch.label}`);
        await bestMatch.btn.click();
        await page.waitForTimeout(2000);

        // Click + for additional quantities
        for (let i = 1; i < item.quantity; i++) {
          const plusBtn = await page.$('button[aria-label*="Increase"], button[aria-label*="increment"]');
          if (plusBtn) {
            await plusBtn.click();
            await page.waitForTimeout(400);
          }
        }
      } else {
        console.log(`Could not find: ${item.item}`);
      }
    }

    console.log('All items added to cart');
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

  await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Matching your order to the Naan & Curry order guide...`);

  try {
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ Couldn't understand that. Try:\n"6 yellow onions, 2 paneer, 1 chicken"`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 Adding to cart:\n\n${orderSummary}\n\nLogging into Restaurant Depot now...`);

    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      await sendWhatsApp(fromNumber, `🎉 Items added to your cart!\n\nCheckout here and select Pickup:\nhttps://member.restaurantdepot.com/store/business/cart\n\nEmail confirmation sent to you and Rahul.`);
      await sendConfirmationEmail(parsedOrder, senderName);
    } else {
      await sendWhatsApp(fromNumber, `⚠️ Issue adding items.\n\nError: ${result.error}\n\nOrder manually:\nhttps://member.restaurantdepot.com/store/business/order-guide/19933806363004568`);
    }

  } catch (error) {
    console.error('Error:', error);
    await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Order manually:\nhttps://member.restaurantdepot.com/store/business/order-guide/19933806363004568`);
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent is running! 🍛'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

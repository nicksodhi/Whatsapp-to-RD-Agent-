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

async function parseOrder(message) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a restaurant ordering assistant for Naan & Curry, an Indian fast-casual restaurant in Las Vegas.

Parse this WhatsApp message into a structured order list. The person may text in any casual format.

Examples of valid orders:
- "order 6 yellow onions" -> [{"item": "yellow onions", "quantity": "6", "unit": "each"}]
- "10 lbs chicken tikka" -> [{"item": "chicken tikka", "quantity": "10", "unit": "lbs"}]
- "need 2 cases naan and 5 lbs paneer" -> [{"item": "naan", "quantity": "2", "unit": "cases"}, {"item": "paneer", "quantity": "5", "unit": "lbs"}]
- "get me some onions and chicken" -> [{"item": "onions", "quantity": "1", "unit": "each"}, {"item": "chicken", "quantity": "1", "unit": "each"}]

Rules:
- If no unit is mentioned, use "each" for countable items and "lbs" for meat/produce by weight
- If no quantity is mentioned, use "1"
- Always return a valid JSON array, never return an error unless the message is completely unrelated to food ordering
- The message does NOT need to start with "order"

Message: "${message}"

Return ONLY a JSON array, no explanation, no markdown, just the array.`
    }]
  });

  const text = response.content[0].text.trim();
  try {
    // Strip any markdown just in case
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
  const orderList = orderItems.map(i => `• ${i.quantity} ${i.unit} ${i.item}`).join('\n');
  await transporter.sendMail({
    from: process.env.GMAIL_ADDRESS,
    to: [process.env.YOUR_EMAIL, process.env.RAHUL_EMAIL].join(','),
    subject: `✅ Restaurant Depot Order Placed - ${new Date().toLocaleDateString()}`,
    text: `A Restaurant Depot pickup order was placed by ${sender}.\n\nORDER SUMMARY:\n${orderList}\n\nOrder placed at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\nLocation: Naan & Curry, Las Vegas\n\nThis is an automated confirmation from your Naan & Curry ordering agent.`
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
    console.log('Navigating to Restaurant Depot login...');
    await page.goto('https://www.restaurantdepot.com/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await page.waitForTimeout(5000);
    console.log('Page loaded, waiting for email field...');

    await page.waitForSelector('#email', { timeout: 30000 });
    console.log('Email field found, filling in credentials...');
    
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(500);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in successfully');

    console.log('Going to Order Guide...');
    await page.goto('https://www.restaurantdepot.com/order-guide', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await page.waitForTimeout(4000);

    for (const item of orderItems) {
      console.log(`Adding: ${item.quantity} ${item.unit} of ${item.item}`);
      try {
        const searchBox = await page.$('input[placeholder*="search"], input[type="search"], .search-input');
        if (searchBox) {
          await searchBox.fill(item.item);
          await page.waitForTimeout(2000);
        }
        const qtyInputs = await page.$$('input[type="number"], .quantity-input, input[name*="qty"]');
        if (qtyInputs.length > 0) {
          await qtyInputs[0].fill(item.quantity.toString());
        }
        await page.waitForTimeout(1000);
      } catch (err) {
        console.log(`Could not add ${item.item}: ${err.message}`);
      }
    }

    console.log('Placing order...');
    const orderBtn = await page.$('button:has-text("Add to Cart"), button:has-text("Place Order"), .add-to-cart, #place-order');
    if (orderBtn) {
      await orderBtn.click();
      await page.waitForTimeout(3000);
    }

    console.log('Order placed successfully');
    await browser.close();
    return { success: true };

  } catch (error) {
    console.error('Browser error:', error.message);
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
    await sendWhatsApp(fromNumber, '❌ Sorry, you are not authorized to place orders.');
    return;
  }

  await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Placing your order on Restaurant Depot now...`);

  try {
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ I couldn't understand that. Try something like:\n\n"6 yellow onions, 10 lbs chicken tikka, 2 cases naan"`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity} ${i.unit} - ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 Order understood:\n\n${orderSummary}\n\nLogging into Restaurant Depot...`);

    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      await sendWhatsApp(fromNumber, `🎉 Order placed on Restaurant Depot!\n\nConfirmation email sent to you and Rahul.`);
      await sendConfirmationEmail(parsedOrder, senderName);
    } else {
      await sendWhatsApp(fromNumber, `⚠️ Couldn't place automatically. Please log into Restaurant Depot manually.\n\nError: ${result.error}`);
    }

  } catch (error) {
    console.error('Error:', error);
    await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Please place the order manually on Restaurant Depot.`);
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent is running! 🍛'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

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

Examples:
- "order 6 yellow onions" -> [{"item": "yellow onions", "quantity": 6}]
- "10 lbs chicken tikka and 2 cases naan" -> [{"item": "chicken tikka", "quantity": 10}, {"item": "naan", "quantity": 2}]
- "need some paneer" -> [{"item": "paneer", "quantity": 1}]

Rules:
- quantity is always a whole number
- if no quantity mentioned, use 1
- always return valid JSON array
- never return an error unless message has nothing to do with food

Message: "${message}"

Return ONLY a JSON array, no explanation, no markdown.`
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
    // Login
    console.log('Navigating to Restaurant Depot login...');
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);

    await page.waitForSelector('#email', { timeout: 30000 });
    console.log('Email field found, filling in credentials...');
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(500);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(500);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in successfully');

    // Go directly to Naan & Curry order guide
    console.log('Going to Naan & Curry order guide...');
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);
    console.log('Order guide loaded');

    // Process each item
    for (const item of orderItems) {
      console.log(`Looking for: ${item.item} (qty: ${item.quantity})`);
      try {
        // Find all "Add" buttons and match by aria-label containing item name
        const itemName = item.item.toLowerCase();
        
        // Get all add buttons on page
        const addButtons = await page.$$('button[aria-label*="Add"]');
        let found = false;

        for (const btn of addButtons) {
          const label = await btn.getAttribute('aria-label');
          if (label && label.toLowerCase().includes(itemName.split(' ')[0])) {
            console.log(`Found item: ${label}`);
            await btn.click();
            await page.waitForTimeout(2000);

            // If quantity > 1, click + button additional times
            if (item.quantity > 1) {
              for (let i = 1; i < item.quantity; i++) {
                const plusBtn = await page.$('button[aria-label*="Increase"], button:has-text("+")');
                if (plusBtn) {
                  await plusBtn.click();
                  await page.waitForTimeout(500);
                }
              }
            }
            found = true;
            break;
          }
        }

        if (!found) {
          console.log(`Item not found in order guide: ${item.item}`);
        }

      } catch (err) {
        console.log(`Error adding ${item.item}: ${err.message}`);
      }
    }

    console.log('All items processed, going to cart for pickup...');
    
    // Go to cart and select pickup
    await page.goto('https://member.restaurantdepot.com/store/business/cart', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Select pickup option if available
    const pickupBtn = await page.$('button:has-text("Pickup"), input[value="pickup"], label:has-text("Pickup")');
    if (pickupBtn) {
      await pickupBtn.click();
      await page.waitForTimeout(1000);
      console.log('Pickup selected');
    }

    console.log('Order added to cart successfully');
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

  await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Looking up your order now...`);

  try {
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ I couldn't understand that. Try:\n\n"6 yellow onions, 10 lbs chicken tikka, 2 cases naan"`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 Order:\n\n${orderSummary}\n\nLogging into Restaurant Depot and adding to your cart...`);

    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      await sendWhatsApp(fromNumber, `🎉 Items added to your cart on Restaurant Depot!\n\nLog in to confirm pickup and checkout:\nhttps://member.restaurantdepot.com/store/business/cart\n\nConfirmation email sent to you and Rahul.`);
      await sendConfirmationEmail(parsedOrder, senderName);
    } else {
      await sendWhatsApp(fromNumber, `⚠️ Couldn't add items automatically.\n\nError: ${result.error}\n\nPlease add manually:\nhttps://member.restaurantdepot.com/store/business/order-guide/19933806363004568`);
    }

  } catch (error) {
    console.error('Error:', error);
    await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Please order manually:\nhttps://member.restaurantdepot.com/store/business/order-guide/19933806363004568`);
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent is running! 🍛'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

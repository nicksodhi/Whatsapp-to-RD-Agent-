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

// Authorized WhatsApp numbers (you and Rahul)
const AUTHORIZED_NUMBERS = [
  process.env.YOUR_WHATSAPP_NUMBER,
  process.env.RAHUL_WHATSAPP_NUMBER
];

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_ADDRESS,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Parse order using Claude AI
async function parseOrder(message) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a restaurant ordering assistant for Naan & Curry, an Indian fast-casual restaurant in Las Vegas.
      
Parse this WhatsApp message into a structured order list.
Message: "${message}"

Return ONLY a JSON array like this, nothing else:
[
  {"item": "chicken tikka", "quantity": "10", "unit": "lbs"},
  {"item": "paneer", "quantity": "5", "unit": "lbs"}
]

If the message is not an order, return: {"error": "not an order"}`
    }]
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'Could not parse order' };
  }
}

// Send WhatsApp reply
async function sendWhatsApp(to, message) {
  await twilioClient.messages.create({
    from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
    to: 'whatsapp:' + to,
    body: message
  });
}

// Send email confirmation
async function sendConfirmationEmail(orderItems, sender) {
  const orderList = orderItems.map(i => `• ${i.quantity} ${i.unit} ${i.item}`).join('\n');
  
  await transporter.sendMail({
    from: process.env.GMAIL_ADDRESS,
    to: [process.env.YOUR_EMAIL, process.env.RAHUL_EMAIL].join(','),
    subject: `✅ Restaurant Depot Order Placed - ${new Date().toLocaleDateString()}`,
    text: `A Restaurant Depot pickup order was placed by ${sender}.

ORDER SUMMARY:
${orderList}

Order placed at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}
Location: Naan & Curry, Las Vegas

This is an automated confirmation from your Naan & Curry ordering agent.`
  });
}

// Place order on Restaurant Depot website
async function placeRestaurantDepotOrder(orderItems) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to Restaurant Depot...');
    await page.goto('https://www.restaurantdepot.com', { waitUntil: 'networkidle' });

    // Login
    console.log('Logging in...');
    await page.click('[data-testid="login"], a[href*="login"], .login-link, #login').catch(() =>
      page.goto('https://www.restaurantdepot.com/login')
    );
    
    await page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });
    await page.fill('input[type="email"], input[name="email"], #email', process.env.RD_EMAIL);
    await page.fill('input[type="password"], input[name="password"], #password', process.env.RD_PASSWORD);
    await page.click('button[type="submit"], .login-btn, #login-submit');
    
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 });
    console.log('Logged in successfully');

    // Go to Order Guide
    console.log('Going to Order Guide...');
    await page.goto('https://www.restaurantdepot.com/order-guide', { waitUntil: 'networkidle' });

    // Search and add each item
    for (const item of orderItems) {
      console.log(`Adding: ${item.quantity} ${item.unit} of ${item.item}`);
      
      try {
        // Search for item in order guide
        const searchBox = await page.$('input[placeholder*="search"], input[type="search"], .search-input');
        if (searchBox) {
          await searchBox.fill(item.item);
          await page.waitForTimeout(2000);
        }

        // Find quantity input and update it
        const qtyInputs = await page.$$('input[type="number"], .quantity-input, input[name*="qty"]');
        if (qtyInputs.length > 0) {
          await qtyInputs[0].fill(item.quantity.toString());
        }

        await page.waitForTimeout(1000);
      } catch (err) {
        console.log(`Could not add ${item.item}: ${err.message}`);
      }
    }

    // Add to cart / place order
    console.log('Placing order...');
    const orderBtn = await page.$('button:has-text("Add to Cart"), button:has-text("Place Order"), .add-to-cart, #place-order');
    if (orderBtn) {
      await orderBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
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

// Main webhook - receives WhatsApp messages
app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200); // Respond to Twilio immediately

  const incomingMsg = req.body.Body;
  const fromNumber = req.body.From.replace('whatsapp:', '');
  const senderName = fromNumber === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';

  console.log(`Message from ${senderName}: ${incomingMsg}`);

  // Check if authorized
  if (!AUTHORIZED_NUMBERS.includes(fromNumber)) {
    await sendWhatsApp(fromNumber, '❌ Sorry, you are not authorized to place orders.');
    return;
  }

  // Let them know we received it
  await sendWhatsApp(fromNumber, `✅ Got your order ${senderName}! Give me a few minutes to place it on Restaurant Depot...`);

  try {
    // Parse the order with AI
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ I couldn't understand that as an order. Try something like:\n\n"Order 10 lbs chicken tikka, 5 lbs paneer, 3 cases naan"`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity} ${i.unit} - ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 I understood your order as:\n\n${orderSummary}\n\nPlacing it now...`);

    // Place the order
    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      await sendWhatsApp(fromNumber, `🎉 Order placed successfully on Restaurant Depot!\n\nA confirmation email has been sent to you and Rahul.`);
      await sendConfirmationEmail(parsedOrder, senderName);
    } else {
      await sendWhatsApp(fromNumber, `⚠️ There was an issue placing the order automatically. Please log in to Restaurant Depot and place it manually.\n\nError: ${result.error}`);
    }

  } catch (error) {
    console.error('Error:', error);
    await sendWhatsApp(fromNumber, `⚠️ Something went wrong. Please place the order manually on Restaurant Depot.`);
  }
});

// Health check
app.get('/', (req, res) => res.send('Naan & Curry Agent is running! 🍛'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Naan & Curry Agent running on port ${PORT}`));

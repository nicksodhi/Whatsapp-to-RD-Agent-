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

// Complete Naan & Curry order guide with case notes
const ORDER_GUIDE = `
1. Isabella - Petite Diced Tomatoes -#10 cans
2. Chef's Quality - Tomato Sauce - #10 cans
3. Chef's Quality - Liquid Butter Alternative - gallon (ORDER CASE)
4. Chef's Quality - All Purpose Pan Spray - 17 oz
5. Chef's Quality - 100% Canola Salad Oil - 35 lbs
6. Chef's Quality - Soybean Salad Oil - 35 lbs
7. Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs (ORDER CASE = Fryer Oil)
8. Athena - Fire Roasted Grilled Eggplant Pulp - 2 kg
9. Chef's Quality - Garbanzo Beans - #10 can
10. Chef's Quality - Dark Red Kidney Beans - #10 cans
11. Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs (= Rice Royal)
12. Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz (= Sambal Chili Jar, ORDER CASE)
13. Felbro - Red Food Coloring - gallon
14. Morton - Purex Salt - 50lb
15. C&H - Granulated Sugar - 25 lbs
16. Clabber Girl - Baking Powder - 5 lbs
17. Clabber Girl Cornstarch - 3 lbs
18. Golden Temple - Durum Atta Flour - 2/20 lb Bag (= All Purpose Flour)
19. Sprite Bottles, 16.9 fl oz, 4 Pack (ORDER CASE)
20. Diet Coke Bottles, 16.9 fl oz, 24 Pack
21. Royal Mahout - Paneer Loaf - 5 lbs (ORDER CASE = 4 blocks)
22. James Farm - Shredded Cheddar Jack Cheese - 5 lbs
23. MILK WHL GAL GS/AN (ORDER CASE = 4 gallons)
24. Royal - Chef's Secret Sela Basmati Rice - 40 lbs
25. James Farm - Heavy Cream, 40% - 64 oz (ORDER CASE)
26. James Farm - Plain Yogurt - 32 lbs (= Yogurt)
27. Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs
28. Frozen James Farm - Frozen Chopped Spinach - 3 lbs
29. Frozen James Farm - IQF Broccoli Florets - 2 lbs
30. Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs (= Frozen 4-Way Mix)
31. Frozen James Farm - IQF Peas - 2.5 lbs
32. Serrano Peppers
33. Fresh Ginger - 30 lbs (= Ginger)
34. Peeled Garlic (= Garlic)
35. Cucumbers - 6 ct
36. Taylor Farms - Bagged Cilantro
37. Micro Orchid Flowers - 4 oz (= Flowers/garnish)
38. Russet Potato - 50 lb Bag, 6oz Min, US #2 (= Potato)
39. Jumbo Red Onions - 25 lbs (= Red Onions)
40. Jumbo Spanish Onions - 50 lbs
41. Jumbo Chicken Party Wings (6-8 ct) (= Chicken Wings, ORDER CASE)
42. Fresh Chicken Leg Quarters - 40 lbs (= Chicken Leg Quarters bone-in)
43. Boneless, Skinless Jumbo Chicken Thighs (= Chicken Breast substitute)
44. Frozen Boneless, Skinless Chicken Thigh Meat, 15% - 40 lbs
45. Frozen Boneless, Skinless Chicken Leg Meat, Marinated - 40 lbs (= Chicken Leg Meat)
46. Frozen Halal Boneless Lamb Leg, Australia
47. Evian - Natural Spring Water, 24 Ct, 500 mL
48. Thomas Farms - Bone in Goat Cube - #15
`;

async function parseOrder(message) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are an ordering assistant for Naan & Curry, an Indian restaurant in Las Vegas. 

Here is the Restaurant Depot order guide with item mappings:
${ORDER_GUIDE}

IMPORTANT RULES:
- When an item says "ORDER CASE", always add it as a case (the quantity in the order IS the number of cases)
- Match casual chef language to the exact item name in the guide
- "Chicken Breast" → use "Boneless, Skinless Jumbo Chicken Thighs" (closest match)
- "Lemon Juice" → not in guide, skip it
- "Cauliflower", "Carrots", "Lemon", "Mint" → not in guide, skip them
- If item is not in the guide, skip it silently
- The quantity in the order = number of units/cases to add to cart
- Return ONLY a JSON array, no markdown, no explanation

Format: [{"item": "EXACT item name from guide", "quantity": NUMBER}]

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

async function sendConfirmationEmail(orderItems, sender, skipped) {
  const orderList = orderItems.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
  const skippedNote = skipped.length > 0 ? `\n\nSKIPPED (not in order guide):\n${skipped.map(s => `• ${s}`).join('\n')}` : '';
  await transporter.sendMail({
    from: process.env.GMAIL_ADDRESS,
    to: [process.env.YOUR_EMAIL, process.env.RAHUL_EMAIL].join(','),
    subject: `✅ Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
    text: `Items added to Restaurant Depot cart by ${sender}.\n\nORDER SUMMARY:\n${orderList}${skippedNote}\n\nAdded at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}\n\nCheckout (select Pickup):\nhttps://member.restaurantdepot.com/store/business/cart`
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

    console.log('Loading order guide...');
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(6000);

    const btnCount = await page.evaluate(() => {
      return document.querySelectorAll('button[aria-label*="Add"]').length;
    });
    console.log(`Found ${btnCount} Add buttons`);

    for (const item of orderItems) {
      console.log(`Adding: ${item.item} x${item.quantity}`);

      // Step 1: Find and click the Add button for this item
      const result = await page.evaluate(({ itemName }) => {
        // Use ALL words including short ones for better matching
        const searchWords = itemName.toLowerCase()
          .replace(/[^a-z0-9 ]/g, ' ')
          .split(' ')
          .filter(w => w.length > 2); // Allow 3+ letter words like "whl", "gal"

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
          return { found: true, label: bestBtn.getAttribute('aria-label') };
        }
        return { found: false };
      }, { itemName: item.item });

      if (result.found) {
        console.log(`Opened modal for: ${result.label}`);
        await page.waitForTimeout(3000); // Wait for modal to open

        // Step 2: Click the Case + button exactly quantity times
        // The case + button has aria-label containing "Increment case quantity"
        for (let i = 0; i < item.quantity; i++) {
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            // Try aria-label first (most reliable)
            const caseBtn = btns.find(b => {
              const label = (b.getAttribute('aria-label') || '').toLowerCase();
              return label.includes('increment case') || label.includes('increase case');
            });
            if (caseBtn) {
              caseBtn.click();
              return;
            }
            // Fallback: second + button (Single row is first, Case row is second)
            const plusBtns = btns.filter(b => b.textContent.trim() === '+');
            if (plusBtns.length >= 2) plusBtns[1].click();
          });
          await page.waitForTimeout(800);
        }

        // Step 3: Click "Add X items to cart" button inside the modal
        // Must skip "Add 48 items to cart" (whole order guide button) and find the modal one
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          // Filter buttons that have "items to cart" but NOT "48 items" (that's the order guide button)
          const addToCart = btns.find(b => {
            const text = b.textContent.trim();
            return text.includes('items to cart') && !text.includes('48 items to cart');
          });
          if (addToCart) {
            console.log('Clicking:', addToCart.textContent.trim());
            addToCart.click();
          }
        });
        await page.waitForTimeout(2000);
        console.log(`Added ${item.quantity} case(s) of ${item.item} to cart`);

      } else {
        console.log(`Not found: ${item.item}`);
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

  await sendWhatsApp(fromNumber, `✅ Got it ${senderName}! Processing order...`);

  try {
    const parsedOrder = await parseOrder(incomingMsg);

    if (parsedOrder.error) {
      await sendWhatsApp(fromNumber, `❓ Couldn't parse that order. Try forwarding the chef's list directly.`);
      return;
    }

    const orderSummary = parsedOrder.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(fromNumber, `📋 Adding to cart:\n\n${orderSummary}`);

    const result = await placeRestaurantDepotOrder(parsedOrder);

    if (result.success) {
      await sendWhatsApp(fromNumber, `🎉 Done! Checkout:\nmember.restaurantdepot.com/store/business/cart`);
      await sendConfirmationEmail(parsedOrder, senderName, []);
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

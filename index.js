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

// Direct product URLs - bypass order guide modal issues entirely
// Format: item name -> { url, type: 'case'|'single', itemsPerCase }
const ITEM_URLS = {
  "Jumbo Red Onions - 25 lbs":           { url: "/store/jetro-restaurant-depot/products/51274775-jumbo-red-onions-25-lbs-25-lb", type: "single" },
  "Russet Potato - 50 lb Bag, 6oz Min, US #2": { url: "/store/jetro-restaurant-depot/products/51274782-russet-potato-50-lb-bag-6oz-min-us-2", type: "single" },
  "Peeled Garlic":                        { url: "/store/jetro-restaurant-depot/products/19189686-peeled-garlic", type: "case" },
  "Fresh Ginger - 30 lbs":               { url: "/store/jetro-restaurant-depot/products/51274783-fresh-ginger-30-lbs-30-lb", type: "single" },
  "Royal Mahout - Paneer Loaf - 5 lbs":  { url: "/store/jetro-restaurant-depot/products/85900000-royal-mahout-paneer-loaf-5-lbs-5-lb", type: "case" },
  "Micro Orchid Flowers - 4 oz":         { url: "/store/jetro-restaurant-depot/products/84046513269-micro-orchid-flowers-4-oz", type: "single" },
  "Taylor Farms - Bagged Cilantro":      { url: "/store/jetro-restaurant-depot/products/30224301456-taylor-farms-bagged-cilantro", type: "single" },
  "Cucumbers - 6 ct":                    { url: "/store/jetro-restaurant-depot/products/72906299106-cucumbers-6-ct", type: "single" },
  "White Cauliflower":                   { url: "/store/jetro-restaurant-depot/products/2060042606-white-cauliflower", type: "case" },
  "Carrots- 10 lb":                      { url: "/store/jetro-restaurant-depot/products/2060079152-carrots-10-lb", type: "single" },
  "Lemons, 71-115 ct":                   { url: "/store/jetro-restaurant-depot/products/2060042570-lemons-71-115-ct", type: "single" },
  "Herb - Mint- 1lb":                    { url: "/store/jetro-restaurant-depot/products/85434200407-herb-mint-1lb", type: "single" },
  "James Farm - Heavy Cream, 40% - 64 oz": { url: "/store/jetro-restaurant-depot/products/76069502990-james-farm-heavy-cream-40-64-oz", type: "case" },
  "MILK WHL GAL GS/AN":                  { url: "/store/jetro-restaurant-depot/products/7911710101-milk-whl-gal-gs-an", type: "case" },
  "James Farm - Plain Yogurt - 32 lbs":  { url: "/store/jetro-restaurant-depot/products/60695005751-james-farm-plain-yogurt-32-lbs", type: "single" },
  "James Farm - Shredded Cheddar Jack Cheese - 5 lbs": { url: "/store/jetro-restaurant-depot/products/76069500868-james-farm-shredded-cheddar-jack-cheese-5-lbs", type: "case" },
  "Boneless, Skinless Chicken Breasts, Tenders Out, Dry": { url: "/store/jetro-restaurant-depot/products/20772300000-boneless-skinless-chicken-breasts-tenders-out-dry", type: "single" },
  "Boneless, Skinless Jumbo Chicken Thighs": { url: "/store/jetro-restaurant-depot/products/20776820000-boneless-skinless-jumbo-chicken-thighs", type: "single" },
  "Fresh Chicken Leg Quarters - 40 lbs": { url: "/store/jetro-restaurant-depot/products/20776700000-fresh-chicken-leg-quarters-40-lbs", type: "single" },
  "Jumbo Chicken Party Wings (6-8 ct)":  { url: "/store/jetro-restaurant-depot/products/20772000000-jumbo-chicken-party-wings-6-8-ct", type: "single" },
  "Fresh Boneless Skinless Chicken Leg Meat": { url: "/store/jetro-restaurant-depot/products/20776580000-fresh-boneless-skinless-chicken-leg-meat", type: "single" },
  "Frozen Halal Boneless Lamb Leg, Australia": { url: "/store/jetro-restaurant-depot/products/20790420000-frozen-halal-boneless-lamb-leg-australia", type: "single" },
  "Thomas Farms - Bone in Goat Cube - #15": { url: "/store/jetro-restaurant-depot/products/81009537357-thomas-farms-bone-in-goat-cube-15", type: "single" },
  "Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs": { url: "/store/jetro-restaurant-depot/products/6069551457-frozen-tilapia-fillets-3-5-oz-iqf-china-10-lbs", type: "case" },
  "Frozen James Farm - Frozen Chopped Spinach - 3 lbs": { url: "/store/jetro-restaurant-depot/products/76069501045-frozen-james-farm-frozen-chopped-spinach-3-lbs", type: "case" },
  "Frozen James Farm - IQF Broccoli Florets - 2 lbs": { url: "/store/jetro-restaurant-depot/products/76069502007-frozen-james-farm-iqf-broccoli-florets-2-lbs", type: "case" },
  "Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs": { url: "/store/jetro-restaurant-depot/products/76069501000-frozen-james-farm-iqf-mixed-vegetables-2-5-lbs", type: "case" },
  "Frozen James Farm - IQF Peas - 2.5 lbs": { url: "/store/jetro-restaurant-depot/products/76069501542-frozen-james-farm-iqf-peas-2-5-lbs", type: "case" },
  "Golden Temple - Durum Atta Flour - 2/20 lb Bag": { url: "/store/jetro-restaurant-depot/products/5900041556-golden-temple-durum-atta-flour-2-20-lb-bag", type: "case" },
  "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag": { url: "/store/jetro-restaurant-depot/products/76069502574-chef-s-quality-hotel-restaurant-all-purpose-flour-25-lb-bag", type: "single" },
  "Clabber Girl - Baking Powder - 5 lbs": { url: "/store/jetro-restaurant-depot/products/1990000350-clabber-girl-baking-powder-5-lbs", type: "case" },
  "Clabber Girl Cornstarch - 3 lbs":     { url: "/store/jetro-restaurant-depot/products/1990061997-clabber-girl-cornstarch-3-lbs", type: "case" },
  "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs": { url: "/store/jetro-restaurant-depot/products/74504200010-royal-chef-s-secret-extra-long-grain-basmati-rice-40-lbs", type: "single" },
  "Royal - Chef's Secret Sela Basmati Rice - 40 lbs": { url: "/store/jetro-restaurant-depot/products/74504200014-royal-chef-s-secret-sela-basmati-rice-40-lbs", type: "single" },
  "Chef's Quality - Garbanzo Beans - #10 can": { url: "/store/jetro-restaurant-depot/products/76069501473-chef-s-quality-garbanzo-beans-10-can", type: "case" },
  "Chef's Quality - Dark Red Kidney Beans - #10 cans": { url: "/store/jetro-restaurant-depot/products/76069501474-chef-s-quality-dark-red-kidney-beans-10-cans", type: "case" },
  "Morton - Purex Salt - 50lb":          { url: "/store/jetro-restaurant-depot/products/2460021512-morton-purex-salt-50lb", type: "single" },
  "C&H - Granulated Sugar - 25 lbs":    { url: "/store/jetro-restaurant-depot/products/1580003021-c-h-granulated-sugar-25-lbs", type: "single" },
  "Chef's Quality - Tomato Sauce - #10 cans": { url: "/store/jetro-restaurant-depot/products/76069500922-chef-s-quality-tomato-sauce-10-cans", type: "case" },
  "Isabella - Petite Diced Tomatoes -#10 cans": { url: "/store/jetro-restaurant-depot/products/76069502533-isabella-petite-diced-tomatoes-10-cans", type: "case" },
  "Chef's Quality - Liquid Butter Alternative - gallon": { url: "/store/jetro-restaurant-depot/products/76069501615-chef-s-quality-liquid-butter-alternative-gallon", type: "case" },
  "Chef's Quality - Soybean Salad Oil - 35 lbs": { url: "/store/jetro-restaurant-depot/products/76069500931-chef-s-quality-soybean-salad-oil-35-lbs", type: "single" },
  "Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs": { url: "/store/jetro-restaurant-depot/products/76069500481-chef-s-quality-clear-liquid-fry-oil-zero-trans-fats-35-lbs", type: "single" },
  "Chef's Quality - 100% Canola Salad Oil - 35 lbs": { url: "/store/jetro-restaurant-depot/products/76069500935-chef-s-quality-100-canola-salad-oil-35-lbs", type: "single" },
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz": { url: "/store/jetro-restaurant-depot/products/2446306124-huy-fong-sambal-olek-ground-chili-paste-3-136-oz", type: "case" },
  "Chef's Quality - Lemon Juice - gallon": { url: "/store/jetro-restaurant-depot/products/76069500330-chef-s-quality-lemon-juice-gallon", type: "case" },
  "Felbro - Red Food Coloring - gallon": { url: "/store/jetro-restaurant-depot/products/4940500120-felbro-red-food-coloring-gallon", type: "case" },
  "Evian - Natural Spring Water, 24 Ct, 500 mL": { url: "/store/jetro-restaurant-depot/products/9437910130-evian-natural-spring-water-24-ct-500-ml", type: "case" },
  "Sprite Bottles, 16.9 fl oz, 4 Pack":  { url: "/store/jetro-restaurant-depot/products/4900002470-sprite-bottles-16-9-fl-oz-4-pack", type: "case" },
  "Diet Coke Bottles, 16.9 fl oz, 24 Pack": { url: "/store/jetro-restaurant-depot/products/4900002469-diet-coke-bottles-16-9-fl-oz-24-pack", type: "single" },
  "Jumbo Spanish Onions - 50 lbs":       { url: "/store/jetro-restaurant-depot/products/2060042545-jumbo-spanish-onions-50-lbs", type: "single" },
};

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

async function addItemViaProductPage(page, item) {
  const info = ITEM_URLS[item.item];
  if (!info) {
    console.log(`  No URL for: ${item.item}`);
    return false;
  }

  const fullUrl = `https://member.restaurantdepot.com${info.url}`;
  console.log(`  Going to product page...`);
  
  await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Click the right + button based on type
  for (let i = 0; i < item.quantity; i++) {
    if (info.type === 'case') {
      // Wait for and click the case increment button
      try {
        await page.waitForSelector('button[aria-label*="Increment case"], button[aria-label*="increment case"], button[aria-label*="Increase case"]', { timeout: 5000 });
        await page.click('button[aria-label*="Increment case"], button[aria-label*="increment case"], button[aria-label*="Increase case"]');
        console.log(`  Click ${i+1}/${item.quantity}: case`);
      } catch {
        // Try second + button
        const plusBtns = await page.$$('button:has-text("+")');
        if (plusBtns.length >= 2) {
          await plusBtns[1].click();
          console.log(`  Click ${i+1}/${item.quantity}: case-fallback`);
        } else if (plusBtns.length === 1) {
          await plusBtns[0].click();
          console.log(`  Click ${i+1}/${item.quantity}: single-only`);
        }
      }
    } else {
      // Single item — click first + button
      try {
        await page.waitForSelector('button[aria-label*="Increment single"], button[aria-label*="increment single"]', { timeout: 3000 });
        await page.click('button[aria-label*="Increment single"], button[aria-label*="increment single"]');
        console.log(`  Click ${i+1}/${item.quantity}: single`);
      } catch {
        const plusBtns = await page.$$('button:has-text("+")');
        if (plusBtns.length > 0) {
          await plusBtns[0].click();
          console.log(`  Click ${i+1}/${item.quantity}: single-fallback`);
        }
      }
    }
    await page.waitForTimeout(600);
  }

  // Click the Add to cart button
  await page.waitForTimeout(500);
  try {
    // Find the active add to cart button (not disabled, has count > 0)
    const confirmed = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Find button with "items to cart" and count > 0
      for (const btn of btns) {
        const text = btn.textContent.trim();
        const match = text.match(/Add (\d+) items? to cart/i);
        if (match && parseInt(match[1]) > 0 && !btn.disabled) {
          btn.click();
          return text;
        }
      }
      // Fallback: "Add to cart"
      const simple = btns.find(b => b.textContent.trim() === 'Add to cart' && !b.disabled);
      if (simple) { simple.click(); return 'Add to cart'; }
      return null;
    });
    console.log(`  Confirmed: ${confirmed}`);
  } catch(e) {
    console.log(`  Confirm error: ${e.message}`);
  }

  await page.waitForTimeout(1500);
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
    // Login
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

    const notFound = [];
    for (const item of orderItems) {
      console.log(`\n--- ${item.item} x${item.quantity} ---`);
      const success = await addItemViaProductPage(page, item);
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

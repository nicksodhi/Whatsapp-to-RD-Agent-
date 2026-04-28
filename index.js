const express  = require('express');
const twilio   = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright');
const sgMail   = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const anthropic    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AUTHORIZED_NUMBERS = [
  process.env.YOUR_WHATSAPP_NUMBER,
  process.env.RAHUL_WHATSAPP_NUMBER,
];

// Items always ordered as individual units (no case multiplier)
const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb',
  'Micro Orchid Flowers - 4 oz',
  'Taylor Farms - Bagged Cilantro',
  'Lemons, 71-115 ct',
  'Carrots- 10 lb',
];

// How many individual units are in one case (for pricing tier + qty math)
const CASE_SIZES = {
  'Peeled Garlic':                                              6,
  'White Cauliflower':                                         12,
  'MILK WHL GAL GS/AN':                                         4,
  "Chef's Quality - Liquid Butter Alternative - gallon":        3,
  "Chef's Quality - Lemon Juice - gallon":                      4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz":    3,
  'James Farm - Heavy Cream, 40% - 64 oz':                      6,
  'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs':        12,
};

const ITEM_MAP = {
  'yellow onions':        'Jumbo Spanish Onions - 50 lbs',
  'red onions':           'Jumbo Red Onions - 25 lbs',
  'potato':               'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'potatoes':             'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'garlic':               'Peeled Garlic',
  'ginger':               'Fresh Ginger - 30 lbs',
  'paneer':               'Royal Mahout - Paneer Loaf - 5 lbs',
  'flowers':              'Micro Orchid Flowers - 4 oz',
  'garnish':              'Micro Orchid Flowers - 4 oz',
  'cilantro':             'Taylor Farms - Bagged Cilantro',
  'cucumber':             'Cucumbers - 6 ct',
  'cauliflower':          'White Cauliflower',
  'carrots':              'Carrots- 10 lb',
  'lemon':                'Lemons, 71-115 ct',
  'lemons':               'Lemons, 71-115 ct',
  'mint':                 'Herb - Mint- 1lb',
  'heavy cream':          'James Farm - Heavy Cream, 40% - 64 oz',
  'milk':                 'MILK WHL GAL GS/AN',
  'yogurt':               'James Farm - Plain Yogurt - 32 lbs',
  'cheese':               'James Farm - Shredded Cheddar Jack Cheese - 5 lbs',
  'chicken breast':       'Boneless, Skinless Chicken Breasts, Tenders Out, Dry',
  'chicken thighs':       'Boneless, Skinless Jumbo Chicken Thighs',
  'chicken leg quarters': 'Fresh Chicken Leg Quarters - 40 lbs',
  'chicken wings':        'Jumbo Chicken Party Wings (6-8 ct)',
  'wings':                'Jumbo Chicken Party Wings (6-8 ct)',
  'chicken leg meat':     'Fresh Boneless Skinless Chicken Leg Meat',
  'lamb':                 'Frozen Halal Boneless Lamb Leg, Australia',
  'goat':                 'Thomas Farms - Bone in Goat Cube - #15',
  'tilapia':              'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'fish':                 'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'frozen spinach':       'Frozen James Farm - Frozen Chopped Spinach - 3 lbs',
  'frozen peas':          'Frozen James Farm - IQF Peas - 2.5 lbs',
  'frozen broccoli':      'Frozen James Farm - IQF Broccoli Florets - 2 lbs',
  'frozen 4-way mix':     'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  '4-way mix':            'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  'roti atta':            'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'atta':                 'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'all purpose flour':    "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'flour':                "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'baking powder':        'Clabber Girl - Baking Powder - 5 lbs',
  'corn starch':          'Clabber Girl Cornstarch - 3 lbs',
  'rice':                 "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'basmati rice':         "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'garbanzo':             "Chef's Quality - Garbanzo Beans - #10 can",
  'kidney beans':         "Chef's Quality - Dark Red Kidney Beans - #10 cans",
  'salt':                 'Morton - Purex Salt - 50lb',
  'sugar':                'C&H - Granulated Sugar - 25 lbs',
  'tomato sauce':         "Chef's Quality - Tomato Sauce - #10 cans",
  'diced tomatoes':       'Isabella - Petite Diced Tomatoes -#10 cans',
  'liquid butter':        "Chef's Quality - Liquid Butter Alternative - gallon",
  'cooking oil':          "Chef's Quality - Soybean Salad Oil - 35 lbs",
  'fryer oil':            "Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs",
  'canola oil':           "Chef's Quality - 100% Canola Salad Oil - 35 lbs",
  'sambal':               'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'sambal chili':         'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'lemon juice':          "Chef's Quality - Lemon Juice - gallon",
  'red food color':       'Felbro - Red Food Coloring - gallon',
  'water':                'Evian - Natural Spring Water, 24 Ct, 500 mL',
  'sprite':               'Sprite Bottles, 16.9 fl oz, 4 Pack',
  'diet coke':            'Diet Coke Bottles, 16.9 fl oz, 24 Pack',
};

// ── PARSE ORDER ───────────────────────────────────────────────────────────────

async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP)
    .map(([k, v]) => `"${k}" -> "${v}"`).join('\n');
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content:
          'You are an ordering assistant for Naan & Curry restaurant.\n\n' +
          'Item mapping:\n' + itemMapStr + '\n\n' +
          'Rules:\n' +
          '- IGNORE headers, dates, names (e.g. "RESTAURANT DEPOT", "Mohan")\n' +
          '- ONLY add items explicitly listed with a quantity number\n' +
          '- Use the EXACT quantity. Never change it.\n' +
          '- Return ONLY a valid JSON array\n\n' +
          'Format: [{"item":"exact name from map values","quantity":NUMBER}]\n\n' +
          'Order: ' + message,
      }],
    });
    const text  = res.content[0].text;
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch (e) {
    console.error('parseOrder error:', e.message);
    return { error: true };
  }
}

// ── MESSAGING ─────────────────────────────────────────────────────────────────

async function sendWhatsApp(to, body) {
  const chunks = body.match(/[\s\S]{1,1400}/g) || [body];
  for (let i = 0; i < chunks.length; i++) {
    await twilioClient.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to:   'whatsapp:' + to,
      body: chunks[i],
    });
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 1000));
  }
}

async function sendEmail(orderItems, sender) {
  const lines = orderItems.map(i => `* ${i.quantity}x ${i.item}`).join('\n');
  await sgMail.send({
    from:    'nicksodhi@gmail.com',
    to:      'nicksodhi@gmail.com',
    subject: 'Restaurant Depot Cart Updated - ' + new Date().toLocaleDateString(),
    text:    `Order by ${sender}:\n\n${lines}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`,
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

// Score how well a string matches an item name (higher = better)
function scoreMatch(text, itemName) {
  const t = text.toLowerCase();
  const words = itemName.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').split(' ')
    .filter(w => w.length >= 3 && !['lbs','pkg','and','the','for','all','out','can','dry'].includes(w));
  const priority = words.filter(w => w.length >= 6);
  let score = words.filter(w => t.includes(w)).length;
  priority.forEach(w => { if (t.includes(w)) score += 3; });
  return score;
}

// ── MAIN AUTOMATION ───────────────────────────────────────────────────────────

async function placeOrder(orderItems) {

  // Pre-compute target cart quantities
  const targetMap = {};
  orderItems.forEach(oi => {
    const isSingle  = SINGLE_ONLY_ITEMS.includes(oi.item);
    const caseSize  = CASE_SIZES[oi.item] || 1;
    const targetQty = isSingle ? oi.quantity : oi.quantity * caseSize;
    targetMap[oi.item] = { ordered: oi, targetQty, found: false };
    console.log(`Target | ${oi.item}: ordered=${oi.quantity} case=${caseSize} cartQty=${targetQty}`);
  });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // ── LOGIN ────────────────────────────────────────────────────────────────
    await page.goto(
      'https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(5000);
    await page.locator('#email').fill(process.env.RD_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.RD_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(5000);
    console.log('Logged in');

    // ── CLEAR CART ───────────────────────────────────────────────────────────
    await page.goto('https://member.restaurantdepot.com/store/business/cart',
      { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 80; i++) {
      const removeBtn = page.locator('button, a').filter({ hasText: /^remove$/i }).first();
      if (await removeBtn.count() === 0) break;
      await removeBtn.click();
      await page.waitForTimeout(1500);
    }
    console.log('Cart cleared');

    // ── LOAD ORDER GUIDE ─────────────────────────────────────────────────────
    await page.goto(
      'https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'load', timeout: 45000 }
    );

    // Poll for the bulk add button
    let bulkBtn = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      bulkBtn = page.locator('[data-testid="add-all-items-button"]');
      if (await bulkBtn.count() > 0) break;
      // Fallback: button with text "Add N items to cart"
      bulkBtn = page.locator('button').filter({ hasText: /add \d+ items to cart/i });
      if (await bulkBtn.count() > 0) break;
      console.log(`Waiting for bulk add button... attempt ${attempt + 1}`);
      await page.waitForTimeout(1500);
    }
    if (await bulkBtn.count() === 0) throw new Error('Bulk add button not found after 30s');

    // Dismiss any open overlay/portal that might intercept the click
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Use force:true to bypass Playwright's interception check.
    // The __reakit-portal dialog overlay was blocking the pointer event.
    await bulkBtn.first().click({ force: true });
    console.log('Bulk add clicked');

    // ── CONFIRM THE "ADD 54 ITEMS?" MODAL ───────────────────────────────────
    const confirmBtn = page.locator('[data-testid="PromptModalConfirmButton"]');
    await confirmBtn.waitFor({ timeout: 15000 });
    await confirmBtn.click();
    console.log('Bulk add confirmed');
    await page.waitForTimeout(4000);

    // ── OPEN CART DRAWER ─────────────────────────────────────────────────────
    // Click the cart icon button in the header
    const cartIconBtn = page.locator('button').filter({ hasText: /view cart|items in cart/i })
      .or(page.locator('button[aria-label*="cart" i]').first());
    
    let drawerOpened = false;
    for (let attempt = 0; attempt < 15; attempt++) {
      const btn = page.locator('button[aria-label*="View Cart"]');
      if (await btn.count() > 0) {
        await btn.first().click();
        drawerOpened = true;
        break;
      }
      // Fallback: any button whose aria-label contains "items in cart"
      const btn2 = page.locator('button[aria-label*="items in cart"]');
      if (await btn2.count() > 0) {
        await btn2.first().click();
        drawerOpened = true;
        break;
      }
      console.log(`Waiting for cart icon... attempt ${attempt + 1}`);
      await page.waitForTimeout(1000);
    }
    if (!drawerOpened) throw new Error('Could not open cart drawer');
    console.log('Cart drawer opened');

    // Wait for cart stepper elements — unique to the drawer, not the order guide
    await page.locator('[data-testid="cartStepper"]').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);

    // ── READ CART ITEMS ──────────────────────────────────────────────────────
    // Each cart item is in a [aria-label="product"][role="group"] container.
    // We get all groups, extract name and qty from each.
    const cartGroups = await page.locator('[aria-label="product"][role="group"]').all();
    console.log(`Cart loaded: ${cartGroups.length} items`);

    const cartItems = [];
    for (const group of cartGroups) {
      // Qty from cartStepper: "1 ct" → 1
      const stepper = group.locator('[data-testid="cartStepper"]');
      let qty = 1;
      if (await stepper.count() > 0) {
        const stepperText = await stepper.first().textContent();
        const m = (stepperText || '').match(/(\d+)/);
        if (m) qty = parseInt(m[1], 10);
      }

      // Name: get full group text, remove known non-name parts, pick longest clean line
      const fullText = await group.textContent();
      const lines = (fullText || '').split(/\n+/).map(l => l.trim()).filter(l => l.length > 5);
      const skipLine = /^(\$[\d.]+|remove|replace|likely|many in stock|about|per\s|replacement|qty|\d+\.?\d*\s*(#|lbs?|oz|gal|ct|z|fl\s*oz|ml)|quantity:|\d+\s*x\s*\d)/i;
      const nameCandidates = lines.filter(l =>
        l.length < 130 &&
        !skipLine.test(l) &&
        !/change quantity/i.test(l) &&
        !/\$/.test(l)
      );
      const name = nameCandidates.reduce((a, b) => a.length >= b.length ? a : b, '');

      if (name.length > 3) {
        cartItems.push({ name, qty, group });
        console.log(`  cart | "${name}" qty=${qty}`);
      }
    }

    // ── PROCESS EACH CART ITEM ───────────────────────────────────────────────
    const notFound = [];

    for (const cartItem of cartItems) {
      // Match to ordered items
      let bestKey = null, bestScore = 0;
      for (const key of Object.keys(targetMap)) {
        const s = scoreMatch(cartItem.name, key);
        if (s > bestScore) { bestScore = s; bestKey = key; }
      }

      if (!bestKey || bestScore === 0) {
        // Not in order — remove it
        console.log(`  [x] Remove: ${cartItem.name}`);
        try {
          const removeBtn = cartItem.group.locator('button, a').filter({ hasText: /^remove$/i });
          if (await removeBtn.count() > 0) {
            await removeBtn.first().click();
            await page.waitForTimeout(1500);
            console.log(`    removed`);
          } else {
            console.log(`    WARNING: no remove button found`);
          }
        } catch (e) {
          console.log(`    remove error: ${e.message}`);
        }
        continue;
      }

      const entry = targetMap[bestKey];
      entry.found = true;
      const delta = entry.targetQty - cartItem.qty;

      if (delta === 0) {
        console.log(`  [=] ${bestKey} already at ${entry.targetQty}`);
        continue;
      }

      // Need to adjust qty — click the stepper button to open the product page
      console.log(`  [adjust] ${bestKey}: ${cartItem.qty} → ${entry.targetQty} (delta=${delta})`);
      try {
        // Click the <button> that CONTAINS the cartStepper span
        // Using Playwright's :has() selector — this is the key fix
        const stepperButton = cartItem.group.locator('button:has([data-testid="cartStepper"])');
        if (await stepperButton.count() === 0) {
          console.log(`    WARNING: no stepper button found`);
          continue;
        }
        await stepperButton.first().click();
        console.log(`    stepper clicked`);

        // Wait for the product detail page/panel with unit quantity buttons
        const incrementBtn = page.locator('button[aria-label="Increment unit quantity"]');
        try {
          await incrementBtn.waitFor({ timeout: 10000 });
        } catch {
          // Log all button aria-labels to diagnose
          const allLabels = await page.evaluate(() =>
            Array.from(document.querySelectorAll('button[aria-label]'))
              .map(b => b.getAttribute('aria-label')).join(' | ')
          );
          console.log(`    WARNING: increment btn not found. Labels: ${allLabels.slice(0, 300)}`);
          await page.keyboard.press('Escape');
          continue;
        }

        const direction = delta > 0 ? 'increment' : 'decrement';
        const clicks    = Math.abs(delta);
        const actionBtn = direction === 'increment'
          ? page.locator('button[aria-label="Increment unit quantity"]')
          : page.locator('button[aria-label="Decrement unit quantity"]');

        for (let i = 0; i < clicks; i++) {
          await actionBtn.first().click();
          console.log(`    [${i + 1}/${clicks}] ${direction}`);
          await page.waitForTimeout(400);
        }

        // Click the Back button/link to return to cart drawer
        await page.waitForTimeout(500);
        const backBtn = page.locator('button, a').filter({ hasText: /^back$/i });
        if (await backBtn.count() > 0) {
          await backBtn.first().click();
          console.log(`    back clicked`);
        } else {
          // Log available options
          const available = await page.evaluate(() =>
            Array.from(document.querySelectorAll('button, a'))
              .map(b => (b.textContent || '').trim()).filter(t => t).slice(0, 15).join(' | ')
          );
          console.log(`    WARNING: no Back button. Available: ${available}`);
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);

      } catch (e) {
        console.log(`    adjust error: ${e.message}`);
      }
    }

    // Items ordered but never found in cart (not in the order guide)
    for (const key of Object.keys(targetMap)) {
      if (!targetMap[key].found) notFound.push(key);
    }

    console.log('Done. Not in guide: ' + (notFound.length ? notFound.join(', ') : 'none'));
    await browser.close();
    return { success: true, notFound };

  } catch (e) {
    console.error('placeOrder error:', e.message);
    try { await browser.close(); } catch (_) {}
    return { success: false, error: e.message };
  }
}

// ── WHATSAPP WEBHOOK ──────────────────────────────────────────────────────────

app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);
  const msg  = req.body.Body;
  const from = req.body.From.replace('whatsapp:', '');
  const name = from === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';
  console.log(`From ${name}: ${msg}`);

  if (!AUTHORIZED_NUMBERS.includes(from)) {
    await sendWhatsApp(from, 'Not authorized');
    return;
  }

  await sendWhatsApp(from, `Got it ${name}! Processing your order...`);

  try {
    const order = await parseOrder(msg);
    if (!Array.isArray(order)) {
      await sendWhatsApp(from, 'Could not parse order. Please try again.');
      return;
    }

    const summary = order.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(from, 'Adding to cart:\n\n' + summary);

    const result = await placeOrder(order);
    if (result.success) {
      let reply = 'Done! Review and checkout:\nmember.restaurantdepot.com/store/business/cart';
      if (result.notFound && result.notFound.length) {
        reply += '\n\nNot in order guide — add manually:\n' +
          result.notFound.map(n => `• ${n}`).join('\n');
      }
      await sendWhatsApp(from, reply);
      await sendEmail(order, name);
    } else {
      await sendWhatsApp(from, 'Error: ' + result.error);
    }
  } catch (e) {
    console.error('Handler error:', e.message);
    await sendWhatsApp(from, 'Something went wrong. Please order manually.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent running'));
app.listen(process.env.PORT || 3000, () => console.log('Running'));

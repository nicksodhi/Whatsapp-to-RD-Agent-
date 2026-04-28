const express   = require('express');
const twilio    = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright');
const axios     = require('axios');
const sgMail    = require('@sendgrid/mail');
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

const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb', 'Micro Orchid Flowers - 4 oz',
  'Taylor Farms - Bagged Cilantro', 'Lemons, 71-115 ct', 'Carrots- 10 lb',
];
const CASE_SIZES = {
  'Peeled Garlic': 6, 'White Cauliflower': 12, 'MILK WHL GAL GS/AN': 4,
  "Chef's Quality - Liquid Butter Alternative - gallon": 3,
  "Chef's Quality - Lemon Juice - gallon": 4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz": 3,
  'James Farm - Heavy Cream, 40% - 64 oz': 6,
  'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs': 12,
};
const ITEM_MAP = {
  'yellow onions': 'Jumbo Spanish Onions - 50 lbs',
  'red onions': 'Jumbo Red Onions - 25 lbs',
  'potato': 'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'potatoes': 'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'garlic': 'Peeled Garlic', 'ginger': 'Fresh Ginger - 30 lbs',
  'paneer': 'Royal Mahout - Paneer Loaf - 5 lbs',
  'flowers': 'Micro Orchid Flowers - 4 oz', 'garnish': 'Micro Orchid Flowers - 4 oz',
  'cilantro': 'Taylor Farms - Bagged Cilantro', 'cucumber': 'Cucumbers - 6 ct',
  'cauliflower': 'White Cauliflower', 'carrots': 'Carrots- 10 lb',
  'lemon': 'Lemons, 71-115 ct', 'lemons': 'Lemons, 71-115 ct',
  'mint': 'Herb - Mint- 1lb', 'heavy cream': 'James Farm - Heavy Cream, 40% - 64 oz',
  'milk': 'MILK WHL GAL GS/AN', 'yogurt': 'James Farm - Plain Yogurt - 32 lbs',
  'cheese': 'James Farm - Shredded Cheddar Jack Cheese - 5 lbs',
  'chicken breast': 'Boneless, Skinless Chicken Breasts, Tenders Out, Dry',
  'chicken thighs': 'Boneless, Skinless Jumbo Chicken Thighs',
  'chicken leg quarters': 'Fresh Chicken Leg Quarters - 40 lbs',
  'chicken wings': 'Jumbo Chicken Party Wings (6-8 ct)',
  'wings': 'Jumbo Chicken Party Wings (6-8 ct)',
  'chicken leg meat': 'Fresh Boneless Skinless Chicken Leg Meat',
  'lamb': 'Frozen Halal Boneless Lamb Leg, Australia',
  'goat': 'Thomas Farms - Bone in Goat Cube - #15',
  'tilapia': 'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'fish': 'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'frozen spinach': 'Frozen James Farm - Frozen Chopped Spinach - 3 lbs',
  'frozen peas': 'Frozen James Farm - IQF Peas - 2.5 lbs',
  'frozen broccoli': 'Frozen James Farm - IQF Broccoli Florets - 2 lbs',
  'frozen 4-way mix': 'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  '4-way mix': 'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  'roti atta': 'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'atta': 'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'all purpose flour': "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'flour': "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'baking powder': 'Clabber Girl - Baking Powder - 5 lbs',
  'corn starch': 'Clabber Girl Cornstarch - 3 lbs',
  'rice': "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'basmati rice': "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'garbanzo': "Chef's Quality - Garbanzo Beans - #10 can",
  'kidney beans': "Chef's Quality - Dark Red Kidney Beans - #10 cans",
  'salt': 'Morton - Purex Salt - 50lb', 'sugar': 'C&H - Granulated Sugar - 25 lbs',
  'tomato sauce': "Chef's Quality - Tomato Sauce - #10 cans",
  'diced tomatoes': 'Isabella - Petite Diced Tomatoes -#10 cans',
  'liquid butter': "Chef's Quality - Liquid Butter Alternative - gallon",
  'cooking oil': "Chef's Quality - Soybean Salad Oil - 35 lbs",
  'fryer oil': "Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs",
  'canola oil': "Chef's Quality - 100% Canola Salad Oil - 35 lbs",
  'sambal': 'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'sambal chili': 'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'lemon juice': "Chef's Quality - Lemon Juice - gallon",
  'red food color': 'Felbro - Red Food Coloring - gallon',
  'water': 'Evian - Natural Spring Water, 24 Ct, 500 mL',
  'sprite': 'Sprite Bottles, 16.9 fl oz, 4 Pack',
  'diet coke': 'Diet Coke Bottles, 16.9 fl oz, 24 Pack',
};

async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
      messages: [{ role: 'user', content:
        'You are an ordering assistant for Naan & Curry restaurant.\n\nItem mapping:\n' + itemMapStr +
        '\n\nRules:\n- IGNORE headers, dates, names\n- ONLY add items with a quantity\n' +
        '- Use EXACT quantity.\n- Return ONLY valid JSON array\n\n' +
        'Format: [{"item":"exact name from map values","quantity":NUMBER}]\n\nOrder: ' + message }],
    });
    const text = res.content[0].text;
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch(e) { console.error('parseOrder:', e.message); return { error: true }; }
}

async function sendWhatsApp(to, body) {
  const chunks = body.match(/[\s\S]{1,1400}/g) || [body];
  for (let i = 0; i < chunks.length; i++) {
    await twilioClient.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: 'whatsapp:' + to, body: chunks[i],
    });
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 1000));
  }
}

async function sendEmail(orderItems, sender) {
  const lines = orderItems.map(i => `* ${i.quantity}x ${i.item}`).join('\n');
  await sgMail.send({
    from: 'nicksodhi@gmail.com', to: 'nicksodhi@gmail.com',
    subject: 'Restaurant Depot Cart Updated - ' + new Date().toLocaleDateString(),
    text: `Order by ${sender}:\n\n${lines}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`,
  });
}

// ── GRAPHQL HELPER ────────────────────────────────────────────────────────────

async function gql(cookieStr, operationName, variables, sha256Hash) {
  const params = new URLSearchParams({
    operationName,
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash } }),
  });
  const res = await axios.get(
    `https://member.restaurantdepot.com/graphql?${params}`,
    {
      headers: {
        'cookie': cookieStr,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'referer': 'https://member.restaurantdepot.com/',
      },
      timeout: 15000,
    }
  );
  return res.data;
}

async function gqlPost(cookieStr, operationName, variables, sha256Hash) {
  const res = await axios.post(
    'https://member.restaurantdepot.com/graphql',
    {
      operationName,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    },
    {
      headers: {
        'cookie': cookieStr,
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'referer': 'https://member.restaurantdepot.com/',
      },
      timeout: 15000,
    }
  );
  return res.data;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function placeOrder(orderItems) {
  const targetMap = {};
  orderItems.forEach(oi => {
    const isSingle = SINGLE_ONLY_ITEMS.includes(oi.item);
    const caseSize = CASE_SIZES[oi.item] || 1;
    const targetQty = isSingle ? oi.quantity : oi.quantity * caseSize;
    targetMap[oi.item] = { ordered: oi, targetQty, found: false };
    console.log(`Target | ${oi.item}: ordered=${oi.quantity} case=${caseSize} cartQty=${targetQty}`);
  });

  const browser = await chromium.launch({
    headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // ── CAPTURE ALL GRAPHQL CALLS ─────────────────────────────────────────────
  const gqlCalls = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/graphql')) {
      const method = req.method();
      const postData = req.postData();
      const urlParams = url.includes('?') ? Object.fromEntries(new URLSearchParams(url.split('?')[1])) : {};
      gqlCalls.push({ method, url: url.slice(0, 200), postData, urlParams, time: Date.now() });
    }
  });

  // Capture full response bodies for GraphQL calls
  page.on('response', async res => {
    if (res.url().includes('/graphql') && res.status() === 200) {
      try {
        const body = await res.text();
        const last = gqlCalls[gqlCalls.length - 1];
        if (last) last.responseBody = body.slice(0, 3000);
      } catch(e) {}
    }
  });

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
    await page.waitForTimeout(6000);
    console.log('Logged in');

    const cookies = await context.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log(`Cookies: ${cookies.map(c => c.name).join(', ')}`);

    // ── STEP 1: READ CURRENT CART VIA PersonalActiveCarts ────────────────────
    console.log('\n=== STEP 1: PersonalActiveCarts ===');
    try {
      const cartData = await gql(cookieStr, 'PersonalActiveCarts', {},
        'eac9d17bd45b099fbbdabca2e111acaf2a4fa486f2ce5bc4e8acbab2f31fd8c0');
      console.log('PersonalActiveCarts response:');
      console.log(JSON.stringify(cartData, null, 2).slice(0, 3000));
    } catch(e) {
      console.log('PersonalActiveCarts error:', e.response?.status, e.message);
    }

    // ── STEP 2: Navigate to order guide, capture ALL GraphQL ops ─────────────
    console.log('\n=== STEP 2: Order guide navigation ===');
    await page.goto(
      'https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'load', timeout: 45000 }
    );
    await page.waitForTimeout(5000);

    // Log all captured graphql ops so far
    console.log(`\nCaptured ${gqlCalls.length} GraphQL calls on order guide:`);
    gqlCalls.forEach((c, i) => {
      const op = c.urlParams?.operationName || (c.postData ? JSON.parse(c.postData||'{}').operationName : 'POST');
      const vars = c.urlParams?.variables || (c.postData ? JSON.parse(c.postData||'{}').variables : {});
      const hash = c.urlParams?.extensions
        ? JSON.parse(c.urlParams.extensions)?.persistedQuery?.sha256Hash?.slice(0,16)
        : (c.postData ? JSON.parse(c.postData||'{}').extensions?.persistedQuery?.sha256Hash?.slice(0,16) : '');
      console.log(`  [${i}] ${c.method} ${op} hash=${hash}`);
      if (vars && Object.keys(JSON.parse(vars||'{}')).length) {
        console.log(`       vars: ${vars}`);
      }
      if (c.responseBody) console.log(`       resp: ${c.responseBody.slice(0, 200)}`);
    });

    // ── STEP 3: Click bulk add and capture the mutation ───────────────────────
    console.log('\n=== STEP 3: Clicking bulk add ===');
    const beforeCount = gqlCalls.length;

    // Find and click the bulk add button
    for (let attempt = 0; attempt < 20; attempt++) {
      const btn = page.locator('[data-testid="add-all-items-button"]');
      if (await btn.count() > 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        try {
          await btn.first().click({ timeout: 5000 });
        } catch {
          await btn.first().click({ force: true });
        }
        console.log('Bulk add button clicked');
        break;
      }
      await page.waitForTimeout(1500);
    }

    await page.waitForTimeout(3000);

    // Click the confirm button - handle multiple matches with first()
    try {
      const confirmBtn = page.locator('[data-testid="PromptModalConfirmButton"]').first();
      await confirmBtn.waitFor({ timeout: 10000 });
      await confirmBtn.click();
      console.log('Confirmed bulk add');
    } catch(e) {
      console.log('Confirm button issue:', e.message);
    }

    await page.waitForTimeout(5000);

    // Log new GraphQL calls from bulk add
    console.log(`\nNew GraphQL calls from bulk add (${gqlCalls.length - beforeCount} calls):`);
    gqlCalls.slice(beforeCount).forEach((c, i) => {
      try {
        const postBody = c.postData ? JSON.parse(c.postData) : {};
        const op = c.urlParams?.operationName || postBody.operationName || 'unknown';
        const hash = c.urlParams?.extensions
          ? JSON.parse(c.urlParams.extensions)?.persistedQuery?.sha256Hash
          : postBody.extensions?.persistedQuery?.sha256Hash;
        const vars = c.urlParams?.variables
          ? JSON.parse(c.urlParams.variables)
          : postBody.variables;
        console.log(`  [${i}] ${c.method} ${op}`);
        console.log(`       hash: ${hash}`);
        console.log(`       vars: ${JSON.stringify(vars).slice(0, 300)}`);
        if (c.responseBody) console.log(`       resp: ${c.responseBody.slice(0, 400)}`);
      } catch(e) {
        console.log(`  [${i}] parse error: ${e.message}`);
        console.log(`       raw: ${c.postData?.slice(0,200) || c.url}`);
      }
    });

    // ── STEP 4: Open cart drawer, capture cart read query ────────────────────
    console.log('\n=== STEP 4: Open cart drawer ===');
    const beforeCart = gqlCalls.length;
    const cartBtn = page.locator('button[aria-label*="View Cart"]').first();
    if (await cartBtn.count() > 0) {
      await cartBtn.click({ force: true });
      await page.waitForTimeout(4000);
    }

    console.log(`New GraphQL calls from cart open (${gqlCalls.length - beforeCart} calls):`);
    gqlCalls.slice(beforeCart).forEach((c, i) => {
      try {
        const postBody = c.postData ? JSON.parse(c.postData) : {};
        const op = c.urlParams?.operationName || postBody.operationName || 'unknown';
        const hash = c.urlParams?.extensions
          ? JSON.parse(c.urlParams.extensions)?.persistedQuery?.sha256Hash
          : postBody.extensions?.persistedQuery?.sha256Hash;
        const vars = c.urlParams?.variables
          ? JSON.parse(c.urlParams.variables)
          : postBody.variables;
        console.log(`  [${i}] ${c.method} ${op}`);
        console.log(`       hash: ${hash}`);
        console.log(`       vars: ${JSON.stringify(vars).slice(0, 300)}`);
        if (c.responseBody) console.log(`       resp: ${c.responseBody.slice(0, 600)}`);
      } catch(e) {
        console.log(`  [${i}] ${c.url.slice(0,150)}`);
      }
    });

    // ── STEP 5: Click a cart stepper to trigger quantity mutation ─────────────
    console.log('\n=== STEP 5: Trigger quantity change to capture mutation ===');
    const beforeQty = gqlCalls.length;

    // Wait for cart items to load
    try {
      await page.locator('[data-testid="cartStepper"]').first().waitFor({ timeout: 15000 });
      const stepperBtn = page.locator('button:has([data-testid="cartStepper"])').first();
      await stepperBtn.click();
      console.log('Clicked stepper button');
      await page.waitForTimeout(3000);

      // Click increment if product page opened
      const incBtn = page.locator('button[aria-label="Increment unit quantity"]');
      if (await incBtn.count() > 0) {
        await incBtn.first().click();
        console.log('Clicked increment button');
        await page.waitForTimeout(2000);
      } else {
        // Log all button labels to find the right one
        const labels = await page.evaluate(() =>
          Array.from(document.querySelectorAll('button[aria-label]'))
            .map(b => b.getAttribute('aria-label')).join(' | ')
        );
        console.log('Available button labels:', labels.slice(0, 500));
      }
    } catch(e) {
      console.log('Stepper interaction error:', e.message);
    }

    await page.waitForTimeout(2000);

    console.log(`\nNew GraphQL calls from quantity change (${gqlCalls.length - beforeQty} calls):`);
    gqlCalls.slice(beforeQty).forEach((c, i) => {
      try {
        const postBody = c.postData ? JSON.parse(c.postData) : {};
        const op = c.urlParams?.operationName || postBody.operationName || 'unknown';
        const hash = c.urlParams?.extensions
          ? JSON.parse(c.urlParams.extensions)?.persistedQuery?.sha256Hash
          : postBody.extensions?.persistedQuery?.sha256Hash;
        const vars = c.urlParams?.variables
          ? JSON.parse(c.urlParams.variables)
          : postBody.variables;
        console.log(`  [${i}] ${c.method} ${op}`);
        console.log(`       hash: ${hash}`);
        console.log(`       vars: ${JSON.stringify(vars).slice(0, 500)}`);
        if (c.responseBody) console.log(`       resp: ${c.responseBody.slice(0, 600)}`);
      } catch(e) {
        console.log(`  [${i}] ${c.url?.slice(0,150)}`);
      }
    });

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    console.log('\n=== FULL GRAPHQL OPERATION SUMMARY ===');
    const opNames = [...new Set(gqlCalls.map(c => {
      try {
        const postBody = c.postData ? JSON.parse(c.postData) : {};
        return c.urlParams?.operationName || postBody.operationName || 'unknown';
      } catch { return 'unknown'; }
    }))];
    console.log('All unique operations:', opNames.join(', '));

    await browser.close();
    return { success: true, notFound: [] };

  } catch(e) {
    console.error('placeOrder error:', e.message);
    try { await browser.close(); } catch(_) {}
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
  if (!AUTHORIZED_NUMBERS.includes(from)) { await sendWhatsApp(from, 'Not authorized'); return; }
  await sendWhatsApp(from, `Got it ${name}! Running GraphQL discovery...`);
  try {
    const order = await parseOrder(msg);
    if (!Array.isArray(order)) { await sendWhatsApp(from, 'Could not parse order.'); return; }
    const result = await placeOrder(order);
    await sendWhatsApp(from, 'GraphQL capture complete — check logs for mutation details.');
  } catch(e) {
    console.error('Handler error:', e.message);
    await sendWhatsApp(from, 'Discovery run complete — check logs.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry — GraphQL Discovery Mode'));
app.listen(process.env.PORT || 3000, () => console.log('Running'));

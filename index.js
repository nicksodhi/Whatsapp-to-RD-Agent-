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
  'Herb - Mint- 1lb',
  'Micro Orchid Flowers - 4 oz',
  'Taylor Farms - Bagged Cilantro',
  'Lemons, 71-115 ct',
  'Carrots- 10 lb',
];

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
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content:
          'You are an ordering assistant for Naan & Curry restaurant.\n\n' +
          'Item mapping:\n' + itemMapStr + '\n\n' +
          'Rules:\n- IGNORE headers, dates, names\n- ONLY add items with a quantity\n' +
          '- Use EXACT quantity. Never change it.\n- Return ONLY valid JSON array\n\n' +
          'Format: [{"item":"exact name from map values","quantity":NUMBER}]\n\nOrder: ' + message,
      }],
    });
    const text  = res.content[0].text;
    const match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch(e) { console.error('parseOrder:', e.message); return { error: true }; }
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
    from: 'nicksodhi@gmail.com', to: 'nicksodhi@gmail.com',
    subject: 'Restaurant Depot Cart Updated - ' + new Date().toLocaleDateString(),
    text: `Order by ${sender}:\n\n${lines}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`,
  });
}

// ── SCORE MATCH ───────────────────────────────────────────────────────────────

function scoreMatch(text, itemName) {
  const t = text.toLowerCase();
  const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ')
    .filter(w => w.length >= 3 && !['lbs','pkg','and','the','for','all','out','can','dry'].includes(w));
  const priority = words.filter(w => w.length >= 6);
  let score = words.filter(w => t.includes(w)).length;
  priority.forEach(w => { if (t.includes(w)) score += 3; });
  return score;
}

// ── MAIN: API-FIRST ORDERING ──────────────────────────────────────────────────
//
// Strategy: Use Playwright only to log in and intercept network traffic.
// All cart operations (read, add, update qty, remove) are done via direct
// API calls using the captured auth token — no UI clicking for quantities.
//
// Flow:
//   1. Login via Playwright, capture auth cookies + bearer token
//   2. Intercept API calls on the order guide page to discover:
//      - Cart API base URL
//      - Auth header format
//      - Item/product ID structure
//   3. Use captured credentials to make direct API calls:
//      - GET cart → current items + IDs
//      - DELETE cart items not in order
//      - PATCH/PUT cart items to set exact quantities
//      - POST to add items that are in order guide but missing from cart

async function placeOrder(orderItems) {

  // Build target qty map
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

  // ── INTERCEPT ALL API TRAFFIC ─────────────────────────────────────────────
  // Capture every XHR/fetch request so we can see the API structure
  const capturedRequests = [];
  const capturedResponses = {};
  let authHeaders = {};

  page.on('request', req => {
    const url = req.url();
    const method = req.method();
    // Only capture non-trivial API calls (not images, fonts, etc.)
    if (!url.includes('.png') && !url.includes('.jpg') && !url.includes('.css') &&
        !url.includes('.js') && !url.includes('fonts') && !url.includes('analytics') &&
        !url.includes('segment') && !url.includes('mixpanel')) {
      const headers = req.headers();
      const postData = req.postData();
      capturedRequests.push({ method, url, headers, postData });
      // Capture auth headers from any request
      if (headers['authorization']) authHeaders['authorization'] = headers['authorization'];
      if (headers['x-auth-token'])  authHeaders['x-auth-token']  = headers['x-auth-token'];
      if (headers['x-api-key'])     authHeaders['x-api-key']     = headers['x-api-key'];
    }
  });

  page.on('response', async res => {
    const url = res.url();
    const status = res.status();
    // Capture cart and order guide API responses
    if ((url.includes('cart') || url.includes('order-guide') || url.includes('basket')) &&
        !url.includes('.js') && status === 200) {
      try {
        const body = await res.text();
        capturedResponses[url] = { status, body: body.slice(0, 2000) };
        console.log(`API RESPONSE [${status}] ${url.slice(0, 120)}`);
        console.log(`  BODY: ${body.slice(0, 500)}`);
      } catch(e) { /* ignore */ }
    }
  });

  try {
    // ── LOGIN ──────────────────────────────────────────────────────────────
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

    // Capture cookies after login
    const cookies = await context.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    console.log(`Cookies captured: ${cookies.length} cookies`);
    console.log(`Cookie names: ${cookies.map(c => c.name).join(', ')}`);
    if (authHeaders['authorization']) {
      console.log(`Auth header: ${authHeaders['authorization'].slice(0, 50)}...`);
    }

    // ── NAVIGATE TO ORDER GUIDE — intercept API calls ─────────────────────
    await page.goto(
      'https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'load', timeout: 45000 }
    );
    await page.waitForTimeout(6000);
    console.log('Order guide loaded');

    // Log all captured API calls so far
    console.log(`\n=== CAPTURED API CALLS (${capturedRequests.length} total) ===`);
    capturedRequests.forEach(r => {
      if (r.url.includes('restaurantdepot') || r.url.includes('jetro')) {
        console.log(`${r.method} ${r.url.slice(0, 150)}`);
        if (r.postData) console.log(`  BODY: ${r.postData.slice(0, 200)}`);
        const interestingHeaders = Object.entries(r.headers)
          .filter(([k]) => ['authorization','x-auth','x-api','content-type','x-store','x-location','x-member'].some(p => k.includes(p)))
          .map(([k,v]) => `${k}: ${v.slice(0,80)}`);
        if (interestingHeaders.length) console.log(`  HEADERS: ${interestingHeaders.join(' | ')}`);
      }
    });

    // ── TRY DIRECT CART API ───────────────────────────────────────────────
    // Build headers from what we captured
    const reqHeaders = {
      'cookie': cookieStr,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'accept': 'application/json',
      'content-type': 'application/json',
      'referer': 'https://member.restaurantdepot.com/',
      ...authHeaders,
    };

    // Try common cart API patterns used by Instacart-powered storefronts
    // Restaurant Depot uses the Instacart Enterprise Platform (IEP)
    const apiBase = 'https://member.restaurantdepot.com';
    const cartEndpoints = [
      '/api/v1/cart',
      '/api/cart',
      '/v1/cart',
      '/rest/cart',
      '/store/api/cart',
      '/api/v2/cart',
    ];

    let cartData = null;
    let workingCartUrl = null;

    for (const endpoint of cartEndpoints) {
      try {
        console.log(`Trying cart endpoint: ${endpoint}`);
        const res = await axios.get(apiBase + endpoint, { headers: reqHeaders, timeout: 8000 });
        console.log(`  ✓ Found cart API at ${endpoint} — status ${res.status}`);
        console.log(`  Data: ${JSON.stringify(res.data).slice(0, 500)}`);
        cartData = res.data;
        workingCartUrl = apiBase + endpoint;
        break;
      } catch(e) {
        console.log(`  ✗ ${endpoint}: ${e.response ? e.response.status : e.message}`);
      }
    }

    // ── GRAPHQL PROBE ─────────────────────────────────────────────────────
    // Instacart storefronts often use GraphQL
    const graphqlEndpoints = [
      '/graphql',
      '/api/graphql',
      '/store/graphql',
    ];

    for (const ep of graphqlEndpoints) {
      try {
        console.log(`Trying GraphQL at ${ep}`);
        const res = await axios.post(apiBase + ep, {
          query: '{ __typename }',
        }, { headers: reqHeaders, timeout: 8000 });
        console.log(`  ✓ GraphQL at ${ep} — status ${res.status}`);
        console.log(`  Data: ${JSON.stringify(res.data).slice(0, 300)}`);
        break;
      } catch(e) {
        console.log(`  ✗ ${ep}: ${e.response ? e.response.status : e.message}`);
      }
    }

    // ── FALLBACK: BROWSER-BASED CART READ + DIRECT FETCH ─────────────────
    // If we didn't find the API, use the browser's own fetch (authenticated)
    // to make the API calls — it already has all the right cookies/tokens
    console.log('\n=== BROWSER FETCH PROBING ===');
    const browserProbe = await page.evaluate(async () => {
      const results = {};

      // Try to get cart via the browser's authenticated fetch
      const endpoints = [
        '/api/v1/cart',
        '/api/cart',
        '/v1/cart',
        '/rest/cart',
        '/api/v1/orders/current',
        '/api/v1/baskets/current',
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            headers: { 'accept': 'application/json', 'content-type': 'application/json' },
            credentials: 'include',
          });
          const text = await res.text();
          results[ep] = { status: res.status, body: text.slice(0, 300) };
        } catch(e) {
          results[ep] = { error: e.message };
        }
      }

      // Also try to find any global state / Redux store exposed on window
      const windowKeys = Object.keys(window).filter(k =>
        ['cart','store','redux','state','app','__'].some(p => k.toLowerCase().includes(p))
      );

      return { endpoints: results, windowKeys };
    });

    console.log('Browser probe results:');
    Object.entries(browserProbe.endpoints).forEach(([ep, result]) => {
      console.log(`  ${ep}: status=${result.status || 'ERR'} body=${result.body || result.error}`);
    });
    console.log('Window keys:', browserProbe.windowKeys.join(', '));

    // ── INTERCEPT ACTUAL CART REQUEST by triggering one ───────────────────
    // Click the cart icon to open the drawer — this will fire real cart API calls
    // that we can intercept with our listener
    console.log('\n=== TRIGGERING CART OPEN TO CAPTURE API CALL ===');
    const cartIconSelectors = [
      'button[aria-label*="View Cart"]',
      'button[aria-label*="items in cart"]',
      'button[aria-label*="cart"]',
      '[data-testid*="cart"]',
    ];
    for (const sel of cartIconSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0) {
        await btn.click({ force: true });
        console.log(`Clicked cart icon: ${sel}`);
        break;
      }
    }
    await page.waitForTimeout(4000);

    // Log any NEW API calls captured after opening cart
    console.log(`\n=== ALL CAPTURED REQUESTS (${capturedRequests.length} total) ===`);
    capturedRequests
      .filter(r => r.url.includes('restaurantdepot') || r.url.includes('jetro') || r.url.includes('instacart'))
      .forEach(r => {
        console.log(`${r.method} ${r.url}`);
        if (r.postData) console.log(`  POST: ${r.postData.slice(0, 300)}`);
      });

    await browser.close();
    return { success: true, notFound: Object.keys(targetMap) };

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

  if (!AUTHORIZED_NUMBERS.includes(from)) {
    await sendWhatsApp(from, 'Not authorized');
    return;
  }

  await sendWhatsApp(from, `Got it ${name}! Discovering API structure...`);

  try {
    const order = await parseOrder(msg);
    if (!Array.isArray(order)) {
      await sendWhatsApp(from, 'Could not parse order. Please try again.');
      return;
    }

    const result = await placeOrder(order);
    await sendWhatsApp(from, 'API discovery complete — check logs for endpoints.');
  } catch(e) {
    console.error('Handler error:', e.message);
    await sendWhatsApp(from, 'Discovery run complete — check logs.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent — API Discovery Mode'));
app.listen(process.env.PORT || 3000, () => console.log('Running'));

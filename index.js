const express   = require('express');
const twilio    = require('twilio');
const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright');
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
        'Ordering assistant for Naan & Curry.\n\nItem mapping:\n' + itemMapStr +
        '\n\nRules: IGNORE headers/dates/names. ONLY items with quantity number. EXACT quantity. Return ONLY valid JSON array.\n\n' +
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

function scoreMatch(text, itemName) {
  const t = text.toLowerCase();
  const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ')
    .filter(w => w.length >= 3 && !['lbs','pkg','and','the','for','all','out','can','dry'].includes(w));
  const priority = words.filter(w => w.length >= 6);
  let score = words.filter(w => t.includes(w)).length;
  priority.forEach(w => { if (t.includes(w)) score += 3; });
  return score;
}

// ── THE CORE: runs entirely inside the browser via page.evaluate ──────────────
// Browser fetch calls use cookies automatically — no auth header management.
// This function does everything: reads cart state, updates quantities, removes
// items — all via GraphQL mutations from inside the authenticated browser context.

const CART_OPERATIONS = `
// Make a GraphQL call using the browser's own cookies
async function gql(op, query, vars) {
  const r = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ operationName: op, query, variables: vars })
  });
  return r.json();
}

// Extract all cart items from the Apollo cache
function getCartItemsFromCache() {
  const cache = window.__APOLLO_CLIENT__.cache.extract();
  const items = [];
  
  Object.entries(cache).forEach(([key, val]) => {
    if (!val || typeof val !== 'object') return;
    
    // Match any cache entry that looks like a cart item
    const type = (val.__typename || '').toLowerCase();
    const hasQty = typeof val.quantity === 'number';
    const hasId = val.id;
    
    if (!hasId || !hasQty) return;
    if (!type.includes('cart') && !type.includes('item') && !type.includes('line')) return;
    if (type.includes('order') && !type.includes('cart')) return;
    
    // Try to get product name from nested refs
    let name = val.name || val.displayName || val.title || '';
    
    // Look up referenced objects for the name
    if (!name) {
      Object.values(val).forEach(v => {
        if (v && v.__ref) {
          const ref = cache[v.__ref];
          if (ref) {
            name = name || ref.name || ref.displayName || ref.title || '';
            // Go one level deeper
            if (!name) {
              Object.values(ref).forEach(rv => {
                if (rv && rv.__ref) {
                  const ref2 = cache[rv.__ref];
                  if (ref2) name = name || ref2.name || ref2.displayName || '';
                }
              });
            }
          }
        }
      });
    }
    
    items.push({
      cacheKey: key,
      id: val.id,
      quantity: val.quantity,
      typename: val.__typename,
      name: name,
      // Keep raw val for debugging
      fields: Object.keys(val),
    });
  });
  
  return items;
}

// Try multiple mutation structures for updating quantity
async function updateQty(itemId, cartId, quantity) {
  const mutations = [
    // Instacart SFP standard mutations (most likely)
    ['UpdateItemsInCart', \`mutation UpdateItemsInCart($input: UpdateItemsInCartInput!) { updateItemsInCart(input: $input) { __typename } }\`,
      { input: { cartId, updates: [{ cartItemId: itemId, quantity }] } }],
    ['UpdateCartItemQuantity', \`mutation UpdateCartItemQuantity($input: UpdateCartItemQuantityInput!) { updateCartItemQuantity(input: $input) { __typename } }\`,
      { input: { cartItemId: itemId, quantity } }],
    ['UpdateCartItem', \`mutation UpdateCartItem($input: UpdateCartItemInput!) { updateCartItem(input: $input) { __typename } }\`,
      { input: { cartItemId: itemId, quantity } }],
    ['SetCartItemQuantity', \`mutation SetCartItemQuantity($input: SetCartItemQuantityInput!) { setCartItemQuantity(input: $input) { __typename } }\`,
      { input: { id: itemId, quantity } }],
    ['UpdateItemQuantity', \`mutation UpdateItemQuantity($input: UpdateItemQuantityInput!) { updateItemQuantity(input: $input) { __typename } }\`,
      { input: { cartItemId: itemId, quantity } }],
    // Try with cartId scoping
    ['UpdateCartItem', \`mutation UpdateCartItem($cartId: ID!, $itemId: ID!, $quantity: Int!) { updateCartItem(cartId: $cartId, itemId: $itemId, quantity: $quantity) { __typename } }\`,
      { cartId, itemId, quantity }],
  ];
  
  for (const [op, query, vars] of mutations) {
    const result = await gql(op, query, vars);
    if (!result.errors) {
      return { ok: true, op };
    }
    // Log first error for diagnosis
    const errMsg = result.errors?.[0]?.message || '';
    if (errMsg.includes('PersistedQueryNotFound')) continue; // wrong hash
    if (errMsg.includes('Cannot query field') || errMsg.includes('Unknown type')) continue; // wrong schema
    console.log('Mutation ' + op + ' error:', errMsg.slice(0, 100));
  }
  return { ok: false };
}

// Try multiple mutation structures for removing an item
async function removeItem(itemId, cartId) {
  const mutations = [
    ['RemoveItemsFromCart', \`mutation RemoveItemsFromCart($input: RemoveItemsFromCartInput!) { removeItemsFromCart(input: $input) { __typename } }\`,
      { input: { cartId, cartItemIds: [itemId] } }],
    ['RemoveCartItem', \`mutation RemoveCartItem($input: RemoveCartItemInput!) { removeCartItem(input: $input) { __typename } }\`,
      { input: { cartItemId: itemId } }],
    ['DeleteCartItem', \`mutation DeleteCartItem($input: DeleteCartItemInput!) { deleteCartItem(input: $input) { __typename } }\`,
      { input: { cartItemId: itemId } }],
    ['RemoveItemFromCart', \`mutation RemoveItemFromCart($cartId: ID!, $itemId: ID!) { removeItemFromCart(cartId: $cartId, itemId: $itemId) { __typename } }\`,
      { cartId, itemId }],
  ];
  
  for (const [op, query, vars] of mutations) {
    const result = await gql(op, query, vars);
    if (!result.errors) return { ok: true, op };
  }
  return { ok: false };
}
`;

async function placeOrder(orderItems) {
  const targetMap = {};
  orderItems.forEach(oi => {
    const isSingle = SINGLE_ONLY_ITEMS.includes(oi.item);
    const caseSize = CASE_SIZES[oi.item] || 1;
    const targetQty = isSingle ? oi.quantity : oi.quantity * caseSize;
    targetMap[oi.item] = { ordered: oi, targetQty, found: false };
    console.log(`Target | ${oi.item}: ordered=${oi.quantity} case=${caseSize} cartQty=${targetQty}`);
  });

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // Capture cartId and mutation hashes from network traffic
  let cartId = null;
  let successfulUpdateOp = null;
  let successfulRemoveOp = null;

  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/graphql')) {
      try {
        const body = JSON.parse(req.postData() || '{}');
        // Extract cartId from any request that has it
        const vars = body.variables || {};
        if (vars.cartId && !cartId) {
          cartId = vars.cartId;
          console.log('Captured cartId:', cartId);
        }
        if (vars.input?.cartId && !cartId) {
          cartId = vars.input.cartId;
          console.log('Captured cartId from input:', cartId);
        }
      } catch(e) {}
    }
    // Also capture from GET requests (queries use GET)
    if (req.method() === 'GET' && req.url().includes('/graphql')) {
      try {
        const url = new URL(req.url());
        const vars = JSON.parse(url.searchParams.get('variables') || '{}');
        if (vars.cartId && !cartId) {
          cartId = vars.cartId;
          console.log('Captured cartId from GET:', cartId);
        }
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
    console.log('Logged in. cartId so far:', cartId);

    // ── LOAD ORDER GUIDE ─────────────────────────────────────────────────────
    await page.goto(
      'https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'load', timeout: 45000 }
    );
    await page.waitForTimeout(5000);
    console.log('Order guide loaded. cartId:', cartId);

    // ── BULK ADD ─────────────────────────────────────────────────────────────
    for (let attempt = 0; attempt < 20; attempt++) {
      const btn = page.locator('[data-testid="add-all-items-button"]');
      if (await btn.count() > 0) {
        try { await btn.first().click({ timeout: 3000 }); }
        catch { await btn.first().click({ force: true }); }
        console.log('Bulk add clicked');
        break;
      }
      await page.waitForTimeout(1500);
    }

    // Confirm modal — button is present but hidden, force click it
    await page.waitForTimeout(2000);
    try {
      await page.waitForSelector('[data-testid="PromptModalConfirmButton"]',
        { state: 'attached', timeout: 12000 });
      await page.locator('[data-testid="PromptModalConfirmButton"]').first()
        .click({ force: true });
      console.log('Bulk add confirmed');
    } catch(e) {
      console.log('Confirm note:', e.message.slice(0, 100));
    }

    await page.waitForTimeout(5000);
    console.log('cartId after bulk add:', cartId);

    // ── OPEN CART DRAWER ─────────────────────────────────────────────────────
    for (let attempt = 0; attempt < 15; attempt++) {
      const btn = page.locator('button[aria-label*="View Cart"], button[aria-label*="items in cart"]');
      if (await btn.count() > 0) {
        await btn.first().click({ force: true });
        console.log('Cart drawer opened');
        break;
      }
      await page.waitForTimeout(1000);
    }

    // Wait for cart items to load into Apollo cache
    try {
      await page.locator('[data-testid="cartStepper"]').first().waitFor({ timeout: 15000 });
    } catch(e) {
      console.log('cartStepper wait:', e.message.slice(0, 80));
    }
    await page.waitForTimeout(3000);
    console.log('cartId before operations:', cartId);

    // ── READ CART + UPDATE QUANTITIES via browser GraphQL ───────────────────
    const result = await page.evaluate(async (params) => {
      const { targetMap, cartIdParam, CART_OPS } = params;

      // Inject all helper functions
      eval(CART_OPS);

      const log = [];

      // Get cartId — prefer captured from network, fall back to Apollo cache
      let cartId = cartIdParam;
      if (!cartId) {
        try {
          const cache = window.__APOLLO_CLIENT__.cache.extract();
          // Look for cartId in ROOT_QUERY
          const rootQuery = cache.ROOT_QUERY || {};
          Object.values(rootQuery).forEach(v => {
            if (v && v.__ref && v.__ref.startsWith('Cart:')) {
              cartId = v.__ref.replace('Cart:', '');
            }
          });
          // Also look in CartSignaledEta or similar
          Object.entries(cache).forEach(([k, v]) => {
            if (k.startsWith('Cart:') && !cartId) cartId = v.id || k.replace('Cart:', '');
          });
        } catch(e) { log.push('cartId lookup error: ' + e.message); }
      }
      log.push('Using cartId: ' + cartId);

      // Read cart items from Apollo cache
      const cartItems = getCartItemsFromCache();
      log.push('Cart items in cache: ' + cartItems.length);

      // Log all typenames found to understand cache structure
      const cache = window.__APOLLO_CLIENT__.cache.extract();
      const typenames = [...new Set(Object.values(cache).map(v => v && v.__typename).filter(Boolean))];
      log.push('Typenames: ' + typenames.join(', '));

      // Log all cache keys for diagnosis
      const allKeys = Object.keys(cache);
      log.push('Cache keys (' + allKeys.length + '): ' + allKeys.slice(0, 40).join(', '));

      if (cartItems.length === 0) {
        // If no items in cache by typename, try reading from DOM
        // The cart drawer has [data-testid="cartStepper"] spans with qty
        // and the parent groups have product names
        const groups = Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
        log.push('DOM cart groups: ' + groups.length);
        
        groups.forEach((g, i) => {
          const stepper = g.querySelector('[data-testid="cartStepper"]');
          const qty = stepper ? parseInt((stepper.textContent || '').match(/\d+/)?.[0] || '1') : 1;
          const text = g.textContent.slice(0, 100);
          log.push('DOM item ' + i + ': qty=' + qty + ' text=' + text.replace(/\n/g, ' ').trim().slice(0, 60));
        });
        
        return { log, cartItems: [], cartId, done: false };
      }

      // Process each cart item
      const results = [];
      for (const item of cartItems) {
        // Find best match in target items
        let bestKey = null, bestScore = 0;
        const searchText = (item.name + ' ' + item.cacheKey + ' ' + item.typename).toLowerCase();
        
        for (const key of Object.keys(targetMap)) {
          const words = key.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ')
            .filter(w => w.length >= 3);
          const priority = words.filter(w => w.length >= 5);
          let score = words.filter(w => searchText.includes(w)).length;
          priority.forEach(w => { if (searchText.includes(w)) score += 3; });
          if (score > bestScore) { bestScore = score; bestKey = key; }
        }

        if (!bestKey || bestScore === 0) {
          // Remove — not in order
          const r = await removeItem(item.id, cartId);
          results.push({ action: 'remove', id: item.id, name: item.name, ...r });
          continue;
        }

        targetMap[bestKey].found = true;
        const targetQty = targetMap[bestKey].targetQty;

        if (item.quantity === targetQty) {
          results.push({ action: 'skip', name: bestKey, qty: targetQty });
          continue;
        }

        // Update quantity
        const r = await updateQty(item.id, cartId, targetQty);
        results.push({ action: 'update', name: bestKey, from: item.quantity, to: targetQty, ...r });
      }

      // Report not found
      const notFound = Object.entries(targetMap)
        .filter(([k, v]) => !v.found).map(([k]) => k);

      return { log, cartItems: cartItems.length, results, notFound, cartId, done: true };
    }, {
      targetMap: Object.fromEntries(Object.entries(targetMap).map(([k, v]) => [k, { targetQty: v.targetQty, found: v.found }])),
      cartIdParam: cartId,
      CART_OPS: CART_OPERATIONS,
    });

    // Log everything
    (result.log || []).forEach(l => console.log('CACHE:', l));
    (result.results || []).forEach(r => console.log('ACTION:', JSON.stringify(r)));
    console.log('Not found:', (result.notFound || []).join(', ') || 'none');
    console.log('Done:', result.done, '| Cart items processed:', result.cartItems);

    // If Apollo cache had no items, we need the UI fallback
    if (!result.done) {
      console.log('Apollo cache empty — cart items must be read from DOM directly');
      console.log('Check logs for DOM item count and text samples above');
    }

    await browser.close();
    return {
      success: true,
      notFound: result.notFound || Object.keys(targetMap),
    };

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
  await sendWhatsApp(from, `Got it ${name}! Placing order...`);
  try {
    const order = await parseOrder(msg);
    if (!Array.isArray(order)) { await sendWhatsApp(from, 'Could not parse order.'); return; }
    const summary = order.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(from, 'Order:\n\n' + summary);
    const result = await placeOrder(order);
    if (result.success) {
      let reply = 'Done! Review:\nmember.restaurantdepot.com/store/business/cart';
      if (result.notFound?.length) {
        reply += '\n\nAdd manually:\n' + result.notFound.map(n => `• ${n}`).join('\n');
      }
      await sendWhatsApp(from, reply);
      await sendEmail(order, name);
    } else {
      await sendWhatsApp(from, 'Error: ' + result.error);
    }
  } catch(e) {
    console.error('Handler:', e.message);
    await sendWhatsApp(from, 'Error placing order.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent'));
app.listen(process.env.PORT || 3000, () => console.log('Running'));

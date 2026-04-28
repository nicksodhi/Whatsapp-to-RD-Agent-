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

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
      messages: [{ role: 'user', content:
        'You are an ordering assistant for Naan & Curry restaurant.\n\nItem mapping:\n' + itemMapStr +
        '\n\nRules:\n- IGNORE headers, dates, names\n- ONLY add items with a quantity number\n' +
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

function scoreMatch(text, itemName) {
  const t = text.toLowerCase();
  const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ')
    .filter(w => w.length >= 3 && !['lbs','pkg','and','the','for','all','out','can','dry'].includes(w));
  const priority = words.filter(w => w.length >= 6);
  let score = words.filter(w => t.includes(w)).length;
  priority.forEach(w => { if (t.includes(w)) score += 3; });
  return score;
}

// ── BROWSER GRAPHQL — runs inside page.evaluate, uses browser cookies ─────────
// This is the core of the new approach. By running fetch() from inside the
// browser context, we get full authentication for free (cookies are automatic).
// No need to capture or replay auth headers.

const GQL_ENDPOINT = '/graphql';

// Make a GraphQL call from within the browser (uses browser cookies)
const BROWSER_GQL_FN = `
async function browserGQL(operationName, query, variables) {
  const res = await fetch('${GQL_ENDPOINT}', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ operationName, query, variables })
  });
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}
`;

// ── MAIN FLOW ─────────────────────────────────────────────────────────────────

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

  // Intercept GraphQL to capture mutation hashes as they happen
  const capturedMutations = [];
  page.on('request', req => {
    if (req.url().includes('/graphql') && req.method() === 'POST') {
      try {
        const body = JSON.parse(req.postData() || '{}');
        if (body.operationName) {
          const hash = body.extensions?.persistedQuery?.sha256Hash || '';
          capturedMutations.push({ op: body.operationName, hash, vars: body.variables });
          console.log(`GQL MUTATION: ${body.operationName} hash=${hash.slice(0,16)} vars=${JSON.stringify(body.variables).slice(0,150)}`);
        }
      } catch(e) {}
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/graphql') && res.status() === 200) {
      try {
        const reqBody = JSON.parse(res.request().postData() || '{}');
        if (reqBody.operationName && (
          reqBody.operationName.toLowerCase().includes('cart') ||
          reqBody.operationName.toLowerCase().includes('item') ||
          reqBody.operationName.toLowerCase().includes('order')
        )) {
          const body = await res.text();
          console.log(`GQL RESPONSE ${reqBody.operationName}: ${body.slice(0, 500)}`);
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
    console.log('Logged in');

    // ── CLEAR CART via browser GraphQL ───────────────────────────────────────
    // Navigate somewhere to get the page JS running, then clear via API
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(5000);
    console.log('Order guide loaded');

    // Read Apollo cache to get cart ID and current items
    const cartState = await page.evaluate(() => {
      try {
        const cache = window.__APOLLO_CLIENT__.cache.extract();
        const cacheStr = JSON.stringify(cache);
        
        // Find cart items — look for keys with cart item patterns
        const cartItemKeys = Object.keys(cache).filter(k =>
          k.match(/^(CartItem|cart_item|LineItem|line_item):/i)
        );
        
        // Find cart keys
        const cartKeys = Object.keys(cache).filter(k => k.match(/^Cart:/i));
        
        // Find ROOT_QUERY cart references
        const rootQuery = cache.ROOT_QUERY || {};
        
        // Look for any object with quantity and item/product fields
        const itemsWithQty = Object.entries(cache)
          .filter(([k, v]) => v && typeof v === 'object' && 
            'quantity' in v && 
            ('item' in v || 'product' in v || 'catalogItem' in v || 'itemId' in v))
          .map(([k, v]) => ({ key: k, quantity: v.quantity, id: v.id }));
        
        return {
          cacheSize: Object.keys(cache).length,
          cartItemKeys: cartItemKeys.slice(0, 20),
          cartKeys: cartKeys.slice(0, 10),
          itemsWithQty: itemsWithQty.slice(0, 30),
          rootQueryKeys: Object.keys(rootQuery).filter(k => k.includes('cart') || k.includes('Cart')),
          // Sample a few cache entries to understand structure
          sample: Object.entries(cache).slice(0, 5).map(([k, v]) => ({ k, type: typeof v, keys: typeof v === 'object' ? Object.keys(v) : [] })),
        };
      } catch(e) {
        return { error: e.message };
      }
    });
    console.log('Apollo cache state:', JSON.stringify(cartState, null, 2).slice(0, 2000));

    // ── CLEAR CART via GraphQL mutations ─────────────────────────────────────
    // Use browser fetch to remove all existing cart items
    const clearResult = await page.evaluate(async () => {
      try {
        // Get cart items from Apollo cache
        const cache = window.__APOLLO_CLIENT__.cache.extract();
        
        // Find all cart item IDs - they have quantity fields
        const cartItems = Object.entries(cache)
          .filter(([k, v]) => v && typeof v === 'object' && 
            'quantity' in v && v.__typename && v.__typename.toLowerCase().includes('cartitem'))
          .map(([k, v]) => ({ cacheKey: k, id: v.id, qty: v.quantity }));
        
        console.log('Found cart items in cache:', JSON.stringify(cartItems.slice(0, 5)));
        
        // Try to remove each one
        const results = [];
        for (const item of cartItems) {
          // Try different mutation names common to Instacart platform
          const mutations = [
            { name: 'RemoveItemFromCart', query: `mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) { removeItemFromCart(input: $input) { __typename } }`, vars: { input: { cartItemId: item.id } } },
            { name: 'DeleteCartItem', query: `mutation DeleteCartItem($input: DeleteCartItemInput!) { deleteCartItem(input: $input) { __typename } }`, vars: { input: { cartItemId: item.id } } },
            { name: 'RemoveCartItem', query: `mutation RemoveCartItem($input: RemoveCartItemInput!) { removeCartItem(input: $input) { __typename } }`, vars: { input: { cartItemId: item.id } } },
          ];
          
          for (const m of mutations) {
            const res = await fetch('/graphql', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ operationName: m.name, query: m.query, variables: m.vars }),
            });
            const data = await res.json();
            if (!data.errors) {
              results.push({ item: item.id, mutation: m.name, ok: true });
              break;
            }
            results.push({ item: item.id, mutation: m.name, error: JSON.stringify(data.errors).slice(0,100) });
          }
        }
        return { cartItems: cartItems.length, results };
      } catch(e) {
        return { error: e.message };
      }
    });
    console.log('Clear result:', JSON.stringify(clearResult).slice(0, 1000));

    // ── BULK ADD via UI (Playwright) ──────────────────────────────────────────
    // Still use the UI for bulk add — it's the most reliable trigger
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

    await page.waitForTimeout(2000);

    // Click confirm — use .first() to avoid strict mode violation
    try {
      const confirmBtn = page.locator('[data-testid="PromptModalConfirmButton"]').first();
      await confirmBtn.waitFor({ timeout: 10000 });
      await confirmBtn.click();
      console.log('Bulk add confirmed');
    } catch(e) {
      console.log('Confirm error:', e.message);
    }

    // Wait for items to land in cart
    await page.waitForTimeout(8000);
    console.log('Waiting for cart to populate...');

    // ── READ CART via Apollo cache ────────────────────────────────────────────
    const cartItems = await page.evaluate(() => {
      try {
        const cache = window.__APOLLO_CLIENT__.cache.extract();
        
        // Log all cache keys to understand structure
        const allKeys = Object.keys(cache);
        console.log('All cache keys count:', allKeys.length);
        console.log('Key samples:', allKeys.slice(0, 50).join(', '));
        
        // Find cart items by typename containing 'cart' and 'item'
        const items = [];
        Object.entries(cache).forEach(([key, val]) => {
          if (!val || typeof val !== 'object') return;
          const type = (val.__typename || '').toLowerCase();
          if (type.includes('cartitem') || type.includes('cart_item') || type.includes('lineitem')) {
            items.push({
              cacheKey: key,
              id: val.id,
              quantity: val.quantity,
              typename: val.__typename,
              // Get product name from nested references
              allFields: Object.keys(val),
            });
          }
        });
        
        // Also look for items with quantity + some product reference
        const qtyItems = [];
        Object.entries(cache).forEach(([key, val]) => {
          if (!val || typeof val !== 'object') return;
          if (typeof val.quantity === 'number' && val.id && !items.find(i => i.cacheKey === key)) {
            qtyItems.push({ key, id: val.id, qty: val.quantity, type: val.__typename, fields: Object.keys(val) });
          }
        });
        
        return {
          byTypename: items.slice(0, 30),
          byQty: qtyItems.slice(0, 30),
          totalKeys: allKeys.length,
          // Show unique typenames to understand schema
          typenames: [...new Set(Object.values(cache).map(v => v && v.__typename).filter(Boolean))].slice(0, 50),
        };
      } catch(e) {
        return { error: e.message };
      }
    });
    
    console.log('\n=== CART ITEMS FROM APOLLO CACHE ===');
    console.log(JSON.stringify(cartItems, null, 2).slice(0, 4000));

    // ── UPDATE QUANTITIES via browser GraphQL ─────────────────────────────────
    // Based on what we find in the cache, try updating quantities
    const updateResult = await page.evaluate(async (targetMap) => {
      try {
        const cache = window.__APOLLO_CLIENT__.cache.extract();
        const results = [];
        
        // Find all cart items with their product names
        const cartItemEntries = Object.entries(cache).filter(([k, v]) => {
          if (!v || typeof v !== 'object') return false;
          const type = (v.__typename || '').toLowerCase();
          return type.includes('cartitem') || type.includes('cart_item') || type.includes('lineitem');
        });
        
        console.log('Cart item entries:', cartItemEntries.length);
        
        // For each cart item, try to find the product name and update qty if needed
        for (const [cacheKey, cacheVal] of cartItemEntries) {
          const itemId = cacheVal.id;
          const currentQty = cacheVal.quantity;
          
          // Try to find product name from nested cache references
          let productName = '';
          // The product might be referenced as { __ref: 'Item:xxx' }
          const refFields = Object.values(cacheVal).filter(v => v && v.__ref);
          for (const ref of refFields) {
            const refObj = cache[ref.__ref];
            if (refObj && refObj.name) { productName = refObj.name; break; }
            if (refObj && refObj.displayName) { productName = refObj.displayName; break; }
          }
          
          console.log(`Cart item: id=${itemId} qty=${currentQty} name=${productName} key=${cacheKey}`);
          
          // Find matching ordered item
          let bestMatch = null, bestScore = 0;
          for (const [orderedName, entry] of Object.entries(targetMap)) {
            const text = (productName + ' ' + cacheKey).toLowerCase();
            const words = orderedName.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w => w.length >= 3);
            const priority = words.filter(w => w.length >= 6);
            let score = words.filter(w => text.includes(w)).length;
            priority.forEach(w => { if (text.includes(w)) score += 3; });
            if (score > bestScore) { bestScore = score; bestMatch = { name: orderedName, entry }; }
          }
          
          if (!bestMatch || bestScore === 0) {
            // Remove item — not in order
            const removeMutations = [
              { name: 'RemoveItemFromCart', q: `mutation RemoveItemFromCart($input: RemoveItemFromCartInput!) { removeItemFromCart(input: $input) { __typename } }`, v: { input: { cartItemId: itemId } } },
              { name: 'DeleteCartItem', q: `mutation DeleteCartItem($input: DeleteCartItemInput!) { deleteCartItem(input: $input) { __typename } }`, v: { input: { cartItemId: itemId } } },
            ];
            for (const m of removeMutations) {
              const r = await fetch('/graphql', { method: 'POST', headers: {'content-type':'application/json'}, credentials: 'include', body: JSON.stringify({ operationName: m.name, query: m.q, variables: m.v }) });
              const d = await r.json();
              results.push({ action: 'remove', item: itemId, mutation: m.name, ok: !d.errors, detail: JSON.stringify(d).slice(0,200) });
              if (!d.errors) break;
            }
            continue;
          }
          
          bestMatch.entry.found = true;
          const targetQty = bestMatch.entry.targetQty;
          
          if (currentQty === targetQty) {
            results.push({ action: 'skip', item: productName || itemId, qty: currentQty });
            continue;
          }
          
          // Update quantity
          const updateMutations = [
            { name: 'UpdateCartItem', q: `mutation UpdateCartItem($input: UpdateCartItemInput!) { updateCartItem(input: $input) { __typename } }`, v: { input: { cartItemId: itemId, quantity: targetQty } } },
            { name: 'UpdateItemQuantity', q: `mutation UpdateItemQuantity($input: UpdateItemQuantityInput!) { updateItemQuantity(input: $input) { __typename } }`, v: { input: { cartItemId: itemId, quantity: targetQty } } },
            { name: 'ChangeCartItemQuantity', q: `mutation ChangeCartItemQuantity($input: ChangeCartItemQuantityInput!) { changeCartItemQuantity(input: $input) { __typename } }`, v: { input: { cartItemId: itemId, quantity: targetQty } } },
            { name: 'SetItemQuantity', q: `mutation SetItemQuantity($input: SetItemQuantityInput!) { setItemQuantity(input: $input) { __typename } }`, v: { input: { cartItemId: itemId, quantity: targetQty } } },
          ];
          
          for (const m of updateMutations) {
            const r = await fetch('/graphql', { method: 'POST', headers: {'content-type':'application/json'}, credentials: 'include', body: JSON.stringify({ operationName: m.name, query: m.q, variables: m.v }) });
            const d = await r.json();
            results.push({ action: 'update', item: productName || itemId, from: currentQty, to: targetQty, mutation: m.name, ok: !d.errors, detail: JSON.stringify(d).slice(0,300) });
            if (!d.errors) break;
          }
        }
        
        return results;
      } catch(e) {
        return [{ error: e.message }];
      }
    }, targetMap);
    
    console.log('\n=== UPDATE RESULTS ===');
    updateResult.forEach(r => console.log(JSON.stringify(r)));

    // Check which items weren't found
    const notFound = Object.entries(targetMap)
      .filter(([k, v]) => !v.found)
      .map(([k]) => k);
    
    console.log('Not found in cart:', notFound.join(', ') || 'none');

    await browser.close();
    return { success: true, notFound };

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
  await sendWhatsApp(from, `Got it ${name}! Processing your order...`);
  try {
    const order = await parseOrder(msg);
    if (!Array.isArray(order)) { await sendWhatsApp(from, 'Could not parse order.'); return; }
    const summary = order.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(from, 'Placing order:\n\n' + summary);
    const result = await placeOrder(order);
    if (result.success) {
      let reply = 'Done! Review:\nmember.restaurantdepot.com/store/business/cart';
      if (result.notFound?.length) reply += '\n\nAdd manually:\n' + result.notFound.map(n => `• ${n}`).join('\n');
      await sendWhatsApp(from, reply);
      await sendEmail(order, name);
    } else {
      await sendWhatsApp(from, 'Error: ' + result.error);
    }
  } catch(e) {
    console.error('Handler error:', e.message);
    await sendWhatsApp(from, 'Something went wrong.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent'));
app.listen(process.env.PORT || 3000, () => console.log('Running'));

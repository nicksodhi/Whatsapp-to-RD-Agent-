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

// Items ordered as individual units (no case multiplier)
const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb',
  'Micro Orchid Flowers - 4 oz',
  'Taylor Farms - Bagged Cilantro',
  'Lemons, 71-115 ct',
  'Carrots- 10 lb',
];

// Units per case for each item.
// Used to convert "cases ordered" into "cart units" so we know
// what number to dial each cart row up or down to.
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

// ── ORDER PARSER ──────────────────────────────────────────────────────────────

async function parseOrder(message) {
  var itemMapStr = Object.entries(ITEM_MAP).map(function(pair) {
    return '"' + pair[0] + '" -> "' + pair[1] + '"';
  }).join('\n');

  try {
    var response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content:
          'You are an ordering assistant for Naan & Curry restaurant.\n\n' +
          'Item mapping:\n' + itemMapStr + '\n\n' +
          'Rules:\n' +
          '- IGNORE headers, dates, and names (e.g. "RESTAURANT DEPOT", "Mohan", "Sat Apr 25")\n' +
          '- ONLY add items explicitly listed with a quantity number\n' +
          '- Use the EXACT quantity from the order. Never change it or do math.\n' +
          '- Return ONLY a valid JSON array\n\n' +
          'Format: [{"item": "exact name from map values", "quantity": NUMBER}]\n\n' +
          'Order: ' + message
      }]
    });
    var text = response.content[0].text;
    var match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch (err) {
    console.error('Parse error:', err.message);
    return { error: true };
  }
}

// ── MESSAGING ─────────────────────────────────────────────────────────────────

async function sendWhatsApp(to, body) {
  var chunks = body.match(/[\s\S]{1,1400}/g) || [body];
  for (var i = 0; i < chunks.length; i++) {
    await twilioClient.messages.create({
      from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER,
      to: 'whatsapp:' + to,
      body: chunks[i]
    });
    if (chunks.length > 1) await new Promise(function(r) { setTimeout(r, 1000); });
  }
}

async function sendEmail(orderItems, sender) {
  var lines = orderItems.map(function(i) { return '* ' + i.quantity + 'x ' + i.item; }).join('\n');
  await sgMail.send({
    from: 'nicksodhi@gmail.com',
    to: 'nicksodhi@gmail.com',
    subject: 'Restaurant Depot Cart Updated - ' + new Date().toLocaleDateString(),
    text: 'Order by ' + sender + ':\n\n' + lines + '\n\nCheckout: https://member.restaurantdepot.com/store/business/cart'
  });
}

// ── CART HELPERS ──────────────────────────────────────────────────────────────

// Score how well a cart item name matches an ordered item name.
function scoreMatch(cartText, itemName) {
  var t = cartText.toLowerCase();
  var words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
    return w.length >= 3 && ['lbs', 'pkg', 'and', 'the', 'for', 'all', 'out', 'can', 'dry'].indexOf(w) === -1;
  });
  var priority = words.filter(function(w) { return w.length >= 6; });
  var score = 0;
  words.forEach(function(w) { if (t.includes(w)) score++; });
  priority.forEach(function(w) { if (t.includes(w)) score += 3; });
  return score;
}

// Read all current cart items: name and current qty.
async function readCartItems(page) {
  return await page.evaluate(function() {
    var results = [];

    // Broad net — cart rows vary by site but always contain buttons
    var candidates = Array.from(document.querySelectorAll(
      '[class*="cart-item"], [class*="CartItem"], [class*="line-item"], ' +
      '[class*="LineItem"], [class*="product-item"], article, li'
    ));

    candidates.forEach(function(el) {
      if (!el.querySelector('button')) return;
      var text = (el.textContent || '').trim();
      if (text.length < 5 || text.length > 3000) return;

      // Try input field for qty first, then scan spans for a lone integer
      var qty = null;
      var input = el.querySelector('input[type="number"], input[inputmode="numeric"]');
      if (input) {
        qty = parseInt(input.value, 10);
      } else {
        var spans = Array.from(el.querySelectorAll('span, div, p, td'));
        for (var i = 0; i < spans.length; i++) {
          var t = (spans[i].textContent || '').trim();
          if (/^\d+$/.test(t) && parseInt(t, 10) > 0 && parseInt(t, 10) < 1000) {
            qty = parseInt(t, 10);
            break;
          }
        }
      }

      // Prefer a heading/title element for the name; fall back to first line of text
      var titleEl = el.querySelector(
        'h1, h2, h3, h4, h5, [class*="title" i], [class*="name" i], [class*="product" i], [class*="description" i]'
      );
      var name = titleEl ? titleEl.textContent.trim() : text.split('\n')[0].trim();

      if (name && qty !== null && !isNaN(qty)) {
        results.push({ name: name, qty: qty });
      }
    });

    // Deduplicate by name (keep first occurrence)
    var seen = {};
    return results.filter(function(r) {
      if (seen[r.name]) return false;
      seen[r.name] = true;
      return true;
    });
  });
}

// Click a +, -, or Remove button scoped to the cart row for itemName.
async function clickCartButton(page, itemName, direction) {
  return await page.evaluate(function(itemName, direction) {
    var words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
      return w.length >= 3;
    });

    // Find the cart row with the best keyword match
    var candidates = Array.from(document.querySelectorAll(
      '[class*="cart-item"], [class*="CartItem"], [class*="line-item"], ' +
      '[class*="LineItem"], [class*="product-item"], article, li'
    ));
    var bestEl = null, bestScore = 0;
    candidates.forEach(function(el) {
      if (!el.querySelector('button')) return;
      var text = (el.textContent || '').toLowerCase();
      var score = words.filter(function(w) { return text.includes(w); }).length;
      if (score > bestScore) { bestScore = score; bestEl = el; }
    });

    if (!bestEl || bestScore === 0) return 'no-match';

    // Find the right button within that row
    var btns = Array.from(bestEl.querySelectorAll('button, a'));
    var btn = btns.find(function(b) {
      var label = (b.getAttribute('aria-label') || '').toLowerCase();
      var txt   = (b.textContent || '').trim().toLowerCase();
      if (direction === 'increment') return label.includes('increment') || label.includes('increase') || txt === '+';
      if (direction === 'decrement') return label.includes('decrement') || label.includes('decrease') || txt === '-';
      if (direction === 'remove')    return label.includes('remove') || txt === 'remove';
      return false;
    });

    if (!btn) return 'no-button';
    btn.click();
    return 'ok';
  }, itemName, direction);
}

// Bring a cart item from currentQty to targetQty using + or -.
async function adjustCartItemQty(page, itemName, currentQty, targetQty) {
  var delta = targetQty - currentQty;
  if (delta === 0) {
    console.log('  [=] ' + itemName + ' already at ' + targetQty);
    return true;
  }

  var direction = delta > 0 ? 'increment' : 'decrement';
  var clicks = Math.abs(delta);
  console.log('  [' + direction + '] ' + itemName + ': ' + currentQty + ' → ' + targetQty + ' (' + clicks + ' clicks)');

  for (var i = 0; i < clicks; i++) {
    var result = await clickCartButton(page, itemName, direction);
    if (result !== 'ok') {
      console.log('  WARNING: ' + direction + ' failed (' + result + ') on click ' + (i + 1));
      return false;
    }
    await page.waitForTimeout(600);
  }
  return true;
}

// Remove a cart item that isn't in the order.
async function removeCartItem(page, cartName) {
  console.log('  [x] Remove: ' + cartName);

  var result = await clickCartButton(page, cartName, 'remove');

  // Fallback: walk up from a Remove button near the item text
  if (result !== 'ok') {
    result = await page.evaluate(function(cartName) {
      var words = cartName.toLowerCase().split(' ').filter(function(w) { return w.length >= 4; });
      var allBtns = Array.from(document.querySelectorAll('button, a'));
      for (var i = 0; i < allBtns.length; i++) {
        var b = allBtns[i];
        var label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
        if (!label.includes('remove')) continue;
        var parent = b.parentElement;
        for (var depth = 0; depth < 7; depth++) {
          if (!parent) break;
          var pText = (parent.textContent || '').toLowerCase();
          if (words.some(function(w) { return pText.includes(w); })) {
            b.click();
            return 'ok-fallback';
          }
          parent = parent.parentElement;
        }
      }
      return 'failed';
    }, cartName);
  }

  console.log('    Remove result: ' + result);
  await page.waitForTimeout(1500); // Let the row disappear from the DOM
  return result === 'ok' || result === 'ok-fallback';
}

// ── MAIN FLOW ─────────────────────────────────────────────────────────────────

async function placeOrder(orderItems) {
  // Pre-compute target cart quantities.
  // Cart quantities are always in individual units, so we multiply cases × caseSize.
  // Single-only items are ordered in units already.
  var targetMap = {};
  orderItems.forEach(function(oi) {
    var isSingle  = SINGLE_ONLY_ITEMS.indexOf(oi.item) !== -1;
    var caseSize  = CASE_SIZES[oi.item] || 1;
    var targetQty = isSingle ? oi.quantity : oi.quantity * caseSize;
    targetMap[oi.item] = { ordered: oi, targetQty: targetQty, found: false };
    console.log('Target | ' + oi.item + ': ordered=' + oi.quantity + ' caseSize=' + caseSize + ' cartQty=' + targetQty);
  });

  var browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  var context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  var page = await context.newPage();

  try {
    // ── LOGIN ──────────────────────────────────────────────────────────────────
    await page.goto(
      'https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(5000);
    await page.waitForSelector('#email', { timeout: 30000 });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(400);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(400);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in');

    // ── CLEAR EXISTING CART ────────────────────────────────────────────────────
    await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    for (var i = 0; i < 80; i++) {
      var removed = await page.evaluate(function() {
        var els = Array.from(document.querySelectorAll('button, [role="button"], a'));
        var btn = els.find(function(b) {
          var txt  = (b.textContent || '').trim().toLowerCase();
          var aria = (b.getAttribute('aria-label') || '').toLowerCase();
          if (aria.includes('wishlist') || aria.includes('saved')) return false;
          return txt === 'remove' || aria.includes('remove') || (b.innerHTML || '').toLowerCase().includes('trash');
        });
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (!removed) break;
      await page.waitForTimeout(1500);
    }
    console.log('Cart cleared');

    // ── LOAD ORDER GUIDE AND BULK-ADD EVERYTHING ───────────────────────────────
    await page.goto(
      'https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'domcontentloaded', timeout: 30000 }
    );
    await page.waitForTimeout(6000);

    var bulkLabel = await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll('button'));
      // The bulk button says "Add 54 items to cart" (or similar large count)
      var bulk = btns.find(function(b) {
        var m = b.textContent.match(/add\s+(\d+)\s+items?\s+to\s+cart/i);
        return m && parseInt(m[1], 10) >= 10;
      });
      if (bulk) { bulk.click(); return bulk.textContent.trim(); }
      return null;
    });

    if (!bulkLabel) {
      throw new Error('Could not find bulk "Add all to cart" button on order guide page');
    }
    console.log('Bulk add: ' + bulkLabel);
    await page.waitForTimeout(6000); // Wait for the full cart to populate

    // ── GO TO CART ─────────────────────────────────────────────────────────────
    await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    var cartItems = await readCartItems(page);
    console.log('Cart loaded: ' + cartItems.length + ' items');
    cartItems.forEach(function(ci) { console.log('  cart | ' + ci.name + ' qty=' + ci.qty); });

    // ── MATCH AND ADJUST ───────────────────────────────────────────────────────
    // For every item in the cart:
    //   - If it matches something we ordered → adjust quantity to target
    //   - If it doesn't → remove it
    for (var c = 0; c < cartItems.length; c++) {
      var cartItem = cartItems[c];

      // Find the highest-scoring match in our ordered items
      var bestKey = null, bestScore = 0;
      Object.keys(targetMap).forEach(function(key) {
        var s = scoreMatch(cartItem.name, key);
        if (s > bestScore) { bestScore = s; bestKey = key; }
      });

      if (!bestKey || bestScore === 0) {
        // Item is in the order guide but not in today's order — remove it
        await removeCartItem(page, cartItem.name);
      } else {
        // Item is ordered — adjust qty
        var entry = targetMap[bestKey];
        entry.found = true;
        await adjustCartItemQty(page, bestKey, cartItem.qty, entry.targetQty);
      }
    }

    // ── REPORT ITEMS FROM ORDER NOT FOUND IN CART ──────────────────────────────
    // These were in the WhatsApp order but never appeared after the bulk add,
    // meaning they aren't in the order guide yet. Flag for manual add.
    var notFound = Object.keys(targetMap).filter(function(key) {
      return !targetMap[key].found;
    });

    console.log('Done. Not in guide: ' + (notFound.length ? notFound.join(', ') : 'none'));
    await browser.close();
    return { success: true, notFound: notFound };

  } catch (e) {
    console.error('placeOrder error:', e.message);
    try { await browser.close(); } catch (_) {}
    return { success: false, error: e.message };
  }
}

// ── WHATSAPP WEBHOOK ──────────────────────────────────────────────────────────

app.post('/whatsapp', async function(req, res) {
  res.sendStatus(200);
  var msg  = req.body.Body;
  var from = req.body.From.replace('whatsapp:', '');
  var name = from === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';
  console.log('From ' + name + ': ' + msg);

  if (AUTHORIZED_NUMBERS.indexOf(from) === -1) {
    await sendWhatsApp(from, 'Not authorized');
    return;
  }

  await sendWhatsApp(from, 'Got it ' + name + '! Processing your order...');

  try {
    var order = await parseOrder(msg);
    if (!Array.isArray(order)) {
      await sendWhatsApp(from, 'Could not parse order. Please try again.');
      return;
    }

    var summary = order.map(function(i) { return '• ' + i.quantity + 'x ' + i.item; }).join('\n');
    await sendWhatsApp(from, 'Adding to cart:\n\n' + summary);

    var result = await placeOrder(order);
    if (result.success) {
      var reply = 'Done! Review and checkout:\nmember.restaurantdepot.com/store/business/cart';
      if (result.notFound && result.notFound.length) {
        reply += '\n\nNot in order guide — add manually:\n' +
          result.notFound.map(function(n) { return '• ' + n; }).join('\n');
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

app.get('/', function(req, res) { res.send('Naan & Curry Agent running'); });
app.listen(process.env.PORT || 3000, function() { console.log('Running'); });

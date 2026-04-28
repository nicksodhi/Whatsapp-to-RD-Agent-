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
//
// Confirmed DOM structure from DevTools screenshots:
//
//   <div aria-label="product" role="group">          ← one per cart item
//     ...item name text, price, etc...
//     <button>                                        ← clicking opens stepper modal
//       <span data-testid="cartStepper">1 ct</span>  ← current qty display
//       <span class="screen-reader-only">Quantity: 1 item. Change quantity</span>
//     </button>
//     <button>Remove</button>                         ← remove button within group
//   </div>
//
// After clicking the cartStepper button, the same stepper modal opens as on
// the order guide. The confirm button says "Update cart" (not "Update guide"),
// so we can actually update the quantity successfully.

// Read all cart items from the drawer.
// Returns array of { name, qty }.
async function readCartItems(page) {
  return await page.evaluate(function() {
    var results = [];
    var groups = Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));

    groups.forEach(function(group) {
      // Qty from the cartStepper span: "1 ct", "12 ct", "1 pkg" → number
      var stepper = group.querySelector('[data-testid="cartStepper"]');
      var qty = 1;
      if (stepper) {
        var m = stepper.textContent.match(/(\d+)/);
        if (m) qty = parseInt(m[1], 10);
      }

      // Walk every element in the group. Skip anything inside a <button>
      // (that catches the screen-reader span "Quantity: 1 item. Change quantity").
      // From the remaining elements, pick the longest text that looks like a name.
      var name = '';
      var els = Array.from(group.querySelectorAll('span, p, div, a, h1, h2, h3, h4, h5'));
      els.forEach(function(el) {
        // Check ancestors — skip if inside a button
        var a = el.parentElement;
        while (a && a !== group) {
          if (a.tagName === 'BUTTON') return; // forEach return = continue
          a = a.parentElement;
        }
        // Skip containers (too many children = layout wrapper, not a text node)
        if (el.children.length > 2) return;

        var t = (el.textContent || '').trim();
        if (t.length < 6 || t.length > 130) return;
        if (/quantity:/i.test(t))       return; // screen-reader text
        if (/change quantity/i.test(t)) return; // screen-reader text
        if (/^\$/.test(t))              return; // price
        if (/^(remove|replace|likely|many in stock|about|per\s)/i.test(t)) return;
        // Pure unit descriptors ("32#", "35 lb", "1 gal", "128 z", "40 lb")
        if (/^\d+\.?\d*\s*(#|lbs?|oz|gal|ct|z|fl\s*oz|ml)\s*$/.test(t)) return;

        if (t.length > name.length) name = t;
      });

      // Strip trailing unit that got concatenated onto the name
      // e.g. "James Farm - Plain Yogurt - 32 lbs32#" → "James Farm - Plain Yogurt - 32 lbs"
      // e.g. "Chef's Quality - Lemon Juice - gallon1 gal" → "...gallon"
      name = name.replace(/\s*•\s*.+$/, '').trim();             // strip " • 24 x 16.9 fl oz"
      name = name.replace(/\s*\d+\.?\d*\s*(#|lbs?)\s*$/, '').trim(); // strip "32#", "35 lb"
      name = name.replace(/\s*\d+\.?\d*\s*(gal|fl\s*oz|ml|z|ct)\s*$/, '').trim(); // "1 gal", "128 z"

      if (name.length > 3) results.push({ name: name, qty: qty });
    });

    return results;
  });
}

// Score how well a cart item name matches an ordered item name.
function scoreMatch(cartName, orderedName) {
  var t = cartName.toLowerCase();
  var words = orderedName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
    return w.length >= 3 && ['lbs', 'pkg', 'and', 'the', 'for', 'all', 'out', 'can', 'dry'].indexOf(w) === -1;
  });
  var priority = words.filter(function(w) { return w.length >= 6; });
  var score = 0;
  words.forEach(function(w) { if (t.includes(w)) score++; });
  priority.forEach(function(w) { if (t.includes(w)) score += 3; });
  return score;
}

// Find the product group in the cart that best matches itemName.
// Returns the group element (in-browser), or null.
// This runs inside page.evaluate so it returns a serialisable result —
// we use it by passing itemName and getting back a boolean + clicking inline.
async function clickStepperForItem(page, itemName) {
  return await page.evaluate(function(itemName) {
    var words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
      return w.length >= 3;
    });
    var groups = Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
    var best = null, bestScore = 0;
    groups.forEach(function(g) {
      var text = g.textContent.toLowerCase();
      var score = words.filter(function(w) { return text.includes(w); }).length;
      if (score > bestScore) { bestScore = score; best = g; }
    });
    if (!best || bestScore === 0) return 'no-match';
    var stepperBtn = best.querySelector('[data-testid="cartStepper"]');
    if (!stepperBtn) {
      // Fallback: click the first button in the group (which wraps the stepper)
      stepperBtn = best.querySelector('button');
    }
    if (!stepperBtn) return 'no-stepper';
    stepperBtn.click();
    return 'ok';
  }, itemName);
}

// Click the Remove button scoped to the product group for this item.
async function clickRemoveForItem(page, itemName) {
  return await page.evaluate(function(itemName) {
    var words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
      return w.length >= 3;
    });
    var groups = Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
    var best = null, bestScore = 0;
    groups.forEach(function(g) {
      var text = g.textContent.toLowerCase();
      var score = words.filter(function(w) { return text.includes(w); }).length;
      if (score > bestScore) { bestScore = score; best = g; }
    });
    if (!best || bestScore === 0) return 'no-match';
    var btns = Array.from(best.querySelectorAll('button, a'));
    var removeBtn = btns.find(function(b) {
      var label = (b.getAttribute('aria-label') || '').toLowerCase();
      var text  = (b.textContent || '').trim().toLowerCase();
      return label === 'remove' || text === 'remove';
    });
    if (!removeBtn) return 'no-remove-btn';
    removeBtn.click();
    return 'ok';
  }, itemName);
}

// Increment or decrement inside the open stepper modal.
// Scoped to [role="dialog"] so we never click the wrong item's buttons.
async function clickModalStepper(page, direction) {
  return await page.evaluate(function(direction) {
    var modal = document.querySelector('[role="dialog"]') || document;
    var btns  = Array.from(modal.querySelectorAll('button'));
    var keyword   = direction === 'increment' ? ['increment', 'increase'] : ['decrement', 'decrease'];
    var plusMinus = direction === 'increment' ? '+' : '-';

    var btn = btns.find(function(b) {
      var l = (b.getAttribute('aria-label') || '').toLowerCase();
      var t = b.textContent.trim();
      return keyword.some(function(k) { return l.includes(k); }) || t === plusMinus;
    });
    if (btn) { btn.click(); return btn.getAttribute('aria-label') || btn.textContent.trim(); }
    return 'none';
  }, direction);
}

// Confirm the stepper modal after setting quantity.
// From the cart, the button says "Update cart" (not "Update guide").
async function confirmModal(page) {
  for (var attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await page.waitForTimeout(1000);
    var confirmed = await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll('button')).reverse();
      var labels = btns.map(function(b) { return b.textContent.trim(); }).join(' | ');
      console.log('MODAL_BTNS:' + labels);

      // Priority 1: "Update cart" — the expected button when modifying from cart
      var upd = btns.find(function(b) { return /update\s+cart/i.test(b.textContent); });
      if (upd) { upd.click(); return 'Update cart'; }

      // Priority 2: "Add N items to cart" (N > 0, not the bulk 54-item button)
      for (var i = 0; i < btns.length; i++) {
        var m = btns[i].textContent.match(/add\s+(\d+)\s+items?\s+to\s+cart/i);
        if (m && +m[1] > 0 && +m[1] < 50) { btns[i].click(); return btns[i].textContent.trim(); }
      }

      // Priority 3: plain "Add to cart"
      var plain = btns.find(function(b) { return /^add to cart$/i.test(b.textContent.trim()); });
      if (plain) { plain.click(); return 'Add to cart'; }

      return null;
    });

    if (confirmed) {
      console.log('  Confirmed: ' + confirmed);
      return confirmed;
    }
  }
  console.log('  WARNING: no confirm button found');
  return null;
}

// Wait for the stepper modal to fully disappear.
async function waitForModalClose(page) {
  for (var i = 0; i < 25; i++) {
    await page.waitForTimeout(300);
    var open = await page.evaluate(function() {
      var modal = document.querySelector('[role="dialog"]');
      if (!modal) return false;
      // Modal is "open" only if it contains stepper buttons
      return Array.from(modal.querySelectorAll('button')).some(function(b) {
        var l = (b.getAttribute('aria-label') || '').toLowerCase();
        return l.includes('increment') || l.includes('decrement') || l.includes('increase') || l.includes('decrease');
      });
    });
    if (!open) break;
  }
  await page.waitForTimeout(400);
}

// Adjust a cart item's quantity.
//
// Clicking the cartStepper in the cart drawer opens a product detail PAGE
// (not an inline dialog) with separate unit/case steppers and a Back button.
// DevTools confirmed aria-label="Increment unit quantity" on the + button.
async function adjustCartItemQty(page, itemName, currentQty, targetQty) {
  var delta = targetQty - currentQty;
  if (delta === 0) {
    console.log('  [=] ' + itemName + ' already at ' + targetQty);
    return true;
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  var stepResult = await clickStepperForItem(page, itemName);
  console.log('  [stepper] ' + itemName + ' → ' + stepResult);
  if (stepResult !== 'ok') return false;

  // Wait for product detail page (has unit/case quantity buttons)
  var productPageOpen = false;
  for (var w = 0; w < 20; w++) {
    await page.waitForTimeout(400);
    productPageOpen = await page.evaluate(function() {
      return Array.from(document.querySelectorAll('button')).some(function(b) {
        var l = (b.getAttribute('aria-label') || '').toLowerCase();
        return l.includes('increment unit') || l.includes('decrement unit') ||
               l.includes('increment case') || l.includes('decrement case') ||
               l.includes('increment single') || l.includes('decrement single');
      });
    });
    if (productPageOpen) break;
  }

  if (!productPageOpen) {
    console.log('  WARNING: product page never opened for ' + itemName);
    await page.keyboard.press('Escape');
    return false;
  }

  var direction = delta > 0 ? 'increment' : 'decrement';
  var clicks = Math.abs(delta);
  console.log('  [' + direction + '] ' + itemName + ': ' + currentQty + ' → ' + targetQty + ' (' + clicks + ' clicks)');

  for (var i = 0; i < clicks; i++) {
    var result = await page.evaluate(function(dir) {
      var btns = Array.from(document.querySelectorAll('button'));
      var btn = btns.find(function(b) {
        var l = (b.getAttribute('aria-label') || '').toLowerCase();
        return l.includes(dir + ' unit') || l.includes(dir + ' single');
      });
      // Fallback: plain + or - symbol button
      if (!btn) {
        var sym = dir === 'increment' ? '+' : '-';
        btn = btns.find(function(b) { return b.textContent.trim() === sym; });
      }
      if (btn) { btn.click(); return btn.getAttribute('aria-label') || btn.textContent.trim(); }
      return 'no-btn';
    }, direction);
    console.log('    [' + (i + 1) + '/' + clicks + '] ' + result);
    if (result === 'no-btn') { console.log('  WARNING: no ' + direction + ' button'); break; }
    await page.waitForTimeout(500);
  }

  // Click Back to return to the cart drawer
  await page.waitForTimeout(400);
  var backResult = await page.evaluate(function() {
    var btns = Array.from(document.querySelectorAll('button, a'));
    var back = btns.find(function(b) {
      var txt = (b.textContent || '').trim().toLowerCase();
      var lbl = (b.getAttribute('aria-label') || '').toLowerCase();
      return txt === 'back' || lbl === 'back' || lbl.includes('go back');
    });
    if (back) { back.click(); return 'ok'; }
    return 'no-back';
  });
  console.log('  [back] ' + backResult);
  if (backResult !== 'ok') await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  return true;
}

// Remove a cart item that isn't in today's order.
async function removeCartItem(page, cartName) {
  console.log('  [x] Remove: ' + cartName);
  var result = await clickRemoveForItem(page, cartName);
  console.log('    ' + result);
  if (result !== 'ok') {
    console.log('  WARNING: could not find Remove for "' + cartName + '" — skipping');
    return false;
  }
  await page.waitForTimeout(1500);
  return true;
}

// ── MAIN FLOW ─────────────────────────────────────────────────────────────────

async function placeOrder(orderItems) {
  // Build target qty map: ordered cases → cart units
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

    // ── CLEAR CART ─────────────────────────────────────────────────────────────
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

    // ── LOAD ORDER GUIDE ───────────────────────────────────────────────────────
    // Use 'load' so React fully hydrates before we look for buttons.
    await page.goto(
      'https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      { waitUntil: 'load', timeout: 45000 }
    );
    await page.waitForTimeout(3000);

    // ── BULK ADD ALL GUIDE ITEMS ───────────────────────────────────────────────
    // Use data-testid="add-all-items-button" — more reliable than text matching.
    // Poll for the button — it may appear a few seconds after page load.
    var bulkLabel = null;
    for (var bulkAttempt = 0; bulkAttempt < 20; bulkAttempt++) {
      bulkLabel = await page.evaluate(function() {
        var btn = document.querySelector('[data-testid="add-all-items-button"]');
        if (!btn) {
          var btns = Array.from(document.querySelectorAll('button'));
          btn = btns.find(function(b) {
            var m = (b.textContent || '').trim().match(/add\s+(\d+)\s+items?\s+to\s+cart/i);
            return m && parseInt(m[1], 10) >= 10;
          });
        }
        if (btn) { btn.click(); return (btn.textContent || '').trim(); }
        return null;
      });
      if (bulkLabel) break;
      console.log('Waiting for bulk add button... attempt ' + (bulkAttempt + 1));
      await page.waitForTimeout(1500);
    }

    if (!bulkLabel) throw new Error('Could not find bulk "Add all to cart" button after 30s');
    console.log('Bulk add clicked: ' + bulkLabel);

    // The site shows a confirmation modal: "Add 54 items to cart?
    // We'll add 1 of each item... Yes, continue / Nevermind"
    // We must click "Yes, continue" or nothing gets added.
    // data-testid="PromptModalConfirmButton" is the reliable hook.
    var confirmed = false;
    for (var attempt = 0; attempt < 15; attempt++) {
      await page.waitForTimeout(1000);
      confirmed = await page.evaluate(function() {
        var btn = document.querySelector('[data-testid="PromptModalConfirmButton"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      if (confirmed) break;
    }
    if (!confirmed) throw new Error('Bulk add confirmation modal never appeared');
    console.log('Bulk add confirmed ("Yes, continue" clicked)');

    // The cart is a drawer overlay — do NOT navigate away from the order guide.
    // Instead, click the cart icon in the header to open the drawer on this page.
    // Give the bulk add a moment to register before we open it.
    await page.waitForTimeout(4000);

    // ── OPEN CART DRAWER ───────────────────────────────────────────────────────
    var drawerOpened = false;
    for (var drawerAttempt = 0; drawerAttempt < 15; drawerAttempt++) {
      drawerOpened = await page.evaluate(function() {
        var btns = Array.from(document.querySelectorAll('button'));
        // Cart icon button: aria-label="View Cart. Items in cart: 53"
        var cartBtn = btns.find(function(b) {
          var l = (b.getAttribute('aria-label') || '').toLowerCase();
          return l.includes('view cart') || l.includes('cart. items') || l.includes('items in cart');
        });
        if (cartBtn) { cartBtn.click(); return true; }
        return false;
      });
      if (drawerOpened) break;
      console.log('Waiting for cart icon... attempt ' + (drawerAttempt + 1));
      await page.waitForTimeout(1000);
    }
    if (!drawerOpened) throw new Error('Could not find cart icon button to open drawer');
    console.log('Cart drawer opened');

    // Wait for cartStepper elements — these only exist inside the cart drawer,
    // NOT on the order guide page. Using [aria-label="product"][role="group"]
    // was matching order guide cards before the drawer loaded, giving 0 items.
    await page.waitForSelector('[data-testid="cartStepper"]', { timeout: 20000 });
    await page.waitForTimeout(2000); // let all items render fully

    // Read cart items — retry if needed
    var cartItems = [];
    for (var retry = 0; retry < 5; retry++) {
      cartItems = await readCartItems(page);
      if (cartItems.length > 0) break;
      console.log('Cart read attempt ' + (retry + 1) + ' returned 0 items — retrying...');
      await page.waitForTimeout(2000);
    }

    console.log('Cart loaded: ' + cartItems.length + ' items');
    cartItems.forEach(function(ci) {
      console.log('  cart | "' + ci.name + '" qty=' + ci.qty);
    });

    // ── MATCH, ADJUST, AND REMOVE ──────────────────────────────────────────────
    for (var c = 0; c < cartItems.length; c++) {
      var cartItem = cartItems[c];

      // Find best match in the ordered items
      var bestKey = null, bestScore = 0;
      Object.keys(targetMap).forEach(function(key) {
        var s = scoreMatch(cartItem.name, key);
        if (s > bestScore) { bestScore = s; bestKey = key; }
      });

      if (!bestKey || bestScore === 0) {
        await removeCartItem(page, cartItem.name);
      } else {
        var entry = targetMap[bestKey];
        entry.found = true;
        await adjustCartItemQty(page, bestKey, cartItem.qty, entry.targetQty);
      }
    }

    // ── REPORT MISSING ─────────────────────────────────────────────────────────
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

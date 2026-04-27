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

// Items that are always ordered as individual singles (no case)
const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb',
  'Micro Orchid Flowers - 4 oz',
  'Taylor Farms - Bagged Cilantro',
  'Lemons, 71-115 ct',
  'Carrots- 10 lb',
];

// How many individual units are in one case of each item.
// Used ONLY when the item has no case+ button (falls back to clicking single+ repeatedly).
// If the item has a case+ button, we just click it N times and ignore this table.
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
  'yellow onions':      'Jumbo Spanish Onions - 50 lbs',
  'red onions':         'Jumbo Red Onions - 25 lbs',
  'potato':             'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'potatoes':           'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'garlic':             'Peeled Garlic',
  'ginger':             'Fresh Ginger - 30 lbs',
  'paneer':             'Royal Mahout - Paneer Loaf - 5 lbs',
  'flowers':            'Micro Orchid Flowers - 4 oz',
  'garnish':            'Micro Orchid Flowers - 4 oz',
  'cilantro':           'Taylor Farms - Bagged Cilantro',
  'cucumber':           'Cucumbers - 6 ct',
  'cauliflower':        'White Cauliflower',
  'carrots':            'Carrots- 10 lb',
  'lemon':              'Lemons, 71-115 ct',
  'lemons':             'Lemons, 71-115 ct',
  'mint':               'Herb - Mint- 1lb',
  'heavy cream':        'James Farm - Heavy Cream, 40% - 64 oz',
  'milk':               'MILK WHL GAL GS/AN',
  'yogurt':             'James Farm - Plain Yogurt - 32 lbs',
  'cheese':             'James Farm - Shredded Cheddar Jack Cheese - 5 lbs',
  'chicken breast':     'Boneless, Skinless Chicken Breasts, Tenders Out, Dry',
  'chicken thighs':     'Boneless, Skinless Jumbo Chicken Thighs',
  'chicken leg quarters': 'Fresh Chicken Leg Quarters - 40 lbs',
  'chicken wings':      'Jumbo Chicken Party Wings (6-8 ct)',
  'wings':              'Jumbo Chicken Party Wings (6-8 ct)',
  'chicken leg meat':   'Fresh Boneless Skinless Chicken Leg Meat',
  'lamb':               'Frozen Halal Boneless Lamb Leg, Australia',
  'goat':               'Thomas Farms - Bone in Goat Cube - #15',
  'tilapia':            'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'fish':               'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'frozen spinach':     'Frozen James Farm - Frozen Chopped Spinach - 3 lbs',
  'frozen peas':        'Frozen James Farm - IQF Peas - 2.5 lbs',
  'frozen broccoli':    'Frozen James Farm - IQF Broccoli Florets - 2 lbs',
  'frozen 4-way mix':   'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  '4-way mix':          'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  'roti atta':          'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'atta':               'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'all purpose flour':  "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'flour':              "Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'baking powder':      'Clabber Girl - Baking Powder - 5 lbs',
  'corn starch':        'Clabber Girl Cornstarch - 3 lbs',
  'rice':               "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'basmati rice':       "Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'garbanzo':           "Chef's Quality - Garbanzo Beans - #10 can",
  'kidney beans':       "Chef's Quality - Dark Red Kidney Beans - #10 cans",
  'salt':               'Morton - Purex Salt - 50lb',
  'sugar':              'C&H - Granulated Sugar - 25 lbs',
  'tomato sauce':       "Chef's Quality - Tomato Sauce - #10 cans",
  'diced tomatoes':     'Isabella - Petite Diced Tomatoes -#10 cans',
  'liquid butter':      "Chef's Quality - Liquid Butter Alternative - gallon",
  'cooking oil':        "Chef's Quality - Soybean Salad Oil - 35 lbs",
  'fryer oil':          "Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs",
  'canola oil':         "Chef's Quality - 100% Canola Salad Oil - 35 lbs",
  'sambal':             'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'sambal chili':       'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'lemon juice':        "Chef's Quality - Lemon Juice - gallon",
  'red food color':     'Felbro - Red Food Coloring - gallon',
  'water':              'Evian - Natural Spring Water, 24 Ct, 500 mL',
  'sprite':             'Sprite Bottles, 16.9 fl oz, 4 Pack',
  'diet coke':          'Diet Coke Bottles, 16.9 fl oz, 24 Pack',
};

async function parseOrder(message) {
  var itemMapStr = Object.entries(ITEM_MAP).map(function(pair) {
    return '"' + pair[0] + '" -> "' + pair[1] + '"';
  }).join('\n');

  try {
    var response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'You are an ordering assistant for Naan & Curry restaurant.\n\nItem mapping:\n' + itemMapStr + '\n\nRules:\n- IGNORE headers, dates, and names (e.g. "RESTAURANT DEPOT", "Mohan", "Sat Apr 25")\n- ONLY add items explicitly listed with a quantity number\n- Use the EXACT quantity from the order. Never change it or do math.\n- Return ONLY a valid JSON array\n\nFormat: [{"item": "exact name from map values", "quantity": NUMBER}]\n\nOrder: ' + message }]
    });
    var text = response.content[0].text;
    var match = text.match(/\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
  } catch (err) {
    console.error('Parse error:', err.message);
    return { error: true };
  }
}

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

// ── MODAL HELPERS ────────────────────────────────────────────────────────────

// FIX 1: Scope increment clicks to the open modal, not the entire page.
// The original bug: after clicking "Update guide" for Orchid Flowers, the
// modal sometimes didn't fully close. Subsequent items (Carrots, Lemons,
// Mint) then found the flowers stepper still in the DOM and kept clicking it,
// which is why the log showed "increment quantity of micro orchid flowers"
// for completely unrelated items.
async function clickIncrementButton(page, preferCase) {
  return await page.evaluate(function(preferCase) {
    // Prefer buttons scoped inside the open modal/drawer/dialog.
    // Fall back to full document only if no modal container is found.
    var modalRoot = (
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[class*="modal" i]') ||
      document.querySelector('[class*="drawer" i]') ||
      document.querySelector('[class*="side-panel" i]') ||
      document.querySelector('[class*="overlay" i]') ||
      document
    );
    var btns = Array.from(modalRoot.querySelectorAll('button'));
    var labeled = btns.map(function(b) {
      return { b: b, l: (b.getAttribute('aria-label') || '').toLowerCase() };
    });
    if (preferCase) {
      var caseBtn = labeled.find(function(x) {
        return x.l.includes('increment case') || x.l.includes('increase case');
      });
      if (caseBtn) { caseBtn.b.click(); return 'case+'; }
    }
    var singleBtn = labeled.find(function(x) {
      return x.l.includes('increment single') || x.l.includes('increase single');
    });
    if (singleBtn) { singleBtn.b.click(); return 'single+'; }
    var anyBtn = labeled.find(function(x) {
      return x.l.includes('increment') || x.l.includes('increase');
    });
    if (anyBtn) { anyBtn.b.click(); return anyBtn.l; }
    var plusBtns = btns.filter(function(b) { return b.textContent.trim() === '+'; });
    if (preferCase && plusBtns.length >= 2) { plusBtns[1].click(); return 'plus-2nd'; }
    if (plusBtns.length >= 1) { plusBtns[0].click(); return 'plus-1st'; }
    return 'none';
  }, preferCase);
}

async function hasCaseButton(page) {
  return await page.evaluate(function() {
    var modalRoot = (
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[class*="modal" i]') ||
      document.querySelector('[class*="drawer" i]') ||
      document
    );
    var btns = Array.from(modalRoot.querySelectorAll('button'));
    return btns.some(function(b) {
      var l = (b.getAttribute('aria-label') || '').toLowerCase();
      return l.includes('increment case') || l.includes('increase case');
    });
  });
}

// FIX 2: Wait for the modal to fully close before moving on to the next item.
// The original bug: after clicking "Update guide", the code did a fixed
// waitForTimeout(1500) but didn't verify the modal actually disappeared.
// The next item's stepper clicks then landed on the still-visible modal.
async function waitForModalClose(page) {
  for (var i = 0; i < 25; i++) {
    await page.waitForTimeout(300);
    var isOpen = await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll('button'));
      return btns.some(function(b) {
        var l = (b.getAttribute('aria-label') || '').toLowerCase();
        return l.includes('increment') || l.includes('increase');
      });
    });
    if (!isOpen) {
      await page.waitForTimeout(300); // one extra tick for DOM to settle
      return;
    }
  }
  // Force close if still open after timeout
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
}

// ── ITEM ADDER ───────────────────────────────────────────────────────────────

async function addItem(page, item) {
  var isSingle = SINGLE_ONLY_ITEMS.indexOf(item.item) !== -1;
  var caseSize = CASE_SIZES[item.item] || 1;
  console.log('\n[' + item.item + '] qty=' + item.quantity + ' single=' + isSingle + ' caseSize=' + caseSize);

  // Ensure any previous modal is fully closed before starting
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await waitForModalClose(page);

  // Find and click the best-matching "Add" button for this item
  var matched = await page.evaluate(function(itemName) {
    var words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
      return w.length >= 3 && ['lbs', 'pkg', 'and', 'the', 'for', 'all', 'out', 'can', 'dry', 'qty', 'per'].indexOf(w) === -1;
    });
    var priority = words.filter(function(w) { return w.length >= 6; });
    var best = null, bestScore = 0;
    var buttons = Array.from(document.querySelectorAll('button'));
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (!label) continue;
      var score = 0;
      for (var j = 0; j < words.length; j++) { if (label.includes(words[j])) score++; }
      for (var k = 0; k < priority.length; k++) { if (label.includes(priority[k])) score += 3; }
      if (score > bestScore) { bestScore = score; best = btn; }
    }
    if (best && bestScore > 0) { best.click(); return best.getAttribute('aria-label'); }
    return null;
  }, item.item);

  if (!matched) { console.log('  NOT FOUND'); return false; }
  console.log('  Matched: ' + matched);

  // Wait for a modal to appear
  var modalType = null;
  for (var attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(400);
    modalType = await page.evaluate(function() {
      var modalRoot = (
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[class*="modal" i]') ||
        document.querySelector('[class*="drawer" i]') ||
        document
      );
      var btns = Array.from(modalRoot.querySelectorAll('button'));
      var labels = btns.map(function(b) { return (b.getAttribute('aria-label') || '').toLowerCase(); });
      if (labels.some(function(l) { return l.includes('increment'); })) return 'stepper';
      var opts = Array.from(document.querySelectorAll('[role="option"]'));
      if (opts.some(function(o) { return /^\d+$/.test(o.textContent.trim()); })) return 'listbox';
      if (document.querySelector('select')) return 'dropdown';
      return null;
    });
    if (modalType) break;
  }
  console.log('  Modal: ' + modalType);
  if (!modalType) { console.log('  Modal never appeared'); return false; }

  // FIX 3: Verify the open modal is for THIS item before touching any steppers.
  // The original bug: the flowers modal would stay open; the next item's button
  // click was registered but the modal that was visible still belonged to flowers.
  // clickIncrementButton then clicked the flowers stepper for carrots, lemons, mint.
  if (modalType === 'stepper') {
    var itemWords = item.item.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function(w) {
      return w.length >= 4;
    });
    var correctModal = await page.evaluate(function(words) {
      var modalRoot = (
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[class*="modal" i]') ||
        document.querySelector('[class*="drawer" i]') ||
        document
      );
      var btns = Array.from(modalRoot.querySelectorAll('button'));
      var labels = btns.map(function(b) { return (b.getAttribute('aria-label') || '').toLowerCase(); });
      var incrementLabels = labels.filter(function(l) { return l.includes('increment'); });
      // At least one keyword from the item name must appear in the stepper labels
      return words.some(function(w) {
        return incrementLabels.some(function(l) { return l.includes(w); });
      });
    }, itemWords);

    if (!correctModal) {
      console.log('  WRONG MODAL — closing and skipping');
      await page.keyboard.press('Escape');
      await waitForModalClose(page);
      return false;
    }
  }

  // ── SET QUANTITY ──────────────────────────────────────────────────────────

  if (modalType === 'listbox') {
    var listResult = await page.evaluate(function(qty) {
      var options = Array.from(document.querySelectorAll('[role="option"]'));
      var target = options.find(function(o) { return o.textContent.trim() === String(qty); });
      if (target) { target.click(); return 'selected ' + qty; }
      var custom = options.find(function(o) { return o.textContent.toLowerCase().includes('custom'); });
      if (custom) { custom.click(); return 'custom'; }
      return 'not found';
    }, item.quantity);
    console.log('  Listbox: ' + listResult);

    if (listResult === 'custom') {
      await page.waitForTimeout(500);
      var numInput = await page.$('input[type="number"], input[inputmode="numeric"]');
      if (numInput) {
        await numInput.fill(String(item.quantity));
        await numInput.dispatchEvent('change');
      }
    }
    await page.waitForTimeout(600);

  } else if (modalType === 'dropdown') {
    await page.evaluate(function(qty) {
      var sel = document.querySelector('select');
      if (sel) { sel.value = String(qty); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, item.quantity);
    console.log('  Dropdown: set to ' + item.quantity);
    await page.waitForTimeout(600);

  } else {
    // STEPPER — decide how many times to click and which button to use
    var useCaseBtn = false;
    var clickCount = item.quantity;

    if (isSingle) {
      useCaseBtn = false;
      clickCount = item.quantity;
    } else {
      var caseExists = await hasCaseButton(page);
      if (caseExists) {
        useCaseBtn = true;
        clickCount = item.quantity;
      } else {
        useCaseBtn = false;
        clickCount = item.quantity * caseSize;
      }
    }

    console.log('  Stepper: useCaseBtn=' + useCaseBtn + ' clicks=' + clickCount);
    for (var i = 0; i < clickCount; i++) {
      var result = await clickIncrementButton(page, useCaseBtn);
      console.log('  [' + (i + 1) + '/' + clickCount + '] ' + result);
      await page.waitForTimeout(700);
    }
  }

  // ── CONFIRM ───────────────────────────────────────────────────────────────
  // FIX 4: Give the UI more time to update the button text before we read it,
  // and increase retry count. The original bug: for many items the "Add N items
  // to cart" button hadn't updated from 0 yet when we first checked, so we fell
  // through to "Update guide" — which saves to the order guide but never adds
  // to cart. That's why Yogurt (4→1), Chicken Breasts (3→1), Flour (5→1),
  // Rice (4→1), and Fry Oil (2→1) all showed wrong quantities.
  await page.waitForTimeout(1200);
  var confirmed = null;
  for (var confirmTry = 0; confirmTry < 5; confirmTry++) {
    if (confirmTry > 0) {
      console.log('  Confirm retry ' + confirmTry);
      await page.waitForTimeout(1200);
    }
    confirmed = await page.evaluate(function() {
      // Reverse so we find the modal button (near bottom of DOM) before the
      // order guide bulk button (near top of page).
      var btns = Array.from(document.querySelectorAll('button')).reverse();
      var cartBtns = btns.filter(function(b) { return /to cart|update/i.test(b.textContent); });
      var labels = cartBtns.map(function(b) { return b.textContent.trim(); }).join(' | ');
      console.log('CART_BTNS:' + labels);

      // Priority 1: "Add N items to cart" where N > 0 and is not the bulk button
      // (bulk button typically says "Add 54 items to cart" or similar large number)
      for (var i = 0; i < cartBtns.length; i++) {
        var m = cartBtns[i].textContent.match(/Add (\d+)/i);
        if (m && +m[1] > 0 && +m[1] < 50) { cartBtns[i].click(); return cartBtns[i].textContent.trim(); }
      }
      // Priority 2: Plain "Add to cart" (no number) — means item being added fresh
      var plain = btns.find(function(b) { return /^add to cart$/i.test(b.textContent.trim()); });
      if (plain) { plain.click(); return 'Add to cart'; }
      // Priority 3: "Update guide" — only as last resort; this saves to the order
      // guide but does NOT add to cart. We log a warning so it's visible.
      var upd = btns.find(function(b) {
        return /update guide/i.test(b.textContent) && !/add \d+ items/i.test(b.textContent);
      });
      if (upd) { upd.click(); return 'UPDATE_GUIDE_ONLY:' + upd.textContent.trim(); }
      return null;
    });
    // If we got a real cart confirmation (not just guide update), break immediately
    if (confirmed && !confirmed.startsWith('UPDATE_GUIDE_ONLY:')) break;
    // If only "Update guide" was available, keep retrying to see if "Add to cart" appears
    if (confirmed && confirmed.startsWith('UPDATE_GUIDE_ONLY:')) {
      console.log('  WARNING: Only "Update guide" found on try ' + (confirmTry + 1) + ' — retrying for Add to cart');
      confirmed = null; // reset and retry
    }
  }

  // FIX 5: If we exhausted retries and never got "Add to cart", that item was NOT
  // added to cart. Log it clearly and return false so it goes in the notFound list.
  if (!confirmed) {
    console.log('  FAILED: No add-to-cart button found after retries');
    await page.keyboard.press('Escape');
    await waitForModalClose(page);
    return false;
  }
  if (confirmed.startsWith('UPDATE_GUIDE_ONLY:')) {
    console.log('  WARNING: Item saved to order guide only, not added to cart: ' + confirmed);
    await waitForModalClose(page);
    return false; // treat as failure so caller includes it in notFound
  }

  console.log('  Confirmed: ' + confirmed);

  // FIX 6: Wait for modal to fully close before moving to the next item.
  await waitForModalClose(page);
  return true;
}

// ── ORDER PLACER ─────────────────────────────────────────────────────────────

async function placeOrder(orderItems) {
  var browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  var context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  var page = await context.newPage();
  page.on('console', function(m) {
    if (m.text().startsWith('CART_BTNS:')) console.log('  BROWSER: ' + m.text());
  });

  try {
    // LOGIN
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.waitForSelector('#email', { timeout: 30000 });
    await page.fill('#email', process.env.RD_EMAIL);
    await page.waitForTimeout(400);
    await page.fill('input[type="password"]', process.env.RD_PASSWORD);
    await page.waitForTimeout(400);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    console.log('Logged in');

    // CLEAR CART
    await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    for (var i = 0; i < 60; i++) {
      var removed = await page.evaluate(function() {
        var els = Array.from(document.querySelectorAll('button, [role="button"]'));
        var btn = els.find(function(b) {
          var txt = (b.textContent || '').trim().toLowerCase();
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

    // LOAD ORDER GUIDE
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    var btnCount = await page.evaluate(function() {
      return document.querySelectorAll('button[aria-label]').length;
    });
    console.log('Order guide loaded - ' + btnCount + ' buttons');

    // PROCESS ITEMS
    var notFound = [];
    for (var j = 0; j < orderItems.length; j++) {
      var ok = await addItem(page, orderItems[j]);
      if (!ok) notFound.push(orderItems[j].item);
    }

    // FIX 7: Log actual failures accurately. The original code printed
    // "Not found: none" even when Cauliflower hit NOT FOUND in the log,
    // because addItem() was returning true in some failure paths.
    console.log('Done. Not found: ' + (notFound.length ? notFound.join(', ') : 'none'));
    await browser.close();
    return { success: true, notFound: notFound };

  } catch (e) {
    console.error('placeOrder error:', e.message);
    try { await browser.close(); } catch (_) {}
    return { success: false, error: e.message };
  }
}

// ── WHATSAPP WEBHOOK ─────────────────────────────────────────────────────────

app.post('/whatsapp', async function(req, res) {
  res.sendStatus(200);
  var msg = req.body.Body;
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

    var summary = order.map(function(i) { return '* ' + i.quantity + 'x ' + i.item; }).join('\n');
    await sendWhatsApp(from, 'Adding to cart:\n\n' + summary);

    var result = await placeOrder(order);
    if (result.success) {
      var reply = 'Done! Checkout:\nmember.restaurantdepot.com/store/business/cart';
      if (result.notFound && result.notFound.length) {
        reply += '\n\nNot added — needs manual fix:\n' + result.notFound.map(function(n) { return '• ' + n; }).join('\n');
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

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
  'Peeled Garlic',
  'White Cauliflower',
  'MILK WHL GAL GS/AN',
  "Chef's Quality - Liquid Butter Alternative - gallon",
  "Chef's Quality - Lemon Juice - gallon",
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz"
];

// BULLETPROOF FIX: We do the case math here in Javascript, not in the AI prompt.
const CASE_CONVERSIONS = {
  "Peeled Garlic": 6,
  "White Cauliflower": 12,
  "MILK WHL GAL GS/AN": 4,
  "Chef's Quality - Liquid Butter Alternative - gallon": 3,
  "Chef's Quality - Lemon Juice - gallon": 4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz": 3
};

const ITEM_MAP = {
  "yellow onions": "Jumbo Spanish Onions - 50 lbs",
  "red onions": "Jumbo Red Onions - 25 lbs",
  "potato": "Potato - 50 lb",
  "potatoes": "Potato - 50 lb",
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
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `You are an ordering assistant for Naan & Curry restaurant.

Item mapping:
${itemMapStr}

Rules:
- IGNORE headers, dates, and employee names (e.g. "Sat, Apr 25 | Mohan", "RESTAURANT DEPOT")
- ONLY add items explicitly listed with a quantity
- Use EXACT quantity from the order. DO NOT DO ANY MATH OR CONVERSIONS.
- Return ONLY a JSON array

Format: [{"item": "exact name from map", "quantity": NUMBER}]

Order: ${message}` }]
    });

    const text = response.content[0].text;
    const match = text.match(/\[[\s\S]*\]/); 
    const jsonStr = match ? match[0] : text;
    let parsedArray = JSON.parse(jsonStr);

    // Apply strict JavaScript math to convert cases to singles
    parsedArray = parsedArray.map(i => {
      if (CASE_CONVERSIONS[i.item]) {
        i.quantity = i.quantity * CASE_CONVERSIONS[i.item];
      }
      return i;
    });

    return parsedArray;

  } catch (err) { 
    console.error("AI Error:", err.message);
    return { error: true, details: err.message }; 
  }
}

async function sendWhatsApp(to, body) {
  await twilioClient.messages.create({ from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, to: 'whatsapp:' + to, body });
}

async function sendEmail(orderItems, sender) {
  await sgMail.send({
    from: 'nicksodhi@gmail.com', to: 'nicksodhi@gmail.com',
    subject: `Restaurant Depot Cart Updated - ${new Date().toLocaleDateString()}`,
    text: `Order by ${sender}:\n\n${orderItems.map(i => `• ${i.quantity}x ${i.item}`).join('\n')}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`
  });
}

async function addItem(page, item) {
  const isSingle = SINGLE_ONLY_ITEMS.includes(item.item);
  console.log(`\n[${item.item}] targetQty=${item.quantity} single=${isSingle}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const found = await page.evaluate((itemName) => {
    const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 4);
    const priority = words.filter(w => w.length >= 6);
    let best = null, bestScore = 0;
    for (const btn of document.querySelectorAll('button')) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (!label) continue;
      if (label.includes('wishlist')) continue;
      const score = words.filter(w => label.includes(w)).length + priority.filter(w => label.includes(w)).length * 3;
      if (score > bestScore) { bestScore = score; best = btn; }
    }
    if (best && bestScore > 0) { best.click(); return best.getAttribute('aria-label') || best.textContent.trim(); }
    return null;
  }, item.item);

  if (!found) { console.log('  NOT FOUND'); return false; }
  console.log(`  Matched initial button: ${found}`);

  let modalReady = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(400);
    modalReady = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const labels = btns.map(b => (b.getAttribute('aria-label') || '').toLowerCase());
      if (labels.some(l => l.includes('increment'))) return 'stepper';
      if (Array.from(document.querySelectorAll('[role="option"]')).some(o => /^\d+$/.test(o.textContent.trim()))) return 'listbox';
      if (document.querySelector('select')) return 'dropdown';
      return false;
    });
    if (modalReady) break;
  }
  
  if (!modalReady) { console.log('  Modal failed'); return false; }

  await page.waitForTimeout(1000);

  if (modalReady === 'listbox') {
    const result = await page.evaluate((qty) => {
      const options = Array.from(document.querySelectorAll('[role="option"]')).reverse();
      const target = options.find(o => o.textContent.trim() === String(qty));
      if (target) { target.click(); return `selected ${qty}`; }
      const custom = options.find(o => o.textContent.toLowerCase().includes('custom'));
      if (custom) { custom.click(); return 'custom'; }
      return 'not found';
    }, item.quantity);
    if (result === 'custom') {
      await page.waitForTimeout(400);
      const input = await page.$('input[type="number"], input[inputmode="numeric"]');
      if (input) {
        await input.fill(String(item.quantity));
        await input.dispatchEvent('change');
      }
    }
    await page.waitForTimeout(600);

  } else if (modalReady === 'dropdown') {
    await page.evaluate((qty) => {
      const sel = document.querySelector('select');
      if (sel) { sel.value = String(qty); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    }, item.quantity);
    await page.waitForTimeout(600);

  } else {
    // THE BULLETPROOF VISUAL FEEDBACK LOOP
    let attempts = 0;
    while(attempts < 35) {
        attempts++;
        await page.waitForTimeout(1200); // 1.2s wait guarantees we read the updated cart state
        
        const state = await page.evaluate(({itemName, targetQty, isSingle}) => {
            const words = itemName.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length >= 4);
            const btns = Array.from(document.querySelectorAll('button')).reverse(); 
            
            let bestBtn = null;
            let bestScore = -1;
            let container = null;
            
            // 1. Locate the specific item container and its + button
            for (const b of btns) {
                const txt = (b.textContent || '').trim().toLowerCase();
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                
                let isPlus = false;
                if (!isSingle && (aria.includes('increment case') || aria.includes('increase case'))) isPlus = true;
                else if (aria.includes('increment single') || aria.includes('increase single')) isPlus = true;
                else if (aria.includes('increment') || aria.includes('increase')) isPlus = true;
                else if (txt === '+') isPlus = true;
                
                if (!isPlus) continue;
                
                let parent = b;
                for(let j=0; j<8; j++) {
                    if(parent.parentElement && parent.parentElement.tagName !== 'BODY') parent = parent.parentElement;
                }
                const containerText = (parent.innerText || '').toLowerCase();
                const score = words.filter(w => containerText.includes(w)).length;
                
                if (score > bestScore) { 
                    bestScore = score; 
                    bestBtn = b; 
                    container = parent;
                }
            }
            
            if (!bestBtn || !container) return { status: 'waiting_for_ui', qty: -1 };
            
            // 2. Visually extract the current quantity displayed on the screen
            let currentQty = 1; 
            let foundQty = null;
            
            const input = container.querySelector('input[type="number"], input[inputmode="numeric"]');
            if(input && input.value) {
                foundQty = parseInt(input.value, 10);
            }
            
            if(foundQty === null) {
                const siblings = Array.from(bestBtn.parentElement.children);
                for(const sib of siblings) {
                    if(sib.tagName !== 'BUTTON') {
                        const txt = (sib.innerText || sib.textContent || '').trim();
                        const m = txt.match(/^(\d+)\s*ct$/i) || txt.match(/^(\d+)$/i);
                        if(m) { foundQty = parseInt(m[1], 10); break; }
                    }
                }
            }
            
            if(foundQty === null) {
                const leafs = Array.from(container.querySelectorAll('*')).filter(el => el.children.length === 0).reverse();
                for(const el of leafs) {
                    const txt = (el.innerText || el.textContent || '').trim();
                    const m = txt.match(/^(\d+)\s*ct$/i);
                    if(m) { foundQty = parseInt(m[1], 10); break; }
                }
            }
            
            if(foundQty !== null) currentQty = foundQty;
            
            // 3. React to what we see
            if(currentQty === targetQty) return { status: 'done', qty: currentQty };
            
            if(currentQty < targetQty) {
                bestBtn.click();
                return { status: 'clicked_plus', qty: currentQty };
            } else {
                const minusBtns = Array.from(container.querySelectorAll('button')).filter(b => {
                    const txt = (b.textContent||'').trim();
                    const aria = (b.getAttribute('aria-label')||'').toLowerCase();
                    return txt === '-' || aria.includes('decrease');
                });
                if(minusBtns.length > 0) {
                    minusBtns[0].click();
                    return { status: 'clicked_minus', qty: currentQty };
                }
                return { status: 'overshot_no_minus_found', qty: currentQty };
            }
            
        }, { itemName: item.item, targetQty: item.quantity, isSingle });
        
        console.log(`  [Stepper Check ${attempts}] UI Qty: ${state.qty} -> Target: ${item.quantity} | Action: ${state.status}`);
        if(state.status === 'done') break;
    }
  }

  await page.waitForTimeout(600);
  const confirmed = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).reverse();
    const cartBtns = btns.filter(b => /to cart|update/i.test(b.textContent));
    for (const b of cartBtns) {
      const m = b.textContent.match(/Add (\d+)/i);
      if (m && +m[1] > 0 && +m[1] < 50) { b.click(); return b.textContent.trim(); }
    }
    const plain = btns.find(b => /^add to cart$/i.test(b.textContent.trim()));
    if (plain) { plain.click(); return 'Add to cart'; }
    const upd = btns.find(b => /update/i.test(b.textContent));
    if (upd) { upd.click(); return upd.textContent.trim(); }
    return null;
  });
  console.log(`  Confirmed: ${confirmed}`);
  await page.waitForTimeout(1500);
  return !!confirmed;
}

async function placeOrder(orderItems) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
  const page = await context.newPage();

  try {
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

    await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    for (let i = 0; i < 60; i++) {
      const removed = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, a, [role="button"]')).reverse();
        const removeBtn = els.find(b => {
          const txt = (b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const html = (b.innerHTML || '').toLowerCase();
          if (aria.includes('wishlist')) return false; 
          return txt === 'remove' || txt === 'delete' || aria.includes('remove') || aria.includes('delete') || html.includes('trash');
        });
        if (removeBtn) { removeBtn.click(); return true; }
        return false;
      });
      if (!removed) break;
      await page.waitForTimeout(1500);
    }
    console.log('Cart cleared');

    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);
    console.log('Order guide loaded');

    const notFound = [];
    for (const item of orderItems) {
      const ok = await addItem(page, item);
      if (!ok) notFound.push(item.item);
    }

    await browser.close();
    console.log('Done. Not found:', notFound.join(', ') || 'none');
    return { success: true, notFound };

  } catch (e) {
    console.error(e.message);
    await browser.close();
    return { success: false, error: e.message };
  }
}

app.post('/whatsapp', async (req, res) => {
  res.sendStatus(200);
  const msg = req.body.Body;
  const from = req.body.From.replace('whatsapp:', '');
  const name = from === process.env.YOUR_WHATSAPP_NUMBER ? 'Nick' : 'Rahul';

  if (!AUTHORIZED_NUMBERS.includes(from)) { await sendWhatsApp(from, '❌ Not authorized'); return; }
  await sendWhatsApp(from, `✅ Got it ${name}! Processing...`);

  try {
    const order = await parseOrder(msg);
    if (order.error) { await sendWhatsApp(from, `❓ Could not parse order: ${order.details || 'Unknown API Error'}`); return; }

    const summary = order.map(i => `• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(from, `📋 Adding to cart:\n\n${summary}`);

    const result = await placeOrder(order);
    if (result.success) {
      let reply = `🎉 Done! Checkout:\nmember.restaurantdepot.com/store/business/cart`;
      if (result.notFound?.length) reply += `\n\n⚠️ Not found: ${result.notFound.join(', ')}`;
      await sendWhatsApp(from, reply);
      await sendEmail(order, name);
    } else {
      await sendWhatsApp(from, `⚠️ Error: ${result.error}`);
    }
  } catch (e) {
    console.error(e);
    await sendWhatsApp(from, '⚠️ Something went wrong. Please order manually.');
  }
});

app.get('/', (req, res) => res.send('Naan & Curry Agent 🍛'));
app.listen(process.env.PORT || 8080, () => console.log('Running'));

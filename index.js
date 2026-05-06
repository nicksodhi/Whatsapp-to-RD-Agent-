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

const AUTHORIZED_NUMBERS = [process.env.YOUR_WHATSAPP_NUMBER, process.env.RAHUL_WHATSAPP_NUMBER];

// Items sold as individual units (no case multiplier)
const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb', 'Micro Orchid Flowers - 4 oz',
  'Lemons, 71-115 ct', 'Carrots- 10 lb',
];

// How many units are in one case
const CASE_SIZES = {
  'Peeled Garlic': 6,
  'White Cauliflower': 12,
  'MILK WHL GAL GS/AN': 4,
  "Chef's Quality - Liquid Butter Alternative - gallon": 3,
  "Chef's Quality - Lemon Juice - gallon": 4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz": 3,
  'James Farm - Heavy Cream, 40% - 64 oz': 6,
  'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs': 12,
  // Cilantro always by case (4 bags)
  'Taylor Farms - Bagged Cilantro': 4,
  // Canned tomatoes always by case (6 cans)
  "Chef's Quality - Tomato Sauce - #10 cans": 6,
  'Isabella - Petite Diced Tomatoes -#10 cans': 6,
  // Paneer always by case (4 ct = 20 lbs)
  'Royal Mahout - Paneer Loaf - 5 lbs': 4,
  // Pan spray always by case (6 cans)
  "Chef's Quality - All Purpose Pan Spray - 17 oz": 6,
  // Shredded cheese always by case (4 bags)
  'James Farm - Shredded Cheddar Jack Cheese - 5 lbs': 4,
  // Fancy shredded cheddar jack — case of 4
  'Fancy Shredded Cheddar Jack Cheese': 4,
  // White vinegar — case of 4 gallons
  'White Vinegar - gallon': 4,
  // Egg yellow color — case of 4 gallons
  'Egg Yellow Food Coloring - gallon': 4,
  // Cleaned spinach — case of 4 bags
  'Cleaned Spinach - 2.5 lbs': 4,
  // Coconut milk — case of 24 cans
  'COCONUT MILK REGULAR - 400ML': 24,
  // Frozen chopped spinach — case of 12
  'Frozen James Farm - Frozen Chopped Spinach - 3 lbs': 12,
  // Garbanzo beans — case of 6 #10 cans
  "Chef's Quality - Garbanzo Beans - #10 can": 6,
  // Shrimp — case of 5
  'SHRP P&D TF 16-20': 5,
};

const ITEM_MAP = {
  'yellow onions': 'Jumbo Spanish Onions - 50 lbs',
  'red onions': 'Jumbo Red Onions - 25 lbs',
  'potato': 'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'potatoes': 'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'garlic': 'Peeled Garlic',
  'ginger': 'Fresh Ginger - 30 lbs',
  'paneer': 'Royal Mahout - Paneer Loaf - 5 lbs',
  'flowers': 'Micro Orchid Flowers - 4 oz',
  'garnish': 'Micro Orchid Flowers - 4 oz',
  'cilantro': 'Taylor Farms - Bagged Cilantro',
  'cucumber': 'Cucumbers - 6 ct',
  'cauliflower': 'White Cauliflower',
  'carrots': 'Carrots- 10 lb',
  'lemon': 'Lemons, 71-115 ct',
  'lemons': 'Lemons, 71-115 ct',
  'mint': 'Herb - Mint- 1lb',
  'heavy cream': 'James Farm - Heavy Cream, 40% - 64 oz',
  'milk': 'MILK WHL GAL GS/AN',
  'yogurt': 'James Farm - Plain Yogurt - 32 lbs',
  'cheese': 'James Farm - Shredded Cheddar Jack Cheese - 5 lbs',
  'chicken breast': 'Boneless, Skinless Chicken Breasts, Tenders Out, Dry',
  // Chicken thighs → always substitute chicken leg meat
  'chicken thighs': 'Fresh Boneless Skinless Chicken Leg Meat',
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
  'salt': 'Morton - Purex Salt - 50lb',
  'sugar': 'C&H - Granulated Sugar - 25 lbs',
  'tomato puree': "Chef's Quality - Tomato Sauce - #10 cans",
  'tomato sauce': "Chef's Quality - Tomato Sauce - #10 cans",
  'diced tomatoes': 'Isabella - Petite Diced Tomatoes -#10 cans',
  'petite diced tomatoes': 'Isabella - Petite Diced Tomatoes -#10 cans',
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
  'diet coca-cola': 'Diet Coke Bottles, 16.9 fl oz, 24 Pack',
  'diet coca cola': 'Diet Coke Bottles, 16.9 fl oz, 24 Pack',
  'coke': 'Coca-Cola Bottles, 16.9 fl oz, 24 Pack',
  'coca-cola': 'Coca-Cola Bottles, 16.9 fl oz, 24 Pack',
  'coca cola': 'Coca-Cola Bottles, 16.9 fl oz, 24 Pack',
  'pan spray': "Chef's Quality - All Purpose Pan Spray - 17 oz",
  'spray': "Chef's Quality - All Purpose Pan Spray - 17 oz",
  'cooking spray': "Chef's Quality - All Purpose Pan Spray - 17 oz",
  'serrano peppers': 'Serrano Peppers',
  'serrano': 'Serrano Peppers',
  'green bell peppers': 'Green Bell Peppers',
  'green peppers': 'Green Bell Peppers',
  'bell peppers': 'Green Bell Peppers',
  'white vinegar': 'White Vinegar - gallon',
  'vinegar': 'White Vinegar - gallon',
  'egg yellow': 'Egg Yellow Food Coloring - gallon',
  'yellow food color': 'Egg Yellow Food Coloring - gallon',
  'cleaned spinach': 'Cleaned Spinach - 2.5 lbs',
  'spinach': 'Cleaned Spinach - 2.5 lbs',
  'fancy shredded cheese': 'Fancy Shredded Cheddar Jack Cheese',
  'fancy cheese': 'Fancy Shredded Cheddar Jack Cheese',
  'cheese blend': 'Fancy Shredded Cheddar Jack Cheese',
  'shrimp': 'SHRP P&D TF 16-20',
  'coconut milk': 'COCONUT MILK REGULAR - 400ML',
};

// Build reverse map: product name → list of all aliases that point to it.
// Used by the matching logic to also score against alias keywords like "shrimp"
// so when the cart shows "Fresh Shrimp - 4 lbs" but our product name is
// "SHRP P&D TF 16-20" we can still match via the alias.
const NAME_TO_ALIASES = {};
Object.entries(ITEM_MAP).forEach(([alias, name]) => {
  if (!NAME_TO_ALIASES[name]) NAME_TO_ALIASES[name] = [];
  NAME_TO_ALIASES[name].push(alias);
});


async function parseOrder(msg) {
  const map = Object.entries(ITEM_MAP).map(([k,v])=>`"${k}" -> "${v}"`).join('\n');
  try {
    const res = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:1000,
      messages:[{role:'user',content:'Ordering assistant for Naan & Curry.\n\nMapping:\n'+map+
        '\n\nRules: IGNORE headers/dates/names. ONLY items with qty. EXACT qty. Return ONLY valid JSON array.\n'+
        'Format: [{"item":"exact name from map values","quantity":NUMBER}]\n\nOrder: '+msg}]});
    const t = res.content[0].text, m = t.match(/\[[\s\S]*\]/);
    return JSON.parse(m?m[0]:t);
  } catch(e) { console.error('parse:',e.message); return {error:true}; }
}

async function sendWhatsApp(to, body) {
  const chunks = body.match(/[\s\S]{1,1400}/g)||[body];
  for (let i=0;i<chunks.length;i++) {
    await twilioClient.messages.create({from:'whatsapp:'+process.env.TWILIO_WHATSAPP_NUMBER,to:'whatsapp:'+to,body:chunks[i]});
    if (chunks.length>1) await new Promise(r=>setTimeout(r,1000));
  }
}

async function sendEmail(items, sender) {
  await sgMail.send({from:'nicksodhi@gmail.com',to:'nicksodhi@gmail.com',
    subject:'RD Cart Updated '+new Date().toLocaleDateString(),
    text:`Order by ${sender}:\n\n${items.map(i=>`* ${i.quantity}x ${i.item}`).join('\n')}\n\nhttps://member.restaurantdepot.com/store/business/cart`});
}

function score(text, name) {
  const t=text.toLowerCase();
  // Filter out generic packaging/qty words that match too many items
  const stop=['lbs','pkg','and','the','for','all','out','can','dry','gal','each','about','fresh','frozen','bag','oz','ct','jar'];
  const words=name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>=3&&!stop.includes(w));
  const pri=words.filter(w=>w.length>=5);          // medium-distinctive
  const dist=words.filter(w=>w.length>=7);          // highly distinctive (brand names, etc.)
  let s=words.filter(w=>t.includes(w)).length;     // base: 1pt per word match
  pri.forEach(w=>{if(t.includes(w))s+=3;});         // +3 for medium-distinctive
  dist.forEach(w=>{if(t.includes(w))s+=5;});        // +5 for super-distinctive
  return s;
}

async function placeOrder(orderItems) {
  const targetMap={};
  orderItems.forEach(oi=>{
    const single=SINGLE_ONLY_ITEMS.includes(oi.item);
    const cs=CASE_SIZES[oi.item]||1;
    const tq=single?oi.quantity:oi.quantity*cs;
    targetMap[oi.item]={targetQty:tq,found:false};
    console.log(`Target | ${oi.item}: ${oi.quantity} × ${cs} = ${tq}`);
  });

  const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const ctx = await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'});
  const page = await ctx.newPage();

  // Capture key network data
  let cartId = null;
  let updateMutationHash = null;
  let updateMutationVarStructure = null; // to learn the variable schema
  const capturedResponses = {}; // op → parsed response body

  page.on('request', req => {
    try {
      if (req.method()==='POST' && req.url().includes('/graphql')) {
        const b = JSON.parse(req.postData()||'{}');
        const vars = b.variables||{};
        // Capture cartId
        if (vars.cartId && !cartId) { cartId = vars.cartId; console.log('cartId=',cartId); }
        if (vars.input?.cartId && !cartId) { cartId = vars.input.cartId; }
        // Capture UpdateCartItemsMutation hash and variable structure
        if (b.operationName === 'UpdateCartItemsMutation') {
          updateMutationHash = b.extensions?.persistedQuery?.sha256Hash;
          updateMutationVarStructure = JSON.stringify(vars).slice(0, 1000);
          console.log('UpdateCartItemsMutation hash=', updateMutationHash);
          console.log('UpdateCartItemsMutation vars=', updateMutationVarStructure);
        }
      }
      if (req.method()==='GET' && req.url().includes('/graphql')) {
        const url = new URL(req.url());
        const vars = JSON.parse(url.searchParams.get('variables')||'{}');
        if (vars.cartId && !cartId) { cartId = vars.cartId; console.log('cartId GET=',cartId); }
      }
    } catch(e) {}
  });

  page.on('response', async res => {
    if (!res.url().includes('/graphql')) return;
    try {
      const url = new URL(res.url());
      const reqBody = res.request().method()==='POST' ? JSON.parse(res.request().postData()||'{}') : {};
      const op = reqBody.operationName || url.searchParams.get('operationName') || '';
      if (!op) return;
      const text = await res.text();
      if (text.length < 100) return;
      const data = JSON.parse(text);
      // Store key responses
      if (['UpdateCartItemsMutation','Items','UniversalReplacements'].includes(op)) {
        if (!capturedResponses[op]) capturedResponses[op] = [];
        capturedResponses[op].push(data);
        console.log(`Captured ${op} (${text.length} bytes)`);
      }
    } catch(e) {}
  });

  try {
    // LOGIN
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F',
      {waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(5000);
    await page.locator('#email').fill(process.env.RD_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.RD_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(6000);
    console.log('Logged in');

    // CLEAR CART
    await page.goto('https://member.restaurantdepot.com/store/business/cart',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(3000);
    let removed=0;
    for(let i=0;i<80;i++){
      const ok=await page.evaluate(()=>{
        const btn=Array.from(document.querySelectorAll('button,a')).find(b=>{
          const t=(b.textContent||'').trim().toLowerCase();
          const a=(b.getAttribute('aria-label')||'').toLowerCase();
          return (t==='remove'||a.includes('remove'))&&!a.includes('wishlist');
        });
        if(btn){btn.click();return true;} return false;
      });
      if(!ok)break;
      await page.waitForTimeout(1200);
      removed++;
    }
    console.log(`Cart cleared: ${removed} items`);

    // ORDER GUIDE
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',
      {waitUntil:'load',timeout:45000});
    await page.waitForTimeout(5000);
    console.log('Order guide loaded, cartId=',cartId);

    // BULK ADD
    let bulkClicked=false;
    for(let i=0;i<20;i++){
      bulkClicked=await page.evaluate(()=>{
        const btn=document.querySelector('[data-testid="add-all-items-button"]')
          || Array.from(document.querySelectorAll('button')).find(b=>/add\s+\d+\s+items?\s+to\s+cart/i.test(b.textContent||''));
        if(btn){btn.click();return true;} return false;
      });
      if(bulkClicked){console.log('Bulk add clicked');break;}
      await page.waitForTimeout(1500);
    }

    // CONFIRM — page.evaluate click (proven reliable, avoids hidden-element issues)
    let confirmed=false;
    for(let i=0;i<25;i++){
      await page.waitForTimeout(600);
      confirmed=await page.evaluate(()=>{
        // Primary: PromptModalConfirmButton that's inside "add items" dialog
        const btns=Array.from(document.querySelectorAll('[data-testid="PromptModalConfirmButton"]'));
        for(const btn of btns){
          const dialog=btn.closest('[role="dialog"],[data-dialog-ref],[aria-label]');
          const txt=((dialog||btn.parentElement||document.body).textContent||'').toLowerCase();
          if(!txt.includes('delete')&&(txt.includes('items to cart')||txt.includes('yes')||txt.includes('continue'))){
            btn.click(); return 'confirmed-testid';
          }
        }
        // Fallback: "Yes, continue" button
        const yes=Array.from(document.querySelectorAll('button')).find(b=>/yes.{0,5}continue/i.test(b.textContent||''));
        if(yes){yes.click();return 'confirmed-yes';}
        return false;
      });
      if(confirmed){console.log('Confirmed:',confirmed);break;}
    }
    if(!confirmed) console.log('WARNING: confirm may not have fired');

    await page.waitForTimeout(7000); // wait for UpdateCartItemsMutation response
    console.log('Post-bulk: cartId=',cartId,'hash=',updateMutationHash,'varStructure=',updateMutationVarStructure);

    // OPEN CART DRAWER
    await page.evaluate(()=>{
      const btn=Array.from(document.querySelectorAll('button')).find(b=>{
        const l=(b.getAttribute('aria-label')||'').toLowerCase();
        return l.includes('view cart')||l.includes('items in cart')||l.includes('cart.');
      });
      if(btn)btn.click();
    });
    await page.waitForTimeout(5000);
    console.log('Cart drawer opened');

    // ── BUILD NAME → CART ITEM ID MAP ────────────────────────────────────────
    // Use UpdateCartItemsMutation response (has cart item IDs)
    // Cross-reference with Items response (has product names)
    // and UniversalReplacements (has productId → cartItemId)

    // Step 1: Extract all cart items with IDs from UpdateCartItemsMutation response
    let allCartItems=[]; // {id, quantity, productId?}
    const updateResp = capturedResponses['UpdateCartItemsMutation']||[];
    for (const resp of updateResp) {
      try {
        const items = resp?.data?.updateCartItems?.cart?.cartItemCollection?.cartItems||[];
        console.log(`UpdateCartItemsMutation has ${items.length} cart items`);
        items.forEach(item=>{
          // The mutation needs itemId in "items_RETAILERLOC-PRODUCTID" format.
          // Build it if not present in response.
          let itemIdPrefixed = item.itemId;
          if (!itemIdPrefixed && item.productId) {
            // retailerLocationId is 473296 (Las Vegas store - from captured request)
            itemIdPrefixed = `items_473296-${item.productId}`;
          }
          allCartItems.push({
            cartItemId: String(item.id),    // numeric cart line ID (33324136827)
            itemIdPrefixed: itemIdPrefixed,  // prefixed item ID for mutations (items_473296-XXX)
            quantity: item.quantity,
            productId: item.productId||item.product?.id||null,
            legacyId: item.legacyId||null,
          });
        });
      } catch(e) { console.log('Parse UpdateCartItemsMutation err:',e.message); }
    }
    console.log(`Total cart items from GQL: ${allCartItems.length}`);

    // Step 2: Build productId → name map from Items query
    const productIdToName={};
    const itemsResp = capturedResponses['Items']||[];
    for (const resp of itemsResp) {
      try {
        const items = resp?.data?.items||[];
        items.forEach(item=>{
          const pid = String(item.productId||'');
          if(pid) productIdToName[pid]=item.name||'';
        });
      } catch(e) {}
    }
    console.log(`Product name map size: ${Object.keys(productIdToName).length}`);

    // Step 3: Build productId → cartItemId from UniversalReplacements
    const productIdToCartItemId={};
    const replResp = capturedResponses['UniversalReplacements']||[];
    for (const resp of replResp) {
      try {
        const sels = resp?.data?.replacementSelections||[];
        sels.forEach(sel=>{
          const ref = sel?.basketItemReference;
          if(ref?.productId && ref?.basketItemReferenceId){
            productIdToCartItemId[String(ref.productId)] = String(ref.basketItemReferenceId);
          }
        });
      } catch(e) {}
    }
    console.log(`ProductId→CartItemId map size: ${Object.keys(productIdToCartItemId).length}`);

    // CRITICAL: Build reverse map cartItemId → productId
    // We need productId to construct itemId in 'items_473296-{productId}' format for mutations.
    const cartItemIdToProductId = {};
    Object.entries(productIdToCartItemId).forEach(([pid, cid]) => {
      cartItemIdToProductId[cid] = pid;
    });
    console.log(`CartItemId→ProductId map size: ${Object.keys(cartItemIdToProductId).length}`);

    // Now backfill itemIdPrefixed on every allCartItems entry using this map
    let backfilled = 0;
    allCartItems.forEach(ci => {
      if (!ci.itemIdPrefixed || ci.itemIdPrefixed.includes('undefined') || ci.itemIdPrefixed.includes('null')) {
        const pid = cartItemIdToProductId[ci.cartItemId] || ci.productId;
        if (pid) {
          ci.itemIdPrefixed = `items_473296-${pid}`;
          ci.productId = pid;
          backfilled++;
        }
      }
    });
    console.log(`Backfilled itemIdPrefixed on ${backfilled} cart items`);
    // Sample check
    allCartItems.slice(0, 3).forEach(ci => 
      console.log(`  ci: cartItemId=${ci.cartItemId} itemIdPrefixed=${ci.itemIdPrefixed} productId=${ci.productId}`)
    );

    // Step 4: Build cartItemId → name map
    // CRITICAL FIX: Read directly from Apollo cache. The cart drawer loads cart items
    // with their full product info into the cache. We traverse __ref chains to get names.
    const cartItemIdToName = {};
    
    const apolloItems = await page.evaluate(() => {
      try {
        const cache = window.__APOLLO_CLIENT__?.cache?.extract();
        if (!cache) return { error: 'no cache' };
        const results = [];
        // Find all cache entries that look like cart items
        Object.entries(cache).forEach(([key, val]) => {
          if (!val || typeof val !== 'object') return;
          const tn = (val.__typename || '').toLowerCase();
          // Cart item — has quantity and id
          if (!tn.includes('cart') && !tn.includes('item') && !tn.includes('basket')) return;
          if (!val.id || typeof val.quantity !== 'number') return;
          
          // Walk all fields for product references
          let productName = null;
          let productId = null;
          
          function walkForName(obj, depth) {
            if (!obj || depth > 3) return;
            if (typeof obj !== 'object') return;
            if (obj.name && typeof obj.name === 'string' && obj.name.length > 3 && !productName) {
              productName = obj.name;
            }
            if (obj.productId && !productId) productId = String(obj.productId);
            // Follow __ref chains
            if (obj.__ref && cache[obj.__ref]) {
              walkForName(cache[obj.__ref], depth + 1);
            }
            // Walk all values
            if (!obj.__ref) {
              Object.values(obj).forEach(v => {
                if (v && typeof v === 'object') walkForName(v, depth + 1);
              });
            }
          }
          walkForName(val, 0);
          
          if (productName || productId) {
            results.push({
              cartItemId: String(val.id),
              quantity: val.quantity,
              productName: productName || '',
              productId: productId || '',
              typename: val.__typename,
            });
          }
        });
        return results;
      } catch(e) { return { error: e.message }; }
    });
    
    console.log(`Apollo lookup found ${Array.isArray(apolloItems) ? apolloItems.length : 0} cart items with names`);
    if (Array.isArray(apolloItems)) {
      apolloItems.slice(0, 5).forEach(i => console.log(`  ${i.cartItemId} (${i.typename}) → "${i.productName}" pid=${i.productId}`));
      apolloItems.forEach(item => {
        if (item.productName) cartItemIdToName[item.cartItemId] = item.productName;
      });
    }
    
    // Fallback: also try the productIdToCartItemId chain in case Apollo is empty
    Object.entries(productIdToCartItemId).forEach(([pid, cid])=>{
      if (!cartItemIdToName[cid]) {
        const name = productIdToName[pid];
        if(name) cartItemIdToName[cid]=name;
      }
    });
    
    console.log(`CartItemId→Name map size: ${Object.keys(cartItemIdToName).length}`);
    Object.entries(cartItemIdToName).slice(0,8).forEach(([cid,name])=>console.log(`  ${cid} → ${name}`));

    // Step 5: Read DOM groups WITH cartItemId from React fiber
    // The cart drawer's product groups have React props containing the cartItemId.
    // Walking the fiber tree extracts it directly — no fuzzy matching needed.
    const domGroups=await page.evaluate(()=>{
      const groups=Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
      return groups.map(g=>{
        // Quantity from cartStepper
        const stepper=g.querySelector('[data-testid="cartStepper"]');
        const qty=stepper?parseInt((stepper.textContent||'').match(/(\d+)/)?.[1]||'1'):1;
        // Name from longest visible text line
        const lines=Array.from(g.querySelectorAll('span,p,div,a'))
          .filter(el=>el.children.length<=2)
          .map(el=>(el.textContent||'').trim())
          .filter(t=>t.length>5&&t.length<150&&!/^\$/.test(t)&&!/^(remove|replace|likely|many|about|quantity|change)/i.test(t));
        const name=lines.reduce((a,b)=>a.length>=b.length?a:b,'');
        // Walk React fiber to find cartItemId (id, cartItemId, itemId in props)
        let cartItemId=null, productId=null;
        const fiberKey=Object.keys(g).find(k=>k.startsWith('__reactFiber')||k.startsWith('__reactInternalInstance'));
        if(fiberKey){
          let fiber=g[fiberKey];
          let depth=0;
          while(fiber&&depth<25){
            const props=fiber.memoizedProps||fiber.pendingProps||{};
            // Look for any field that looks like a cart item id (numeric, 10+ digits)
            for(const k of Object.keys(props)){
              const v=props[k];
              if(typeof v==='string'&&/^\d{10,}$/.test(v)){
                if(!cartItemId&&(k==='id'||k==='cartItemId'||k.toLowerCase().includes('cartitem'))){
                  cartItemId=v;
                }
              }
              // Look for productId
              if(typeof v==='string'&&/^\d{4,9}$/.test(v)&&!productId&&(k==='productId'||k.toLowerCase().includes('product'))){
                productId=v;
              }
              // Also recursively check nested objects (one level)
              if(v&&typeof v==='object'&&!Array.isArray(v)){
                for(const k2 of Object.keys(v)){
                  const v2=v[k2];
                  if(typeof v2==='string'&&/^\d{10,}$/.test(v2)&&!cartItemId&&(k2==='id'||k2==='cartItemId')){
                    cartItemId=v2;
                  }
                  if(typeof v2==='string'&&/^\d{4,9}$/.test(v2)&&!productId&&k2==='productId'){
                    productId=v2;
                  }
                }
              }
            }
            if(cartItemId&&productId)break;
            fiber=fiber.return;
            depth++;
          }
        }
        return{name,qty,cartItemId,productId};
      });
    });
    console.log(`DOM groups: ${domGroups.length}`);
    domGroups.slice(0,5).forEach((g,i)=>console.log(`  DOM[${i}] "${g.name.slice(0,50)}" qty=${g.qty} cartItemId=${g.cartItemId} productId=${g.productId}`));

    // ── MATCH ORDERED ITEMS TO CART ITEM IDs ─────────────────────────────────
    // Match each ordered item to a cart item ID
    const actions=[]; // {cartItemId, name, currentQty, targetQty, action:'update'|'remove'|'skip'}

    // CRITICAL FIX: Use DOM groups directly. Each DOM group has the visible name
    // AND cartItemId from React fiber. This avoids the bad index-based pairing.
    // Fall back to allCartItems by index for any DOM groups missing cartItemId.
    const usedCartItemIds = new Set();

    // Build cart entries: prefer DOM cartItemId, fall back to allCartItems by index
    const cartEntries = domGroups.map((dom, idx) => {
      const cid = dom.cartItemId || allCartItems[idx]?.cartItemId;
      const ci = allCartItems.find(x => x.cartItemId === cid) || allCartItems[idx];
      return {
        cartItemId: cid,
        itemIdPrefixed: (dom.productId ? `items_473296-${dom.productId}` : ci?.itemIdPrefixed) || ci?.itemIdPrefixed,
        name: dom.name,
        quantity: dom.qty,
      };
    }).filter(e => e.cartItemId && e.name);

    console.log(`Cart entries built: ${cartEntries.length}`);
    cartEntries.slice(0,5).forEach(e => console.log(`  entry: "${e.name.slice(0,40)}" qty=${e.quantity} id=${e.cartItemId} prefixed=${e.itemIdPrefixed}`));

    // For each ORDERED item, find single best matching cart entry by name
    for (const orderedKey of Object.keys(targetMap)) {
      let best = null, bestScore = 0;
      // Augment the search name with all aliases (e.g. "shrimp" for "SHRP P&D TF 16-20")
      const aliases = (NAME_TO_ALIASES[orderedKey] || []).join(' ');
      const searchName = orderedKey + ' ' + aliases;
      for (const e of cartEntries) {
        if (usedCartItemIds.has(e.cartItemId)) continue;
        const s = score(e.name, searchName);
        if (s > bestScore) { bestScore = s; best = e; }
      }
      if (best && bestScore >= 2) {
        usedCartItemIds.add(best.cartItemId);
        targetMap[orderedKey].found = true;
        const tq = targetMap[orderedKey].targetQty;
        if (best.quantity === tq) {
          actions.push({cartItemId:best.cartItemId,itemIdPrefixed:best.itemIdPrefixed,name:orderedKey,currentQty:best.quantity,targetQty:tq,action:'skip'});
        } else {
          actions.push({cartItemId:best.cartItemId,itemIdPrefixed:best.itemIdPrefixed,name:orderedKey,currentQty:best.quantity,targetQty:tq,action:'update'});
        }
        console.log(`  matched: "${orderedKey}" → "${best.name.slice(0,50)}" (score=${bestScore})`);
      } else {
        console.log(`  unmatched ordered: "${orderedKey}" (best=${bestScore})`);
      }
    }

    // Cart entries NOT matched → REMOVE
    cartEntries.forEach(e => {
      if (usedCartItemIds.has(e.cartItemId)) return;
      actions.push({cartItemId:e.cartItemId,itemIdPrefixed:e.itemIdPrefixed,name:e.name,currentQty:e.quantity,targetQty:0,action:'remove'});
    });

    console.log(`Actions: ${actions.length} (updates=${actions.filter(a=>a.action==='update').length} removes=${actions.filter(a=>a.action==='remove').length} skips=${actions.filter(a=>a.action==='skip').length})`);
    actions.filter(a=>a.action==='update').forEach(a=>console.log(`  UPDATE ${a.name}: ${a.currentQty}→${a.targetQty} id=${a.cartItemId}`));
    actions.filter(a=>a.action==='remove').forEach(a=>console.log(`  REMOVE ${a.name} id=${a.cartItemId}`));

    // ── EXECUTE ACTIONS via browser fetch ─────────────────────────────────────
    const results = await page.evaluate(async (params) => {
      const { actions, cartId, updateMutationHash } = params;
      const results = [];

      async function gqlFetch(op, query, vars, hash) {
        try {
          const body = { operationName: op, variables: vars };
          if (hash) {
            body.extensions = { persistedQuery: { version: 1, sha256Hash: hash } };
          } else {
            body.query = query;
          }
          const r = await fetch('/graphql', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
          });
          const text = await r.text();
          const data = JSON.parse(text);
          return data;
        } catch(e) {
          return { errors: [{ message: 'fetch error: ' + e.message }] };
        }
      }

      // CONFIRMED EXACT STRUCTURE from network capture:
      // {"cartItemUpdates":[{"itemId":"items_473296-XXXXXXX","quantity":N,"quantityType":"each",...}]}
      // The itemId is the prefixed format (items_RETAILERLOC-PRODUCTID), NOT the numeric cart item ID.
      async function updateQty(itemIdPrefixed, targetQty, cartId, hash) {
        if (!itemIdPrefixed || itemIdPrefixed === 'undefined' || itemIdPrefixed.includes('undefined')) {
          return { ok: false, err: 'no itemIdPrefixed: ' + itemIdPrefixed };
        }
        // Build minimal trackingParams (the site sends huge ones but minimal should work)
        const trackingParams = { trackingProperties: { source: 'cart' } };
        const mutations = [
          // Shape 1 — exact match to captured request
          ['UpdateCartItemsMutation', null, {
            cartItemUpdates: [{
              itemId: itemIdPrefixed,
              quantity: targetQty,
              quantityType: 'each',
              trackingParams,
            }]
          }, hash],
          // Shape 2 — without trackingParams
          ['UpdateCartItemsMutation', null, {
            cartItemUpdates: [{
              itemId: itemIdPrefixed,
              quantity: targetQty,
              quantityType: 'each',
            }]
          }, hash],
          // Shape 3 — bare minimum
          ['UpdateCartItemsMutation', null, {
            cartItemUpdates: [{ itemId: itemIdPrefixed, quantity: targetQty }]
          }, hash],
        ];
        for (const [op, query, vars, h] of mutations) {
          const d = await gqlFetch(op, query, vars, h);
          if (!d.errors) return { ok: true, op, shape: Object.keys(vars.cartItemUpdates[0]).join(',') };
          // Log first error for diagnosis
          console.log('updateQty err:', (d.errors[0]?.message || '').slice(0, 150));
        }
        return { ok: false, err: 'all variants failed' };
      }

      // Remove = quantity 0 with same mutation
      async function removeItem(itemIdPrefixed, cartId, hash) {
        return await updateQty(itemIdPrefixed, 0, cartId, hash);
      }

      for (const action of actions) {
        try {
          if (action.action === 'skip') {
            results.push({ action: 'skip', name: action.name, qty: action.targetQty });
          } else if (action.action === 'update') {
            await new Promise(r => setTimeout(r, 250)); // throttle to avoid hammering server
            const r = await updateQty(action.itemIdPrefixed, action.targetQty, cartId, updateMutationHash);
            results.push({ action: 'update', name: action.name, from: action.currentQty, to: action.targetQty, id: action.itemIdPrefixed, ...r });
          } else if (action.action === 'remove') {
            await new Promise(r => setTimeout(r, 250));
            const r = await removeItem(action.itemIdPrefixed, cartId, updateMutationHash);
            results.push({ action: 'remove', name: action.name, id: action.cartItemId, ...r });
          }
        } catch(e) {
          results.push({ action: action.action, name: action.name, error: e.message });
        }
      }

      return JSON.stringify(results);
    }, { actions, cartId, updateMutationHash });

    // Parse and log results
    let parsedResults = [];
    try { parsedResults = JSON.parse(results); } catch(e) { console.log('Results parse err:', e.message); }
    console.log('=== RESULTS ===');
    let okCount = 0, failCount = 0;
    (results || []).forEach(r => {
      const status = r.ok ? 'OK' : (r.action === 'skip' ? 'SKIP' : 'FAIL');
      console.log(`${status} | ${r.action} | ${(r.name || '').slice(0,50)} | from=${r.from || ''} to=${r.to !== undefined ? r.to : r.qty} | id=${(r.id || '').slice(0,30)} | err=${(r.err || '').slice(0,80)}`);
      if (r.ok) okCount++; else if (r.action !== 'skip') failCount++;
    });
    console.log(`SUMMARY: ${okCount} succeeded, ${failCount} failed`);
    parsedResults.forEach(r => console.log(JSON.stringify(r)));

    const notFound = Object.entries(targetMap).filter(([k,v])=>!v.found).map(([k])=>k);
    console.log('Not found:', notFound.join(', ')||'none');

    await browser.close();
    return { success: true, notFound };

  } catch(e) {
    console.error('placeOrder error:', e.message);
    try { await browser.close(); } catch(_) {}
    return { success: false, error: e.message };
  }
}

// WEBHOOK
app.post('/whatsapp', async(req,res)=>{
  res.sendStatus(200);
  const msg=req.body.Body, from=req.body.From.replace('whatsapp:','');
  const name=from===process.env.YOUR_WHATSAPP_NUMBER?'Nick':'Rahul';
  console.log(`From ${name}: ${msg}`);
  if(!AUTHORIZED_NUMBERS.includes(from)){await sendWhatsApp(from,'Not authorized');return;}
  await sendWhatsApp(from,`Got it ${name}! Placing order...`);
  try {
    const order=await parseOrder(msg);
    if(!Array.isArray(order)){await sendWhatsApp(from,'Could not parse order.');return;}
    await sendWhatsApp(from,'Order:\n\n'+order.map(i=>`• ${i.quantity}x ${i.item}`).join('\n'));
    const result=await placeOrder(order);
    if(result.success){
      const summary=order.map(i=>{
        const cs=CASE_SIZES[i.item]||1;
        const single=SINGLE_ONLY_ITEMS.includes(i.item);
        const finalQty=single?i.quantity:i.quantity*cs;
        const note=(!single&&cs>1)?` (${i.quantity} case${i.quantity>1?'s':''}x${cs})`:''
        return `• ${finalQty}x ${i.item}${note}`;
      }).join('\n');
      let reply=`Cart ready ${name}!\n\n${summary}\n\n🛒 Review & checkout:\nmember.restaurantdepot.com/store/business/cart`;
      if(result.notFound?.length) reply+='\n\n⚠️ Not in guide - add manually:\n'+result.notFound.map(n=>`• ${n}`).join('\n');
      await sendWhatsApp(from,reply);
      await sendEmail(order,name);
    } else {
      await sendWhatsApp(from,`❌ Order failed: ${result.error||'unknown error'}\n\nPlace manually:\nmember.restaurantdepot.com/store/business/cart`);
    }
  } catch(e) {
    console.error('Handler:',e.message);
    await sendWhatsApp(from,'❌ Something went wrong. Place order manually:\nmember.restaurantdepot.com/store/business/cart');
  }
});

app.get('/',(req,res)=>res.send('Naan & Curry Agent'));
app.listen(process.env.PORT||3000,()=>console.log('Running'));

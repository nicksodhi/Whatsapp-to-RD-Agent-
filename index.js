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

const SINGLE_ONLY_ITEMS = [
  'Herb - Mint- 1lb',
  'Micro Orchid Flowers - 4 oz',
  'Lemons, 71-115 ct',
  'Carrots- 10 lb'
];

const CASE_SIZES = {
  'Peeled Garlic': 6,
  'White Cauliflower': 12,
  'MILK WHL GAL GS/AN': 4,
  "Chef's Quality - Liquid Butter Alternative - gallon": 3,
  "Chef's Quality - Lemon Juice - gallon": 4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz": 3,
  'James Farm - Heavy Cream, 40% - 64 oz': 6,
  'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs': 12,
  'Taylor Farms - Bagged Cilantro': 4,
  "Chef's Quality - Tomato Puree - #10 cans": 6,
  "Chef's Quality - Tomato Sauce - #10 cans": 6,
  "Isabella - Petite Diced Tomatoes -#10 cans": 6,
  "Royal Mahout - Paneer Loaf - 5 lbs": 4
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
  
  // Chicken Mapping - AI strictly resolves all thigh requests to Leg Meat
  'chicken breast': 'Boneless, Skinless Chicken Breasts, Tenders Out, Dry',
  'chicken thigh': 'Fresh Boneless Skinless Chicken Leg Meat',
  'chicken thighs': 'Fresh Boneless Skinless Chicken Leg Meat',
  'chicken boneless thighs': 'Fresh Boneless Skinless Chicken Leg Meat',
  'chicken leg meat': 'Fresh Boneless Skinless Chicken Leg Meat',
  'chicken leg quarters': 'Fresh Chicken Leg Quarters - 40 lbs',
  'chicken wings': 'Jumbo Chicken Party Wings (6-8 ct)',
  'wings': 'Jumbo Chicken Party Wings (6-8 ct)',
  
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
  'tomato puree': "Chef's Quality - Tomato Puree - #10 cans",
  'tomato sauce': "Chef's Quality - Tomato Sauce - #10 cans",
  'diced tomatoes': 'Isabella - Petite Diced Tomatoes -#10 cans',
  'petite diced tomato': 'Isabella - Petite Diced Tomatoes -#10 cans',
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

// Seamless fallback if primary is out of stock in the drawer
const FALLBACKS = {
  'Fresh Boneless Skinless Chicken Leg Meat': 'Boneless, Skinless Jumbo Chicken Thighs'
};

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
    text:`Order by ${sender}:\n\n${items.map(i=>`• ${i.quantity}x ${i.item}`).join('\n')}\n\nhttps://member.restaurantdepot.com/store/business/cart`});
}

function score(text, name) {
  const t=text.toLowerCase();
  const stop=['lbs','pkg','and','the','for','all','out','can','dry','gal','each','about','fresh','frozen','bag','oz','ct','jar'];
  const words=name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>=3&&!stop.includes(w));
  const pri=words.filter(w=>w.length>=5);          
  const dist=words.filter(w=>w.length>=7);         
  let s=words.filter(w=>t.includes(w)).length;     
  pri.forEach(w=>{if(t.includes(w))s+=3;});         
  dist.forEach(w=>{if(t.includes(w))s+=5;});        
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

  let cartId = null;
  let updateMutationHash = null;
  let updateMutationVarStructure = null; 
  const capturedResponses = {}; 

  page.on('request', req => {
    try {
      if (req.method()==='POST' && req.url().includes('/graphql')) {
        const b = JSON.parse(req.postData()||'{}');
        const vars = b.variables||{};
        if (vars.cartId && !cartId) { cartId = vars.cartId; }
        if (vars.input?.cartId && !cartId) { cartId = vars.input.cartId; }
        if (b.operationName === 'UpdateCartItemsMutation') {
          updateMutationHash = b.extensions?.persistedQuery?.sha256Hash;
          updateMutationVarStructure = JSON.stringify(vars).slice(0, 1000);
        }
      }
      if (req.method()==='GET' && req.url().includes('/graphql')) {
        const url = new URL(req.url());
        const vars = JSON.parse(url.searchParams.get('variables')||'{}');
        if (vars.cartId && !cartId) { cartId = vars.cartId; }
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
      if (['UpdateCartItemsMutation','Items','UniversalReplacements'].includes(op)) {
        if (!capturedResponses[op]) capturedResponses[op] = [];
        capturedResponses[op].push(data);
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

    // CONFIRM
    let confirmed=false;
    for(let i=0;i<25;i++){
      await page.waitForTimeout(600);
      confirmed=await page.evaluate(()=>{
        const btns=Array.from(document.querySelectorAll('[data-testid="PromptModalConfirmButton"]'));
        for(const btn of btns){
          const dialog=btn.closest('[role="dialog"],[data-dialog-ref],[aria-label]');
          const txt=((dialog||btn.parentElement||document.body).textContent||'').toLowerCase();
          if(!txt.includes('delete')&&(txt.includes('items to cart')||txt.includes('yes')||txt.includes('continue'))){
            btn.click(); return 'confirmed-testid';
          }
        }
        const yes=Array.from(document.querySelectorAll('button')).find(b=>/yes.{0,5}continue/i.test(b.textContent||''));
        if(yes){yes.click();return 'confirmed-yes';}
        return false;
      });
      if(confirmed){break;}
    }

    await page.waitForTimeout(7000); 

    // OPEN CART DRAWER
    await page.evaluate(()=>{
      const btn=Array.from(document.querySelectorAll('button')).find(b=>{
        const l=(b.getAttribute('aria-label')||'').toLowerCase();
        return l.includes('view cart')||l.includes('items in cart')||l.includes('cart.');
      });
      if(btn)btn.click();
    });
    await page.waitForTimeout(5000);

    // ── GQL MAPPING ────────────────────────────────────────
    let allCartItems=[]; 
    const updateResp = capturedResponses['UpdateCartItemsMutation']||[];
    for (const resp of updateResp) {
      try {
        const items = resp?.data?.updateCartItems?.cart?.cartItemCollection?.cartItems||[];
        items.forEach(item=>{
          let itemIdPrefixed = item.itemId;
          if (!itemIdPrefixed && item.productId) {
            itemIdPrefixed = `items_473296-${item.productId}`;
          }
          allCartItems.push({
            cartItemId: String(item.id),    
            itemIdPrefixed: itemIdPrefixed,  
            quantity: item.quantity,
            productId: item.productId||item.product?.id||null,
            legacyId: item.legacyId||null,
          });
        });
      } catch(e) {}
    }

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

    const cartItemIdToProductId = {};
    Object.entries(productIdToCartItemId).forEach(([pid, cid]) => {
      cartItemIdToProductId[cid] = pid;
    });

    allCartItems.forEach(ci => {
      if (!ci.itemIdPrefixed || ci.itemIdPrefixed.includes('undefined') || ci.itemIdPrefixed.includes('null')) {
        const pid = cartItemIdToProductId[ci.cartItemId] || ci.productId;
        if (pid) {
          ci.itemIdPrefixed = `items_473296-${pid}`;
          ci.productId = pid;
        }
      }
    });

    const domGroups=await page.evaluate(()=>{
      const groups=Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
      return groups.map(g=>{
        const stepper=g.querySelector('[data-testid="cartStepper"]');
        const qty=stepper?parseInt((stepper.textContent||'').match(/(\d+)/)?.[1]||'1'):1;
        const lines=Array.from(g.querySelectorAll('span,p,div,a'))
          .filter(el=>el.children.length<=2)
          .map(el=>(el.textContent||'').trim())
          .filter(t=>t.length>5&&t.length<150&&!/^\$/.test(t)&&!/^(remove|replace|likely|many|about|quantity|change)/i.test(t));
        const name=lines.reduce((a,b)=>a.length>=b.length?a:b,'');
        let cartItemId=null, productId=null;
        const fiberKey=Object.keys(g).find(k=>k.startsWith('__reactFiber')||k.startsWith('__reactInternalInstance'));
        if(fiberKey){
          let fiber=g[fiberKey];
          let depth=0;
          while(fiber&&depth<25){
            const props=fiber.memoizedProps||fiber.pendingProps||{};
            for(const k of Object.keys(props)){
              const v=props[k];
              if(typeof v==='string'&&/^\d{10,}$/.test(v)){
                if(!cartItemId&&(k==='id'||k==='cartItemId'||k.toLowerCase().includes('cartitem'))){
                  cartItemId=v;
                }
              }
              if(typeof v==='string'&&/^\d{4,9}$/.test(v)&&!productId&&(k==='productId'||k.toLowerCase().includes('product'))){
                productId=v;
              }
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

    const usedCartItemIds = new Set();
    const actions=[]; 
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

    // ── MATCHING & FALLBACK LOGIC ─────────────────────────────────
    for (const orderedKey of Object.keys(targetMap)) {
      let best = null, bestScore = 0;
      for (const e of cartEntries) {
        if (usedCartItemIds.has(e.cartItemId)) continue;
        const s = score(e.name, orderedKey);
        if (s > bestScore) { bestScore = s; best = e; }
      }

      if ((!best || bestScore < 2) && FALLBACKS[orderedKey]) {
        const fallbackKey = FALLBACKS[orderedKey];
        let fBest = null, fScore = 0;
        for (const e of cartEntries) {
          if (usedCartItemIds.has(e.cartItemId)) continue;
          const s = score(e.name, fallbackKey);
          if (s > fScore) { fScore = s; fBest = e; }
        }
        if (fBest && fScore >= 2) {
          best = fBest;
          bestScore = fScore;
          console.log(`Fallback used: Swapped ${orderedKey} for ${fallbackKey}`);
        }
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
      }
    }

    cartEntries.forEach(e => {
      if (usedCartItemIds.has(e.cartItemId)) return;
      actions.push({cartItemId:e.cartItemId,itemIdPrefixed:e.itemIdPrefixed,name:e.name,currentQty:e.quantity,targetQty:0,action:'remove'});
    });

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
          return JSON.parse(text);
        } catch(e) {
          return { errors: [{ message: 'fetch error: ' + e.message }] };
        }
      }

      async function updateQty(itemIdPrefixed, targetQty, cartId, hash) {
        if (!itemIdPrefixed || itemIdPrefixed.includes('undefined')) return { ok: false, err: 'invalid id' };
        const trackingParams = { trackingProperties: { source: 'cart' } };
        const mutations = [
          ['UpdateCartItemsMutation', null, { cartItemUpdates: [{ itemId: itemIdPrefixed, quantity: targetQty, quantityType: 'each', trackingParams }] }, hash],
          ['UpdateCartItemsMutation', null, { cartItemUpdates: [{ itemId: itemIdPrefixed, quantity: targetQty, quantityType: 'each' }] }, hash],
          ['UpdateCartItemsMutation', null, { cartItemUpdates: [{ itemId: itemIdPrefixed, quantity: targetQty }] }, hash],
        ];
        for (const [op, query, vars, h] of mutations) {
          const d = await gqlFetch(op, query, vars, h);
          if (!d.errors) return { ok: true };
        }
        return { ok: false, err: 'failed' };
      }

      for (const action of actions) {
        try {
          if (action.action === 'skip') {
            results.push({ action: 'skip', name: action.name, qty: action.targetQty });
          } else if (action.action === 'update' || action.action === 'remove') {
            await new Promise(r => setTimeout(r, 250)); 
            const r = await updateQty(action.itemIdPrefixed, action.targetQty, cartId, updateMutationHash);
            results.push({ action: action.action, name: action.name, ...r });
          }
        } catch(e) {
          results.push({ action: action.action, name: action.name, error: e.message });
        }
      }
      return JSON.stringify(results);
    }, { actions, cartId, updateMutationHash });

    let parsedResults = [];
    try { parsedResults = JSON.parse(results); } catch(e) { console.log('Results parse err:', e.message); }
    console.log('=== RESULTS ===');
    (parsedResults || []).forEach(r => {
      console.log(`${r.ok?'OK':(r.action==='skip'?'SKIP':'FAIL')} | ${r.action} | ${(r.name||'').slice(0,50)}`);
    });

    // ── GHOST ITEM UI SWEEPER ────────────────────────────────────────
    // If the API failed to accept `targetQty: 0`, we manually delete the ghost items from the Cart page
    console.log('Starting UI Ghost Item Sweeper...');
    await page.goto('https://member.restaurantdepot.com/store/business/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    const ghostNames = actions.filter(a => a.action === 'remove').map(a => {
        return a.name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w => w.length >= 4).join(' ');
    }).filter(n => n.length > 5);

    if (ghostNames.length > 0) {
      let ghostsBusted = 0;
      for (let i = 0; i < 40; i++) {
        const clicked = await page.evaluate((names) => {
          const groups = Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
          for (const g of groups) {
            const txt = (g.textContent || '').toLowerCase().replace(/[^a-z0-9 ]/g,' ');
            const isGhost = names.some(name => {
               const words = name.split(' ');
               return words.length > 1 && words.every(w => txt.includes(w));
            });
            if (isGhost) {
               const btn = Array.from(g.querySelectorAll('button, a')).find(b => {
                 const t = (b.textContent||'').trim().toLowerCase();
                 const a = (b.getAttribute('aria-label')||'').toLowerCase();
                 return (t==='remove'||a.includes('remove'))&&!a.includes('wishlist');
               });
               if (btn) { btn.click(); return true; }
            }
          }
          return false;
        }, ghostNames);
        
        if (!clicked) break;
        await page.waitForTimeout(1500);
        ghostsBusted++;
      }
      console.log(`UI Sweeper: Busted ${ghostsBusted} ghost items`);
    }

    const notFound = Object.entries(targetMap).filter(([k,v])=>!v.found).map(([k])=>k);
    await browser.close();
    return { success: true, notFound };

  } catch(e) {
    console.error('placeOrder error:', e.message);
    try { await browser.close(); } catch(_) {}
    return { success: false, error: e.message };
  }
}

app.post('/whatsapp', async(req,res)=>{
  res.sendStatus(200);
  const msg=req.body.Body, from=req.body.From.replace('whatsapp:','');
  const name=from===process.env.YOUR_WHATSAPP_NUMBER?'Nick':'Rahul';
  if(!AUTHORIZED_NUMBERS.includes(from)){await sendWhatsApp(from,'Not authorized');return;}
  await sendWhatsApp(from,`Got it ${name}! Placing order...`);
  
  try {
    const order = await parseOrder(msg);
    if(order.error || !Array.isArray(order)){await sendWhatsApp(from,'Could not parse order.');return;}
    
    await sendWhatsApp(from,'Order:\n\n'+order.map(i=>`• ${i.quantity}x ${i.item}`).join('\n'));
    
    const result = await placeOrder(order);
    if (result.success) {
      let reply='🎉 Done!\nmember.restaurantdepot.com/store/business/cart';
      if(result.notFound?.length) reply+='\n\n⚠️ Add manually:\n'+result.notFound.map(n=>`• ${n}`).join('\n');
      await sendWhatsApp(from, reply);
      
      try { await sendEmail(order, name); } catch(emailErr) { console.log('Email failed'); }
      
    } else {
      await sendWhatsApp(from,'❌ Error: '+result.error);
    }
  } catch(e) { 
    await sendWhatsApp(from,'❌ General Error: ' + e.message); 
  }
});

app.get('/',(req,res)=>res.send('Naan & Curry Agent'));
app.listen(process.env.PORT||3000,()=>console.log('Running'));

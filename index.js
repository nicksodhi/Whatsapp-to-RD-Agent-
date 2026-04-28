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

const SINGLE_ONLY_ITEMS = ['Herb - Mint- 1lb','Micro Orchid Flowers - 4 oz','Taylor Farms - Bagged Cilantro','Lemons, 71-115 ct','Carrots- 10 lb'];
const CASE_SIZES = {
  'Peeled Garlic':6,'White Cauliflower':12,'MILK WHL GAL GS/AN':4,
  "Chef's Quality - Liquid Butter Alternative - gallon":3,
  "Chef's Quality - Lemon Juice - gallon":4,
  "Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz":3,
  'James Farm - Heavy Cream, 40% - 64 oz':6,
  'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs':12,
};
const ITEM_MAP = {
  'yellow onions':'Jumbo Spanish Onions - 50 lbs','red onions':'Jumbo Red Onions - 25 lbs',
  'potato':'Russet Potato - 50 lb Crtn, 90 cnt, US #1','potatoes':'Russet Potato - 50 lb Crtn, 90 cnt, US #1',
  'garlic':'Peeled Garlic','ginger':'Fresh Ginger - 30 lbs','paneer':'Royal Mahout - Paneer Loaf - 5 lbs',
  'flowers':'Micro Orchid Flowers - 4 oz','garnish':'Micro Orchid Flowers - 4 oz',
  'cilantro':'Taylor Farms - Bagged Cilantro','cucumber':'Cucumbers - 6 ct','cauliflower':'White Cauliflower',
  'carrots':'Carrots- 10 lb','lemon':'Lemons, 71-115 ct','lemons':'Lemons, 71-115 ct',
  'mint':'Herb - Mint- 1lb','heavy cream':'James Farm - Heavy Cream, 40% - 64 oz',
  'milk':'MILK WHL GAL GS/AN','yogurt':'James Farm - Plain Yogurt - 32 lbs',
  'cheese':'James Farm - Shredded Cheddar Jack Cheese - 5 lbs',
  'chicken breast':'Boneless, Skinless Chicken Breasts, Tenders Out, Dry',
  'chicken thighs':'Boneless, Skinless Jumbo Chicken Thighs',
  'chicken leg quarters':'Fresh Chicken Leg Quarters - 40 lbs',
  'chicken wings':'Jumbo Chicken Party Wings (6-8 ct)','wings':'Jumbo Chicken Party Wings (6-8 ct)',
  'chicken leg meat':'Fresh Boneless Skinless Chicken Leg Meat',
  'lamb':'Frozen Halal Boneless Lamb Leg, Australia','goat':'Thomas Farms - Bone in Goat Cube - #15',
  'tilapia':'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs','fish':'Frozen Tilapia Fillets - 3-5 oz, IQF(China) - 10 lbs',
  'frozen spinach':'Frozen James Farm - Frozen Chopped Spinach - 3 lbs',
  'frozen peas':'Frozen James Farm - IQF Peas - 2.5 lbs',
  'frozen broccoli':'Frozen James Farm - IQF Broccoli Florets - 2 lbs',
  'frozen 4-way mix':'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  '4-way mix':'Frozen James Farm - IQF Mixed Vegetables - 2.5 lbs',
  'roti atta':'Golden Temple - Durum Atta Flour - 2/20 lb Bag','atta':'Golden Temple - Durum Atta Flour - 2/20 lb Bag',
  'all purpose flour':"Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'flour':"Chef's Quality - Hotel & Restaurant All Purpose Flour - 25 lb Bag",
  'baking powder':'Clabber Girl - Baking Powder - 5 lbs','corn starch':'Clabber Girl Cornstarch - 3 lbs',
  'rice':"Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'basmati rice':"Royal Chef's Secret - Extra Long Grain Basmati Rice - 40 lbs",
  'garbanzo':"Chef's Quality - Garbanzo Beans - #10 can",'kidney beans':"Chef's Quality - Dark Red Kidney Beans - #10 cans",
  'salt':'Morton - Purex Salt - 50lb','sugar':'C&H - Granulated Sugar - 25 lbs',
  'tomato sauce':"Chef's Quality - Tomato Sauce - #10 cans",'diced tomatoes':'Isabella - Petite Diced Tomatoes -#10 cans',
  'liquid butter':"Chef's Quality - Liquid Butter Alternative - gallon",
  'cooking oil':"Chef's Quality - Soybean Salad Oil - 35 lbs",
  'fryer oil':"Chef's Quality - Clear Liquid Fry Oil, zero trans fats - 35 lbs",
  'canola oil':"Chef's Quality - 100% Canola Salad Oil - 35 lbs",
  'sambal':'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'sambal chili':'Huy Fong - Sambal Olek (Ground Chili Paste) - 3/136 oz',
  'lemon juice':"Chef's Quality - Lemon Juice - gallon",'red food color':'Felbro - Red Food Coloring - gallon',
  'water':'Evian - Natural Spring Water, 24 Ct, 500 mL','sprite':'Sprite Bottles, 16.9 fl oz, 4 Pack',
  'diet coke':'Diet Coke Bottles, 16.9 fl oz, 24 Pack',
};

async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v])=>`"${k}" -> "${v}"`).join('\n');
  try {
    const res = await anthropic.messages.create({ model:'claude-haiku-4-5-20251001', max_tokens:1000,
      messages:[{role:'user',content:'Ordering assistant for Naan & Curry.\n\nItem mapping:\n'+itemMapStr+
        '\n\nRules: IGNORE headers/dates/names. ONLY items with quantity. EXACT quantity. Return ONLY valid JSON array.\n\n'+
        'Format: [{"item":"exact name from map values","quantity":NUMBER}]\n\nOrder: '+message}]});
    const text=res.content[0].text; const match=text.match(/\[[\s\S]*\]/);
    return JSON.parse(match?match[0]:text);
  } catch(e){console.error('parseOrder:',e.message);return{error:true};}
}

async function sendWhatsApp(to,body) {
  const chunks=body.match(/[\s\S]{1,1400}/g)||[body];
  for(let i=0;i<chunks.length;i++){
    await twilioClient.messages.create({from:'whatsapp:'+process.env.TWILIO_WHATSAPP_NUMBER,to:'whatsapp:'+to,body:chunks[i]});
    if(chunks.length>1)await new Promise(r=>setTimeout(r,1000));
  }
}

async function sendEmail(orderItems,sender) {
  const lines=orderItems.map(i=>`* ${i.quantity}x ${i.item}`).join('\n');
  await sgMail.send({from:'nicksodhi@gmail.com',to:'nicksodhi@gmail.com',
    subject:'Restaurant Depot Cart Updated - '+new Date().toLocaleDateString(),
    text:`Order by ${sender}:\n\n${lines}\n\nCheckout: https://member.restaurantdepot.com/store/business/cart`});
}

function scoreMatch(text,itemName) {
  const t=text.toLowerCase();
  const words=itemName.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>=3&&!['lbs','pkg','and','the','for','all','out','can','dry'].includes(w));
  const priority=words.filter(w=>w.length>=6);
  let score=words.filter(w=>t.includes(w)).length;
  priority.forEach(w=>{if(t.includes(w))score+=3;});
  return score;
}

async function placeOrder(orderItems) {
  const targetMap={};
  orderItems.forEach(oi=>{
    const isSingle=SINGLE_ONLY_ITEMS.includes(oi.item);
    const caseSize=CASE_SIZES[oi.item]||1;
    const targetQty=isSingle?oi.quantity:oi.quantity*caseSize;
    targetMap[oi.item]={ordered:oi,targetQty,found:false};
    console.log(`Target | ${oi.item}: ordered=${oi.quantity} case=${caseSize} cartQty=${targetQty}`);
  });

  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const context=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'});
  const page=await context.newPage();

  // ── NETWORK INTERCEPTION ─────────────────────────────────────────────────
  let cartId=null;
  // Collect ALL graphql responses that look like cart data
  const gqlResponses=[];
  
  page.on('request',req=>{
    if(!req.url().includes('/graphql'))return;
    try{
      // Capture cartId from GET query params
      const url=new URL(req.url());
      const vars=JSON.parse(url.searchParams.get('variables')||'{}');
      if(vars.cartId&&!cartId){cartId=vars.cartId;console.log('cartId:',cartId);}
      // Capture cartId from POST body
      if(req.method()==='POST'){
        const body=JSON.parse(req.postData()||'{}');
        const v=body.variables||{};
        if(v.cartId&&!cartId){cartId=v.cartId;console.log('cartId POST:',cartId);}
        if(v.input?.cartId&&!cartId){cartId=v.input.cartId;console.log('cartId input:',cartId);}
      }
    }catch(e){}
  });

  page.on('response',async res=>{
    if(!res.url().includes('/graphql'))return;
    try{
      const url=new URL(res.url());
      const op=url.searchParams.get('operationName')||(res.request().method()==='POST'?JSON.parse(res.request().postData()||'{}').operationName:'');
      const text=await res.text();
      // Store all substantial responses
      if(text.length>200){
        gqlResponses.push({op,text,url:res.url().slice(0,100)});
        // Log any response mentioning cart items
        if(text.includes('"quantity"')&&(text.includes('"id"'))&&text.length>500){
          console.log(`GQL [${op}] len=${text.length}: ${text.slice(0,300)}`);
        }
      }
    }catch(e){}
  });

  try {
    // ── LOGIN ───────────────────────────────────────────────────────────────
    await page.goto('https://member.restaurantdepot.com/rest/sso/auth/restaurantdepot/init?return_to=https%3A%2F%2Fwww.restaurantdepot.com%2F',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(5000);
    await page.locator('#email').fill(process.env.RD_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.RD_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(6000);
    console.log('Logged in');

    // ── CLEAR CART via UI ────────────────────────────────────────────────────
    await page.goto('https://member.restaurantdepot.com/store/business/cart',{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(3000);
    let removed=0;
    for(let i=0;i<80;i++){
      const btn=await page.evaluate(()=>{
        const els=Array.from(document.querySelectorAll('button,a'));
        const b=els.find(b=>{
          const txt=(b.textContent||'').trim().toLowerCase();
          const aria=(b.getAttribute('aria-label')||'').toLowerCase();
          if(aria.includes('wishlist')||aria.includes('saved'))return false;
          return txt==='remove'||aria.includes('remove');
        });
        if(b){b.click();return true;}return false;
      });
      if(!btn)break;
      await page.waitForTimeout(1200);
      removed++;
    }
    console.log(`Cart cleared (${removed} items removed)`);

    // ── LOAD ORDER GUIDE ─────────────────────────────────────────────────────
    await page.goto('https://member.restaurantdepot.com/store/business/order-guide/19933806363004568',{waitUntil:'load',timeout:45000});
    await page.waitForTimeout(5000);
    console.log('Order guide loaded, cartId=',cartId);

    // ── BULK ADD ─────────────────────────────────────────────────────────────
    let bulkClicked=false;
    for(let attempt=0;attempt<20;attempt++){
      const clicked=await page.evaluate(()=>{
        // Try data-testid first
        let btn=document.querySelector('[data-testid="add-all-items-button"]');
        if(!btn){
          // Fallback: find by text
          btn=Array.from(document.querySelectorAll('button')).find(b=>{
            const m=(b.textContent||'').trim().match(/add\s+(\d+)\s+items?\s+to\s+cart/i);
            return m&&parseInt(m[1])>=10;
          });
        }
        if(btn){btn.click();return (btn.textContent||'').trim();}
        return null;
      });
      if(clicked){console.log('Bulk add clicked:',clicked);bulkClicked=true;break;}
      await page.waitForTimeout(1500);
    }
    if(!bulkClicked)throw new Error('Bulk add button not found');

    // ── CONFIRM MODAL via page.evaluate (proven to work) ────────────────────
    // Do NOT use Playwright locator for this — the button is hidden/in a portal
    // page.evaluate with document.querySelector reliably finds and clicks it
    let confirmed=false;
    for(let attempt=0;attempt<20;attempt++){
      await page.waitForTimeout(700);
      confirmed=await page.evaluate(()=>{
        // Try testid first
        const btn=document.querySelector('[data-testid="PromptModalConfirmButton"]');
        if(btn){
          // Check it's the "Yes, continue" button (not delete guide)
          const dialog=btn.closest('[role="dialog"],[data-dialog-ref]');
          const dialogText=(dialog||document.body).textContent||'';
          if(dialogText.includes('items to cart')||dialogText.includes('Yes, continue')||!dialogText.includes('Delete')){
            btn.click();return true;
          }
        }
        // Fallback: click "Yes, continue" text button
        const allBtns=Array.from(document.querySelectorAll('button'));
        const yesBtn=allBtns.find(b=>/yes,?\s*continue/i.test(b.textContent));
        if(yesBtn){yesBtn.click();return true;}
        return false;
      });
      if(confirmed){console.log('Bulk add confirmed');break;}
    }
    if(!confirmed)console.log('WARNING: Confirm may not have fired — continuing anyway');

    await page.waitForTimeout(6000);
    console.log('After bulk add, cartId=',cartId);

    // ── OPEN CART DRAWER ─────────────────────────────────────────────────────
    const drawerOpened=await page.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('button'));
      const cartBtn=btns.find(b=>{
        const l=(b.getAttribute('aria-label')||'').toLowerCase();
        return l.includes('view cart')||l.includes('items in cart')||l.includes('cart.');
      });
      if(cartBtn){cartBtn.click();return true;}
      return false;
    });
    console.log('Cart drawer opened:',drawerOpened);
    await page.waitForTimeout(5000);

    // ── READ CART ITEMS FROM DOM ─────────────────────────────────────────────
    // Apollo cache approach failed — items aren't typed the way we expected.
    // Read directly from the rendered cart drawer DOM instead.
    const domCartItems=await page.evaluate(()=>{
      const groups=Array.from(document.querySelectorAll('[aria-label="product"][role="group"]'));
      return groups.map((g,idx)=>{
        // Qty from cartStepper
        const stepper=g.querySelector('[data-testid="cartStepper"]');
        const qty=stepper?parseInt((stepper.textContent||'').match(/(\d+)/)?.[1]||'1'):1;
        // Name — longest text that's not a price/label
        const allText=Array.from(g.querySelectorAll('span,p,div,a'))
          .filter(el=>el.children.length<=2)
          .map(el=>(el.textContent||'').trim())
          .filter(t=>t.length>5&&t.length<150&&!/^\$/.test(t)&&!/^(remove|replace|likely|many|about|quantity|change)/i.test(t)&&!/\d+\.?\d*\s*(lb|oz|ct|gal|#|z)\s*$/i.test(t));
        const name=allText.reduce((a,b)=>a.length>=b.length?a:b,'');
        return{idx,qty,name};
      });
    });
    console.log(`DOM cart items: ${domCartItems.length}`);
    domCartItems.forEach(i=>console.log(`  [${i.idx}] "${i.name}" qty=${i.qty}`));

    // ── GET CART ITEM IDs FROM GRAPHQL RESPONSES ─────────────────────────────
    // Parse all captured GQL responses to find cart item IDs
    let cartItemsWithIds=[];
    for(const resp of gqlResponses){
      if(resp.text.length<200)continue;
      try{
        const data=JSON.parse(resp.text);
        const str=JSON.stringify(data);
        // Look for arrays of items with id and quantity
        if(!str.includes('"quantity"'))continue;
        
        // Walk the data tree to find cart items
        function findCartItems(obj,path=''){
          if(!obj||typeof obj!=='object')return[];
          const results=[];
          if(Array.isArray(obj)){
            obj.forEach((item,i)=>{
              if(item&&typeof item==='object'&&'id'in item&&'quantity'in item&&typeof item.quantity==='number'){
                results.push({id:String(item.id),quantity:item.quantity,data:item,source:resp.op,path:path+'['+i+']'});
              }
              results.push(...findCartItems(item,path+'['+i+']'));
            });
          }else{
            Object.entries(obj).forEach(([k,v])=>{
              if(v&&typeof v==='object'&&'id'in v&&'quantity'in v&&typeof v.quantity==='number'&&v.quantity>=0){
                results.push({id:String(v.id),quantity:v.quantity,data:v,source:resp.op,path:path+'.'+k});
              }
              results.push(...findCartItems(v,path+'.'+k));
            });
          }
          return results;
        }
        
        const found=findCartItems(data);
        if(found.length>0){
          console.log(`Found ${found.length} potential cart items in [${resp.op}]`);
          found.slice(0,5).forEach(f=>console.log(`  id=${f.id} qty=${f.quantity} path=${f.path}`));
          cartItemsWithIds.push(...found);
        }
      }catch(e){}
    }

    // Deduplicate by id
    const seen=new Set();
    cartItemsWithIds=cartItemsWithIds.filter(item=>{
      if(seen.has(item.id))return false;
      seen.add(item.id);return true;
    });
    console.log(`Unique cart item IDs found: ${cartItemsWithIds.length}`);

    // ── MATCH DOM ITEMS TO ORDERED ITEMS ────────────────────────────────────
    // Use DOM for names/quantities, GQL responses for IDs
    const matchedItems=[];
    domCartItems.forEach((domItem,domIdx)=>{
      // Find best matching ordered item
      let bestKey=null,bestScore=0;
      for(const key of Object.keys(targetMap)){
        const s=scoreMatch(domItem.name,key);
        if(s>bestScore){bestScore=s;bestKey=key;}
      }
      // Find matching ID from GQL responses (by index or quantity match)
      const gqlItem=cartItemsWithIds[domIdx]||null;
      matchedItems.push({
        domIdx,name:domItem.name,currentQty:domItem.qty,
        orderedKey:bestKey,orderedScore:bestScore,
        id:gqlItem?.id||null,
        targetQty:bestKey?targetMap[bestKey].targetQty:null,
      });
      if(bestKey)targetMap[bestKey].found=true;
    });

    // ── UPDATE QUANTITIES + REMOVE via browser fetch ─────────────────────────
    const updateResult=await page.evaluate(async(params)=>{
      const{matchedItems,cartId,targetMap}=params;
      const results=[];

      async function gqlFetch(op,query,vars){
        const r=await fetch('/graphql',{method:'POST',
          headers:{'content-type':'application/json','accept':'application/json'},
          credentials:'include',
          body:JSON.stringify({operationName:op,query,variables:vars})});
        return r.json();
      }

      // Try all known mutation structures for update
      async function tryUpdate(id,qty,cartId){
        const mutations=[
          ['UpdateItemsInCart',`mutation UpdateItemsInCart($input:UpdateItemsInCartInput!){updateItemsInCart(input:$input){__typename}}`,{input:{cartId,updates:[{cartItemId:id,quantity:qty}]}}],
          ['UpdateCartItemQuantity',`mutation UpdateCartItemQuantity($input:UpdateCartItemQuantityInput!){updateCartItemQuantity(input:$input){__typename}}`,{input:{cartItemId:id,quantity:qty}}],
          ['UpdateCartItem',`mutation UpdateCartItem($input:UpdateCartItemInput!){updateCartItem(input:$input){__typename}}`,{input:{cartItemId:id,quantity:qty}}],
          ['ChangeItemQuantity',`mutation ChangeItemQuantity($input:ChangeItemQuantityInput!){changeItemQuantity(input:$input){__typename}}`,{input:{id,quantity:qty,cartId}}],
          ['SetItemQuantity',`mutation SetItemQuantity($cartItemId:ID!,$quantity:Int!){setItemQuantity(cartItemId:$cartItemId,quantity:$quantity){__typename}}`,{cartItemId:id,quantity:qty}],
          // Try with cartId at top level
          ['UpdateItemsInCart',`mutation UpdateItemsInCart($cartId:ID!,$updates:[CartItemUpdateInput!]!){updateItemsInCart(cartId:$cartId,updates:$updates){__typename}}`,{cartId,updates:[{cartItemId:id,quantity:qty}]}],
        ];
        for(const[op,query,vars]of mutations){
          const d=await gqlFetch(op,query,vars);
          if(!d.errors)return{ok:true,op};
          const msg=(d.errors[0]?.message||'').toLowerCase();
          // If it's a field/type error, wrong mutation — try next
          if(msg.includes('cannot query field')||msg.includes('unknown type')||msg.includes('does not exist'))continue;
          // If it's a permissions or auth error, report it
          return{ok:false,op,err:d.errors[0]?.message};
        }
        return{ok:false,err:'all mutations failed'};
      }

      async function tryRemove(id,cartId){
        const mutations=[
          ['RemoveItemsFromCart',`mutation RemoveItemsFromCart($input:RemoveItemsFromCartInput!){removeItemsFromCart(input:$input){__typename}}`,{input:{cartId,cartItemIds:[id]}}],
          ['RemoveCartItem',`mutation RemoveCartItem($input:RemoveCartItemInput!){removeCartItem(input:$input){__typename}}`,{input:{cartItemId:id}}],
          ['DeleteCartItem',`mutation DeleteCartItem($input:DeleteCartItemInput!){deleteCartItem(input:$input){__typename}}`,{input:{cartItemId:id}}],
          ['RemoveItemFromCart',`mutation RemoveItemFromCart($cartId:ID!,$itemId:ID!){removeItemFromCart(cartId:$cartId,itemId:$itemId){__typename}}`,{cartId,itemId:id}],
        ];
        for(const[op,query,vars]of mutations){
          const d=await gqlFetch(op,query,vars);
          if(!d.errors)return{ok:true,op};
          const msg=(d.errors[0]?.message||'').toLowerCase();
          if(msg.includes('cannot query field')||msg.includes('unknown type'))continue;
          return{ok:false,op,err:d.errors[0]?.message};
        }
        return{ok:false,err:'all remove mutations failed'};
      }

      for(const item of matchedItems){
        if(!item.orderedKey||item.orderedScore===0){
          // Remove item — not in order
          if(item.id){
            const r=await tryRemove(item.id,cartId);
            results.push({action:'remove',name:item.name,id:item.id,...r});
          }else{
            results.push({action:'remove-no-id',name:item.name});
          }
          continue;
        }

        if(item.currentQty===item.targetQty){
          results.push({action:'skip',name:item.orderedKey,qty:item.targetQty});
          continue;
        }

        if(item.id){
          const r=await tryUpdate(item.id,item.targetQty,cartId);
          results.push({action:'update',name:item.orderedKey,from:item.currentQty,to:item.targetQty,id:item.id,...r});
        }else{
          results.push({action:'update-no-id',name:item.orderedKey,from:item.currentQty,to:item.targetQty});
        }
      }

      return results;
    },{matchedItems,cartId,targetMap:Object.fromEntries(Object.entries(targetMap).map(([k,v])=>[k,{targetQty:v.targetQty}]))});

    console.log('\n=== RESULTS ===');
    updateResult.forEach(r=>console.log(JSON.stringify(r)));

    const notFound=Object.entries(targetMap).filter(([k,v])=>!v.found).map(([k])=>k);
    console.log('Not found:',notFound.join(', ')||'none');

    await browser.close();
    return{success:true,notFound};

  }catch(e){
    console.error('placeOrder error:',e.message);
    try{await browser.close();}catch(_){}
    return{success:false,error:e.message};
  }
}

app.post('/whatsapp',async(req,res)=>{
  res.sendStatus(200);
  const msg=req.body.Body;
  const from=req.body.From.replace('whatsapp:','');
  const name=from===process.env.YOUR_WHATSAPP_NUMBER?'Nick':'Rahul';
  console.log(`From ${name}: ${msg}`);
  if(!AUTHORIZED_NUMBERS.includes(from)){await sendWhatsApp(from,'Not authorized');return;}
  await sendWhatsApp(from,`Got it ${name}! Placing order...`);
  try{
    const order=await parseOrder(msg);
    if(!Array.isArray(order)){await sendWhatsApp(from,'Could not parse order.');return;}
    const summary=order.map(i=>`• ${i.quantity}x ${i.item}`).join('\n');
    await sendWhatsApp(from,'Order:\n\n'+summary);
    const result=await placeOrder(order);
    if(result.success){
      let reply='Done! Review:\nmember.restaurantdepot.com/store/business/cart';
      if(result.notFound?.length)reply+='\n\nAdd manually:\n'+result.notFound.map(n=>`• ${n}`).join('\n');
      await sendWhatsApp(from,reply);
      await sendEmail(order,name);
    }else{
      await sendWhatsApp(from,'Error: '+result.error);
    }
  }catch(e){
    console.error('Handler:',e.message);
    await sendWhatsApp(from,'Error placing order.');
  }
});

app.get('/',(req,res)=>res.send('Naan & Curry Agent'));
app.listen(process.env.PORT||3000,()=>console.log('Running'));

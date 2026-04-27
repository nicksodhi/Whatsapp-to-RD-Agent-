# Naan & Curry - Restaurant Depot Ordering Agent 🍛

WhatsApp agent that automatically places Restaurant Depot orders when Nick or Rahul texts it.

## How it works
1. Nick or Rahul texts the order via WhatsApp
2. AI parses the order
3. Agent logs into Restaurant Depot and places the order
4. Email confirmation sent to both

## Example order text
"Order 10 lbs chicken tikka, 5 lbs paneer, 3 cases naan, 2 lbs garam masala"

## Setup (Railway)
Add these environment variables in Railway dashboard:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_WHATSAPP_NUMBER
- YOUR_WHATSAPP_NUMBER
- RAHUL_WHATSAPP_NUMBER
- ANTHROPIC_API_KEY
- GMAIL_ADDRESS
- GMAIL_APP_PASSWORD
- YOUR_EMAIL
- RAHUL_EMAIL
- RD_EMAIL
- RD_PASSWORD

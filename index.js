/**
 * PARSE ORDER
 * Translates informal chef text into exact order guide items.
 */
async function parseOrder(message) {
  const itemMapStr = Object.entries(ITEM_MAP).map(([k,v]) => `"${k}" -> "${v}"`).join('\n');
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest', 
      max_tokens: 1000,
      messages: [{ 
        role: 'user', 
        content: `You are an automated ordering assistant for Naan & Curry. Your job is to translate informal grocery text messages from chefs into an exact JSON array for our purchasing system.
        
        Order Guide Mapping:
        ${itemMapStr}
        
        Rules for Processing:
        1. IGNORE headers, dates, employee names (e.g., "Mohan"), locations (e.g., "Rhodes Ranch"), and section titles (e.g., "RESTAURANT DEPOT").
        2. FUZZY MATCH the chef's item description to the closest key in our mapping list, even if they include extra words, weights, or formatting (e.g., "Carrots (25lb bag)" maps to "carrots").
        3. OUTPUT the EXACT mapped value from the right side of the mapping list. Never invent items.
        4. Use the exact quantity requested as a number.
        5. Return ONLY a valid JSON array, absolutely no conversational text.
        
        Format Example: [{"item": "Jumbo Red Onions - 25 lbs", "quantity": 1}]
        
        Chef's List: 
        ${message}` 
      }]
    });

    // Extract just the JSON part to prevent errors if Claude adds conversational filler
    const text = response.content[0].text.trim();
    const jsonStr = text.match(/\[.*\]/s)?.[0] || text;
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Parsing Error:", err);
    return { error: true };
  }
}

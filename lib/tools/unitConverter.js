import { generateJSON } from './llm.js';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_API_URL = 'https://api.tavily.com/search';

const ALLOWED_UNITS = ['g', 'kg', 'ml', 'l', 'tbsp', 'tsp'];

const UNIT_ALIASES = {
  'gram': 'g',
  'grams': 'g',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'millilitre': 'ml',
  'millilitres': 'ml',
  'liter': 'l',
  'liters': 'l',
  'litre': 'l',
  'litres': 'l',
  'tablespoon': 'tbsp',
  'tablespoons': 'tbsp',
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  'cup': 'cup',
  'cups': 'cup',
  'ounce': 'oz',
  'ounces': 'oz',
  'pound': 'lb',
  'pounds': 'lb',
  'lb': 'lb',
  'lbs': 'lb',
  'oz': 'oz',
  'fl oz': 'fl_oz',
  'fluid ounce': 'fl_oz',
  'fluid ounces': 'fl_oz',
  'pint': 'pint',
  'pints': 'pint',
  'quart': 'quart',
  'quarts': 'quart',
  'gallon': 'gallon',
  'gallons': 'gallon',
};

const WEIGHT_CONVERSIONS = {
  oz: { to: 'g', factor: 28.3495 },
  lb: { to: 'g', factor: 453.592 },
  kg: { to: 'g', factor: 1000 },
};

const VOLUME_CONVERSIONS = {
  cup: { to: 'ml', factor: 236.588 },
  fl_oz: { to: 'ml', factor: 29.5735 },
  pint: { to: 'ml', factor: 473.176 },
  quart: { to: 'ml', factor: 946.353 },
  gallon: { to: 'l', factor: 3.78541 },
  l: { to: 'ml', factor: 1000 },
};

function normalizeUnit(unit) {
  if (!unit) return null;
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] || lower;
}

function isAllowedUnit(unit) {
  const normalized = normalizeUnit(unit);
  return ALLOWED_UNITS.includes(normalized);
}

// Unit names to use in the Tavily search query (more readable than codes)
const UNIT_DISPLAY = {
  g: 'grams', kg: 'kilograms', mg: 'milligrams',
  ml: 'milliliters', l: 'liters',
  oz: 'ounces', lb: 'pounds',
  cup: 'cups', tbsp: 'tablespoons', tsp: 'teaspoons',
  fl_oz: 'fluid ounces', pint: 'pints', quart: 'quarts', gallon: 'gallons',
};

function unitDisplay(unit) {
  return UNIT_DISPLAY[unit] || unit;
}

async function convertViaTavily(value, fromUnit, toUnit) {
  if (!TAVILY_API_KEY) {
    console.warn('[UnitConverter] No TAVILY_API_KEY set');
    return null;
  }
  try {
    const query = `how much is ${value} ${unitDisplay(fromUnit)} in ${unitDisplay(toUnit)}`;
    console.log('[UnitConverter] Tavily query:', query);

    const res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_answer: true,
      }),
    });

    if (!res.ok) {
      console.warn('[UnitConverter] Tavily error:', res.status);
      return null;
    }

    const data = await res.json();

    // Combine answer + first result snippet into context for the LLM
    const answerText = [data.answer || '', ...(data.results || []).slice(0, 2).map(r => r.content || '')]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 800);

    if (!answerText) {
      console.warn('[UnitConverter] Tavily: empty response');
      return null;
    }

    // Ask the LLM to extract just the numeric result
    const extracted = await generateJSON(
      `Unit conversion: ${value} ${unitDisplay(fromUnit)} → ${unitDisplay(toUnit)}

Search result text:
"${answerText}"

What is the numeric result of converting ${value} ${unitDisplay(fromUnit)} to ${unitDisplay(toUnit)}?
WARNING: Do NOT return ${value}. That is the input. Return the CONVERTED value.
Example: 1 pound → grams = 453.592 (NOT 1). 1 cup → milliliters = 236.588 (NOT 1).

Return ONLY: { "result": <converted number> }`,
      'You are a unit conversion extractor. Return only valid JSON with a single "result" key. The result MUST be the converted value in the target unit — never the original input number.'
    );

    const result = extracted?.result;
    if (typeof result === 'number' && result > 0) {
      console.log('[UnitConverter] Tavily+LLM result:', result, toUnit);
      return result;
    }

    console.warn('[UnitConverter] Tavily: LLM could not extract result');
    return null;
  } catch (e) {
    console.warn('[UnitConverter] Tavily failed:', e.message);
    return null;
  }
}

function convertLocally(value, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  
  if (from === to) return value;
  
  if (WEIGHT_CONVERSIONS[from]) {
    const conv = WEIGHT_CONVERSIONS[from];
    const inGrams = value * conv.factor;
    if (to === 'g') return Math.round(inGrams * 10) / 10;
    if (to === 'kg') return Math.round(inGrams / 1000 * 100) / 100;
  }
  
  if (VOLUME_CONVERSIONS[from]) {
    const conv = VOLUME_CONVERSIONS[from];
    if (conv.to === 'ml') {
      const inMl = value * conv.factor;
      if (to === 'ml') return Math.round(inMl);
      if (to === 'l') return Math.round(inMl / 1000 * 100) / 100;
      if (to === 'tbsp') return Math.round(inMl / 14.787 * 10) / 10;
      if (to === 'tsp') return Math.round(inMl / 4.929 * 10) / 10;
    } else if (conv.to === 'l') {
      const inL = value * conv.factor;
      if (to === 'l') return Math.round(inL * 100) / 100;
      if (to === 'ml') return Math.round(inL * 1000);
    }
  }
  
  if (from === 'tbsp') {
    const inMl = value * 14.787;
    if (to === 'ml') return Math.round(inMl);
    if (to === 'tsp') return Math.round(value * 3 * 10) / 10;
    if (to === 'l') return Math.round(inMl / 1000 * 1000) / 1000;
  }
  
  if (from === 'tsp') {
    const inMl = value * 4.929;
    if (to === 'ml') return Math.round(inMl);
    if (to === 'tbsp') return Math.round(value / 3 * 10) / 10;
    if (to === 'l') return Math.round(inMl / 1000 * 1000) / 1000;
  }
  
  return null;
}

export async function convertUnit(value, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  
  if (from === to) return { value, unit: to };
  
  // Local math first (instant, free), Tavily only for unknown conversions
  let result = convertLocally(value, from, to);

  if (result === null) {
    result = await convertViaTavily(value, from, to);
  }
  
  if (result !== null) {
    return { value: result, unit: to };
  }
  
  console.warn(`[UnitConverter] Could not convert ${value} ${from} to ${to}`);
  return { value, unit: fromUnit };
}

export function getBestTargetUnit(fromUnit) {
  const from = normalizeUnit(fromUnit);
  
  if (['oz', 'lb', 'kg', 'g'].includes(from)) return 'g';
  if (['cup', 'fl_oz', 'pint', 'quart', 'ml', 'l'].includes(from)) return 'ml';
  if (['gallon'].includes(from)) return 'l';
  if (from === 'tbsp' || from === 'tsp') return from;
  
  return from;
}

export async function convertIngredientUnits(ingredients) {
  const converted = [];
  
  for (const ing of ingredients) {
    const unit = normalizeUnit(ing.unit);
    
    if (!unit || isAllowedUnit(unit)) {
      converted.push(ing);
      continue;
    }
    
    const targetUnit = getBestTargetUnit(unit);
    const quantity = parseFloat(ing.quantity) || 0;
    
    if (quantity > 0 && targetUnit !== unit) {
      const result = await convertUnit(quantity, unit, targetUnit);
      console.log(`[UnitConverter] ${quantity} ${unit} → ${result.value} ${result.unit}`);
      converted.push({
        ...ing,
        quantity: result.value,
        unit: result.unit,
        original_quantity: ing.quantity,
        original_unit: ing.unit,
      });
    } else {
      converted.push(ing);
    }
  }
  
  return converted;
}

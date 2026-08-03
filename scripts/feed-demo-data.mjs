import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

// Resolve paths
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DEMO_DIR = join(ROOT_DIR, 'demo-data');
const OUT_FILE = join(ROOT_DIR, 'scripts', 'seed_demo.sql');

// --- CSV Parsing Helper (RFC-4180-ish) ---
function splitRow(line) {
  const cells = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function readCsv(file) {
  const text = readFileSync(join(DEMO_DIR, file), "utf8").replace(/^﻿/, "").trim();
  const [head, ...lines] = text.split(/\r?\n/);
  const cols = splitRow(head);
  return lines
    .filter((l) => l.trim())
    .map((l) => {
      const cells = splitRow(l);
      return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
    });
}

// --- Domain Logic for Units ---
function getBaseUnit(materialType) {
  if (materialType === 'Liquid') return 'ML';
  if (materialType === 'Count') return 'Piece';
  return 'Gram'; // Default for Weight
}

function getPurchaseUnit(materialType) {
  if (materialType === 'Liquid') return 'Litre';
  if (materialType === 'Count') return 'Piece';
  return 'KG'; // Default for Weight
}

function calculateCostPerBaseUnit(price, quantity, purchaseUnit, baseUnit) {
  if (!price || !quantity) return 0;
  let multiplier = 1;
  const pUnit = purchaseUnit.toLowerCase();
  const bUnit = baseUnit.toLowerCase();
  
  if ((pUnit === 'kg' && bUnit === 'gram') || (pUnit === 'litre' && bUnit === 'ml')) {
    multiplier = 1000;
  }
  
  return price / (quantity * multiplier);
}

function escapeSql(str) {
  if (str === null || str === undefined || str === '') return 'null';
  return `'${String(str).replace(/'/g, "''")}'`;
}

// --- Main Generation Logic ---
function generateSql() {
  try {
    let sql = `-- Demo Data Seed Script\n-- Generated on ${new Date().toISOString()}\n\n`;
    sql += `BEGIN;\n\n`;
    
    // 0. Cleanup partial runs and Insert Brand
    sql += `-- --------------------------------------------------------\n`;
    sql += `-- Clean up previous demo runs & Insert Brand\n`;
    sql += `-- --------------------------------------------------------\n`;
    sql += `DELETE FROM public.recipe_ingredients WHERE recipe_id IN (SELECT id FROM public.recipes WHERE brand = 'demo-brand');\n`;
    sql += `DELETE FROM public.recipes WHERE brand = 'demo-brand';\n\n`;
    
    sql += `INSERT INTO public.brands (id, name, normalized_name, brand_code, display_name, accent_color, status) VALUES ` +
           `('demo-brand', 'Demo Restaurant', 'demo-restaurant', 'DEMO', 'Demo Restaurant', '#000000', 'active') ` +
           `ON CONFLICT (id) DO NOTHING;\n\n`;
    
    // 1. Raw Materials
    console.log("📦 Processing Raw Materials...");
    const rawMaterialsCsv = readCsv("1_raw-materials.csv");
    const materialMap = new Map(); // name -> { id, cost }
    
    sql += `-- --------------------------------------------------------\n`;
    sql += `-- Raw Materials\n`;
    sql += `-- --------------------------------------------------------\n`;
    
    for (const r of rawMaterialsCsv) {
      const id = crypto.randomUUID();
      const pPrice = Number(r["Purchase Price"]);
      const baseUnit = getBaseUnit(r["Material Type"]);
      const pUnit = getPurchaseUnit(r["Material Type"]);
      const cpu = calculateCostPerBaseUnit(pPrice, 1, pUnit, baseUnit);
      
      materialMap.set(r.Ingredient.toLowerCase(), { id, cost: cpu });
      
      sql += `INSERT INTO public.raw_materials (id, ingredient_name, category, notes, purchase_price, purchase_quantity, purchase_unit, base_unit, cost_per_base_unit, status) VALUES (` +
        `${escapeSql(id)}, ${escapeSql(r.Ingredient)}, ${escapeSql(r.Category)}, ${escapeSql(r.Notes)}, ` +
        `${pPrice}, 1, ${escapeSql(pUnit)}, ${escapeSql(baseUnit)}, ${cpu}, 'active') ` +
        `ON CONFLICT (ingredient_name) DO UPDATE SET ` +
        `purchase_price = EXCLUDED.purchase_price, cost_per_base_unit = EXCLUDED.cost_per_base_unit;\n`;
    }
    
    sql += `\n`;
    
    // Helper to process recipes
    const recipeMap = new Map(); // name -> id
    
    function processRecipes(filename, isPrep) {
      console.log(`🍳 Processing recipes from ${filename}...`);
      const csvLines = readCsv(filename);
      const recipeGroups = new Map();
      
      for (const line of csvLines) {
        const name = line["Prep Name"] ?? line["Recipe Name"];
        if (!recipeGroups.has(name)) recipeGroups.set(name, []);
        recipeGroups.get(name).push(line);
      }
      
      sql += `-- --------------------------------------------------------\n`;
      sql += `-- Recipes: ${isPrep ? 'In-House Preps' : 'Menu Items'}\n`;
      sql += `-- --------------------------------------------------------\n`;
      
      for (const [recipeName, lines] of recipeGroups.entries()) {
        const id = crypto.randomUUID();
        recipeMap.set(recipeName.toLowerCase(), id);
        
        const header = lines[0];
        
        let totalCost = 0;
        const ingredientsSql = [];
        let sortOrder = 0;
        
        for (const line of lines) {
          if (!line.Ingredient) continue;
          
          let ingredientId = null;
          let componentType = 'material';
          let costPerUnit = 0;
          
          const matName = line.Ingredient.toLowerCase();
          
          if (materialMap.has(matName)) {
            const mat = materialMap.get(matName);
            ingredientId = mat.id;
            costPerUnit = mat.cost;
          } else if (recipeMap.has(matName)) {
            ingredientId = recipeMap.get(matName);
            componentType = 'recipe';
            // Simplified cost resolution for preps in this static script
          } else {
            console.warn(`⚠️ Ingredient/Prep not found: ${line.Ingredient} for ${recipeName}`);
            continue;
          }
          
          const qty = Number(line.Quantity) || 0;
          const lineCost = qty * costPerUnit;
          totalCost += lineCost;
          
          ingredientsSql.push(
            `INSERT INTO public.recipe_ingredients (recipe_id, ingredient_id, component_type, quantity_used, unit_used, calculated_cost, sort_order) VALUES (` +
            `${escapeSql(id)}, ${escapeSql(ingredientId)}, ${escapeSql(componentType)}, ${qty}, ${escapeSql(line.Unit || 'Gram')}, ${lineCost}, ${sortOrder++});`
          );
        }
        
        // Insert Recipe Header
        sql += `INSERT INTO public.recipes (id, recipe_name, category, brand, description, image_url, preparation_time, serving_size, status, selling_price, is_prep, total_cost, cost_per_portion) VALUES (` +
          `${escapeSql(id)}, ${escapeSql(recipeName)}, ${escapeSql(header.Category || 'Uncategorised')}, 'demo-brand', ` +
          `${escapeSql(header.Description)}, ${escapeSql(header.Image)}, ${header["Prep Time"] ? Number(header["Prep Time"]) : 'null'}, 1, 'approved', ` +
          `${header["Selling Price"] ? Number(header["Selling Price"]) : 'null'}, ${isPrep}, ${totalCost}, ${totalCost});\n`;
          
        sql += ingredientsSql.join('\n') + '\n\n';
      }
    }
    
    processRecipes("3_in-house-prep.csv", true);
    processRecipes("4_menu-recipes.csv", false);
    
    sql += `COMMIT;\n`;
    
    writeFileSync(OUT_FILE, sql);
    console.log(`\n🎉 Generated SQL file successfully at:\n${OUT_FILE}`);
    console.log(`\nYou can now copy the contents of this file and paste it into the Supabase SQL Editor.`);
    
  } catch (err) {
    console.error("❌ Fatal error during SQL generation:", err);
  }
}

generateSql();

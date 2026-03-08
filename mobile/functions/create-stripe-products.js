/**
 * One-time script to create Garage Scholars products & prices in Stripe.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx node create-stripe-products.js
 *   STRIPE_SECRET_KEY=sk_test_xxx node create-stripe-products.js
 *
 * After running, copy the printed price IDs into gs-constants.ts → STRIPE_PRICE_IDS
 */

const Stripe = require("stripe");

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌  Set STRIPE_SECRET_KEY env var before running.");
  process.exit(1);
}

const stripe = Stripe(key);

const PACKAGES = [
  // ── Garage Organization ──
  { key: "undergraduate", name: "The Undergraduate", description: "Garage Organization — Tier 1: The Basics, Done Right", price: 1197, type: "one_time", category: "Garage Organization" },
  { key: "graduate",      name: "The Graduate",      description: "Garage Organization — Tier 2: Leveling Up Your Space", price: 2197, type: "one_time", category: "Garage Organization" },
  { key: "doctorate",     name: "The Doctorate",     description: "Garage Organization — Tier 3: The Complete Scholar Treatment", price: 3697, type: "one_time", category: "Garage Organization" },
  // ── Home Gym Installation ──
  { key: "warmup",   name: "Warm Up",   description: "Home Gym Installation — Tier 1: Get the Basics Set Up", price: 997,  type: "one_time", category: "Home Gym Installation" },
  { key: "superset", name: "Super Set", description: "Home Gym Installation — Tier 2: A Real Training Space",   price: 1997, type: "one_time", category: "Home Gym Installation" },
  { key: "1repmax",  name: "1 Rep Max", description: "Home Gym Installation — Tier 3: The Ultimate Home Gym",   price: 4797, type: "one_time", category: "Home Gym Installation" },
  // ── Combo Bundles ──
  { key: "deans-list",  name: "The Dean's List",   description: "Bundle — Graduate Org + 1 Rep Max Gym", price: 6497, type: "one_time", category: "Bundle" },
  { key: "valedictorian", name: "The Valedictorian", description: "Bundle — Doctorate Org + 1 Rep Max Gym", price: 7997, type: "one_time", category: "Bundle" },
  // ── Monthly Memberships ──
  { key: "freshman", name: "The Freshman", description: "Monthly Membership — Tier 1: Quarterly visits, priority booking", price: 97,  type: "recurring", category: "Monthly Membership" },
  { key: "scholar",  name: "The Scholar",  description: "Monthly Membership — Tier 2: Monthly visits, haul-away, resale concierge", price: 197, type: "recurring", category: "Monthly Membership" },
  { key: "tenured",  name: "The Tenured",  description: "Monthly Membership — Tier 3: Bi-weekly visits, dedicated scholar", price: 347, type: "recurring", category: "Monthly Membership" },
];

async function run() {
  console.log(`\n🚀  Creating Garage Scholars products in Stripe (${key.startsWith("sk_live") ? "LIVE" : "TEST"} mode)...\n`);

  const results = {};

  for (const pkg of PACKAGES) {
    try {
      // Create product
      const product = await stripe.products.create({
        name: pkg.name,
        description: pkg.description,
        metadata: {
          gs_package_key: pkg.key,
          category: pkg.category,
        },
      });

      // Create price
      const priceData = {
        product: product.id,
        unit_amount: pkg.price * 100, // cents
        currency: "usd",
        metadata: { gs_package_key: pkg.key },
      };

      if (pkg.type === "recurring") {
        priceData.recurring = { interval: "month" };
      }

      const price = await stripe.prices.create(priceData);

      results[pkg.key] = { productId: product.id, priceId: price.id, price: pkg.price, type: pkg.type };
      console.log(`  ✓ ${pkg.name.padEnd(22)} $${String(pkg.price).padStart(5)}  ${price.id}`);
    } catch (err) {
      console.error(`  ❌ ${pkg.name}: ${err.message}`);
    }
  }

  console.log("\n── Copy into gs-constants.ts → STRIPE_PRICE_IDS ──\n");
  for (const [key, val] of Object.entries(results)) {
    console.log(`  "${key}": "${val.priceId}",`);
  }
  console.log();
}

run();

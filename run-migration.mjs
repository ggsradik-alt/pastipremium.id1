// One-time migration script for production Supabase
// Run with: node run-migration.mjs

const SUPABASE_URL = 'https://cxeosepxoszckudnwgdp.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE_KEY environment variable first');
  process.exit(1);
}

async function checkColumnExists(table, column) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=0`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  return res.ok; // If column doesn't exist, PostgREST returns 400
}

async function checkTableExists(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=0`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  return res.ok;
}

async function main() {
  console.log('🔍 Checking production database schema...\n');

  // Check resellers table columns
  const hasCommType = await checkColumnExists('resellers', 'default_commission_type');
  const hasCommValue = await checkColumnExists('resellers', 'default_commission_value');
  const hasProductComm = await checkTableExists('reseller_product_commissions');
  const hasCommissions = await checkTableExists('reseller_commissions');

  console.log(`  resellers.default_commission_type: ${hasCommType ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`  resellers.default_commission_value: ${hasCommValue ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`  reseller_product_commissions table: ${hasProductComm ? '✅ EXISTS' : '❌ MISSING'}`);
  console.log(`  reseller_commissions table: ${hasCommissions ? '✅ EXISTS' : '❌ MISSING'}`);

  if (hasCommType && hasCommValue && hasProductComm && hasCommissions) {
    console.log('\n✅ All columns and tables exist! No migration needed.');
    console.log('   If you still get errors, run this SQL in Supabase Dashboard:');
    console.log("   NOTIFY pgrst, 'reload schema';");
    return;
  }

  console.log('\n❌ Missing columns/tables detected.');
  console.log('   Please run the following SQL in your Supabase Dashboard SQL Editor:');
  console.log('   Go to: https://supabase.com/dashboard/project/cxeosepxoszckudnwgdp/sql\n');
  console.log('='.repeat(70));
  console.log(MIGRATION_SQL);
  console.log('='.repeat(70));
}

const MIGRATION_SQL = `
-- ============================================
-- MIGRATION: Add Hybrid Commission System
-- ============================================

-- 1. Add missing columns to resellers table
ALTER TABLE resellers 
  ADD COLUMN IF NOT EXISTS default_commission_type text DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS default_commission_value numeric DEFAULT 3000;

-- 2. Update existing resellers that have NULL values
UPDATE resellers 
SET default_commission_type = 'fixed', 
    default_commission_value = 3000 
WHERE default_commission_type IS NULL;

-- 3. Create reseller_product_commissions table
CREATE TABLE IF NOT EXISTS reseller_product_commissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id uuid REFERENCES resellers(id) ON DELETE CASCADE,
  product_id integer REFERENCES products(id) ON DELETE CASCADE,
  commission_type text NOT NULL DEFAULT 'fixed',
  commission_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(reseller_id, product_id)
);

-- 4. Create reseller_commissions table (transaction log)
CREATE TABLE IF NOT EXISTS reseller_commissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id uuid REFERENCES resellers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id),
  product_id integer,
  product_name text,
  order_amount numeric DEFAULT 0,
  commission_type text DEFAULT 'fixed',
  commission_rate numeric DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'unpaid',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE reseller_product_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_commissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read reseller_product_commissions') THEN
    CREATE POLICY "Allow public read reseller_product_commissions" ON reseller_product_commissions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read reseller_commissions') THEN
    CREATE POLICY "Allow public read reseller_commissions" ON reseller_commissions FOR SELECT USING (true);
  END IF;
END $$;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_rpc_reseller_id ON reseller_product_commissions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_rpc_product_id ON reseller_product_commissions(product_id);
CREATE INDEX IF NOT EXISTS idx_rc_reseller_id ON reseller_commissions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_rc_order_id ON reseller_commissions(order_id);

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Done! ✅
`;

main().catch(console.error);

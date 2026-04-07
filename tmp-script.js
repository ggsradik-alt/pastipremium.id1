const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://cxeosepxoszckudnwgdp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZW9zZXB4b3N6Y2t1ZG53Z2RwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzgwOTUyMSwiZXhwIjoyMDg5Mzg1NTIxfQ.FVKlgtpJxzzwE-GmlOYYWsuCEgrUoA_xticv-F3yGqQ');
async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: "SELECT pg_get_functiondef(p.oid) FROM pg_proc p WHERE proname = 'assign_account_for_order';"
  });
  console.log(error || data);
}
run();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if required environment variables are present
if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL environment variable is missing');
    console.error('Please set SUPABASE_URL in your environment variables');
    process.exit(1);
}

if (!supabaseAnonKey) {
    console.error('❌ SUPABASE_ANON_KEY environment variable is missing');
    console.error('Please set SUPABASE_ANON_KEY in your environment variables');
    process.exit(1);
}

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
    console.error('Please set SUPABASE_SERVICE_ROLE_KEY in your environment variables');
    process.exit(1);
}

console.log('✅ Supabase configuration loaded successfully');
console.log('📍 Supabase URL:', supabaseUrl);

// Client for user operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseAdmin };

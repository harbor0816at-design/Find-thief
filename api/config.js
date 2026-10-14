module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  const databaseConfigured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
  const authConfigured=Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY&&process.env.ADMIN_EMAILS);
  return res.status(200).json({version:'1.1.0',databaseConfigured,reportSubmissionsEnabled:databaseConfigured&&process.env.ENABLE_PUBLIC_REPORTING==='true',adminAuthenticationReady:authConfigured,supabaseUrl:authConfigured?process.env.SUPABASE_URL:null,publishableKey:authConfigured?process.env.SUPABASE_PUBLISHABLE_KEY:null});
};
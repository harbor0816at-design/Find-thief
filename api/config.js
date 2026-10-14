module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const url=process.env.SUPABASE_URL,service=(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY),pub=process.env.SUPABASE_PUBLISHABLE_KEY;
 const db=Boolean(url&&service),auth=Boolean(url&&pub&&process.env.ADMIN_EMAILS),accepted=Boolean(db&&process.env.REPORT_RATE_SECRET&&process.env.DATA_CONTROLLER_EMAIL&&process.env.DATA_CONTROLLER_NAME&&process.env.CRON_SECRET&&process.env.ENABLE_PUBLIC_REPORTING==='true');
 return res.status(200).json({version:'1.2.0',databaseConfigured:db,reportSubmissionsEnabled:accepted,adminAuthenticationReady:auth,supabaseUrl:auth?url:null,publishableKey:auth?pub:null,privacyContact:process.env.DATA_CONTROLLER_EMAIL||null,controllerName:process.env.DATA_CONTROLLER_NAME||null});
};

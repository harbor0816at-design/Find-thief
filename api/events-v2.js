// Public V2 verified event feed; explicit minimal projection excludes all private details.
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=90');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(200).json({items:[],areas:[],available:false});
 const headers={apikey:key,...(key.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+key})};
 const fetchData=async path=>{const r=await fetch(url+'/rest/v1/'+path,{headers,signal:AbortSignal.timeout(6200)});if(!r.ok)throw Error('Data unavailable');const v=await r.json();if(!Array.isArray(v))throw Error('Unexpected data');return v};
 try {
 const [events,areas]=await Promise.all([fetchData('evidence_events_v2?review_status=eq.approved&select=id,country,city,spot_name,event_kind,source_type,source_title,source_url,source_published_on,occurred_on,occurred_precision,lat,lon,location_precision,radius_m,item_category,short_summary,confidence,reviewed_at&order=reviewed_at.desc&limit=120'),fetchData('risk_areas_v2?review_status=eq.published&select=id,country,city,spot_name,lat,lon,radius_m,last_incident_on,last_source_on,verified_event_count,approved_visitor_reports,common_item_categories,sample_summary,source_urls&limit=120')]);
 return res.status(200).json({available:true,items:events,areas,note:'Only reviewed location-specific evidence, not general advice'});
 } catch{return res.status(503).json({items:[],areas:[],available:false,error:'公开事件暂时无法读取'});}
};

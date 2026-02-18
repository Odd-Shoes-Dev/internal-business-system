(async ()=>{
  try {
    const key = process.env.WHOP_API_KEY;
    const id = process.env.WHOP_COMPANY_ID;
    if(!key || !id){
      console.error('WHOP_API_KEY or WHOP_COMPANY_ID not set');
      process.exit(1);
    }
    const url = `https://api.whop.com/api/v1/companies/${id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
    const body = await res.text();
    console.log('status', res.status);
    try{ console.log(JSON.stringify(JSON.parse(body), null, 2)); } catch(e){ console.log(body); }
  } catch (err){
    console.error('error', err && err.message ? err.message : err);
    process.exit(1);
  }
})();

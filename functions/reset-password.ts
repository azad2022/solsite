const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>بازیابی رمز عبور | Solmint</title>
<style>
:root{color-scheme:dark;font-family:Vazirmatn,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08080f;color:#e2e8f0;padding:24px}main{width:min(100%,430px);box-sizing:border-box;background:#0b0b13;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.45)}h1{margin:0 0 8px;font-size:22px;color:#fff}p{color:#64748b;font-size:13px;line-height:1.8}label{display:block;margin-top:16px;font-size:12px;font-weight:700;color:#94a3b8}input{width:100%;box-sizing:border-box;margin-top:8px;padding:12px 13px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;outline:0}input:focus{border-color:rgba(20,241,149,.45)}button{width:100%;margin-top:18px;padding:13px;border:0;border-radius:14px;background:#9945ff;color:#fff;font-weight:900;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.notice{margin-top:14px;padding:12px 13px;border-radius:14px;font-size:12px;line-height:1.8;display:none}.error{display:block;background:rgba(244,63,94,.1);border:1px solid rgba(244,63,94,.2);color:#fecdd3}.success{display:block;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);color:#a7f3d0}.muted{margin-top:18px;border-top:1px solid rgba(255,255,255,.05);padding-top:14px;font-size:11px;color:#475569}
</style>
</head>
<body><main><h1>بازیابی رمز عبور</h1><p>رمز عبور جدیدی برای حساب سولمینت انتخاب کنید.</p><form id="form"><label for="password">رمز عبور جدید<input id="password" name="password" type="password" minlength="8" autocomplete="new-password" required /></label><label for="confirm">تکرار رمز عبور<input id="confirm" name="confirm" type="password" minlength="8" autocomplete="new-password" required /></label><button id="submit" type="submit">ذخیره رمز عبور</button></form><div id="notice" class="notice"></div><div class="muted">توکن بازیابی از نشانی صفحه خوانده می‌شود و در localStorage ذخیره نمی‌شود.</div></main>
<script>
const params=new URLSearchParams(location.search);const token=params.get('token');const form=document.getElementById('form');const notice=document.getElementById('notice');const submit=document.getElementById('submit');
function show(text,kind){notice.textContent=text;notice.className='notice '+kind}
if(!token){show('توکن بازیابی وجود ندارد یا منقضی شده است.','error');form.style.display='none'}
form?.addEventListener('submit',async e=>{e.preventDefault();if(!token)return;const password=document.getElementById('password').value;const confirm=document.getElementById('confirm').value;if(password.length<8){show('رمز عبور باید حداقل ۸ کاراکتر باشد.','error');return}if(password!==confirm){show('تکرار رمز عبور یکسان نیست.','error');return}submit.disabled=true;try{const response=await fetch('/api/auth/reset-password?token='+encodeURIComponent(token),{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({newPassword:password})});if(!response.ok){show('بازیابی رمز عبور انجام نشد. ممکن است لینک منقضی شده باشد.','error');return}show('رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد حساب شوید.','success');form.reset();form.style.display='none';setTimeout(()=>{location.href='/';},1200)}catch{show('ارتباط با سرویس احراز هویت برقرار نشد. دوباره تلاش کنید.','error')}finally{submit.disabled=false}});
</script></body></html>`;

export const onRequestGet = ({ request }: { request: Request }) => new Response(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'",
  },
});

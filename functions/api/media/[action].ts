import { getAuthenticatedUser, jsonResponse, type Env } from '../auth/_shared';

interface MediaEnv extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  GITHUB_MEDIA_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

type Config = {
  provider: 'github'; githubOwner: string; githubRepository: string; branch: string; basePath: string;
  connectionStatus?: string; lastTestAt?: string | null;
};

const DEFAULT_URL = 'https://nvopkbiedorfshwbmyhn.supabase.co';
const DEFAULT_CONFIG: Config = { provider:'github', githubOwner:'azad2022', githubRepository:'solsite', branch:'main', basePath:'public/media/articles/', connectionStatus:'untested', lastTestAt:null };
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = ['.jpg','.jpeg','.png','.webp','.gif','.avif'];
const ACTIONS = new Set(['config','assets','test-connection','upload','delete','migrate']);

const getSecret = (env: MediaEnv) => env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
const getSupabaseUrl = (env: MediaEnv) => (env.SUPABASE_URL || DEFAULT_URL).replace(/\/$/,'');
const getGithubToken = (env: MediaEnv) => String(env.GITHUB_MEDIA_TOKEN || env.GITHUB_TOKEN || '').trim();
const cleanPath = (v: unknown) => { const s = String(v || '').trim().replace(/^\/+|\/+$/g,''); return s ? `${s}/` : ''; };
const normalizeConfig = (v: any): Config => ({
  provider:'github',
  githubOwner:String(v?.githubOwner || DEFAULT_CONFIG.githubOwner).trim().replace(/[^A-Za-z0-9_.-]/g,''),
  githubRepository:String(v?.githubRepository || DEFAULT_CONFIG.githubRepository).trim().replace(/[^A-Za-z0-9_.-]/g,''),
  branch:String(v?.branch || DEFAULT_CONFIG.branch).trim().replace(/[^A-Za-z0-9._\/-]/g,''),
  basePath:cleanPath(v?.basePath || DEFAULT_CONFIG.basePath),
  connectionStatus:v?.connectionStatus || 'untested',
  lastTestAt:v?.lastTestAt ?? null,
});
const safePath = (v: unknown) => { const p = String(v || '').replace(/\\/g,'/'); return !p || p.startsWith('/') || p.includes('..') || p.includes('//') ? null : p; };
const isImagePath = (p: string) => IMAGE_EXTENSIONS.some(ext => p.toLowerCase().endsWith(ext));
async function readJson(r: Response) { const text = await r.text(); if (!text) return null; try { return JSON.parse(text); } catch { return { raw:text }; } }
async function supabase(env: MediaEnv, path: string, init: RequestInit = {}) {
  const key = getSecret(env); if (!key) throw new Error('کلید سرور Supabase پیکربندی نشده است.');
  return fetch(`${getSupabaseUrl(env)}/rest/v1/${path}`, { ...init, headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', ...(init.headers || {}) } });
}
async function github(env: MediaEnv, path: string, init: RequestInit = {}) {
  const token = getGithubToken(env); if (!token) throw new Error('GITHUB_MEDIA_TOKEN روی سرور تنظیم نشده است.');
  return fetch(`https://api.github.com${path}`, { ...init, headers:{ Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28', 'User-Agent':'Solmint-GitHub-Media-Gateway', ...(init.headers || {}) } });
}
async function getConfig(env: MediaEnv): Promise<Config> {
  const r = await supabase(env,'media_config?id=eq.active_config&select=*'); if (!r.ok) return DEFAULT_CONFIG;
  const rows = await readJson(r); return normalizeConfig(Array.isArray(rows) && rows[0] ? rows[0] : DEFAULT_CONFIG);
}
async function saveConfig(env: MediaEnv, config: Config, status = 'connected') {
  const n = normalizeConfig({...config, connectionStatus:status});
  const r = await supabase(env,'media_config?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:'active_config',provider:'github',github_owner:n.githubOwner,github_repository:n.githubRepository,branch:n.branch,base_path:n.basePath,connection_status:status,last_test_at:status==='connected'?new Date().toISOString():null})});
  if (!r.ok) throw new Error(`ذخیره تنظیمات کتابخانه در Supabase ناموفق بود (${r.status}).`);
  return {...n,lastTestAt:status==='connected'?new Date().toISOString():null};
}
async function metadata(env: MediaEnv, c: Config) {
  const q = new URLSearchParams({github_owner:`eq.${c.githubOwner}`,github_repository:`eq.${c.githubRepository}`,branch:`eq.${c.branch}`,select:'*',limit:'1000'});
  const r = await supabase(env,`media_assets?${q}`); if (!r.ok) return [];
  const rows = await readJson(r); return Array.isArray(rows) ? rows : [];
}
function makeAsset(row:any,c:Config,path:string,sha:string) {
  const filename = path.split('/').pop() || path; const encoded = path.split('/').map(encodeURIComponent).join('/');
  return { id:row?.id || `github_${c.githubOwner}_${c.githubRepository}_${sha}`, provider:'github', githubOwner:c.githubOwner, githubRepository:c.githubRepository, branch:c.branch, path, filename,
    publicUrl:`https://raw.githubusercontent.com/${c.githubOwner}/${c.githubRepository}/${encodeURIComponent(c.branch)}/${encoded}`,
    mimeType:row?.mime_type || `image/${filename.split('.').pop()}`, fileSize:Number(row?.file_size||0), width:Number(row?.width||0), height:Number(row?.height||0), sha:row?.sha||sha,
    createdAt:row?.created_at||new Date().toISOString(), updatedAt:row?.updated_at||null, originalFilename:row?.original_filename||filename, altText:row?.alt_text||'', title:row?.title||filename };
}
async function saveAsset(env:MediaEnv,a:any) {
  const r = await supabase(env,'media_assets?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:a.id,provider:'github',github_owner:a.githubOwner,github_repository:a.githubRepository,branch:a.branch,path:a.path,filename:a.filename,public_url:a.publicUrl,mime_type:a.mimeType,file_size:a.fileSize||0,width:a.width||0,height:a.height||0,sha:a.sha||null,original_filename:a.originalFilename||a.filename,alt_text:a.altText||'',title:a.title||'',updated_at:new Date().toISOString()})});
  if (!r.ok) throw new Error(`ثبت metadata تصویر در Supabase ناموفق بود (${r.status}).`);
}
async function deleteMetadata(env:MediaEnv,id:string){ if(id) await supabase(env,`media_assets?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'}); }
async function testRepository(env:MediaEnv,c:Config) {
  const diagnostics:any[]=[];
  if(!getGithubToken(env)) return {success:false,errorCode:'GITHUB_TOKEN_MISSING',stage:'github_authentication',message:'توکن GitHub روی سرور تنظیم نشده است.',diagnostics};
  diagnostics.push({name:'GitHub Token',stage:'github_authentication',status:'passed',message:'توکن GitHub روی سرور موجود است.'});
  const repo=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}`); const repoData=await readJson(repo);
  if(!repo.ok){const code=repo.status===401?'GITHUB_TOKEN_INVALID':repo.status===403?'GITHUB_TOKEN_PERMISSION_DENIED':'GITHUB_REPOSITORY_NOT_FOUND';const message=repo.status===401?'توکن GitHub معتبر نیست یا منقضی شده است.':repo.status===403?'توکن GitHub دسترسی لازم به Repository ندارد.':'Repository یافت نشد یا قابل دسترسی نیست.';return{success:false,errorCode:code,stage:'github_repository_check',message,diagnostics:[...diagnostics,{name:'Repository',stage:'github_repository_check',status:'failed',message,details:{status:repo.status}}]};}
  diagnostics.push({name:'Repository',stage:'github_repository_check',status:'passed',message:'Repository قابل دسترسی است.',details:{full_name:repoData?.full_name,private:repoData?.private}});
  const branch=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}/branches/${encodeURIComponent(c.branch)}`);
  if(!branch.ok)return{success:false,errorCode:'GITHUB_BRANCH_NOT_FOUND',stage:'github_branch_check',message:`Branch «${c.branch}» قابل دسترسی نیست.`,diagnostics:[...diagnostics,{name:'Branch',stage:'github_branch_check',status:'failed',message:`Branch «${c.branch}» قابل دسترسی نیست.`,details:{status:branch.status}}]};
  diagnostics.push({name:'Branch',stage:'github_branch_check',status:'passed',message:'Branch قابل دسترسی است.'});
  const tree=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}/git/trees/${encodeURIComponent(c.branch)}?recursive=1`); const treeData=await readJson(tree);
  if(!tree.ok)return{success:false,errorCode:'GITHUB_API_ERROR',stage:'media_directory_check',message:`خطای GitHub (${tree.status}).`,diagnostics};
  if(treeData?.truncated)return{success:false,errorCode:'GITHUB_TREE_TRUNCATED',stage:'media_directory_check',message:'فهرست Repository ناقص شد؛ کتابخانه فعلاً نمی‌تواند فایل‌ها را کامل بخواند.',diagnostics};
  const count=(treeData?.tree||[]).filter((i:any)=>i.type==='blob'&&String(i.path||'').startsWith(c.basePath)&&isImagePath(String(i.path||''))).length;
  diagnostics.push({name:'Media Directory',stage:'media_directory_check',status:'passed',message:'Repository، Branch و مسیر رسانه قابل دسترسی است.',details:{basePath:c.basePath,imageCount:count}});
  return{success:true,message:'اتصال GitHub، Repository، Branch و مسیر رسانه با موفقیت بررسی شد.',diagnostics,details:{repo:`${c.githubOwner}/${c.githubRepository}`,branch:c.branch,basePath:c.basePath,imageCount:count}};
}
async function listAssets(env:MediaEnv,c:Config){const r=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}/git/trees/${encodeURIComponent(c.branch)}?recursive=1`);if(!r.ok)throw new Error(`خطای دریافت فهرست GitHub (${r.status}).`);const t=await readJson(r);if(t?.truncated)throw new Error('فهرست فایل‌های Repository ناقص شد.');const rows=await metadata(env,c);const map=new Map(rows.map((x:any)=>[x.path,x]));return(t?.tree||[]).filter((i:any)=>i.type==='blob'&&String(i.path||'').startsWith(c.basePath)&&isImagePath(String(i.path||''))).map((i:any)=>makeAsset(map.get(i.path),c,i.path,i.sha));}
function decodedSize(base64:string){const s=base64.includes(',')?base64.split(',').pop()||'':base64;const padding=s.endsWith('==')?2:s.endsWith('=')?1:0;return Math.max(0,Math.floor(s.length*3/4)-padding);}
function validateUpload(body:any){const filename=String(body.filename||'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/.test(filename)||filename.includes('..'))throw new Error('نام فایل نامعتبر است.');const raw=String(body.base64||'').trim();if(!raw)throw new Error('محتوای تصویر خالی است.');const base64=raw.includes(',')?raw.split(',').pop()||'':raw;const bytes=decodedSize(base64);if(bytes<1||bytes>MAX_UPLOAD_BYTES)throw new Error('حجم تصویر باید بین ۱ بایت و ۸ مگابایت باشد.');const mime=String(body.mimeType||'').toLowerCase();if(!['image/webp','image/jpeg','image/png','image/gif','image/avif'].includes(mime))throw new Error('فرمت تصویر مجاز نیست. فقط WebP، JPEG، PNG، GIF و AVIF پذیرفته می‌شوند.');return{filename,base64,bytes,mime};}
async function uploadAsset(env:MediaEnv,body:any,c:Config){const input=validateUpload(body);const path=safePath(`${c.basePath}${input.filename}`);if(!path||!path.startsWith(c.basePath))throw new Error('مسیر فایل برای این کتابخانه معتبر نیست.');const endpoint=`/repos/${c.githubOwner}/${c.githubRepository}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;const old=await github(env,`${endpoint}?ref=${encodeURIComponent(c.branch)}`);let oldSha='';if(old.ok){oldSha=(await readJson(old))?.sha||'';if(!body.overwrite)return{conflict:true,existingSha:oldSha,message:`فایلی با نام «${input.filename}» از قبل وجود دارد.`};}else if(old.status!==404)throw new Error(`بررسی فایل موجود در GitHub ناموفق بود (${old.status}).`);const put=await github(env,endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Upload media asset: ${input.filename} via Solmint Admin`,content:input.base64,branch:c.branch,...(oldSha?{sha:oldSha}:{})})});if(!put.ok){const d=await readJson(put);throw new Error((put.status===409?'GitHub فایل را هم‌زمان تغییر داده است؛ Library را Refresh کنید.':put.status===422?'GitHub اطلاعات فایل یا Branch را نپذیرفت.':`آپلود به GitHub ناموفق بود (${put.status}).`)+(d?.message?` ${d.message}`:''));}const d=await readJson(put);const asset=makeAsset(null,c,path,d?.content?.sha||oldSha);asset.mimeType=input.mime;asset.fileSize=input.bytes;asset.width=Number(body.width||0);asset.height=Number(body.height||0);asset.originalFilename=String(body.originalFilename||input.filename).slice(0,255);asset.altText=String(body.altText||'').slice(0,500);asset.title=String(body.title||input.filename).slice(0,255);await saveAsset(env,asset);return{asset};}
async function removeAsset(env:MediaEnv,body:any,c:Config){const path=safePath(body.path);if(!path||!path.startsWith(c.basePath))throw new Error('مسیر فایل برای این کتابخانه معتبر نیست.');const endpoint=`/repos/${c.githubOwner}/${c.githubRepository}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;const old=await github(env,`${endpoint}?ref=${encodeURIComponent(c.branch)}`);if(old.status===404){await deleteMetadata(env,String(body.assetId||''));return;}if(!old.ok)throw new Error(`خواندن فایل قبل از حذف ناموفق بود (${old.status}).`);const d=await readJson(old);const sha=String(body.sha||d?.sha||'');if(!sha)throw new Error('SHA فایل برای حذف مشخص نیست.');const del=await github(env,endpoint,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Delete media asset: ${path} via Solmint Admin`,sha,branch:c.branch})});if(!del.ok){const e=await readJson(del);throw new Error(`حذف فایل از GitHub ناموفق بود (${del.status}).${e?.message?` ${e.message}`:''}`);}await deleteMetadata(env,String(body.assetId||''));}

export const onRequest = async ({request,env,params}:{request:Request;env:MediaEnv;params:Record<string,string>})=>{try{const action=String(params.action||'').trim();if(!ACTIONS.has(action))return jsonResponse({success:false,message:'عملیات رسانه نامعتبر است.'},404);if(request.method!=='GET'&&request.method!=='POST')return jsonResponse({success:false,message:'Method Not Allowed'},405,{Allow:'GET, POST'});const user=await getAuthenticatedUser(env,request);if(!user||user.is_active===false||!['admin','superadmin'].includes(String(user.role)))return jsonResponse({success:false,message:'نشست مدیریتی معتبر نیست یا دسترسی رسانه ندارید.'},401);const body=request.method==='POST'?await request.json().catch(()=>({})):{};let config=await getConfig(env);if(body?.config)config=normalizeConfig(body.config);if(action==='config')return jsonResponse({success:true,config,hasToken:Boolean(getGithubToken(env)),tokenManagedByServer:true});if(action==='assets')return jsonResponse({success:true,assets:await listAssets(env,config),config,hasToken:Boolean(getGithubToken(env)),tokenManagedByServer:true});if(action==='test-connection'){const result=await testRepository(env,config);if(!result.success)return jsonResponse(result,200);const saved=await saveConfig(env,config,'connected');return jsonResponse({success:true,message:result.message,details:result.details,diagnostics:result.diagnostics,config:saved,hasToken:true,tokenManagedByServer:true});}if(action==='upload'){const result=await uploadAsset(env,body,config);if(result.conflict)return jsonResponse({success:false,errorCode:'FILE_EXISTS',code:'FILE_EXISTS',stage:'github_upload',message:result.message,existingSha:result.existingSha},409);return jsonResponse({success:true,message:'تصویر با موفقیت در GitHub ذخیره شد.',asset:result.asset});}if(action==='delete'){await removeAsset(env,body,config);return jsonResponse({success:true,message:'تصویر با موفقیت از GitHub حذف شد.'});}if(action==='migrate'){return jsonResponse({success:false,message:'مهاجرت Repository در این نسخه از gateway عمداً غیرفعال است تا از انتقال ناقص داده جلوگیری شود.'},501);}return jsonResponse({success:false,message:'عملیات رسانه پشتیبانی نمی‌شود.'},400);}catch(error){console.error('Production media gateway error:',error instanceof Error?error.message:error);return jsonResponse({success:false,message:error instanceof Error?error.message.slice(0,500):'خطای سرویس رسانه.'},503);}};

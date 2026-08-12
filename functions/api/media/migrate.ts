import { getAuthenticatedUser, jsonResponse, type Env } from '../auth/_shared';

interface EnvMedia extends Env {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  GITHUB_MEDIA_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

type Config = { provider:'github'; githubOwner:string; githubRepository:string; branch:string; basePath:string; connectionStatus?:string; lastTestAt?:string|null };
const DEFAULT_URL='https://nvopkbiedorfshwbmyhn.supabase.co';
const imageExt=['.jpg','.jpeg','.png','.webp','.gif','.avif'];
const secret=(env:EnvMedia)=>env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY||'';
const sbUrl=(env:EnvMedia)=>(env.SUPABASE_URL||DEFAULT_URL).replace(/\/$/,'');
const ghToken=(env:EnvMedia)=>String(env.GITHUB_MEDIA_TOKEN||env.GITHUB_TOKEN||'').trim();
const normalize=(v:any):Config=>({provider:'github',githubOwner:String(v?.githubOwner||'').trim().replace(/[^A-Za-z0-9_.-]/g,''),githubRepository:String(v?.githubRepository||'').trim().replace(/[^A-Za-z0-9_.-]/g,''),branch:String(v?.branch||'main').trim().replace(/[^A-Za-z0-9._\/-]/g,''),basePath:`${String(v?.basePath||'').trim().replace(/^\/+|\/+$/g,'')}/`.replace(/^\/$/,''),connectionStatus:'untested',lastTestAt:null});
const safePath=(v:any)=>{const p=String(v||'').replace(/\\/g,'/');return !p||p.startsWith('/')||p.includes('..')||p.includes('//')?null:p;};
const isImage=(p:string)=>imageExt.some(ext=>p.toLowerCase().endsWith(ext));
async function read(r:Response){const t=await r.text();if(!t)return null;try{return JSON.parse(t)}catch{return{raw:t}}}
async function supabase(env:EnvMedia,path:string,init:RequestInit={}){const k=secret(env);if(!k)throw new Error('کلید سرور Supabase پیکربندی نشده است.');return fetch(`${sbUrl(env)}/rest/v1/${path}`,{...init,headers:{apikey:k,Authorization:`Bearer ${k}`,'Content-Type':'application/json',...(init.headers||{})}})}
async function github(env:EnvMedia,path:string,init:RequestInit={}){const k=ghToken(env);if(!k)throw new Error('GITHUB_MEDIA_TOKEN روی سرور تنظیم نشده است.');return fetch(`https://api.github.com${path}`,{...init,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${k}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Solmint-GitHub-Media-Gateway',...(init.headers||{})}})}
async function checkRepo(env:EnvMedia,c:Config){const r=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}`);if(!r.ok)throw new Error(r.status===401?'توکن GitHub نامعتبر است.':r.status===403?'توکن GitHub دسترسی لازم ندارد.':`Repository ${c.githubOwner}/${c.githubRepository} قابل دسترسی نیست.`);const b=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}/branches/${encodeURIComponent(c.branch)}`);if(!b.ok)throw new Error(`Branch «${c.branch}» در ${c.githubOwner}/${c.githubRepository} قابل دسترسی نیست.`);const t=await github(env,`/repos/${c.githubOwner}/${c.githubRepository}/git/trees/${encodeURIComponent(c.branch)}?recursive=1`);const td=await read(t);if(!t.ok)throw new Error(`خواندن ساختار Repository ناموفق بود (${t.status}).`);if(td?.truncated)throw new Error('ساختار Repository بیش از ظرفیت tree API GitHub است.');return td;}
async function saveConfig(env:EnvMedia,c:Config){const n=normalize(c);const r=await supabase(env,'media_config?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:'active_config',provider:'github',github_owner:n.githubOwner,github_repository:n.githubRepository,branch:n.branch,base_path:n.basePath,connection_status:'connected',last_test_at:new Date().toISOString()})});if(!r.ok)throw new Error(`ذخیره تنظیمات مقصد در Supabase ناموفق بود (${r.status}).`)}
async function saveAsset(env:EnvMedia,a:any){const r=await supabase(env,'media_assets?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:a.id,provider:'github',github_owner:a.githubOwner,github_repository:a.githubRepository,branch:a.branch,path:a.path,filename:a.filename,public_url:a.publicUrl,mime_type:a.mimeType,file_size:a.fileSize||0,width:a.width||0,height:a.height||0,sha:a.sha||null,original_filename:a.originalFilename||a.filename,alt_text:a.altText||'',title:a.title||'',updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(`ثبت metadata «${a.filename}» در Supabase ناموفق بود (${r.status}).`)}
function publicUrl(c:Config,path:string){return `https://raw.githubusercontent.com/${c.githubOwner}/${c.githubRepository}/${encodeURIComponent(c.branch)}/${path.split('/').map(encodeURIComponent).join('/')}`;}

export const onRequestPost=async({request,env}:{request:Request;env:EnvMedia})=>{
  try{
    const user=await getAuthenticatedUser(env,request);
    if(!user||user.is_active===false||!['admin','superadmin'].includes(String(user.role)))return jsonResponse({success:false,message:'نشست مدیریتی معتبر نیست یا دسترسی رسانه ندارید.'},401);
    if(!ghToken(env))return jsonResponse({success:false,message:'توکن GitHub روی سرور تنظیم نشده است.'},503);
    const body=await request.json().catch(()=>({}));
    const source=normalize(body.sourceConfig||{}); const target=normalize(body.targetConfig||{});
    if(!source.githubOwner||!source.githubRepository||!source.basePath)return jsonResponse({success:false,message:'تنظیمات مبدا مهاجرت کامل نیست.'},400);
    if(!target.githubOwner||!target.githubRepository||!target.basePath)return jsonResponse({success:false,message:'تنظیمات مقصد مهاجرت کامل نیست.'},400);
    const same=source.githubOwner.toLowerCase()===target.githubOwner.toLowerCase()&&source.githubRepository.toLowerCase()===target.githubRepository.toLowerCase()&&source.branch===target.branch&&source.basePath===target.basePath;
    if(same)return jsonResponse({success:false,message:'مخزن مبدا و مقصد یکسان هستند.'},400);

    // Preflight both repositories before writing anything.
    const sourceTree=await checkRepo(env,source); await checkRepo(env,target);
    const sourceAssets=Array.isArray(body.assets)?body.assets:(sourceTree?.tree||[]).filter((i:any)=>i.type==='blob'&&String(i.path||'').startsWith(source.basePath)&&isImage(String(i.path||''))).map((i:any)=>({path:i.path,filename:String(i.path).split('/').pop()||i.path,sha:i.sha}));
    const results:any[]=[];

    for(const asset of sourceAssets){
      const sp=safePath(asset.path); if(!sp||!sp.startsWith(source.basePath))return jsonResponse({success:false,message:`مسیر مبدا نامعتبر است: ${asset.path}`,results},400);
      const srcEndpoint=`/repos/${source.githubOwner}/${source.githubRepository}/contents/${sp.split('/').map(encodeURIComponent).join('/')}`;
      const src=await github(env,`${srcEndpoint}?ref=${encodeURIComponent(source.branch)}`); if(!src.ok)throw new Error(`خواندن «${asset.filename}» از مبدا ناموفق بود (${src.status}).`);
      const srcData=await read(src); if(!srcData?.content)throw new Error(`محتوای «${asset.filename}» از GitHub دریافت نشد.`);
      const filename=String(asset.filename||sp.split('/').pop()||'').replace(/[^A-Za-z0-9._-]/g,''); if(!filename||!isImage(filename))throw new Error(`نام فایل مهاجرتی نامعتبر است: ${asset.filename}`);
      const tp=safePath(`${target.basePath}${filename}`); if(!tp||!tp.startsWith(target.basePath))throw new Error(`مسیر مقصد «${filename}» نامعتبر است.`);
      const targetEndpoint=`/repos/${target.githubOwner}/${target.githubRepository}/contents/${tp.split('/').map(encodeURIComponent).join('/')}`;
      const existing=await github(env,`${targetEndpoint}?ref=${encodeURIComponent(target.branch)}`); let targetSha='';
      if(existing.ok) targetSha=(await read(existing))?.sha||''; else if(existing.status!==404)throw new Error(`بررسی مقصد «${filename}» ناموفق بود (${existing.status}).`);
      const write=await github(env,targetEndpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:`Migrate media asset: ${filename} via Solmint Admin`,content:srcData.content.replace(/\n/g,''),branch:target.branch,...(targetSha?{sha:targetSha}:{})})});
      if(!write.ok){const wd=await read(write);throw new Error(`نوشتن «${filename}» در مقصد ناموفق بود (${write.status}).${wd?.message?` ${wd.message}`:''}`)}
      const wd=await read(write); const migrated={id:asset.id||`github_${target.githubOwner}_${target.githubRepository}_${wd?.content?.sha||targetSha}`,provider:'github',githubOwner:target.githubOwner,githubRepository:target.githubRepository,branch:target.branch,path:tp,filename,publicUrl:publicUrl(target,tp),mimeType:asset.mimeType||'image/webp',fileSize:Number(asset.fileSize||0),width:Number(asset.width||0),height:Number(asset.height||0),sha:wd?.content?.sha||targetSha,createdAt:asset.createdAt||new Date().toISOString(),originalFilename:asset.originalFilename||filename,altText:asset.altText||'',title:asset.title||filename};
      await saveAsset(env,migrated); results.push({filename,path:tp,success:true});
    }

    // Active configuration changes only after every asset has been written and metadata saved.
    await saveConfig(env,target);
    return jsonResponse({success:true,message:`مهاجرت ${results.length} تصویر با موفقیت تکمیل شد و مخزن مقصد فعال شد.`,results:{count:results.length,items:results}});
  }catch(error){
    console.error('Media migration error:',error instanceof Error?error.message:error);
    return jsonResponse({success:false,message:error instanceof Error?error.message.slice(0,500):'مهاجرت رسانه ناموفق بود.',activeConfigUnchanged:true},503);
  }
};

/* MyDesk 2.0 private sync service (Node + Neon PostgreSQL).
   Deploy separately to Render. NEVER publish secret values in GitHub Pages. */
import express from 'express';
import {rateLimit} from 'express-rate-limit';
import {Pool} from 'pg';
import crypto from 'node:crypto';

const app=express();
app.disable('x-powered-by');
app.set('trust proxy',1); // Render のリバースプロキシを1段だけ信頼
app.use(express.json({limit:'4mb'}));

const origins=(process.env.ALLOWED_ORIGIN||'http://localhost:8000').split(',').map(s=>s.trim()).filter(Boolean);
const SESSION_SECONDS=60*60*24*30;
function fail(res,status,message){return res.status(status).json({error:message})}
app.use((req,res,next)=>{
  res.set('X-Content-Type-Options','nosniff');
  res.set('Referrer-Policy','no-referrer');
  res.set('Cache-Control','no-store');
  const origin=req.get('origin');
  if(origin){
    if(!origins.includes(origin))return fail(res,403,'このWebサイトからの接続は許可されていません');
    res.set('Access-Control-Allow-Origin',origin);
    res.set('Vary','Origin');
    res.set('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
  }
  if(req.method==='OPTIONS')return res.sendStatus(204);
  next();
});

const rate=(limit,windowMs)=>rateLimit({windowMs,limit,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'操作が多すぎます。しばらくしてから再試行してください。'}});
const password=process.env.SYNC_PASSWORD||'';
const jwtSecret=process.env.SESSION_SECRET||'';
const model=process.env.OPENAI_MODEL||'gpt-4.1-mini';
function sameDigest(a,b){
  const h1=crypto.createHash('sha256').update(a).digest();
  const h2=crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(h1,h2);
}
function signToken(){
  const exp=Math.floor(Date.now()/1000)+SESSION_SECONDS;
  const part=`v1.${exp}.${crypto.randomBytes(18).toString('base64url')}`;
  const signature=crypto.createHmac('sha256',jwtSecret).update(part).digest('base64url');
  return `${part}.${signature}`;
}
function isTokenValid(token){
  const parts=String(token||'').split('.');
  if(parts.length!==4||parts[0]!=='v1'||!/^[0-9]+$/.test(parts[1]))return false;
  const exp=Number(parts[1]);
  if(!Number.isSafeInteger(exp)||exp<=Math.floor(Date.now()/1000)||exp>Math.floor(Date.now()/1000)+SESSION_SECONDS+60)return false;
  const raw=parts.slice(0,3).join('.');
  const expected=crypto.createHmac('sha256',jwtSecret).update(raw).digest('base64url');
  return sameDigest(parts[3],expected);
}
function needAuth(req,res,next){
  const bearer=req.get('authorization')||'';
  if(!bearer.startsWith('Bearer ')||!isTokenValid(bearer.slice(7)))return fail(res,401,'ログインが必要です。設定から再接続してください');
  next();
}
app.get('/health',(req,res)=>res.json({status:'ok',service:'mydesk-sync-api',aiEnabled:Boolean(process.env.OPENAI_API_KEY)}));
app.post('/api/login',rate(8,15*60*1000),(req,res)=>{
  const candidate=req.body?.password;
  if(typeof candidate!=='string'||candidate.length>1024||!sameDigest(candidate,password))return fail(res,401,'パスワードが正しくありません');
  return res.json({token:signToken(),expiresIn:SESSION_SECONDS});
});

const pool=new Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:12000});
app.get('/api/data',needAuth,async(req,res)=>{
  try{
    const q=await pool.query('SELECT version,data,updated_at FROM mydesk_store WHERE id=1');
    const row=q.rows[0];
    return res.json(row?{version:row.version,data:row.data,updatedAt:row.updated_at}:{version:0,data:null,updatedAt:null});
  }catch(e){console.error('database read failed',e.code||e.message);return fail(res,503,'データベースを読み込めません')}
});
app.put('/api/data',needAuth,rate(120,60*60*1000),async(req,res)=>{
  const version=req.body?.expectedVersion;
  const data=req.body?.data;
  if(!Number.isInteger(version)||version<0||!data||typeof data!=='object'||!Array.isArray(data.tasks)||!Array.isArray(data.favorites)||!Array.isArray(data.checks)||!Array.isArray(data.logs)||!Array.isArray(data.ideas)||!data.weekDone||typeof data.weekDone!=='object')return fail(res,400,'データの形式が正しくありません');
  if(JSON.stringify(data).length>1_000_000)return fail(res,413,'保存データが大きすぎます（上限約1MB）');
  try{
    // 楽観的ロック：予想版番号が一致する場合だけ更新。別端末の変更を無断で上書きしない。
    const result=version===0
      ?await pool.query('INSERT INTO mydesk_store (id,version,data) VALUES (1,1,$1::jsonb) ON CONFLICT (id) DO NOTHING RETURNING version',[JSON.stringify(data)])
      :await pool.query('UPDATE mydesk_store SET version=version+1,data=$1::jsonb,updated_at=NOW() WHERE id=1 AND version=$2 RETURNING version',[JSON.stringify(data),version]);
    if(!result.rowCount)return fail(res,409,'別の端末による変更があります。クラウドと照合してください');
    return res.json({version:result.rows[0].version});
  }catch(e){console.error('database write failed',e.code||e.message);return fail(res,503,'データベースへ保存できません')}
});
// プライベート画像置き場: 公開URLを発行せず、認証付きのAPIで画像を返す。
// 個人利用を想定し、Neonの空き容量を圧迫しないよう厳格に制限する。
const PHOTO_MAX_BYTES=1_400_000;
const PHOTO_TOTAL_BYTES=35_000_000;
const PHOTO_MAX_COUNT=50;
const photoSql='SELECT id::text,name,mime,size,encode(thumb,\'base64\') AS thumb,created_at FROM mydesk_photos';
function validImage(b,mime){
  if(mime==='image/jpeg') return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(mime==='image/png') return b.length>=8&&b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  if(mime==='image/webp') return b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  return false;
}
app.get('/api/photos',needAuth,async(req,res)=>{
  try{const {rows}=await pool.query(`${photoSql} ORDER BY created_at DESC LIMIT 50`);
    return res.json({items:rows.map(r=>({id:r.id,name:r.name,mime:r.mime,size:r.size,thumbnail:`data:image/jpeg;base64,${r.thumb}`,createdAt:r.created_at})),maxFiles:PHOTO_MAX_COUNT,maxTotalBytes:PHOTO_TOTAL_BYTES});
  }catch(e){console.error('photos list',e.code||e.message);return fail(res,503,'画像一覧を読み込めません')}
});
app.post('/api/photos',needAuth,rate(40,60*60*1000),async(req,res)=>{
  const {name,mime,base64,thumbnail}=req.body||{};
  if(typeof name!=='string'||!name.trim()||name.length>100||typeof mime!=='string'||typeof base64!=='string'||typeof thumbnail!=='string'||base64.length>2_000_000||thumbnail.length>60_000)return fail(res,400,'画像データが不正、またはサイズ制限を超えています');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||!/^[A-Za-z0-9+/]+={0,2}$/.test(thumbnail))return fail(res,400,'画像データの形式が正しくありません');
  const binary=Buffer.from(base64,'base64'),thumb=Buffer.from(thumbnail,'base64');
  if(binary.length===0||binary.length>PHOTO_MAX_BYTES||thumb.length<3||thumb.length>40_000||!validImage(binary,mime)||!validImage(thumb,'image/jpeg'))return fail(res,413,'写真は約1.4MBまで、サムネイルは40KBまでです');
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    // 同時アップロードが容量制限をすり抜けないようDB側で排他する。
    await c.query('SELECT pg_advisory_xact_lock(13370103)');
    const q=await c.query('SELECT COUNT(*)::int AS count,COALESCE(SUM(size),0)::bigint AS total FROM mydesk_photos');
    if(q.rows[0].count>=PHOTO_MAX_COUNT||Number(q.rows[0].total)+binary.length>PHOTO_TOTAL_BYTES){await c.query('ROLLBACK');return fail(res,413,'画像の保存上限（50枚・合計35MB）です。不要な写真を削除してください')}
    const id=crypto.randomUUID();
    await c.query('INSERT INTO mydesk_photos(id,name,mime,size,body,thumb) VALUES ($1,$2,$3,$4,$5,$6)',[id,name.trim(),mime,binary.length,binary,thumb]);
    await c.query('COMMIT');return res.status(201).json({id,name,mime,size:binary.length});
  }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('photo upload',e.code||e.message);return fail(res,503,'画像を保存できません')}
  finally{c.release()}
});
app.get('/api/photos/:id',needAuth,async(req,res)=>{
  if(!/^[a-f0-9-]{36}$/.test(req.params.id))return fail(res,400,'画像IDが不正です');
  try{const {rows}=await pool.query('SELECT name,mime,body FROM mydesk_photos WHERE id=$1',[req.params.id]);
    if(!rows.length)return fail(res,404,'画像が見つかりません');
    res.set('Content-Type',rows[0].mime);res.set('Content-Length',String(rows[0].body.length));return res.send(rows[0].body);
  }catch(e){console.error('photo download',e.code||e.message);return fail(res,503,'画像を開けません')}
});
app.delete('/api/photos/:id',needAuth,rate(80,60*60*1000),async(req,res)=>{
  if(!/^[a-f0-9-]{36}$/.test(req.params.id))return fail(res,400,'画像IDが不正です');
  try{const result=await pool.query('DELETE FROM mydesk_photos WHERE id=$1',[req.params.id]);return res.json({deleted:result.rowCount>0})}
  catch(e){console.error('photo delete',e.code||e.message);return fail(res,503,'画像を削除できません')}
});
// ランク順位・わざ・持ち物・能力Pの採用割合は取得元を明示して中継。公開DBの再配布はしない。
app.get('/api/pokemon-usage',needAuth,rate(120,60*60*1000),async(req,res)=>{
  const format=req.query.format==='Singles'?'Singles':'Doubles';
  const name=String(req.query.pokemon||'').toLowerCase();
  if(!/^[a-z0-9-]{2,48}$/.test(name))return fail(res,400,'ポケモンの検索名が不正です');
  try{const response=await fetch(`https://championsbattledata.com/api/battle/${format}/${encodeURIComponent(name)}`,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
    if(!response.ok)return fail(res,502,`対戦データ取得元が応答しませんでした（${response.status}）`);
    const body=await response.json();
    if(!Array.isArray(body.rows))return fail(res,502,'対戦データの形式が変わりました');
    const allowed=body.rows.slice(0,100).map(x=>({category:String(x.category||'').slice(0,50),name:String(x.name||'').slice(0,100),rank:Number(x.rank)||0,percentage:String(x.percentage||'').slice(0,30)}));
    return res.json({pokemon:String(body.pokemon||name).slice(0,80),format,season:String(body.season||'不明').slice(0,30),source:'Pokémon Champions Battle Data',fetchedAt:new Date().toISOString(),sourceUrl:`https://championsbattledata.com/`,rows:allowed});
  }catch(e){console.error('pokemon usage error',e.message);return fail(res,502,'対戦データ提供元へ接続できませんでした')}
});

app.post('/api/rewrite',needAuth,rate(15,60*60*1000),async(req,res)=>{
  if(!process.env.OPENAI_API_KEY)return fail(res,503,'AI機能は未設定です（OPENAI_API_KEYが必要です）');
  const {recipient,intent,raw}=req.body||{};
  if(typeof raw!=='string'||!raw.trim()||raw.length>2000)return fail(res,400,'2000文字以内の文章を入力してください');
  const recipients={teacher:'学校の先生',manager:'アルバイト先の店長・上司',business:'外部企業の担当者',other:'目上の方'};
  const intents={request:'お願い・確認',consult:'相談',apology:'お詫び',decline:'お断り',notice:'報告・連絡',thanks:'お礼'};
  try{
    const ai=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({model,store:false,max_output_tokens:700,
        instructions:'あなたは日本語のビジネス文章を丁寧に推敲するアシスタントです。入力された下書きを相手にふさわしい自然な敬語メッセージにします。日時、人数、名前、事実、事情、依頼内容、結論を絶対に捏造・改変しないでください。欠けている情報を補作しないでください。丁寧でも長すぎない文にしてください。送り手本人の言葉で書き、件名や解説は不要です。完成メッセージだけ返してください。',
        input:`宛先：${recipients[recipient]||recipients.other}\n目的：${intents[intent]||intents.notice}\n下書き：\n${raw}`}),signal:AbortSignal.timeout(30000)});
    const j=await ai.json();
    if(!ai.ok){console.error('AI returned',ai.status);return fail(res,502,'AI側の処理が失敗しました。APIキーや利用枠をご確認ください')}
    const answer=(j.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n').trim();
    if(!answer)return fail(res,502,'AIの出力を取得できませんでした');
    return res.json({text:answer.slice(0,3500)});
  }catch(e){console.error('AI error',e.name);return fail(res,502,'AIサービスへの接続に失敗しました')}
});

async function start(){
  if(password.length<16||jwtSecret.length<32||!process.env.DATABASE_URL){
    throw new Error('SYNC_PASSWORD(16文字以上)、SESSION_SECRET(32文字以上)、DATABASE_URL をRender環境変数に設定してください');
  }
  await pool.query('CREATE TABLE IF NOT EXISTS mydesk_store (id INTEGER PRIMARY KEY,version INTEGER NOT NULL,data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await pool.query('CREATE TABLE IF NOT EXISTS mydesk_photos (id UUID PRIMARY KEY,name VARCHAR(100) NOT NULL,mime VARCHAR(40) NOT NULL,size INTEGER NOT NULL,body BYTEA NOT NULL,thumb BYTEA NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const port=Number(process.env.PORT||3000);
  app.listen(port,'0.0.0.0',()=>console.log(`MyDesk sync API ready on port ${port}`));
}
start().catch(e=>{console.error('startup failed:',e.message);process.exit(1)});

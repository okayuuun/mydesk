'use strict';
/* MyDesk v3: Private photo vault + Pokemon Champions research and approximate damage.
   All network data stays attributed. Damage is only an estimate: unmodeled abilities, items and
   special moves can substantially change results. */
const POKEMON_NAMES={
'ガブリアス':'garchomp','アシレーヌ':'primarina','カバルドン':'hippowdon','グソクムシャ':'golisopod',
'メガグソクムシャ':'golisopod-mega','リザードン':'charizard','メガリザードンX':'charizard-mega-x','メガリザードンY':'charizard-mega-y',
'ルカリオ':'lucario','メガルカリオ':'lucario-mega','ライチュウ':'raichu','メガライチュウY':'raichu-mega-y',
'カイリュー':'dragonite','ボーマンダ':'salamence','メガボーマンダ':'salamence-mega','ゴリランダー':'rillaboom',
'ガオガエン':'incineroar','オオニューラ':'sneasler','ドドゲザン':'kingambit','サーフゴー':'gholdengo',
'ブリジュラス':'archaludon','イエッサン':'indeedee-male','イエッサン♀':'indeedee-female','ペリッパー':'pelipper',
'エルフーン':'whimsicott','ミロカロス':'milotic','アーマーガア':'corviknight','ミミッキュ':'mimikyu-disguised',
'ゲンガー':'gengar','バンギラス':'tyranitar','ハバタクカミ':'flutter-mane','ウーラオス':'urshifu-single-strike',
'メタグロス':'metagross','マスカーニャ':'meowscarada','セグレイブ':'baxcalibur','ギャラドス':'gyarados',
'シャワーズ':'vaporeon','ドリュウズ':'excadrill','イダイトウ':'basculegion-male','ヤバソチャ':'sinistcha',
'キラフロル':'glimmora','ピカチュウ':'pikachu','パーモット':'pawmot','ヤドキング':'slowking',
'ヌメルゴン':'goodra','オニシズクモ':'araquanid','サザンドラ':'hydreigon','ラティアス':'latias',
'ヤミカラス':'murkrow','ウインディ':'arcanine','アローラキュウコン':'ninetales-alola',
'クレセリア':'cresselia','ニンフィア':'sylveon','エースバーン':'cinderace','ラグラージ':'swampert',
'コータス':'torkoal','テツノカイナ':'iron-hands','チオンジェン':'wo-chien','トドロクツキ':'roaring-moon',
'ヘイラッシャ':'dondozo','キノガッサ':'breloom','サーナイト':'gardevoir','フシギバナ':'venusaur'
};
const NAME_BY_SLUG=Object.fromEntries(Object.entries(POKEMON_NAMES).map(([k,v])=>[v,k]));
const TYPE_JA={normal:'ノーマル',fire:'ほのお',water:'みず',electric:'でんき',grass:'くさ',ice:'こおり',fighting:'かくとう',poison:'どく',ground:'じめん',flying:'ひこう',psychic:'エスパー',bug:'むし',rock:'いわ',ghost:'ゴースト',dragon:'ドラゴン',dark:'あく',steel:'はがね',fairy:'フェアリー'};
const STAT_JA={hp:'HP',attack:'攻撃',defense:'防御','special-attack':'特攻','special-defense':'特防',speed:'素早さ'};
const STAT_KEYS=['hp','attack','defense','special-attack','special-defense','speed'];
const MOVE_SAMPLES={
'じしん':['earthquake',100,'ground','physical','範囲'],'いわなだれ':['rock-slide',75,'rock','physical','範囲'],
'ドラゴンクロー':['dragon-claw',80,'dragon','physical','単体'],'げきりん':['outrage',120,'dragon','physical','単体'],
'フレアドライブ':['flare-blitz',120,'fire','physical','単体'],'ブラストバーン':['blast-burn',150,'fire','special','単体'],
'ねっぷう':['heat-wave',95,'fire','special','範囲'],'かえんほうしゃ':['flamethrower',90,'fire','special','単体'],
'オーバーヒート':['overheat',130,'fire','special','単体'],'なみのり':['surf',90,'water','special','範囲'],
'ハイドロポンプ':['hydro-pump',110,'water','special','単体'],'ムーンフォース':['moonblast',95,'fairy','special','単体'],
'マジカルシャイン':['dazzling-gleam',80,'fairy','special','範囲'],'じゃれつく':['play-rough',90,'fairy','physical','単体'],
'インファイト':['close-combat',120,'fighting','physical','単体'],'ドレインパンチ':['drain-punch',75,'fighting','physical','単体'],
'シャドーボール':['shadow-ball',80,'ghost','special','単体'],'ゴールドラッシュ':['make-it-rain',120,'steel','special','範囲'],
'リーフストーム':['leaf-storm',130,'grass','special','単体'],'グラススライダー':['grassy-glide',55,'grass','physical','単体'],
'ウッドハンマー':['wood-hammer',120,'grass','physical','単体'],'とんぼがえり':['u-turn',70,'bug','physical','単体'],
'10まんボルト':['thunderbolt',90,'electric','special','単体'],'ボルトチェンジ':['volt-switch',70,'electric','special','単体'],
'かみなり':['thunder',110,'electric','special','単体'],'れいとうビーム':['ice-beam',90,'ice','special','単体'],
'ふぶき':['blizzard',110,'ice','special','範囲'],'こおりのつぶて':['ice-shard',40,'ice','physical','単体'],
'あくのはどう':['dark-pulse',80,'dark','special','単体'],'ふいうち':['sucker-punch',70,'dark','physical','単体'],
'しんそく':['extreme-speed',80,'normal','physical','単体'],'すてみタックル':['double-edge',120,'normal','physical','単体'],
'サイコキネシス':['psychic',90,'psychic','special','単体'],'だいちのちから':['earth-power',90,'ground','special','単体'],
'アイアンヘッド':['iron-head',80,'steel','physical','単体'],'ヘビーボンバー':['heavy-slam',0,'steel','physical','単体'],
'エレクトロビーム':['electro-shot',130,'electric','special','単体'],'ウェーブタックル':['wave-crash',120,'water','physical','単体'],
'きょけんとつげき':['glaive-rush',120,'dragon','physical','単体'],'ラスターカノン':['flash-cannon',80,'steel','special','単体'],
'ギガドレイン':['giga-drain',75,'grass','special','単体'],'アクアジェット':['aqua-jet',40,'water','physical','単体'],
'ストーンエッジ':['stone-edge',100,'rock','physical','単体']
};
const MOVE_OPTS=Object.keys(MOVE_SAMPLES).map(n=>`<option value="${n}"></option>`).join('');
const PK_OPTS=Object.keys(POKEMON_NAMES).map(n=>`<option value="${n}"></option>`).join('');
const pokeCache=new Map();
let dexCurrent=null,usageCurrent=null,usageFormat='Doubles',pokemonFind='ガブリアス';
let photoItems=[],photoViewURL=null,photoLoading=false,photoError='';
let calcDraft={atk:'ガブリアス',def:'アシレーヌ',atkNatureUp:'attack',atkNatureDown:'special-attack',defNatureUp:'defense',defNatureDown:'attack',move:'じしん',power:100,type:'ground',category:'physical',spread:true,item:'',defItem:'',atkBoost:0,defBoost:0,weather:'',battleFormat:'Doubles',screen:false,burn:false,critical:false,atkAbility:'',defAbility:'',atkTypeOverride:'',defTypeOverride:'',atkPoints:[0,32,0,0,0,32],defPoints:[32,0,32,0,0,2],historyMode:'either'};
let calcResult=null;
function pokeSlug(v){let s=String(v||'').trim();return POKEMON_NAMES[s]||s.toLowerCase().replace(/[.\s_'’]/g,'-').replace(/-+/g,'-');}
function pokemonLabel(s){return NAME_BY_SLUG[s]||s;}
async function getPokemon(v){
  const slug=pokeSlug(v);
  if(!slug||!/^[a-z0-9-]{2,45}$/.test(slug))throw Error('ポケモン名は候補の日本語名、英語名、またはPokeAPIのIDで指定してください');
  if(pokeCache.has(slug))return pokeCache.get(slug);
  const r=await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(slug)}`,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error(`図鑑データが見つかりません（${slug}）。新しいメガシンカなどPokeAPI未収録の姿もあります`);
  const j=await r.json();
  const pk={slug,name:pokemonLabel(slug),types:j.types.map(t=>t.type.name),stats:Object.fromEntries(j.stats.map(st=>[st.stat.name,st.base_stat])),sprite:j.sprites?.front_default||'',abilities:j.abilities.map(a=>a.ability.name),moves:j.moves?.map(x=>x.move.name)||[]};
  pokeCache.set(slug,pk);return pk;
}
function pokemonView(){return `<section class="panel"><div class="panelhead"><h2>ポケモン図鑑・対戦データ</h2><span class="chip">Pokémon Champions</span></div><p class="muted">日本語の代表的な名前、英語名、PokeAPI IDで検索。種族値はPokeAPI、技・持ち物・能力Pの使用率はPokémon Champions Battle Dataを参照します。両者の収録範囲は異なります。</p><div class="section-tools"><input id="pokemonSearch" class="input grow" list="pokemonOptions" value="${esc(pokemonFind)}" placeholder="例：ガブリアス、リザードン"><datalist id="pokemonOptions">${PK_OPTS}</datalist><button class="btn primary" data-act="pokemonLookup">検索</button></div><div class="section-tools"><label>使用率の対戦形式</label><select class="input" id="pokemonFormat" style="max-width:190px"><option value="Doubles" ${usageFormat==='Doubles'?'selected':''}>ダブル</option><option value="Singles" ${usageFormat==='Singles'?'selected':''}>シングル</option></select><button class="btn ghost" data-act="pokemonUsage">わざ・もちもの・能力Pの使用率を取得</button></div><div id="pokemonResult">${dexCurrent?pokemonResultHtml(dexCurrent):'<div class="empty">ポケモンを検索してください。</div>'}</div><div id="usageResult">${usageCurrent?usageResultHtml(usageCurrent):'<p class="muted">使用率を見る場合はクラウドAPI（Render）の接続が必要です。取得データには対象シーズンを明示します。</p>'}</div></section><section class="panel"><h2>対戦データの出典</h2><p class="muted">種族値: <a href="https://pokeapi.co/" target="_blank" rel="noopener">PokeAPI</a> / 採用率: <a href="https://championsbattledata.com/" target="_blank" rel="noopener">Pokémon Champions Battle Data</a>（非公式）。入手できない場合は元サイトで確認できます。採用率は公式のポケモン順位と同じ意味ではありません。</p><button class="btn ghost" data-act="gotoDamage">このポケモンでダメージ計算 →</button></section>`;}
function pokemonResultHtml(p){return `<div class="pokemon-card"><div class="pokemon-head">${p.sprite?`<img src="${esc(p.sprite)}" alt="${esc(p.name)}のゲーム内ドット絵" width="90" height="90" loading="lazy">`:''}<div><h3>${esc(p.name)} <small>${esc(p.slug)}</small></h3><p class="muted">${p.types.map(t=>esc(TYPE_JA[t]||t)).join(' / ')} · 特性候補: ${esc(p.abilities.join(', '))}</p></div></div><div class="stat-grid">${STAT_KEYS.map(k=>`<div class="stat-mini"><span>${STAT_JA[k]}</span><strong>${Number(p.stats[k]||0)}</strong></div>`).join('')}</div><p class="muted">種族値（形態・バージョンによる違いに注意）。<a href="https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">参照元データ ↗</a></p></div>`;}
function usageResultHtml(u){
 const groups=[['move','わざ'],['item','もちもの'],['spread','能力ポイント配分'],['stat','能力配分'],['nature','せいかく'],['alignment','性格補正'],['ability','とくせい']];
 const rows=u.rows||[];
 return `<div class="usage-box"><div class="panelhead"><h2>採用傾向・使用率</h2><span class="chip">${esc(u.season||'時期不明')} / ${u.format==='Singles'?'シングル':'ダブル'}</span></div><p class="muted">出典：<a href="https://championsbattledata.com/" target="_blank" rel="noopener">Pokémon Champions Battle Data</a>。割合はそのポケモンの使用者の中での採用割合です。シーズンが『Current』の場合、必ずしも当日・当月のデータではありません。取得元の更新日時を確認してください。${u.fetchedAt?`API照会: ${esc(new Date(u.fetchedAt).toLocaleString('ja-JP'))}`:''} 項目がない場合は元データ未収録です。</p>${groups.map(([key,label])=>{const rr=rows.filter(r=>String(r.category).toLowerCase().includes(key));return rr.length?`<div class="usage-group"><b>${label}</b>${rr.slice(0,8).map(x=>`<div class="usage-line"><span>${esc(x.name)}</span><strong>${esc(x.percentage)}</strong></div>`).join('')}</div>`:''}).join('')||'<p class="muted">このポケモンの採用データは見つかりませんでした。</p>'}</div>`;
}
async function pokemonLookup(){pokemonFind=document.getElementById('pokemonSearch')?.value.trim()||pokemonFind;const dst=document.getElementById('pokemonResult');if(dst)dst.textContent='図鑑データを読み込み中…';try{dexCurrent=await getPokemon(pokemonFind);usageCurrent=null;render();}catch(e){if(dst)dst.textContent='取得失敗：'+e.message}}
async function pokemonUsage(){
  pokemonFind=document.getElementById('pokemonSearch')?.value.trim()||pokemonFind;
  usageFormat=document.getElementById('pokemonFormat')?.value||'Doubles';
  const dst=document.getElementById('usageResult');if(dst)dst.textContent='採用率を読み込み中…';
  try{
    if(!syncConfig?.token)throw Error('採用率を取得するには「設定」でRenderのクラウドAPIにログインしてください。');
    const slug=pokeSlug(pokemonFind).replaceAll('-','');
    const u=await cloudRequest(`/api/pokemon-usage?format=${usageFormat}&pokemon=${encodeURIComponent(slug)}`);
    usageCurrent=u;if(dst)dst.innerHTML=usageResultHtml(u);
  }catch(e){if(dst)dst.innerHTML=`<p class="note">${esc(e.message)} <a href="https://championsbattledata.com/" target="_blank" rel="noopener">元サイトで検索する ↗</a></p>`}
}
// Private cloud image storage (no images in the task JSON or public GitHub Pages).
function galleryView(){return `<section class="panel"><div class="panelhead"><h2>写真・画像の共有</h2><span class="chip">非公開 / 認証制</span></div><p class="muted">PCとスマホで同じクラウドAPIにログインすると、双方から画像を送受信できます。画像本体はNeonの専用テーブルに保存し、URLだけで公開できないようにしています。</p><div class="tools"><button class="btn primary" data-act="choosePhoto">＋ 画像をアップロード</button><button class="btn ghost" data-act="galleryLoad">一覧を更新</button><input id="photoSelect" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></div><p class="muted">1枚約1.4MB・最大50枚・合計35MB。アップロード時に画質と大きさを自動調整します。画像の同期にはRender・Neonへの接続が必須です。通信量とDB使用量に注意してください。</p><div id="photoList">${photoError?`<p class="note">${esc(photoError)}</p>`:photoItems.length?photoTiles():`<div class="empty">${photoLoading?'一覧を読み込み中…':'画像がありません。ログイン後、アップロードしてください。'}</div>`}</div></section><section class="panel"><h2>大切な画像について</h2><p class="muted">スマホから追加した画像も、PCで同じアカウントに接続すると一覧に現れます。画像は端末のローカル保存だけでは他端末に届きません。個人情報を含む写真・機密書類のアップロードは避け、元画像は別途保管してください。</p></section>`;}
function photoTiles(){return `<div class="photo-grid">${photoItems.map(x=>`<div class="photo-tile"><button class="photo-cover" data-act="photoOpen" data-id="${esc(x.id)}"><img loading="lazy" src="${esc(x.thumbnail)}" alt="${esc(x.name)}"><span>拡大する</span></button><div class="photo-caption"><b title="${esc(x.name)}">${esc(x.name)}</b><small>${Math.round(x.size/1024)}KB · ${new Date(x.createdAt).toLocaleDateString('ja-JP')}</small><button class="tiny danger" data-act="photoDelete" data-id="${esc(x.id)}">削除</button></div></div>`).join('')}</div>`}
function galleryListUpdate(){const el=document.getElementById('photoList');if(el)el.innerHTML=photoError?`<p class="note">${esc(photoError)}</p>`:photoItems.length?photoTiles():'<div class="empty">画像はまだありません。</div>'}
async function galleryLoad(){
 if(!syncConfig?.token){photoError='写真共有にはクラウド同期のログインが必要です。その他 → 設定から接続してください。';galleryListUpdate();return}
 photoLoading=true;photoError='';const dst=document.getElementById('photoList');if(dst)dst.textContent='画像一覧を取得しています…';
 try{const data=await cloudRequest('/api/photos');photoItems=data.items||[];photoError=''}catch(e){photoError=e.message}finally{photoLoading=false;galleryListUpdate()}
}
function choosePhoto(){if(!syncConfig?.token)return toast('設定からクラウドに接続してください');document.getElementById('photoSelect')?.click()}
function makeCanvas(file,maxSide,quality,mime='image/jpeg'){
 return new Promise((resolve,reject)=>{
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{URL.revokeObjectURL(url);const k=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));const ctx=c.getContext('2d');if(mime==='image/jpeg'){ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height)}ctx.drawImage(img,0,0,c.width,c.height);c.toBlob(blob=>blob?resolve(blob):reject(Error('画像を変換できません')) ,mime,quality)};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('この画像を読み込めません'))};img.src=url;
 });
}
async function fileToBase64(file){const a=await file.arrayBuffer();let binary='',u=new Uint8Array(a);for(let i=0;i<u.length;i+=8192)binary+=String.fromCharCode(...u.subarray(i,i+8192));return btoa(binary)}
async function galleryUpload(files){
 if(!files?.length)return;for(const file of [...files].slice(0,10)){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)){toast(`${file.name}: JPEG・PNG・WebPに対応`);continue}
  try{
    toast(`${file.name}: 画像を圧縮しています`);
    let mime=file.type;let blob=file;
    // PNG/WebP are kept unchanged if small, otherwise converted to JPEG with white backing.
    if(file.size>1_350_000||file.type==='image/webp'){
      mime='image/jpeg';blob=await makeCanvas(file,1600,.83);
      if(blob.size>1_400_000)blob=await makeCanvas(file,1100,.67);
    }
    if(blob.size>1_400_000)throw Error('圧縮しても容量上限を超えました');
    const thumb=await makeCanvas(file,220,.65);const thumb64=await fileToBase64(thumb);
    if(thumb.size>40_000)throw Error('サムネイルが大きすぎます');
    await cloudRequest('/api/photos',{method:'POST',body:JSON.stringify({name:file.name.slice(0,100),mime,base64:await fileToBase64(blob),thumbnail:thumb64})});
  }catch(e){toast(`${file.name}: ${e.message}`)}
 }
 await galleryLoad();toast('画像の送信処理が完了しました');
}
async function photoBlob(id){const response=await fetch(cloudUrl()+`/api/photos/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${syncConfig.token}`},cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('画像を取得できません。再ログインしてみてください');return response.blob()}
async function photoOpen(id){
 const item=photoItems.find(p=>p.id===id);if(!item)return;
 try{toast('画像を読み込み中…');const blob=await photoBlob(id);if(photoViewURL)URL.revokeObjectURL(photoViewURL);photoViewURL=URL.createObjectURL(blob);
 const d=document.getElementById('photoViewer');d.querySelector('img').src=photoViewURL;d.querySelector('img').alt=item.name;d.querySelector('h3').textContent=item.name;
 const a=d.querySelector('#photoDownload');a.href=photoViewURL;a.download=item.name;a.setAttribute('aria-label',`${item.name} を保存`);d.showModal();
 }catch(e){toast(e.message)}
}
async function photoDelete(id){if(!confirm('クラウドからこの画像を完全に削除しますか？'))return;try{await cloudRequest(`/api/photos/${encodeURIComponent(id)}`,{method:'DELETE'});await galleryLoad();toast('削除しました')}catch(e){toast('削除失敗: '+e.message)}}
// Champions Lv50 stat point system (max32 per stat, total 66).
function getSp(v,k){const n=Number(v)||0;return Number.isFinite(n)?Math.floor(n):0}
function calculatedStat(pk,idx,points,up,down){const base=Number(pk.stats[STAT_KEYS[idx]]||0);if(idx===0)return base+75+points[idx];const stat=STAT_KEYS[idx];const nature=up&&up===down?1:(up===stat?1.1:1)*(down===stat?.9:1);return Math.floor((base+20+points[idx])*nature)}
function stageMultiplier(n){return n>=0?(2+n)/2:2/(2-n)}
const TYPE_EFFECT={normal:['rock,steel','ghost'],fire:['fire,water,rock,dragon',''],water:['water,grass,dragon',''],electric:['electric,grass,dragon','ground'],grass:['fire,grass,poison,flying,bug,dragon,steel',''],ice:['fire,water,ice,steel',''],fighting:['poison,flying,psychic,bug,fairy','ghost'],poison:['poison,ground,rock,ghost','steel'],ground:['grass,bug','flying'],flying:['electric,rock,steel',''],psychic:['psychic,steel','dark'],bug:['fire,fighting,poison,flying,ghost,steel,fairy',''],rock:['fighting,ground,steel',''],ghost:['dark','normal'],dragon:['steel','fairy'],dark:['fighting,dark,fairy',''],steel:['fire,water,electric,steel',''],fairy:['fire,poison,steel','']};
const SUPER={normal:[],fire:['grass','ice','bug','steel'],water:['fire','ground','rock'],electric:['water','flying'],grass:['water','ground','rock'],ice:['grass','ground','flying','dragon'],fighting:['normal','ice','rock','dark','steel'],poison:['grass','fairy'],ground:['fire','electric','poison','rock','steel'],flying:['grass','fighting','bug'],psychic:['fighting','poison'],bug:['grass','psychic','dark'],rock:['fire','ice','flying','bug'],ghost:['psychic','ghost'],dragon:['dragon'],dark:['psychic','ghost'],steel:['ice','rock','fairy'],fairy:['fighting','dragon','dark']};
function typeRate(moveType,defTypes){let v=1;for(const d of defTypes){const [resist,immune]=TYPE_EFFECT[moveType]||['',''];if(immune.split(',').includes(d)){v*=0;continue}if(resist.split(',').includes(d))v*=.5;else if((SUPER[moveType]||[]).includes(d))v*=2}return v}
function weatherRate(w,t){if(w==='sun'&&t==='fire'||w==='rain'&&t==='water')return 1.5;if(w==='sun'&&t==='water'||w==='rain'&&t==='fire')return .5;return 1}
function getCalcValues(){const v={...calcDraft};for(const key of ['atk','def','move','type','category','item','defItem','atkNatureUp','atkNatureDown','defNatureUp','defNatureDown','atkAbility','defAbility','weather','battleFormat','historyMode']){const e=document.getElementById('c_'+key);if(e)v[key]=e.value}for(const key of ['power','atkBoost','defBoost']){let el=document.getElementById('c_'+key);if(el)v[key]=Number(el.value)||0}for(const key of ['spread','screen','burn','critical']){const e=document.getElementById('c_'+key);if(e)v[key]=e.checked}for(const who of ['atk','def']){v[who+'Points']=STAT_KEYS.map((_,i)=>getSp(document.getElementById(`c_${who}P${i}`)?.value,STAT_KEYS[i]))}return v}
function applyMovePreset(){const n=document.getElementById('c_move')?.value;const spec=MOVE_SAMPLES[n];if(!spec)return;const vals=['power','type','category','spread'];const [slug,power,type,cat,spread]=spec;document.getElementById('c_power').value=power||'';document.getElementById('c_type').value=type;document.getElementById('c_category').value=cat;document.getElementById('c_spread').checked=spread==='範囲';}
function optStage(n){return Array.from({length:13},(_,i)=>i-6).map(i=>`<option value="${i}" ${Number(n)===i?'selected':''}>${i>0?'+':''}${i}</option>`).join('')}
function optNatures(value){return ['-'].concat(STAT_KEYS.slice(1)).map(v=>`<option value="${v==='-'?'':v}" ${v===value||v==='-'&&!value?'selected':''}>${v==='-'?'補正なし':STAT_JA[v]}</option>`).join('')}
function calcPokemonForm(side,name){const p=calcDraft,prefix=side==='atk'?'攻撃側':'防御側';return `<div class="calc-person"><h3>${prefix}</h3><div class="field"><label>${prefix}ポケモン</label><input class="input" id="c_${side}" list="calcSpecies" value="${esc(p[side])}" placeholder="名前を入力"></div><div class="fieldrow"><div class="field"><label>性格で上昇</label><select id="c_${side}NatureUp">${optNatures(p[side+'NatureUp'])}</select></div><div class="field"><label>性格で下降</label><select id="c_${side}NatureDown">${optNatures(p[side+'NatureDown'])}</select></div></div><div class="field"><label>能力ポイント（各0〜32、合計66以下）</label><div class="points-grid">${STAT_KEYS.map((k,i)=>`<label>${STAT_JA[k]}<input id="c_${side}P${i}" class="input" type="number" min="0" max="32" value="${p[side+'Points'][i]||0}"></label>`).join('')}</div><p class="muted">現在 ${p[side+'Points'].reduce((a,b)=>a+b,0)}/66 ポイント</p></div><div class="field"><label>特性（メモのみ・計算には未反映）</label><input class="input" id="c_${side}Ability" value="${esc(p[side+'Ability'])}" placeholder="例：いかく"></div><div class="field"><label>持ち物</label><select id="c_${side==='atk'?'item':'defItem'}">${(side==='atk'?['','いのちのたま','こだわりハチマキ','こだわりメガネ','たつじんのおび']:['','オボンのみ','たべのこし','しんかのきせき']).map(x=>`<option ${p[side==='atk'?'item':'defItem']===x?'selected':''}>${x||'なし'}</option>`).join('').replace('<option >なし</option>','<option value="">なし</option>')}</select></div></div>`;}
function damageView(){const p=calcDraft;return `<p class="note"><strong>Pokémon Champions向け簡易ダメージ計算</strong>。レベル50・能力ポイント制・タイプ相性・16段階乱数・ランク補正などを扱います。<b>特性・一部の道具・特殊な技の効果・端数処理の完全再現は未対応</b>のため、厳密な確定数の判定には使用しないでください。</p><section class="panel"><datalist id="calcSpecies">${PK_OPTS}</datalist><datalist id="calcMoves">${MOVE_OPTS}</datalist><div class="calc-people">${calcPokemonForm('atk',p.atk)}${calcPokemonForm('def',p.def)}</div><div class="fieldrow"><div class="field"><label>わざ名（候補を選ぶと値を入力）</label><input class="input" id="c_move" list="calcMoves" value="${esc(p.move)}"></div><div class="field"><label>わざの威力</label><input id="c_power" class="input" type="number" min="1" max="500" value="${p.power}"></div></div><div class="fieldrow"><div class="field"><label>わざタイプ</label><select id="c_type">${Object.keys(TYPE_JA).map(t=>`<option value="${t}" ${t===p.type?'selected':''}>${TYPE_JA[t]}</option>`).join('')}</select></div><div class="field"><label>分類</label><select id="c_category"><option value="physical" ${p.category==='physical'?'selected':''}>物理</option><option value="special" ${p.category==='special'?'selected':''}>特殊</option></select></div></div><div class="calc-settings"><label><input id="c_spread" type="checkbox" ${p.spread?'checked':''}> ダブルの範囲補正</label><label><input id="c_burn" type="checkbox" ${p.burn?'checked':''}> 攻撃側がやけど</label><label><input id="c_critical" type="checkbox" ${p.critical?'checked':''}> 急所</label><label><input id="c_screen" type="checkbox" ${p.screen?'checked':''}> 相手に壁（リフレクター/光の壁）</label></div><div class="fieldrow"><div class="field"><label>攻撃側ランク</label><select id="c_atkBoost">${optStage(p.atkBoost)}</select></div><div class="field"><label>防御側ランク</label><select id="c_defBoost">${optStage(p.defBoost)}</select></div></div><div class="fieldrow"><div class="field"><label>対戦形式</label><select id="c_battleFormat"><option value="Doubles" ${p.battleFormat==='Doubles'?'selected':''}>ダブル</option><option value="Singles" ${p.battleFormat==='Singles'?'selected':''}>シングル</option></select></div><div class="field"><label>天候</label><select id="c_weather"><option value="" ${!p.weather?'selected':''}>なし</option><option value="sun" ${p.weather==='sun'?'selected':''}>晴れ</option><option value="rain" ${p.weather==='rain'?'selected':''}>雨</option></select></div></div><div class="tools"><button class="btn primary" data-act="damageCalc">計算して履歴に保存</button><button class="btn ghost" data-act="damageSwap">攻撃側と防御側を入れ替える</button></div><div id="damageResult">${calcResult?calcResultHtml(calcResult):'<p class="empty">上の条件で計算してください。</p>'}</div></section><section class="panel"><div class="panelhead"><h2>過去の計算履歴</h2><span class="chip">${(state.pokeHistory||[]).length} 件保存</span></div><p class="muted">今選んでいる攻撃側または防御側のポケモンに関連する過去の計算を検索できます。履歴はタスクと一緒にクラウド同期・JSONバックアップの対象になります。</p><div class="field"><label>履歴の絞り込み</label><select id="c_historyMode"><option value="either" ${p.historyMode==='either'?'selected':''}>いずれかのポケモンを含む</option><option value="attacker" ${p.historyMode==='attacker'?'selected':''}>攻撃側が一致</option><option value="defender" ${p.historyMode==='defender'?'selected':''}>防御側が一致</option><option value="both" ${p.historyMode==='both'?'selected':''}>両方が一致</option><option value="all" ${p.historyMode==='all'?'selected':''}>すべて表示</option></select></div><div id="calcHistory">${historyHtml()}</div></section>`;}
function historyHtml(){let p=calcDraft,items=(state.pokeHistory||[]).filter(h=>{const a=pokeSlug(p.atk),d=pokeSlug(p.def);switch(p.historyMode){case'attacker':return h.atk===a;case'defender':return h.def===d;case'both':return h.atk===a&&h.def===d;case'all':return true;default:return h.atk===a||h.def===d}});return items.length?items.slice(0,70).map(h=>`<div class="history-row"><div><b>${esc(h.atkName||pokemonLabel(h.atk))} → ${esc(h.defName||pokemonLabel(h.def))}</b><p>${esc(h.move)}：<strong>${esc(h.summary)}</strong></p><small>${esc(h.time)} · ${esc(h.kind||'概算')}</small></div><div class="actions"><button class="tiny" data-act="historyLoad" data-id="${esc(h.id)}">条件を再表示</button><button class="tiny danger" data-act="historyDelete" data-id="${esc(h.id)}">削除</button></div></div>`).join(''):'<p class="empty">選択中のポケモンに一致する履歴はありません。</p>'}
function calcResultHtml(r){return `<div class="calc-result"><span class="chip">推定・未対応効果あり</span><h3>${esc(r.atkName)} → ${esc(r.defName)}</h3><strong class="calc-main">${r.min}〜${r.max} ダメージ</strong><p><b>${r.minPct}〜${r.maxPct}%</b> / 最大HP ${r.hp} · ${esc(r.move)}（タイプ相性 ×${r.effect}）</p><p>${esc(r.ko)}</p><small>能力値：攻撃側 ${r.atkStat}、防御側 ${r.defStat} / Lv.50 / ${r.bonusNote}</small><p class="muted">概算です。特性・特殊効果・複雑な持ち物補正などは完全再現できません。実戦の確定数・乱数割合として保証しません。</p></div>`}
function validateDraft(v){
  for(const side of ['atk','def']){if(v[side+'Points'].some(n=>n<0||n>32)||v[side+'Points'].reduce((a,b)=>a+b,0)>66)throw Error(`${side==='atk'?'攻撃側':'防御側'}の能力ポイントは1か所32、合計66以下にしてください`)}
  if(!Number.isFinite(v.power)||v.power<1||v.power>500)throw Error('技の威力を1〜500で入力してください。威力が状況で変わる技は正しい値を手入力してください');
  if(!TYPE_JA[v.type])throw Error('わざタイプが正しくありません');
}
function rollOne(base,mods){let x=base;for(const m of mods)x=Math.floor(x*m);return Math.max(1,x)}
async function damageCalc(){
 const v=getCalcValues();calcDraft=v;
 try{
  validateDraft(v);
  const [a,d]=await Promise.all([getPokemon(v.atk),getPokemon(v.def)]);
  const physical=v.category==='physical',idxA=physical?1:3,idxD=physical?2:4;
  let atk=calculatedStat(a,idxA,v.atkPoints,v.atkNatureUp,v.atkNatureDown),def=calculatedStat(d,idxD,v.defPoints,v.defNatureUp,v.defNatureDown);
  const crit=Boolean(v.critical);
  atk=Math.floor(atk*stageMultiplier(crit?Math.max(0,v.atkBoost):v.atkBoost));
  def=Math.floor(def*stageMultiplier(crit?Math.min(0,v.defBoost):v.defBoost));
  if(v.item==='こだわりハチマキ'&&physical||v.item==='こだわりメガネ'&&!physical)atk=Math.floor(atk*1.5);
  if(v.defItem==='しんかのきせき')throw Error('しんかのきせきは進化可否の確認が必要なため、この簡易計算では非対応です。別のもちものを選んでください');
  const hp=calculatedStat(d,0,v.defPoints,v.defNatureUp,v.defNatureDown);
  const eff=typeRate(v.type,d.types);const stab=a.types.includes(v.type)?1.5:1;
  if(eff===0){const r={min:0,max:0,hp,minPct:0,maxPct:0,ko:'タイプ相性で無効（特性による相性の変更は未反映）',atkStat:atk,defStat:def,effect:0,move:v.move,atkName:a.name,defName:d.name,bonusNote:'通常のタイプ相性'};finishDamage(v,a,d,r);return}
  const base=Math.floor(Math.floor((22*v.power*atk)/Math.max(1,def))/50)+2;
  let prep=base;if(v.battleFormat==='Doubles'&&v.spread)prep=Math.floor(prep*.75);prep=Math.floor(prep*weatherRate(v.weather,v.type));if(crit)prep=Math.floor(prep*1.5);
  let mods=[];
  const screenRate=v.screen&&!crit?(v.battleFormat==='Doubles'?2/3:1/2):1; // conservative Double screen by default
  const finalItem=v.item==='いのちのたま'?1.3:v.item==='たつじんのおび'&&eff>1?1.2:1;
  for(let i=85;i<=100;i++){let x=Math.max(1,Math.floor(prep*i/100));x=rollOne(x,[stab,eff,physical&&v.burn?.5:1,screenRate,finalItem]);mods.push(x)}
  const min=Math.min(...mods),max=Math.max(...mods),minPct=(min*100/hp).toFixed(1),maxPct=(max*100/hp).toFixed(1);
  const ko=min>=hp?'概算では確定1発':max>=hp?'概算では乱数1発の可能性':min>=hp/2?'概算では確定2発圏内（回復等を除く）':`概算で最大HPの ${minPct}〜${maxPct}%`;
  const r={min,max,hp,minPct,maxPct,ko,atkStat:atk,defStat:def,effect:eff,move:v.move,atkName:a.name,defName:d.name,bonusNote:`タイプ一致 ×${stab} / 道具 ${v.item||'なし'}`};finishDamage(v,a,d,r);
 }catch(e){toast(e.message);const dst=document.getElementById('damageResult');if(dst)dst.innerHTML=`<p class="note">${esc(e.message)}</p>`}
}
function finishDamage(v,a,d,r){calcResult=r;state.pokeHistory??=[];state.pokeHistory.unshift({id:uid(),time:new Date().toLocaleString('ja-JP'),atk:a.slug,def:d.slug,atkName:a.name,defName:d.name,move:v.move,summary:`${r.min}〜${r.max} (${r.minPct}〜${r.maxPct}%)`,result:r,settings:JSON.parse(JSON.stringify(v)),kind:'簡易計算'});state.pokeHistory=state.pokeHistory.slice(0,200);save();const el=document.getElementById('damageResult');if(el)el.innerHTML=calcResultHtml(r);const list=document.getElementById('calcHistory');if(list)list.innerHTML=historyHtml();toast('計算結果を履歴に保存しました')}
function damageSwap(){calcDraft=getCalcValues();[calcDraft.atk,calcDraft.def]=[calcDraft.def,calcDraft.atk];[calcDraft.atkPoints,calcDraft.defPoints]=[calcDraft.defPoints,calcDraft.atkPoints];[calcDraft.atkNatureUp,calcDraft.defNatureUp]=[calcDraft.defNatureUp,calcDraft.atkNatureUp];[calcDraft.atkNatureDown,calcDraft.defNatureDown]=[calcDraft.defNatureDown,calcDraft.atkNatureDown];[calcDraft.atkAbility,calcDraft.defAbility]=[calcDraft.defAbility,calcDraft.atkAbility];render()}
function historyLoad(id){const h=(state.pokeHistory||[]).find(x=>x.id===id);if(!h)return;calcDraft=JSON.parse(JSON.stringify(h.settings));calcResult=h.result;render();toast('保存した計算条件と結果を表示しました')}
function historyDelete(id){if(!confirm('この計算履歴を削除しますか？'))return;state.pokeHistory=state.pokeHistory.filter(x=>x.id!==id);save();render()}
function wireExtraActions(){
  state.pokeHistory??=[];
  Object.assign(actions,{gotoGallery:()=>setPage('gallery'),gotoPokemon:()=>setPage('pokemon'),gotoDamage:()=>{if(dexCurrent)calcDraft.atk=dexCurrent.name;setPage('damage')},galleryLoad,choosePhoto,photoOpen,photoDelete,pokemonLookup,pokemonUsage,damageCalc,damageSwap,historyLoad,historyDelete});
  document.addEventListener('change',e=>{if(e.target.id==='photoSelect'){galleryUpload(e.target.files);e.target.value=''}if(e.target.id==='c_move')applyMovePreset();if(e.target.id==='c_historyMode'){calcDraft=getCalcValues();const list=document.getElementById('calcHistory');if(list)list.innerHTML=historyHtml()} });
  document.addEventListener('focusout',e=>{if(e.target.id==='c_atk'||e.target.id==='c_def'){calcDraft=getCalcValues();const list=document.getElementById('calcHistory');if(list)list.innerHTML=historyHtml()}});
  document.getElementById('photoClose').addEventListener('click',()=>{document.getElementById('photoViewer').close()});
  document.getElementById('photoViewer').addEventListener('close',()=>{if(photoViewURL)URL.revokeObjectURL(photoViewURL);photoViewURL=null;document.querySelector('#photoViewer img').removeAttribute('src')});
}

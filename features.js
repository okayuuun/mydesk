'use strict';
/* MyDesk 2.0: ゲームニュース / 敬語アシスタント / クラウド同期 */
const SYNC_CONFIG_KEY = 'mydesk-sync-v2';
const SYNC_PENDING_KEY = 'mydesk-sync-pending-v2';
let syncConfig = (()=>{try{return JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY))||{}}catch{return {}}})();
let syncFlag = 'local';
let syncBusy = false;
let syncTimer = null;
let newsItems = [];
let newsStamp = '';
let newsError = '';
let newsCategory = 'すべて';
let politeOutput = '';

function setSyncStatus(flag){
  syncFlag=flag;
  const tag=document.querySelector('.local-pill');
  if(tag) tag.textContent=({local:'◉ この端末に保存',saved:'✓ クラウド同期済み',syncing:'↻ 同期中',pending:'● 未同期の変更あり',conflict:'! 同期の競合',error:'! 接続を確認'})[flag]||'◉ この端末に保存';
}
function syncSettingsHtml(){
  const active=Boolean(syncConfig?.apiUrl&&syncConfig?.token);
  return `<section class="panel"><div class="panelhead"><h2>☁ PC・スマホのクラウド同期</h2><span class="chip">${active?'接続設定あり':'未接続'}</span></div>
  <p class="muted">Render上の自分専用APIとNeonを接続すると、複数端末でデータを共有できます。同期前にバックアップを取ってください。GitHub Pages単体では同期できません。</p>
  <div class="field"><label for="syncUrl">同期APIのURL</label><input class="input" type="url" id="syncUrl" placeholder="https://xxxxx.onrender.com" autocomplete="url" value="${esc(syncConfig.apiUrl||'')}"></div>
  <div class="field"><label for="syncPassword">同期用パスワード</label><input class="input" id="syncPassword" type="password" autocomplete="current-password" placeholder="Renderで設定した SYNC_PASSWORD"></div>
  <div class="tools"><button class="btn primary" data-act="syncConnect">ログイン・接続</button><button class="btn ghost" data-act="syncPull">クラウドと照合</button><button class="btn ghost" data-act="syncPush">この端末の内容をクラウドへ保存</button><button class="btn ghost" data-act="syncLogout">接続解除</button></div>
  <p id="syncHelp" class="muted">状態：${esc(syncFlag)}。オフラインでの変更は端末内に保存されます。同じ項目を別端末で同時に編集すると競合確認が必要です。</p>
  </section>`;
}
function markSyncDirty(){
  if(!syncConfig?.token)return;
  localStorage.setItem(SYNC_PENDING_KEY,'1');
  setSyncStatus('pending');
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>syncUpload(false),1800);
}
function cloudUrl(){
  const url=(syncConfig.apiUrl||'').replace(/\/+$/,'');
  if(!/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url))throw Error('HTTPSのAPI URLを指定してください');
  return url;
}
async function cloudRequest(path,options={}){
  const url=cloudUrl()+path;
  const headers={'Content-Type':'application/json',...(syncConfig.token?{Authorization:`Bearer ${syncConfig.token}`}:{})};
  const res=await fetch(url,{...options,headers:{...headers,...(options.headers||{})},cache:'no-store',signal:AbortSignal.timeout(14000)});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok){const err=new Error(data.error||`HTTP ${res.status}`);err.status=res.status;throw err}
  return data;
}
function localDataValid(v){return v&&Array.isArray(v.tasks)&&Array.isArray(v.favorites)&&Array.isArray(v.checks)&&Array.isArray(v.logs)&&Array.isArray(v.ideas)&&v.weekDone&&typeof v.weekDone==='object'}
function acceptCloud(data,version){
  if(!localDataValid(data))throw Error('クラウドデータの形式が正しくありません');
  state=data;
  syncConfig.version=version;
  persistSyncConfig();
  localStorage.setItem(STORE,JSON.stringify(state)); // クラウド読込は、再アップロードを開始しない
  localStorage.removeItem(SYNC_PENDING_KEY);
  setSyncStatus('saved');
  render();
}
function persistSyncConfig(){localStorage.setItem(SYNC_CONFIG_KEY,JSON.stringify(syncConfig))}
async function syncUpload(force){
  if(!syncConfig.token||syncBusy)return;
  if(!force&&!localStorage.getItem(SYNC_PENDING_KEY))return;
  syncBusy=true;setSyncStatus('syncing');
  try{
    const snapshot=JSON.stringify(state);
    const res=await cloudRequest('/api/data',{method:'PUT',body:JSON.stringify({expectedVersion:syncConfig.version||0,data:JSON.parse(snapshot)})});
    syncConfig.version=res.version;
    persistSyncConfig();
    if(JSON.stringify(state)===snapshot){localStorage.removeItem(SYNC_PENDING_KEY);setSyncStatus('saved')}
    else{localStorage.setItem(SYNC_PENDING_KEY,'1');setSyncStatus('pending');clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncUpload(false),500)}
    return true;
  }catch(e){
    setSyncStatus(e.status===409?'conflict':'error');
    if(force)toast('クラウド保存に失敗：'+e.message);
    return false;
  }finally{syncBusy=false}
}
async function syncConnect(){
  const apiUrl=document.getElementById('syncUrl')?.value.trim().replace(/\/+$/,'');
  const password=document.getElementById('syncPassword')?.value||'';
  if(!apiUrl||!password)return toast('API URLとパスワードを入力してください');
  if(syncBusy)return;
  syncBusy=true;setSyncStatus('syncing');
  try{
    syncConfig={apiUrl,version:0};cloudUrl();
    const login=await cloudRequest('/api/login',{method:'POST',body:JSON.stringify({password})});
    syncConfig.token=login.token;
    const remote=await cloudRequest('/api/data');
    syncConfig.version=remote.version;
    persistSyncConfig();
    if(remote.data){
      const useCloud=confirm('クラウドに既存のデータがあります。\nOK：クラウドの内容をこの端末に読み込む\nキャンセル：今は内容を変更しない\n\n※この端末のデータは先にバックアップすることをおすすめします。');
      if(useCloud)acceptCloud(remote.data,remote.version);
      else {localStorage.setItem(SYNC_PENDING_KEY,'1');setSyncStatus('pending')}
    }else{
      localStorage.setItem(SYNC_PENDING_KEY,'1');
      await syncUploadAfterBusy();
    }
    toast('ログインしました。同期状態を確認してください');
  }catch(e){syncConfig={};setSyncStatus('error');toast('接続できません：'+e.message)}
  finally{syncBusy=false;render()}
}
async function syncUploadAfterBusy(){ // syncConnect中の排他を保ったまま初回アップロード
  const res=await cloudRequest('/api/data',{method:'PUT',body:JSON.stringify({expectedVersion:syncConfig.version||0,data:state})});
  syncConfig.version=res.version;persistSyncConfig();localStorage.removeItem(SYNC_PENDING_KEY);setSyncStatus('saved');
}
async function syncPull(manual=true){
  if(!syncConfig.token)return manual&&toast('先にクラウドへログインしてください');
  if(syncBusy)return;
  syncBusy=true;setSyncStatus('syncing');
  try{
    const remote=await cloudRequest('/api/data');
    if(!remote.data){syncConfig.version=remote.version;persistSyncConfig();setSyncStatus('pending');if(manual)toast('クラウドにはまだデータがありません');return}
    const pending=Boolean(localStorage.getItem(SYNC_PENDING_KEY));
    if(pending){
      if(remote.version===syncConfig.version){
        syncBusy=false;
        await syncUpload(false);
        return;
      }
      setSyncStatus('conflict');
      if(manual){
        if(confirm('クラウドと端末の両方に変更があります。\nOK：端末の内容を破棄し、クラウドの内容を読み込む\nキャンセル：両方保持して、設定から手動で選ぶ'))acceptCloud(remote.data,remote.version);
      }
      return;
    }
    acceptCloud(remote.data,remote.version);
    if(manual)toast('クラウドと同期しました');
  }catch(e){setSyncStatus('error');if(manual)toast('同期に失敗：'+e.message)}
  finally{syncBusy=false}
}
async function syncPush(){
  if(!syncConfig.token)return toast('先にログインしてください');
  if(!confirm('この端末のデータでクラウドを更新します。\n他の端末での変更は失われる場合があります。\n続行する前にバックアップを取ることをおすすめします。'))return;
  try{
    const remote=await cloudRequest('/api/data');
    syncConfig.version=remote.version;persistSyncConfig();
    localStorage.setItem(SYNC_PENDING_KEY,'1');
    await syncUpload(true);
  }catch(e){setSyncStatus('error');toast('クラウドへの書込失敗：'+e.message)}
}
function syncLogout(){
  if(!confirm('この端末のクラウド接続を解除しますか？（端末内のタスクは残ります）'))return;
  clearTimeout(syncTimer);syncConfig={};
  localStorage.removeItem(SYNC_CONFIG_KEY);localStorage.removeItem(SYNC_PENDING_KEY);
  setSyncStatus('local');render();toast('接続を解除しました');
}
function initFeatures(){
  if(syncConfig?.token){
    setSyncStatus(localStorage.getItem(SYNC_PENDING_KEY)?'pending':'syncing');
    syncPull(false);
  }else setSyncStatus('local');
  refreshNews();
  window.addEventListener('online',()=>{if(syncConfig.token)syncPull(false);refreshNews()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&syncConfig.token)syncPull(false)});
}

function writerQuickCard(){
  return `<section class="panel writer-shortcut"><div class="panelhead"><h2>✉ 丁寧なメッセージを作る</h2><button class="linkbtn" data-act="gotoWriter">文章を作成 →</button></div><p class="muted">先生・店長・企業への連絡を、相手に合った言葉遣いに整えます。</p><button class="btn ghost" data-act="gotoWriter">敬語変換を開く</button></section>`;
}
function newsHomeCard(){
  const items=newsItems.slice(0,3);
  return `<section class="panel news-home"><div class="panelhead"><h2>🎮 ゲームニュース</h2><button class="linkbtn" data-act="gotoNews">ニュース一覧 →</button></div>
  ${items.length?items.map(newsCard).join(''):`<p class="muted">${esc(newsError||'ニュースを読み込み中です。公開後、更新設定が完了すると最新記事が表示されます。')}</p>`}
  <div class="tools"><button class="btn ghost" data-act="reloadNews">ニュース表示を更新</button><a class="btn ghost" href="https://news.google.com/search?q=%E3%82%B2%E3%83%BC%E3%83%A0%E6%A5%AD%E7%95%8C&hl=ja&gl=JP&ceid=JP%3Aja" target="_blank" rel="noopener noreferrer">Googleニュース ↗</a></div></section>`;
}
function newsCard(item){
  const d=item.published?new Date(item.published):null;
  const date=d&&!isNaN(+d)?`${d.getMonth()+1}/${d.getDate()}`:'日時不明';
  return `<a class="news-item" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer"><div class="news-meta"><span class="chip">${esc(item.category||'ゲーム')}</span> ${esc(item.source||'ニュース')} · ${date}</div><strong>${esc(item.title)}</strong><span class="news-open">記事を開く ↗</span></a>`;
}
function newsView(){
  const cats=['すべて','総合','任天堂','PlayStation','PC・Steam','ゲーム開発'];
  const list=newsCategory==='すべて'?newsItems:newsItems.filter(x=>x.category===newsCategory);
  return `<section class="panel"><div class="panelhead"><h2>ゲーム業界ニュース</h2><button class="btn ghost" data-act="reloadNews">↻ 表示を更新</button></div>
  <p class="muted">Googleニュースの公開RSSを取得し、定期処理で整理した記事へのリンクを表示します。「大きなニュース」は見出しのキーワードを使った目安であり、重要度の保証ではありません。</p>
  <div class="categorybar">${cats.map(cat=>`<button class="category-btn ${newsCategory===cat?'selected':''}" data-news-cat="${esc(cat)}">${esc(cat)}</button>`).join('')}</div>
  <p class="muted">${newsStamp?'最終取得：'+esc(new Date(newsStamp).toLocaleString('ja-JP')):'まだニュース更新データがありません'} ／ 全${newsItems.length}件</p>
  ${list.length?list.map(newsCard).join(''):`<div class="empty">${esc(newsError||'この分類の記事はまだありません。GitHubのActionsから「Update game news」を実行してください。')}</div>`}
  <p class="footerline"><a href="https://news.google.com/search?q=%E3%82%B2%E3%83%BC%E3%83%A0%E6%A5%AD%E7%95%8C&hl=ja&gl=JP&ceid=JP%3Aja" target="_blank" rel="noopener noreferrer">Googleニュースで探す ↗</a><br>記事の見出し・出典・日時・リンクのみ表示します。ニュースの内容はリンク先で確認してください。更新は自動処理の実行後に反映されます。</p>
  </section>`;
}
async function refreshNews(){
  try{
    const res=await fetch('./news.json?v='+Date.now(),{cache:'no-store'});
    if(!res.ok)throw Error('ニュースファイルがありません');
    const data=await res.json();
    if(!Array.isArray(data.items))throw Error('ニュースデータの形式が不正です');
    newsItems=data.items.filter(x=>x&&typeof x.title==='string'&&/^https:\/\//.test(x.url||'')).slice(0,50);
    newsStamp=data.updatedAt||'';newsError='';
  }catch(e){newsError='ニュースを読み込めませんでした。インターネット接続とGitHub Actionsの実行結果を確認してください。'}
  if(page==='news'||page==='home')render();
}

const politeRecipientLabels={teacher:'学校の先生',manager:'店長・バイト先',business:'企業・外部の方',other:'その他の目上の方'};
function writerView(){return `<div class="layout2 writer-layout"><section class="panel"><div class="panelhead"><h2>✉ 敬語・メッセージ作成</h2><span class="chip">編集前に内容を確認</span></div>
  <p class="muted">伝えたいことを普段の言葉で入力し、送る相手と目的を選択します。無料版は定型表現を整える簡易変換です。</p>
  <div class="field"><label for="writerRecipient">送る相手</label><select id="writerRecipient"><option value="teacher">学校の先生</option><option value="manager">店長・アルバイト先</option><option value="business">企業・外部の方</option><option value="other">その他の目上の方</option></select></div>
  <div class="field"><label for="writerIntent">メッセージの目的</label><select id="writerIntent"><option value="request">お願い・確認</option><option value="consult">相談</option><option value="apology">お詫び</option><option value="decline">お断り</option><option value="notice">報告・連絡</option><option value="thanks">お礼</option></select></div>
  <div class="field"><label for="writerSource">伝えたい内容</label><textarea id="writerSource" class="writer-source" rows="8" maxlength="2000" placeholder="例：土曜は学校の行事があって、バイトに30分遅れそうです。すみません。遅れても大丈夫ですか？"></textarea></div>
  <div class="tools"><button class="btn primary" data-act="writerLocal">無料で丁寧に整える</button><button class="btn ghost" data-act="writerAI">AIで自然に推敲（要設定）</button></div>
  <p class="muted">AI機能を利用する場合だけ、入力内容を設定済みAPI経由で外部のAIサービスへ送信します。API利用料が発生する可能性があります。</p></section>
  <section class="panel"><div class="panelhead"><h2>変換結果</h2></div><div id="writerResult" class="report writer-result">${esc(politeOutput||'ここにメッセージが表示されます。')}</div>
  <div class="tools" style="margin-top:15px"><button class="btn primary" data-act="writerCopy">文章をコピー</button><button class="btn ghost" data-act="writerEdit">結果を編集する</button></div>
  <p class="note">相手の氏名・敬称、日時、出欠や謝罪の程度、用件が正確か必ず確認してから送信してください。自動変換は正しさを保証するものではありません。</p>
  </section></div>`}
function makePoliteOffline(raw,recipient,intent){
  let content=raw.trim().replace(/\r\n/g,'\n');
  if(!content)return '';
  // 固有名詞、日時、数量を変えないよう、意味が大きく変わらない定型語のみを置換
  const rules=[
    [/ごめんなさい|すいません|すみません/g,'申し訳ありません'],
    [/了解しました|わかりました|分かりました/g,'承知いたしました'],
    [/教えてください/g,'教えていただけますでしょうか'],
    [/見てください/g,'ご確認いただけますでしょうか'],
    [/確認してください/g,'ご確認いただけますと幸いです'],
    [/返事ください|返信ください/g,'ご返信いただけますと幸いです'],
    [/よろしくお願いします/g,'よろしくお願いいたします'],
    [/ありがとうございます！+/g,'ありがとうございます。'],
    [/ありがとう(?=！|!|\s|$|[。\n])/g,'ありがとうございます'],
  ];
  for(const [pattern,replacement] of rules)content=content.replace(pattern,replacement);
  content=content.replace(/(^|[\n。])\s*(お疲れ様です|お疲れさまです|お世話になっております)[！!。\s]*/g,'$1').trim();
  content=content.replace(/([！!])+/g,'。').replace(/[。]{2,}/g,'。');
  // 口語体を全文無条件に機械置換しない。誤変換防止のため原文を残す場合あり。
  const intro=recipient==='manager'?'お疲れさまです。':recipient==='business'?'お世話になっております。':'お疲れさまです。';
  const endings={request:'お忙しいところ恐れ入りますが、よろしくお願いいたします。',consult:'お手数をおかけしますが、よろしくお願いいたします。',apology:'何卒よろしくお願いいたします。',decline:'恐れ入りますが、ご理解いただけますと幸いです。',notice:'よろしくお願いいたします。',thanks:'改めまして、ありがとうございます。\n今後ともよろしくお願いいたします。'};
  let ending=endings[intent]||endings.notice;
  if(content.includes('よろしくお願いいたします'))ending='';
  if(content.includes('申し訳ありません')&&intent==='apology')ending='何卒よろしくお願いいたします。';
  if(content.length>0&&!/[。！？!?]$/.test(content))content+='。';
  return `${intro}\n\n${content}${ending?'\n\n'+ending:''}`;
}
function writerValues(){return {recipient:document.getElementById('writerRecipient')?.value||'teacher',intent:document.getElementById('writerIntent')?.value||'request',raw:document.getElementById('writerSource')?.value||''}}
function writerLocal(){const v=writerValues();if(!v.raw.trim())return toast('伝えたい内容を入力してください');politeOutput=makePoliteOffline(v.raw,v.recipient,v.intent);const dst=document.getElementById('writerResult');if(dst)dst.textContent=politeOutput;toast('簡易変換しました。内容をご確認ください')}
async function writerAI(){
  const v=writerValues();if(!v.raw.trim())return toast('伝えたい内容を入力してください');
  if(!syncConfig.token)return toast('設定で同期APIに接続してください。AI APIキーはサーバーに設定します');
  if(!confirm('入力した文章をサーバー経由で外部AIに送信し、敬語へ推敲します。\n人物情報などに注意してください。実行しますか？'))return;
  const btn=document.querySelector('[data-act="writerAI"]');if(btn)btn.disabled=true;
  try{
    const res=await cloudRequest('/api/rewrite',{method:'POST',body:JSON.stringify(v)});
    politeOutput=res.text||'';document.getElementById('writerResult').textContent=politeOutput;
    toast('推敲しました。送信前に事実関係をご確認ください');
  }catch(e){toast('AI推敲を利用できません：'+e.message)}finally{if(btn)btn.disabled=false}
}
async function writerCopy(){if(!politeOutput)return toast('先に文章を作成してください');try{await navigator.clipboard.writeText(politeOutput);toast('コピーしました')}catch{toast('コピーできませんでした')}}
function writerEdit(){if(!politeOutput)return toast('先に文章を作成してください');openModal('文章を編集',formField('文章','draft','textarea',politeOutput),v=>{politeOutput=v.draft;return true})}
function wireFeatureActions(){
  Object.assign(actions,{
    gotoNews:()=>setPage('news'),gotoWriter:()=>setPage('writer'),
    reloadNews:()=>{refreshNews();toast('公開中のニュースデータを再取得します')},
    writerLocal,writerAI,writerCopy,writerEdit,
    syncConnect,syncPull:()=>syncPull(true),syncPush,syncLogout
  });
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-news-cat]');if(t){newsCategory=t.dataset.newsCat;render()}
  });
  initFeatures();
}

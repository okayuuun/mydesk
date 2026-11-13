'use strict';
const STORE='mydesk-data-v1';
const DAYS=['日','月','火','水','木','金','土'];
const nav=[['home','⌂','ホーム'],['tasks','☑','タスク'],['weekly','▦','週間'],['favorites','↗','リンク'],['more','☷','その他']];
const categories=['制作・開発','学校・連絡','デザイン','素材・音楽','学習','趣味','その他'];
const defaultChecks=[['制作','今週の制作目標を確認'],['制作','ゲームを少しでも制作する'],['制作','動作テスト・バグ確認'],['制作','作業内容を記録する'],['学習','新しく学んだことを整理'],['学習','作品や参考資料を調べる'],['学校','課題・提出期限を確認'],['学校','Teamsの連絡を確認'],['整理','制作ファイルをバックアップ'],['整理','未完了タスクを見直す'],['週報','今週の成果をまとめる'],['週報','Teamsの週報を提出する']];
function fresh(){return {taskEvents:[],tasks:[{id:uid(),title:'エフェクト・UIの調整',category:'ゲーム制作',priority:'中',status:'完了',due:'',finished:'2026-11-08',created:'2026-11-02'},{id:uid(),title:'3Dモデルの用意',category:'ゲーム制作',priority:'高',status:'未着手',due:'',finished:'',created:'2026-11-02'},{id:uid(),title:'シーン管理',category:'ゲーム制作',priority:'中',status:'未着手',due:'',finished:'',created:'2026-11-02'},{id:uid(),title:'音実装',category:'ゲーム制作',priority:'中',status:'未着手',due:'',finished:'',created:'2026-11-02'}],checks:defaultChecks.map(([cat,title])=>({id:uid(),cat,title})),weekDone:{},favorites:[{id:uid(),name:'Microsoft Teams',url:'https://teams.microsoft.com/',category:'学校・連絡',pin:true},{id:uid(),name:'GitHub',url:'https://github.com/',category:'制作・開発',pin:true},{id:uid(),name:'OneDrive',url:'https://onedrive.live.com/',category:'学校・連絡',pin:true},{id:uid(),name:'Canva',url:'https://www.canva.com/',category:'デザイン',pin:true},{id:uid(),name:'Microsoft To Do',url:'https://to-do.office.com/tasks/',category:'学校・連絡',pin:false}],logs:[{id:uid(),date:'2026-11-08',type:'対応',title:'エフェクト・UIの調整',detail:'画面演出とUIを調整した'},{id:uid(),date:'2026-11-08',type:'できなかった',title:'3Dモデルの用意',detail:''},{id:uid(),date:'2026-11-08',type:'できなかった',title:'シーン管理',detail:''},{id:uid(),date:'2026-11-08',type:'できなかった',title:'音実装',detail:''},{id:uid(),date:'2026-11-08',type:'その他',title:'ゲームフリークのCGの話が面白かった',detail:''}],ideas:[]};}
function uid(){return 'id'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function load(){try{const v=JSON.parse(localStorage.getItem(STORE));return v&&Array.isArray(v.tasks)&&Array.isArray(v.favorites)?v:fresh()}catch{return fresh()}}
let state=load(),page='home',filter='',weeklyShift=0,reportShift=0;
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));markSyncDirty()}catch{toast('保存できませんでした。ブラウザの空き容量をご確認ください。')}}
if(!localStorage.getItem(STORE))save();
function esc(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function pad(n){return String(n).padStart(2,'0')}
function offsetDay(iso,days){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function monday(iso=todayISO()){const d=new Date(iso+'T12:00:00');return offsetDay(iso,-(d.getDay()+6)%7)}
function weekId(shift=0){return offsetDay(monday(),shift*7)}
function dateLabel(iso){if(!iso)return '期限なし';const d=new Date(iso+'T12:00:00');return `${d.getMonth()+1}/${d.getDate()}`}
function weekLabel(start){return `${dateLabel(start)} 〜 ${dateLabel(offsetDay(start,6))}`}
// Weekly report activity history. Kept inside the existing state object for cloud sync and backups.
function taskEvents(){return Array.isArray(state.taskEvents)?state.taskEvents:(state.taskEvents=[])}
function recordTaskEvent(task,type,date=todayISO()){
  taskEvents().push({id:uid(),taskId:task.id,date,type,title:task.title,category:task.category||'その他',status:task.status,stamp:new Date().toISOString()});
}
function preserveTaskHistory(task){
  const entries=taskEvents();
  if(task.created&&!entries.some(e=>e.taskId===task.id&&e.type==='created'))recordTaskEvent(task,'created',task.created);
  if(task.finished&&!entries.some(e=>e.taskId===task.id&&e.type==='completed'))recordTaskEvent(task,'completed',task.finished);
}
function setTaskStatus(task,nextStatus){
  if(task.status===nextStatus)return;
  preserveTaskHistory(task);
  const previous=task.status;
  task.status=nextStatus;
  if(nextStatus==='完了'){task.finished=todayISO();recordTaskEvent(task,'completed')}
  else{task.finished='';recordTaskEvent(task,previous==='完了'?'reopened':'status')}
}
function taskActivityForWeek(start,end){
  const entries=Array.isArray(state.taskEvents)?state.taskEvents.slice():[];
  // Older data saved before this feature had only created/finished dates.
  for(const task of state.tasks){
    if(task.created&&!entries.some(e=>e.taskId===task.id&&e.type==='created'))entries.push({taskId:task.id,date:task.created,type:'created',title:task.title,category:task.category,stamp:task.created+'T00:00:00'});
    if(task.finished&&!entries.some(e=>e.taskId===task.id&&e.type==='completed'))entries.push({taskId:task.id,date:task.finished,type:'completed',title:task.title,category:task.category,stamp:task.finished+'T00:00:00'});
  }
  const ordered=entries.filter(e=>typeof e.date==='string'&&e.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||(a.stamp||'').localeCompare(b.stamp||''));
  const added=ordered.filter(e=>e.type==='created'&&e.date>=start);
  const lastCompletion=new Map();
  for(const e of ordered){
    if(e.type==='completed')lastCompletion.set(e.taskId,e);
    if(e.type==='reopened')lastCompletion.delete(e.taskId);
  }
  const completed=[...lastCompletion.values()].filter(e=>e.date>=start);
  return {added,completed};
}
const doneCount=()=>state.tasks.filter(t=>t.status==='完了').length;
const rate=()=>state.tasks.length?Math.round(doneCount()/state.tasks.length*100):0;
function setPage(p){page=p;filter='';render();window.scrollTo(0,0);if(p==='gallery')galleryLoad()}
function toast(text){let t=document.getElementById('toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
function button(text,fn,cls='btn primary'){return `<button class="${cls}" data-act="${fn}">${text}</button>`}
function titlebar(text,act,actLabel){return `<div class="panelhead"><h2>${text}</h2>${act?`<button class="linkbtn" data-act="${act}">${actLabel||'すべて見る'} →</button>`:''}</div>`}
function taskRow(t){return `<div class="taskrow"><input type="checkbox" class="tick" data-checktask="${t.id}" ${t.status==='完了'?'checked':''} aria-label="${esc(t.title)}を完了にする"><div><strong class="${t.status==='完了'?'done':''}">${esc(t.title)}</strong><small>${esc(t.category||'その他')} · ${esc(t.status)} · ${t.due?'期限 '+dateLabel(t.due):'期限なし'}</small></div><span class="chip ${t.priority==='高'?'high':t.priority==='中'?'medium':'low'}">${esc(t.priority)}</span><div class="actions"><button class="tiny" data-act="editTask" data-id="${t.id}">編集</button><button class="tiny danger" data-act="deleteTask" data-id="${t.id}">削除</button></div></div>`}
function favLink(f){return `<a class="favtile" target="_blank" rel="noopener noreferrer" href="${esc(f.url)}"><span class="favicon">${esc(f.name.slice(0,1))}</span><span>${esc(f.name)}<small>${esc(f.category)}</small></span></a>`}
function home(){let open=state.tasks.filter(t=>t.status!=='完了');const wk=weekId(),n=state.checks.filter(c=>state.weekDone[wk]?.[c.id]).length,pinned=state.favorites.filter(f=>f.pin);return `<section class="welcome"><div><span class="welcome-day">YOUR DAILY WORKSPACE</span><h2>今日も、少しずつ進めよう。 ✳</h2><p>制作も、学校も、やることをひとつに。</p></div><button class="btn primary" data-act="newTask">＋ タスク追加</button></section><div class="stats"><div class="stat"><span class="label">タスク進捗</span><strong>${rate()}%</strong><small>${doneCount()} / ${state.tasks.length} 件完了</small></div><div class="stat"><span class="label">未完了</span><strong>${open.length}<small> 件</small></strong><small>あと少しずつ</small></div><div class="stat"><span class="label">今週のチェック</span><strong>${n}<small> / ${state.checks.length}</small></strong><small>${state.checks.length?Math.round(n/state.checks.length*100):0}% 達成</small></div></div>${newsHomeCard()}${writerQuickCard()}<div class="quick-feature-row"><button class="btn ghost" data-act="gotoGallery">▧ 画像を共有</button><button class="btn ghost" data-act="gotoPokemon">◉ ポケモン検索</button><button class="btn ghost" data-act="gotoDamage">⌗ ダメージ計算</button></div><div class="layout2"><div><section class="panel">${titlebar('今やること','gotoTasks')}<div class="progress"><div style="width:${rate()}%"></div></div>${open.slice(0,5).map(taskRow).join('')||'<div class="empty">すべて完了！ 新しいタスクを追加できます。</div>'}</section><section class="panel">${titlebar('クイックアクセス','gotoFav','リンクを管理')}<div class="mini-grid">${pinned.slice(0,6).map(favLink).join('')||'<p class="muted">お気に入りを固定するとここに表示されます。</p>'}</div></section></div><div><section class="panel">${titlebar('今週のチェック','gotoWeekly')}<p class="muted">${weekLabel(wk)} · ${n}/${state.checks.length} 完了</p><div class="progress"><div style="width:${state.checks.length?n/state.checks.length*100:0}%"></div></div>${state.checks.slice(0,6).map(c=>checkRow(c,wk)).join('')}</section><section class="panel">${titlebar('今日のひらめき','gotoIdeas','アイデアBOXへ')}<p class="muted">制作中のアイデアや、気になったことをメモ。</p>${button('＋ アイデアをメモ','newIdea','btn ghost')}</section></div></div>`}
function tasks(){let list=state.tasks.filter(t=>!filter||t.title.toLowerCase().includes(filter)||t.category.toLowerCase().includes(filter));return `<div class="section-tools"><input id="searchTasks" class="input search grow" placeholder="タスクを検索…" value="${esc(filter)}">${button('＋ 新しいタスク','newTask')}${button('Teams週報を確認','gotoLogs','btn ghost')}</div><div class="stats"><div class="stat"><span class="label">全タスク</span><strong>${state.tasks.length}</strong></div><div class="stat"><span class="label">完了</span><strong>${doneCount()}</strong></div><div class="stat"><span class="label">進捗率</span><strong>${rate()}%</strong></div></div><section class="panel">${titlebar('タスク一覧')}<div class="progress"><div style="width:${rate()}%"></div></div><div id="taskList">${list.map(taskRow).join('')||'<p class="empty">タスクがありません。</p>'}</div></section>`}
function checkRow(c,w){return `<label class="checkrow"><input type="checkbox" class="tick" data-checkweek="${c.id}" ${state.weekDone[w]?.[c.id]?'checked':''}><div><strong class="${state.weekDone[w]?.[c.id]?'done':''}">${esc(c.title)}</strong><small>${esc(c.cat)}</small></div>${page==='weekly'?`<button class="tiny danger" type="button" data-act="removeCheck" data-id="${c.id}">削除</button>`:''}</label>`}
function weekly(){const w=weekId(weeklyShift),n=state.checks.filter(c=>state.weekDone[w]?.[c.id]).length,group=[...new Set(state.checks.map(c=>c.cat))];return `<div class="section-tools">${button('＋ チェック項目','newCheck')}<button class="btn ghost" data-act="resetWeek">この週を未完了に戻す</button></div><section class="panel"><div class="weeknav"><button data-act="prevWeek">←</button><strong>${weekLabel(w)}</strong><button data-act="nextWeek">→</button><button data-act="currentWeek">今週</button></div><div class="panelhead"><h2>今週の習慣・定期タスク</h2><span class="daytag">${n} / ${state.checks.length} 完了</span></div><div class="progress"><div style="width:${state.checks.length?100*n/state.checks.length:0}%"></div></div>${group.map(g=>`<div class="checkgroup"><h3>${esc(g)}</h3>${state.checks.filter(c=>c.cat===g).map(c=>checkRow(c,w)).join('')}</div>`).join('')||'<div class="empty">チェック項目を追加してみましょう。</div>'}</section><p class="muted">週の記録は毎週月曜日で区切られ、前週のチェック状態は引き継がれません。過去の記録は残ります。</p>`}
function favorites(){const fs=state.favorites.filter(f=>!filter||f.name.toLowerCase().includes(filter)||f.category.toLowerCase().includes(filter));return `<div class="section-tools"><input id="searchFav" class="input search grow" placeholder="サイト名・カテゴリで検索" value="${esc(filter)}">${button('＋ サイトを登録','newFav')}</div><section class="panel">${titlebar('固定したサイト')}<div class="mini-grid">${fs.filter(f=>f.pin).map(favLink).join('')||'<div class="empty">サイトの編集画面で「ホームに固定」を選んでください。</div>'}</div></section><section class="panel">${titlebar('サイト一覧')}<div id="favoriteList">${fs.map(f=>`<div class="favorow"><span class="favicon">${esc(f.name.slice(0,1))}</span><div><strong>${esc(f.name)} ${f.pin?'★':''}</strong><small>${esc(f.category)} · ${esc(f.url)}</small></div><div class="actions"><a class="tiny" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">開く ↗</a><button class="tiny" data-act="editFav" data-id="${f.id}">編集</button><button class="tiny danger" data-act="deleteFav" data-id="${f.id}">削除</button></div></div>`).join('')||'<p class="empty">サイトがありません。</p>'}</div></section>`}
function reportText(w){
  const end=offsetDay(w,6);
  const logs=state.logs.filter(l=>l.date>=w&&l.date<=end);
  const done=state.tasks.filter(t=>t.status==='完了').length;
  const all=state.tasks.length;
  const activity=taskActivityForWeek(w,end);
  const group=kind=>logs.filter(l=>l.type===kind).map(l=>'・'+l.title+(l.detail?'：'+l.detail:'')).join('\n')||'・特になし';
  const taskList=entries=>entries.length?entries.map(e=>'・'+e.title+(e.category?'（'+e.category+'）':'')).join('\n'):'・なし';
  const n=state.checks.filter(c=>state.weekDone[w]?.[c.id]).length;
  return [
    '進捗報告（'+w.replaceAll('-','/')+'〜'+end.replaceAll('-','/')+'）',
    '',
    '■現在の全体進捗',
    '・完了タスク：'+done+' / '+all,
    '・進捗率：'+(all?Math.round(done/all*100):0)+'%',
    '・週間チェック：'+n+' / '+state.checks.length,
    '',
    '■今週追加したタスク（'+activity.added.length+'件）',
    taskList(activity.added),
    '',
    '■今週完了したタスク（'+activity.completed.length+'件）',
    taskList(activity.completed),
    '',
    '■今週対応した内容（作業ログ）',
    group('対応'),
    '',
    '■今週できなかったこと',
    group('できなかった'),
    '',
    '■その他',
    group('その他')
  ].join('\n');
}
function logs(){const w=weekId(reportShift),rows=state.logs.filter(l=>l.date>=w&&l.date<=offsetDay(w,6)).sort((a,b)=>b.date.localeCompare(a.date));return `<div class="section-tools">${button('＋ 作業ログを追加','newLog')}</div><div class="layout2"><section class="panel"><div class="weeknav"><button data-act="prevReport">←</button><strong>${weekLabel(w)}</strong><button data-act="nextReport">→</button><button data-act="currentReport">今週</button></div>${titlebar('Teams投稿用の週報')}<div class="report" id="reportText">${esc(reportText(w))}</div><div class="tools" style="margin-top:14px">${button('週報をコピー','copyReport')}<button class="btn ghost" data-act="openTeams">Teamsを開く ↗</button></div><p class="muted">タスクの追加・完了は自動反映されます。詳しい作業内容は右側の作業ログに入力してください。週報をコピーしてTeamsに貼り付けます（自動投稿ではありません）。</p></section><section class="panel">${titlebar('今週の作業ログ')}${rows.map(l=>`<div class="idea-row"><div class="grow"><strong>${esc(l.title)}</strong><p>${esc(l.date)} · ${esc(l.type)}${l.detail?'\n'+esc(l.detail):''}</p></div><button class="tiny danger" data-act="deleteLog" data-id="${l.id}">削除</button></div>`).join('')||'<p class="empty">今週のログはまだありません。</p>'}</section></div>`}
function ideas(){return `<div class="section-tools">${button('＋ アイデアをメモ','newIdea')}</div><section class="panel">${titlebar('アイデアBOX')}${state.ideas.slice().reverse().map(i=>`<div class="idea-row"><div class="grow"><strong>${esc(i.title)}</strong><p>${esc(i.date)} · ${esc(i.category)}\n${esc(i.detail)}</p></div><button class="tiny danger" data-act="deleteIdea" data-id="${i.id}">削除</button></div>`).join('')||'<p class="empty">思いついたことをすぐ残しておきましょう。</p>'}</section>`}
const apps=[['💬','Microsoft Teams','学校連絡・週報投稿','https://teams.microsoft.com/'],['☁️','OneDrive','ファイル管理・共有','https://onedrive.live.com/'],['✓','Microsoft To Do','リマインダー・予定','https://to-do.office.com/tasks/'],['⌘','GitHub','ソースコード管理','https://github.com/'],['✎','Canva','簡単なデザイン制作','https://www.canva.com/'],['🎨','Figma','UIデザイン・共有','https://www.figma.com/'],['▶','YouTube','学習・作品紹介','https://www.youtube.com/'],['🎮','itch.io','インディーゲーム','https://itch.io/'],['▧','Google Fonts','フォントを探す','https://fonts.google.com/']];
function appDirectory(){return `<section class="panel">${titlebar('おすすめのアプリ・サービス')}<div class="app-grid">${apps.map(a=>`<a class="app-link" href="${a[3]}" target="_blank" rel="noopener noreferrer"><span class="emoji">${a[0]}</span><b>${esc(a[1])} ↗</b><small>${esc(a[2])}</small></a>`).join('')}</div><p class="footerline">各サービスの利用条件・無料枠は公式サイトで確認してください。</p></section>`}
function settings(){return `${syncSettingsHtml()}<section class="panel">${titlebar('データの保存・移行')}<p class="muted">接続前はブラウザ内保存です。サーバーへのログイン・Neon接続を完了するとクラウド同期を使用できます。設定後も定期的にバックアップしてください。</p><div class="tools"><button class="btn primary" data-act="export">バックアップを書き出す</button><button class="btn ghost" data-act="import">バックアップを読み込む</button><input type="file" id="importFile" accept="application/json,.json" hidden></div></section><section class="panel">${titlebar('ホーム画面への追加')}<p>iPhone：Safariで公開URLを開き、共有メニューから「ホーム画面に追加」を選択。</p><p>Android：Chromeで公開URLを開き、メニューから「アプリをインストール」または「ホーム画面に追加」を選択。</p><p class="muted">この機能はHTTPSのサイトで動作します。ZIP内のHTMLファイルを直接開くだけではPWAとしてインストールできません。</p></section><section class="panel">${titlebar('ご注意')}<div class="note">端末のブラウザデータを消去すると保存内容が失われる可能性があります。クラウド同期には別途Render・Neonの設定が必要です。プッシュ通知、Teams自動投稿は未実装です。AI推敲には別途APIキーと利用料が必要です。</div></section>`}
function more(){return `<div class="mini-grid" style="margin-bottom:20px"><button class="btn ghost" data-act="gotoLogs">✎ Teams週報・作業ログ</button><button class="btn ghost" data-act="gotoIdeas">✧ アイデアBOX</button><button class="btn ghost" data-act="gotoApps">▦ 便利アプリ集</button><button class="btn ghost" data-act="gotoSettings">⚙ 設定・バックアップ</button><button class="btn ghost" data-act="gotoNews">🎮 ゲームニュース</button><button class="btn ghost" data-act="gotoWriter">✉ 敬語変換</button><button class="btn ghost" data-act="gotoGallery">▧ 画像共有</button><button class="btn ghost" data-act="gotoPokemon">◉ ポケモン図鑑</button><button class="btn ghost" data-act="gotoDamage">⌗ ダメージ計算・履歴</button></div><section class="panel">${titlebar('今週の週報プレビュー')}<div class="report">${esc(reportText(weekId()).slice(0,450))}</div><div class="tools" style="margin-top:15px">${button('週報の編集へ','gotoLogs')}</div></section>`}
const views={home,tasks,weekly,favorites,news:newsView,writer:writerView,logs,ideas,apps:appDirectory,settings,more,gallery:galleryView,pokemon:pokemonView,damage:damageView};const labels={gallery:'画像共有',pokemon:'ポケモン検索',damage:'ダメージ計算・履歴',home:'ホーム',tasks:'タスク管理',weekly:'週間チェック',favorites:'お気に入りサイト',news:'ゲームニュース',writer:'敬語・文章作成',logs:'週報・作業ログ',ideas:'アイデアBOX',apps:'便利アプリ集',settings:'設定',more:'その他'};
function render(){let d=new Date();document.getElementById('today').textContent=`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${DAYS[d.getDay()]}）`;document.getElementById('pageTitle').textContent=labels[page];document.getElementById('sidenav').innerHTML=nav.slice(0,4).concat([['news','◈','ゲームニュース'],['writer','✉','敬語変換'],['gallery','▧','画像共有'],['pokemon','◉','ポケモン検索'],['damage','⌗','ダメージ計算'],['logs','▤','週報'],['ideas','✧','アイデア'],['apps','▦','便利アプリ'],['settings','⚙','設定']]).map(x=>`<button class="navitem ${page===x[0]?'active':''}" data-page="${x[0]}"><span class="ni">${x[1]}</span>${x[2]}</button>`).join('');document.getElementById('bottomnav').innerHTML=nav.map(x=>`<button class="${page===x[0]||x[0]==='more'&&['more','news','writer','gallery','pokemon','damage','logs','ideas','apps','settings'].includes(page)?'active':''}" data-page="${x[0]}"><span class="ico">${x[1]}</span>${x[2]}</button>`).join('');document.getElementById('content').innerHTML=views[page]();}
function formField(label,name,type='text',value='',extra=''){return `<div class="field"><label for="f_${name}">${label}</label>${type==='textarea'?`<textarea id="f_${name}" name="${name}" ${extra}>${esc(value)}</textarea>`:type==='select'?`<select id="f_${name}" name="${name}">${extra.split('|').map(v=>`<option ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select>`:`<input class="input" id="f_${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`}</div>`}
let submitModal=null;
function openModal(title,html,action){document.getElementById('modalTitle').textContent=title;document.getElementById('modalFields').innerHTML=html;submitModal=action;document.getElementById('modal').showModal();}
function values(){return Object.fromEntries(new FormData(document.getElementById('modalForm')))}
function taskModal(id){
  const task=state.tasks.find(t=>t.id===id)||{title:'',category:'ゲーム制作',priority:'中',status:'未着手',due:''};
  const fields=formField('タスク名','title','text',task.title,'required maxlength="160"')+formField('カテゴリ','category','text',task.category)+`<div class="fieldrow">${formField('優先度','priority','select',task.priority,'高|中|低')}${formField('状態','status','select',task.status,'未着手|進行中|確認待ち|保留|完了')}</div>`+formField('期限','due','date',task.due);
  openModal(id?'タスクを編集':'タスクを追加',fields,v=>{
    if(!v.title.trim())return toast('タスク名を入力してください');
    if(id){
      preserveTaskHistory(task);
      const oldStatus=task.status;
      Object.assign(task,{...v,status:oldStatus});
      setTaskStatus(task,v.status);
    }else{
      const added={...v,id:uid(),finished:v.status==='完了'?todayISO():'',created:todayISO()};
      state.tasks.push(added);
      recordTaskEvent(added,'created');
      if(added.status==='完了')recordTaskEvent(added,'completed');
    }
    return true;
  });
}
function favModal(id){let f=state.favorites.find(f=>f.id===id)||{name:'',url:'',category:'制作・開発',pin:false};openModal(id?'サイトを編集':'サイトを登録',formField('サイト名','name','text',f.name,'required maxlength="100"')+formField('URL（https://〜）','url','url',f.url,'required')+formField('カテゴリ','category','select',f.category,categories.join('|'))+`<label class="field"><input type="checkbox" name="pin" ${f.pin?'checked':''}> ホームに固定する</label>`,v=>{if(!v.name.trim())return toast('サイト名を入力してください');let url=v.url.trim();if(!/^https?:\/\//i.test(url))return toast('http:// または https:// から始まるURLを入力してください');try{let parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw 0}catch{return toast('有効なURLを入力してください')}v.url=url;v.pin=v.pin==='on';if(id)Object.assign(f,v);else state.favorites.push({...v,id:uid()});return true})}
function checkModal(){openModal('毎週のチェック項目を追加',formField('チェック項目','title','text','','required maxlength="140"')+formField('分類','cat','select','制作','制作|学校|学習|整理|週報|生活|その他'),v=>{if(!v.title.trim())return toast('項目名を入力してください');state.checks.push({...v,id:uid()});return true})}
function logModal(){openModal('作業ログを追加',formField('日付','date','date',todayISO())+formField('週報の分類','type','select','対応','対応|できなかった|その他')+formField('内容・タスク名','title','text','','required maxlength="160"')+formField('補足','detail','textarea',''),v=>{if(!v.title.trim()||!v.date)return toast('日付と内容を入力してください');state.logs.push({...v,id:uid()});return true})}
function ideaModal(){openModal('アイデアをメモ',formField('タイトル','title','text','','required maxlength="160"')+formField('分類','category','select','ゲーム企画','ゲーム企画|改善案|バグ|デザイン|学習|その他')+formField('メモ','detail','textarea',''),v=>{if(!v.title.trim())return toast('タイトルを入力してください');state.ideas.push({...v,date:todayISO(),id:uid()});return true})}
function removeFrom(arr,id){let i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1)}
const actions={newTask:()=>taskModal(),editTask:id=>taskModal(id),deleteTask:id=>{if(confirm('このタスクを削除しますか？')){const t=state.tasks.find(x=>x.id===id);if(t)preserveTaskHistory(t);removeFrom(state.tasks,id);save();render()}},newFav:()=>favModal(),editFav:id=>favModal(id),deleteFav:id=>{if(confirm('このサイトを削除しますか？')){removeFrom(state.favorites,id);save();render()}},newCheck:checkModal,removeCheck:id=>{if(confirm('このチェック項目を削除しますか？')){removeFrom(state.checks,id);for(const done of Object.values(state.weekDone))delete done[id];save();render()}},newLog:logModal,deleteLog:id=>{if(confirm('この作業ログを削除しますか？')){removeFrom(state.logs,id);save();render()}},newIdea:ideaModal,deleteIdea:id=>{if(confirm('このメモを削除しますか？')){removeFrom(state.ideas,id);save();render()}},prevWeek:()=>{weeklyShift--;render()},nextWeek:()=>{weeklyShift++;render()},currentWeek:()=>{weeklyShift=0;render()},prevReport:()=>{reportShift--;render()},nextReport:()=>{reportShift++;render()},currentReport:()=>{reportShift=0;render()},resetWeek:()=>{if(confirm('表示中の週のチェックをすべて未完了に戻しますか？')){state.weekDone[weekId(weeklyShift)]={};save();render()}},copyReport:async()=>{const v=reportText(weekId(reportShift));try{await navigator.clipboard.writeText(v);toast('週報をコピーしました')}catch{const el=document.createElement('textarea');el.value=v;document.body.append(el);el.select();let ok=document.execCommand('copy');el.remove();toast(ok?'週報をコピーしました':'コピーできませんでした')}},openTeams:()=>window.open('https://teams.microsoft.com/','_blank','noopener'),export:()=>{const a=document.createElement('a'),blob=new Blob([JSON.stringify({app:'MyDesk',version:1,exportedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download=`mydesk-backup-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('バックアップを書き出しました')},import:()=>document.getElementById('importFile').click()};
for(const [from,to] of Object.entries({gotoTasks:'tasks',gotoWeekly:'weekly',gotoFav:'favorites',gotoLogs:'logs',gotoIdeas:'ideas',gotoApps:'apps',gotoSettings:'settings',gotoNews:'news',gotoWriter:'writer',gotoGallery:'gallery',gotoPokemon:'pokemon',gotoDamage:'damage'})){actions[from]=()=>setPage(to)}
document.addEventListener('click',e=>{const node=e.target.closest('[data-page],[data-act]');if(!node)return;const pg=node.dataset.page;if(pg){setPage(pg);return}const act=node.dataset.act;if(actions[act]){e.preventDefault();actions[act](node.dataset.id)}});
document.addEventListener('change',async e=>{if(e.target.matches('[data-checktask]')){const t=state.tasks.find(x=>x.id===e.target.dataset.checktask);if(t){setTaskStatus(t,e.target.checked?'完了':'未着手');save();render()}}else if(e.target.matches('[data-checkweek]')){const w=weekId(weeklyShift),id=e.target.dataset.checkweek;state.weekDone[w]??={};state.weekDone[w][id]=e.target.checked;save();render()}else if(e.target.id==='importFile'){const file=e.target.files[0];if(!file)return;try{if(file.size>5_000_000)throw Error('ファイルが大きすぎます');const obj=JSON.parse(await file.text());const data=obj.data;if(obj.app!=='MyDesk'||!data||!Array.isArray(data.tasks)||!Array.isArray(data.favorites)||!Array.isArray(data.checks)||!Array.isArray(data.logs)||!Array.isArray(data.ideas)||!data.weekDone||typeof data.weekDone!=='object')throw Error('MyDeskのバックアップファイルではありません');if(!confirm('現在のすべてのデータをバックアップの内容で置き換えますか？'))return;state=data;save();render();toast('読み込みが完了しました')}catch(err){toast('読み込み失敗：'+err.message)}e.target.value=''}});
document.addEventListener('input',e=>{if(e.target.id==='searchTasks'||e.target.id==='searchFav'){filter=e.target.value.toLowerCase();const sel=e.target.selectionStart;render();const input=document.getElementById(e.target.id);input.focus();input.setSelectionRange(sel,sel)}});
document.getElementById('quickAdd').onclick=()=>taskModal();
document.getElementById('modalSave').onclick=()=>{const form=document.getElementById('modalForm');if(!form.reportValidity())return;const result=submitModal?.(values());if(result===true){save();document.getElementById('modal').close();render();toast('保存しました')}};
document.getElementById('modalForm').addEventListener('submit',e=>{e.preventDefault();document.getElementById('modalSave').click()});
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
wireFeatureActions();
wireExtraActions();

/* MyDesk: safe task-only import. Existing tasks and settings are preserved. */
async function importTaskBatch(file) {
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('1MBを超えるファイルには対応していません');
    const payload = JSON.parse(await file.text());
    if (payload.app !== 'MyDeskTaskImport' || payload.version !== 1 || !Array.isArray(payload.tasks)) {
      throw new Error('MyDeskタスク追加用JSONを選択してください');
    }
    if (!payload.tasks.length || payload.tasks.length > 500) {
      throw new Error('一度に登録できるのは1～500件です');
    }
    const groupName = String(payload.group?.name || '').trim().slice(0, 80);
    if (!groupName) throw new Error('まとまり名がありません');
    const group = taskGroups().find(g => g.name.trim().toLowerCase() === groupName.toLowerCase());
    const normalizedTitle = title => String(title || '').trim().toLowerCase();
    const knownKeys = new Set(state.tasks.map(t => String(t.importKey || '')));
    const knownTitles = new Set(state.tasks
      .filter(t => group ? t.groupId === group.id : !knownTaskGroupId(t))
      .map(t => normalizedTitle(t.title)));
    const pending = [];
    const seen = new Set();
    for (const src of payload.tasks) {
      if (!src || typeof src !== 'object') throw new Error('不正なタスクデータです');
      const title = String(src.title || '').trim();
      if (!title || title.length > 160) throw new Error('タスク名が不正です');
      const sourceId = String(src.sourceId || title).trim().slice(0, 120);
      const importKey = 'syncblocks-1231:' + sourceId;
      const titleKey = normalizedTitle(title);
      const due = String(src.due || '');
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('期限の形式が不正です: ' + title);
      if (knownKeys.has(importKey) || knownTitles.has(titleKey) || seen.has(importKey) || seen.has(titleKey)) continue;
      const status = ['未着手','進行中','確認待ち','保留','完了'].includes(src.status) ? src.status : '未着手';
      const priority = ['高','中','低'].includes(src.priority) ? src.priority : '中';
      const category = String(src.category || 'ゲーム制作').trim().slice(0,80) || 'ゲーム制作';
      const notes = [
        src.phase ? 'フェーズ：' + src.phase : '',
        src.criteria ? '完了条件：' + src.criteria : '',
        src.relatedFiles ? '対応ファイル：' + src.relatedFiles : ''
      ].filter(Boolean).join('\n').slice(0, 2000);
      pending.push({title,sourceId,importKey,due,status,priority,category,notes});
      seen.add(importKey);
      seen.add(titleKey);
    }
    if (!pending.length) {
      toast('追加対象はありません（登録済みのタスクは保持されています）');
      return;
    }
    const existingCount = payload.tasks.length - pending.length;
    if (!confirm('「' + groupName + '」に' + pending.length + '件のタスクを追加しますか？\n登録済み・重複：' + existingCount + '件\n既存のタスクや設定は削除・上書きしません。')) return;
    if (!Array.isArray(state.taskGroups)) state.taskGroups = [];
    let groupId = group?.id;
    if (!groupId) {
      groupId = uid();
      state.taskGroups.push({
        id: groupId,
        name: groupName,
        description: String(payload.group?.description || '').slice(0, 300)
      });
    }
    for (const src of pending) {
      const task = {
        id: uid(), title: src.title, groupId, category: src.category,
        priority: src.priority, status: src.status, due: src.due,
        notes: src.notes, importKey: src.importKey,
        created: todayISO(), finished: src.status === '完了' ? todayISO() : ''
      };
      state.tasks.push(task);
      recordTaskEvent(task, 'created');
      if (task.status === '完了') recordTaskEvent(task, 'completed');
    }
    taskGroupFilter = groupId;
    save();
    setPage('tasks');
    toast(pending.length + '件を「' + groupName + '」に追加しました');
  } catch (err) {
    toast('タスク追加に失敗：' + err.message);
  }
}

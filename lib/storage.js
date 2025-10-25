// lib/storage.js
// 说明：封装基于 chrome.storage.local 的备忘录存取逻辑，并做最小结构校验与错误冒泡
// 注意：本模块不持有 UI 状态；排序规则为未完成在前、完成在后，同组内按 updatedAt 倒序返回

const NOTES_KEY = 'notes'; // 存储键名，所有笔记以数组形式存放于此

// 工具：获取可用的 chrome.storage.local；在非扩展环境下抛错，供上层显示提示
function getChromeLocal() {
  const c = globalThis.chrome;
  if (!c || !c.storage || !c.storage.local) {
    throw new Error('storage API 不可用：请在扩展环境中使用，或为测试注入 mock 的 chrome.storage.local');
  }
  return c.storage.local;
}

// 工具：Promise 化 get/set/remove，兼容 callback 形式与 runtime.lastError
function getAsync(keys) {
  const local = getChromeLocal();
  return new Promise((resolve, reject) => {
    try {
      local.get(keys, (res) => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) return reject(new Error(err.message || 'storage.get 失败'));
        resolve(res);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function setAsync(items) {
  const local = getChromeLocal();
  return new Promise((resolve, reject) => {
    try {
      local.set(items, () => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) return reject(new Error(err.message || 'storage.set 失败'));
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

function removeAsync(keys) {
  const local = getChromeLocal();
  return new Promise((resolve, reject) => {
    try {
      local.remove(keys, () => {
        const err = globalThis.chrome?.runtime?.lastError;
        if (err) return reject(new Error(err.message || 'storage.remove 失败'));
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

// 校验：判断对象是否为合法 Note 结构（done 字段允许缺省）
function isValidNote(o) {
  return (
    o &&
    typeof o.id === 'string' &&
    typeof o.content === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number' &&
    (typeof o.done === 'undefined' || typeof o.done === 'boolean')
  );
}

// 校验：断言 Note 数组
function assertNotesArray(arr, scene) {
  if (!Array.isArray(arr)) {
    throw new Error(`${scene || '校验'}失败：存储数据不是数组`);
  }
  const allValid = arr.every(isValidNote);
  if (!allValid) {
    throw new Error(`${scene || '校验'}失败：存在不合法的 Note 结构`);
  }
}

// 归一化：确保 Note 拥有布尔 done 字段
function normalizeNote(note) {
  if (!isValidNote(note)) {
    throw new Error('校验失败：Note 结构不合法');
  }
  return { ...note, done: !!note.done };
}

// 排序：未完成在前，完成在后，同组按更新时间倒序
function sortNotes(list) {
  return [...list].sort((a, b) => {
    const doneDiff = Number(a.done) - Number(b.done);
    if (doneDiff !== 0) return doneDiff;
    return b.updatedAt - a.updatedAt;
  });
}

// 落盘：写入前统一归一化与排序
async function saveNotes(list) {
  const normalized = list.map(normalizeNote);
  await setAsync({ [NOTES_KEY]: sortNotes(normalized) });
}

// 导出：读取全部笔记，按新排序规则返回
export async function getNotes() {
  const res = await getAsync({ [NOTES_KEY]: [] });
  const list = res[NOTES_KEY] ?? [];
  assertNotesArray(list, '读取');
  const normalized = list.map(normalizeNote);
  return sortNotes(normalized);
}

// 导出：整体写入全部笔记（批量覆盖）
export async function setNotes(notes) {
  assertNotesArray(notes, '写入');
  await saveNotes(notes);
}

// 导出：新增一条笔记，要求调用方提供完整结构
export async function addNote(note) {
  if (typeof note !== 'object' || note === null) {
    throw new Error('新增失败：Note 结构不合法');
  }
  if (!note.content || !note.content.trim()) {
    throw new Error('新增失败：内容不能为空');
  }
  const normalizedNote = normalizeNote({
    ...note,
    done: note.done ?? false
  });
  const list = await getNotes();
  if (list.some((n) => n.id === normalizedNote.id)) {
    throw new Error('新增失败：ID 已存在');
  }
  const next = [...list, normalizedNote];
  await saveNotes(next);
  return normalizedNote;
}

// 导出：按 id 更新内容并刷新 updatedAt，返回更新后的 Note
export async function updateNote(id, content) {
  if (typeof id !== 'string' || !id) {
    throw new Error('更新失败：id 非法');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('更新失败：内容不能为空');
  }
  const list = await getNotes();
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) {
    throw new Error('更新失败：未找到对应笔记');
  }
  const now = Date.now();
  const updated = normalizeNote({
    ...list[idx],
    content,
    updatedAt: now
  });
  const merged = [...list];
  merged[idx] = updated;
  await saveNotes(merged);
  return updated;
}

// 导出：切换完成状态，返回最新 Note
export async function setNoteDone(id, done) {
  if (typeof id !== 'string' || !id) {
    throw new Error('设置完成失败：id 非法');
  }
  if (typeof done !== 'boolean') {
    throw new Error('设置完成失败：完成状态非法');
  }
  const list = await getNotes();
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) {
    throw new Error('设置完成失败：未找到对应笔记');
  }
  const now = Date.now();
  const updated = normalizeNote({
    ...list[idx],
    done,
    updatedAt: now
  });
  const merged = [...list];
  merged[idx] = updated;
  await saveNotes(merged);
  return updated;
}

// 导出：按 id 删除，返回布尔值表示是否删除了某项
export async function deleteNote(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('删除失败：id 非法');
  }
  const list = await getNotes();
  const next = list.filter((n) => n.id !== id);
  if (next.length === list.length) {
    return false;
  }
  if (next.length === 0) {
    await removeAsync(NOTES_KEY);
  } else {
    await saveNotes(next);
  }
  return true;
}

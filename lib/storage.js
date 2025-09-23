// lib/storage.js
// 说明：封装基于 chrome.storage.local 的备忘录存取逻辑，并做最小结构校验与错误冒泡。
// 注意：本模块不持有 UI 状态；排序规则在 getNotes 时按 updatedAt 倒序返回，UI 直接渲染即可。

const NOTES_KEY = 'notes'; // 存储键名，所有笔记以数组形式存放于此键

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
  const local = getChromeLocal(); // 取得 local 句柄
  return new Promise((resolve, reject) => {
    try {
      local.get(keys, (res) => {                             // 调用回调式 API
        const err = globalThis.chrome?.runtime?.lastError;   // 读取 lastError（可能不存在）
        if (err) return reject(new Error(err.message || 'storage.get 失败')); // 有错则拒绝
        resolve(res);                                        // 正常返回结果对象
      });
    } catch (e) {
      reject(e);                                             // 捕获同步异常
    }
  });
}

function setAsync(items) {
  const local = getChromeLocal();                            // 取得 local 句柄
  return new Promise((resolve, reject) => {
    try {
      local.set(items, () => {                               // 写入键值对象
        const err = globalThis.chrome?.runtime?.lastError;   // 检查 lastError
        if (err) return reject(new Error(err.message || 'storage.set 失败')); // 拒绝
        resolve();                                           // 成功不带返回值
      });
    } catch (e) {
      reject(e);                                             // 捕获同步异常
    }
  });
}

function removeAsync(keys) {
  const local = getChromeLocal();                            // 取得 local 句柄
  return new Promise((resolve, reject) => {
    try {
      local.remove(keys, () => {                             // 删除指定键
        const err = globalThis.chrome?.runtime?.lastError;   // 检查 lastError
        if (err) return reject(new Error(err.message || 'storage.remove 失败')); // 拒绝
        resolve();                                           // 成功
      });
    } catch (e) {
      reject(e);                                             // 捕获同步异常
    }
  });
}

// 校验：判断对象是否为合法 Note 结构
function isValidNote(o) {
  return (
    o &&
    typeof o.id === 'string' &&
    typeof o.content === 'string' &&
    typeof o.createdAt === 'number' &&
    typeof o.updatedAt === 'number'
  );
}

// 校验：断言是 Note 数组
function assertNotesArray(arr, scene) {
  if (!Array.isArray(arr)) {
    throw new Error(`${scene || '校验'}失败：存储数据不是数组`);
  }
  const allValid = arr.every(isValidNote);
  if (!allValid) {
    throw new Error(`${scene || '校验'}失败：存在不合法的 Note 结构`);
  }
}

// 导出：读取全部笔记，按 updatedAt 倒序返回
export async function getNotes() {
  // 用带默认值的对象形式读取，缺省时返回 []
  const res = await getAsync({ [NOTES_KEY]: [] }); // 读取 notes 键
  const list = res[NOTES_KEY] ?? [];               // 取出数组
  assertNotesArray(list, '读取');                  // 结构校验
  // 按 updatedAt 倒序排序，不修改原数组
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

// 导出：整体写入全部笔记（批量覆盖）
export async function setNotes(notes) {
  assertNotesArray(notes, '写入');                 // 写入前校验结构
  await setAsync({ [NOTES_KEY]: notes });          // 落盘
}

// 导出：新增一条笔记，要求调用方提供完整结构（含 id、时间戳等）
export async function addNote(note) {
  if (!isValidNote(note)) {
    throw new Error('新增失败：Note 结构不合法');
  }
  if (!note.content || !note.content.trim()) {
    throw new Error('新增失败：内容不能为空');
  }
  const list = await getNotes();                   // 读取现有
  if (list.some(n => n.id === note.id)) {
    throw new Error('新增失败：ID 已存在');
  }
  const next = [note, ...list];                    // 头部插入
  await setAsync({ [NOTES_KEY]: next });           // 落盘
  return note;                                     // 返回新增项
}

// 导出：按 id 更新内容并刷新 updatedAt，返回更新后的 Note
export async function updateNote(id, content) {
  if (typeof id !== 'string' || !id) {
    throw new Error('更新失败：id 非法');
  }
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('更新失败：内容不能为空');
  }
  const list = await getNotes();                   // 读取现有并已排序
  const idx = list.findIndex(n => n.id === id);    // 定位目标
  if (idx === -1) {
    throw new Error('更新失败：未找到对应笔记');
  }
  const now = Date.now();                          // 生成新的更新时间
  const updated = { ...list[idx], content, updatedAt: now }; // 构造更新后对象
  if (!isValidNote(updated)) {
    throw new Error('更新失败：生成的 Note 结构不合法');
  }
  // 将更新后的项移动到顶部，保持其余项相对顺序
  const next = [updated, ...list.slice(0, idx), ...list.slice(idx + 1)];
  await setAsync({ [NOTES_KEY]: next });           // 落盘
  return updated;                                   // 返回更新结果
}

// 导出：按 id 删除，返回布尔值表示是否删除了某项
export async function deleteNote(id) {
  if (typeof id !== 'string' || !id) {
    throw new Error('删除失败：id 非法');
  }
  const list = await getNotes();                   // 读取现有
  const next = list.filter(n => n.id !== id);      // 过滤目标
  if (next.length === list.length) {
    return false;                                  // 未删除任何项
  }
  if (next.length === 0) {
    // 清空时可以直接 remove，避免保留空数组也可；这里选择清键
    await removeAsync(NOTES_KEY);                  // 删除整个键
  } else {
    await setAsync({ [NOTES_KEY]: next });         // 写回剩余项
  }
  return true;                                     // 已删除
}

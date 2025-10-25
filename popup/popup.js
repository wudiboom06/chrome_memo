// 以 ES Module 方式编写弹窗逻辑，并对接存储封装
import { getNotes, addNote, updateNote, deleteNote, setNoteDone } from '../lib/storage.js'; // 封装的存储操作
import { generateId } from '../lib/id.js'; // 唯一 ID 生成工具

// 查找页面元素的引用
const $input = document.getElementById('newContent'); // 新增输入 textarea 节点
const $save = document.getElementById('saveBtn'); // 新增保存按钮节点
const $list = document.getElementById('list'); // 列表容器节点
const $msg = document.getElementById('msg'); // 消息提示容器节点

// 初始化：为输入框与按钮绑定事件，并首次渲染列表
init().catch((err) => showError(err));

// 初始化函数：绑定监听与渲染数据
async function init() {
  $input.addEventListener('input', () => {
    const hasText = !!$input.value.trim();
    $save.disabled = !hasText;
  });
  $save.addEventListener('click', onCreate);
  await renderList();
}

// 新增处理函数：将输入内容保存为新笔记
async function onCreate() {
  try {
    const content = $input.value.trim();
    if (!content) {
      showWarn('内容不能为空');
      return;
    }
    disableNode($save, true);
    const now = Date.now();
    const note = {
      id: generateId(),
      content,
      createdAt: now,
      updatedAt: now,
      done: false
    };
    await addNote(note);
    $input.value = '';
    $save.disabled = true;
    showOk('已保存');
    await renderList();
  } catch (e) {
    showError(e);
  } finally {
    disableNode($save, false);
  }
}

// 列表渲染函数：从存储读取并绘制 DOM
async function renderList() {
  const notes = await getNotes();
  $list.innerHTML = '';
  for (const note of notes) {
    const li = document.createElement('li');
    li.className = 'item';
    li.dataset.id = note.id;
    if (note.done) {
      li.classList.add('completed');
    }

    const row = document.createElement('div');
    row.className = 'row';

    const txt = document.createElement('div');
    txt.className = 'text';
    txt.textContent = note.content;

    const act = document.createElement('div');
    act.className = 'actions';

    const btnDone = createDoneButton(note);
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn';
    btnEdit.textContent = '编辑';
    const btnDel = document.createElement('button');
    btnDel.className = 'btn del';
    btnDel.textContent = '删除';

    act.appendChild(btnDone);
    act.appendChild(btnEdit);
    act.appendChild(btnDel);

    row.appendChild(txt);
    row.appendChild(act);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = formatUpdated(note.updatedAt);

    li.appendChild(row);
    li.appendChild(meta);
    $list.appendChild(li);

    btnEdit.addEventListener('click', () => enterEditMode(li, note));
    btnDel.addEventListener('click', async () => {
      const ok = confirm('确认删除该条备忘吗？');
      if (!ok) return;
      try {
        const removed = await deleteNote(note.id);
        if (removed) {
          showOk('已删除');
          await renderList();
        } else {
          showWarn('未找到要删除的条目');
        }
      } catch (e) {
        showError(e);
      }
    });
  }
}

// 创建完成状态按钮：绑定点击事件切换完成状态
function createDoneButton(note) {
  const btn = document.createElement('button');
  btn.className = 'btn done-toggle';
  syncDoneButtonState(btn, note.done);
  btn.addEventListener('click', async () => {
    const nextDone = !note.done;
    try {
      disableNode(btn, true);
      await setNoteDone(note.id, nextDone);
      showOk(nextDone ? '已标记完成' : '已恢复未完成');
      await renderList();
    } catch (e) {
      showError(e);
    } finally {
      disableNode(btn, false);
    }
  });
  return btn;
}

// 将完成按钮的可视状态与辅助文本同步
function syncDoneButtonState(btn, done) {
  btn.classList.toggle('is-done', done);
  btn.setAttribute('title', done ? '标记为未完成' : '标记为已完成');
  btn.setAttribute('aria-label', done ? '标记为未完成' : '标记为已完成');
  btn.setAttribute('aria-pressed', String(done));
}

// 进入行内编辑模式：将文本替换为 textarea 与保存/取消按钮
function enterEditMode(li, note) {
  const row = li.querySelector('.row');
  if (!row) return;
  row.innerHTML = '';

  const ta = document.createElement('textarea');
  ta.className = 'editbox';
  ta.value = note.content;

  const act = document.createElement('div');
  act.className = 'actions';

  const btnSave = document.createElement('button');
  btnSave.className = 'btn save';
  btnSave.textContent = '保存';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn';
  btnCancel.textContent = '取消';

  act.appendChild(btnSave);
  act.appendChild(btnCancel);
  row.appendChild(ta);
  row.appendChild(act);

  btnSave.addEventListener('click', async () => {
    const content = ta.value.trim();
    if (!content) {
      showWarn('内容不能为空');
      return;
    }
    try {
      disableNode(btnSave, true);
      await updateNote(note.id, content);
      showOk('已更新');
      await renderList();
    } catch (e) {
      showError(e);
    } finally {
      disableNode(btnSave, false);
    }
  });

  btnCancel.addEventListener('click', async () => {
    await renderList();
  });
}

// 工具函数：将节点设置禁用或恢复
function disableNode(node, disabled) {
  if (!node) return;
  node.disabled = !!disabled;
}

// 消息提示：显示错误信息（红色）
function showError(e) {
  $msg.className = '';
  const message = e && e.message ? e.message : String(e);
  $msg.textContent = `错误：${message}`;
}

// 消息提示：显示成功信息（绿色）
function showOk(text) {
  $msg.className = 'ok';
  $msg.textContent = text || '已完成';
}

// 消息提示：显示警告信息（橙色）
function showWarn(text) {
  $msg.className = 'warn';
  $msg.textContent = text || '请检查输入';
}

// 时间格式化：将 updatedAt 的 UTC 毫秒转为易读短格式
function formatUpdated(ts) {
  try {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `更新于 ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return '更新时间未知';
  }
}

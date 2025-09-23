// 以 ES Module 方式编写弹窗逻辑，并对接 lib/storage.js 与 lib/id.js
import { getNotes, addNote, updateNote, deleteNote } from '../lib/storage.js'; // 引入存储封装的五个异步函数
import { generateId } from '../lib/id.js'; // 引入唯一 ID 生成器

// 查找页面元素的引用
const $input = document.getElementById('newContent'); // 新增输入的 textarea 节点
const $save  = document.getElementById('saveBtn');    // 新增保存按钮节点
const $list  = document.getElementById('list');       // 列表容器节点
const $msg   = document.getElementById('msg');        // 消息提示容器节点

// 初始化：为输入框与按钮绑定事件，并首次渲染列表
init().catch(err => showError(err)); // 调用初始化函数，若抛错在消息区提示

// 初始化函数：绑定监听与渲染数据
async function init() {
  // 绑定输入事件：根据内容是否为空来切换保存按钮的禁用状态
  $input.addEventListener('input', () => { // 在输入时触发
    const hasText = !!$input.value.trim(); // 计算是否有非空白字符
    $save.disabled = !hasText; // 没有文本则禁用保存，有文本则允许保存
  });
  // 绑定保存按钮点击事件：执行新增流程
  $save.addEventListener('click', onCreate); // 点击保存时调用新增处理函数
  // 首次渲染列表
  await renderList(); // 读取存储并绘制列表项
}

// 新增处理函数：将输入内容保存为新笔记
async function onCreate() {
  try {
    const content = $input.value.trim(); // 读取并去除首尾空白
    if (!content) { // 若内容为空则提示并返回
      showWarn('内容不能为空'); // 在消息区显示警告
      return; // 直接终止后续逻辑
    }
    $save.disabled = true; // 提交期间禁用保存，避免重复点击
    const now = Date.now(); // 记录当前 UTC 毫秒时间戳
    const note = { id: generateId(), content, createdAt: now, updatedAt: now }; // 组装 Note 结构体
    await addNote(note); // 调用存储封装新增一条笔记
    $input.value = ''; // 清空输入框内容
    $save.disabled = true; // 清空后再次禁用保存按钮
    showOk('已保存'); // 显示成功提示
    await renderList(); // 重新渲染列表以反映新数据
  } catch (e) {
    showError(e); // 将错误展示到消息区
  }
}

// 列表渲染函数：从存储读取并绘制 DOM
async function renderList() {
  // 读取全部笔记并保证为 updatedAt 倒序（getNotes 内已处理排序）
  const notes = await getNotes(); // 获取笔记数组
  // 清空旧的列表 DOM
  $list.innerHTML = ''; // 直接重建列表
  // 遍历笔记生成每个列表项
  for (const n of notes) { // 对每一条笔记进行处理
    const li = document.createElement('li'); // 创建列表项容器
    li.className = 'item'; // 赋予样式类名为 item
    // 创建内容行：左侧文字/编辑框，右侧操作按钮
    const row = document.createElement('div'); // 创建行容器
    row.className = 'row'; // 设置行样式
    // 文本容器，默认展示文本内容
    const txt = document.createElement('div'); // 创建文本容器
    txt.className = 'text'; // 设置文本样式类
    txt.textContent = n.content; // 填入笔记正文文本
    // 操作按钮区域容器
    const act = document.createElement('div'); // 创建操作容器
    act.className = 'actions'; // 设置操作区域样式
    // 编辑按钮
    const btnEdit = document.createElement('button'); // 创建编辑按钮
    btnEdit.className = 'btn'; // 设置通用按钮样式
    btnEdit.textContent = '编辑'; // 设置按钮文本
    // 删除按钮
    const btnDel = document.createElement('button'); // 创建删除按钮
    btnDel.className = 'btn del'; // 设置删除按钮样式
    btnDel.textContent = '删除'; // 设置按钮文本
    // 将按钮添加到操作容器
    act.appendChild(btnEdit); // 放入编辑按钮
    act.appendChild(btnDel); // 放入删除按钮
    // 将文本与操作区加入到行内
    row.appendChild(txt); // 行左侧为文本内容
    row.appendChild(act); // 行右侧为操作按钮
    // 元数据行：显示更新时间
    const meta = document.createElement('div'); // 创建元数据容器
    meta.className = 'meta'; // 设置元数据样式
    meta.textContent = formatUpdated(n.updatedAt); // 填入更新时间文本
    // 将所有片段组装到列表项
    li.appendChild(row); // 将第一行加入列表项
    li.appendChild(meta); // 将元数据加入列表项
    // 将列表项加入到列表容器
    $list.appendChild(li); // 添加到列表末尾（已按顺序）
    // 绑定编辑按钮点击事件，进入行内编辑模式
    btnEdit.addEventListener('click', () => enterEditMode(li, n)); // 点击编辑进入编辑模式
    // 绑定删除按钮点击事件，弹出二次确认并删除
    btnDel.addEventListener('click', async () => { // 点击删除时触发
      const ok = confirm('确认删除该条备忘吗？'); // 弹出确认对话框
      if (!ok) return; // 若取消则不继续
      try {
        const removed = await deleteNote(n.id); // 调用删除接口
        if (removed) { // 若确实删除
          showOk('已删除'); // 显示删除成功
          await renderList(); // 重新渲染列表
        } else {
          showWarn('未找到要删除的条目'); // 若未删除任何项则提示
        }
      } catch (e) {
        showError(e); // 显示删除异常
      }
    }); // 删除按钮事件结束
  } // 遍历结束
}

// 进入行内编辑模式：将文本替换为 textarea 与保存/取消按钮
function enterEditMode(li, note) {
  // 在当前列表项中查找已有的行容器
  const row = li.querySelector('.row'); // 获取第一行容器
  // 清空行内容以切换为编辑布局
  row.innerHTML = ''; // 移除原有文本与按钮
  // 创建编辑输入框并填入原内容
  const ta = document.createElement('textarea'); // 创建 textarea 作为编辑框
  ta.className = 'editbox'; // 赋予编辑框样式
  ta.value = note.content; // 将原始内容写入编辑框
  // 创建按钮容器
  const act = document.createElement('div'); // 创建操作容器
  act.className = 'actions'; // 设置操作区域样式
  // 保存按钮
  const btnSave = document.createElement('button'); // 创建保存按钮
  btnSave.className = 'btn save'; // 设置强调样式
  btnSave.textContent = '保存'; // 按钮文案为保存
  // 取消按钮
  const btnCancel = document.createElement('button'); // 创建取消按钮
  btnCancel.className = 'btn'; // 使用通用按钮样式
  btnCancel.textContent = '取消'; // 按钮文案为取消
  // 将编辑输入与操作按钮装配到行中
  row.appendChild(ta); // 左侧为编辑框
  act.appendChild(btnSave); // 操作区放入保存
  act.appendChild(btnCancel); // 操作区放入取消
  row.appendChild(act); // 将操作区加入行内
  // 绑定保存事件：校验非空并调用 updateNote 后刷新渲染
  btnSave.addEventListener('click', async () => { // 点击保存触发
    const content = ta.value.trim(); // 读取编辑后的内容
    if (!content) { // 若编辑后为空
      showWarn('内容不能为空'); // 提示内容为空
      return; // 中止保存
    }
    try {
      disableNode(btnSave, true); // 提交期间禁用保存按钮
      await updateNote(note.id, content); // 调用更新接口（内部会刷新 updatedAt）
      showOk('已更新'); // 提示成功
      await renderList(); // 重新渲染以反映排序变化与新内容
    } catch (e) {
      showError(e); // 显示更新错误
    } finally {
      disableNode(btnSave, false); // 恢复保存按钮可用
    }
  }); // 保存按钮事件结束
  // 绑定取消事件：恢复为原始的只读视图
  btnCancel.addEventListener('click', async () => { // 点击取消时触发
    await renderList(); // 直接重新渲染列表以恢复原样
  }); // 取消按钮事件结束
}

// 工具函数：将按钮或节点设置禁用或恢复
function disableNode(node, disabled) {
  node.disabled = !!disabled; // 将传入的真假值规范为布尔并赋给 disabled
}

// 消息提示：显示错误信息（红色）
function showError(e) {
  $msg.className = ''; // 先清空旧的状态类
  $msg.textContent = `错误：${String(e && e.message ? e.message : e)}`; // 将错误对象转为可读文本
  $msg.classList.remove('ok', 'warn'); // 移除其他状态类
} // 错误提示函数结束

// 消息提示：显示成功信息（绿色）
function showOk(text) {
  $msg.className = ''; // 清空旧类名
  $msg.textContent = text || '已完成'; // 设置成功文案
  $msg.classList.add('ok'); // 添加 ok 状态类
} // 成功提示函数结束

// 消息提示：显示警告信息（橙色）
function showWarn(text) {
  $msg.className = ''; // 清空旧类名
  $msg.textContent = text || '请检查输入'; // 设置警告文案
  $msg.classList.add('warn'); // 添加 warn 状态类
} // 警告提示函数结束

// 时间格式化：将 updatedAt 的 UTC 毫秒转为易读短格式
function formatUpdated(ts) {
  try { // 使用 try 捕获潜在异常
    const d = new Date(ts); // 由毫秒构造日期对象
    const yyyy = d.getFullYear(); // 获取年
    const mm = String(d.getMonth() + 1).padStart(2, '0'); // 获取月并补零
    const dd = String(d.getDate()).padStart(2, '0'); // 获取日并补零
    const hh = String(d.getHours()).padStart(2, '0'); // 获取小时并补零
    const mi = String(d.getMinutes()).padStart(2, '0'); // 获取分钟并补零
    return `更新于 ${yyyy}-${mm}-${dd} ${hh}:${mi}`; // 返回格式化字符串
  } catch { // 若格式化异常
    return '更新时间未知'; // 返回兜底文案
  }
} // 时间格式化函数结束

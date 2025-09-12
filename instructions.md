## 1. 项目目标
构建一个仅包含弹窗页的 Manifest V3 Chrome 扩展，实现新增、列表、行内编辑、删除与本地持久化；不包含后台 service worker 与任何网络请求。

## 2. 技术边界
必须使用原生 HTML、CSS 与 JavaScript。Manifest 版本必须为 3。仅声明 storage 权限，禁止添加未使用权限。必须使用 chrome.storage.local 并通过封装模块进行读写与错误处理。所有代码与注释使用中文，命名需语义化并保持函数职责单一。

## 3. 目录结构与文件职责
根目录包含 manifest.json、README.md、instructions.md 与 assets。popup 目录包含 index.html、popup.css 与 popup.js，其中 index.html 作为 action.default_popup 的入口页面。lib 目录包含 storage.js 与 id.js，其中 storage.js 封装对 chrome.storage.local 的增删改查，id.js 负责生成唯一 id。assets/icons 目录放置图标资源，包含 16、32、48 与 128 像素的 PNG 文件。

## 4. 数据模型与排序规则
Note 结构由 id、content、createdAt（UTC 毫秒）与 updatedAt（UTC 毫秒）组成。列表渲染统一按 updatedAt 倒序；新增或编辑成功后对应项应位于顶部。

## 5. 交互细节
弹窗顶部提供多行输入与保存按钮，空内容在点击保存时需提示并阻止提交。列表项默认展示内容与操作按钮；点击编辑进入行内编辑，保存时更新 updatedAt 并刷新排序，取消时恢复原内容。删除操作需弹出二次确认后执行，确认后从存储中移除并刷新列表。出现异常时在页面显著位置显示简短错误提示语。

## 6. 存储封装接口约定
getNotes 返回 Note 数组；若无记录则返回空数组。setNotes 接收 Note 数组并整体覆盖写入，写入前进行最小结构校验。addNote 接收内容字符串，内部生成 id、createdAt、updatedAt，写入后返回新增 Note。updateNote 接收 id 与变更字段，定位目标记录并更新 updatedAt，写回后返回更新结果。deleteNote 接收 id，从集合中移除目标记录并持久化。所有存储操作必须捕获异常并将错误传递给 UI 显示。

## 7. manifest.json 约束
manifest_version 必须为 3。action.default_popup 必须指向 popup/index.html。permissions 仅包含 storage。icons 必须指向 16、32、48 与 128 的图标路径。禁止出现 background 与 service_worker 字段。

## 8. 质量要求
控制台不得出现未捕获异常或权限相关报错。列表渲染可以采用“清空再重建”的简单策略，但需要避免重复事件绑定导致的内存问题。关键函数必须包含简短中文注释，说明输入、输出与副作用。

## 9. 非目标清单
不实现提醒、重复、通知、搜索、右键菜单与快捷键。不引入打包器或任何第三方库。不实现后台脚本与任何网络请求。

## 10. README 要点
README 必须说明如何在 chrome://extensions 中加载本扩展、如何使用新增编辑删除及数据持久化，并提供 Git 与 GitHub 的常用命令（Git Bash 版本且逐行注释）。
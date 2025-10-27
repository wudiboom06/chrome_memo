## 1. 项目简介
本项目是一个极简的 Chrome 扩展（Manifest V3）。用户可以在弹窗中创建、查看、行内编辑、删除与标记完成备忘录，数据通过 chrome.storage.local 本地持久化，重启浏览器后依然可见。本项目不包含提醒、通知、后台脚本与任何网络请求。

## 2. 目录结构
以下为项目的最小目录结构，可直接在 Chrome 中以“加载已解压的扩展程序”的方式载入：
```
chrome-memo/
  manifest.json
  popup/
    index.html
    popup.css
    popup.js
  lib/
    storage.js
    id.js
  assets/
    icons/
      icon16.png
      icon32.png
      icon48.png
      icon128.png
  README.md
  instructions.md
```

## 3. 安装与加载
在地址栏打开 chrome://extensions 并开启开发者模式。点击“加载已解压的扩展程序”，选择包含 manifest.json 的项目根目录。在工具栏固定扩展图标，点击即可打开弹窗进行体验。修改文件后可在扩展管理页刷新本扩展，如弹窗未更新可先关闭后重新打开。

## 4. 使用说明
在弹窗顶部输入文本并点击保存即可新增一条备忘录，保存后输入框会清空，新建项会按“未完成优先 + 更新时间倒序”展示。在列表项右侧点击勾选按钮可以将该条标记为已完成（条目会置灰并排列在列表底部），再次点击可恢复为未完成。在列表项点击编辑可进入行内编辑状态，修改完成后选择保存或取消。点击删除会弹出确认提示，确认后条目将被永久移除。数据持久化于 chrome.storage.local，浏览器重启后仍可看到先前记录与完成状态。

## 5. 权限与安全
本扩展仅声明 storage 权限，用于读写本地存储。建议在 .cursor/rules 目录放置安全与权限白名单规则文件，并设置 alwaysApply，以限制仅能修改当前项目文件并禁止系统级危险操作。

## 6. Git 与 GitHub 常用命令（Git Bash，逐行注释）
```bash
# 在项目根目录初始化一个新的 Git 仓库
git init
# 将当前目录下的所有文件加入暂存区
git add .
# 提交一次骨架提交，说明本次变更
git commit -m "chore: scaffold MVP chrome memo project"

# 关联远程仓库（请先在 GitHub 创建空仓库并替换为你的地址）
git remote add origin https://github.com/<yourname>/chrome-memo.git
# 将当前分支改名为 main，作为主分支
git branch -M main
# 推送本地 main 分支到远程，并建立追踪关系
git push -u origin main

# 为开发创建一个特性分支
git checkout -b feat/mvp-popup
# 开发完成后按规范提交
git commit -m "feat: popup create/edit/delete with chrome.storage.local"
# 将特性分支推送到远程
git push -u origin feat/mvp-popup
# 在 GitHub 网页端发起 Pull Request 并合并到 main（此步骤在浏览器完成）

# 当 main 达到稳定点后打上 v0.1.0 标签
git tag v0.1.0
# 将标签推送到远程
git push origin v0.1.0

# 追加常见忽略项到 .gitignore（如需要）
echo ".DS_Store" >> .gitignore
echo "Thumbs.db" >> .gitignore
echo "dist/" >> .gitignore
echo "*.log" >> .gitignore
echo "node_modules/" >> .gitignore
# 将 .gitignore 纳入版本控制
git add .gitignore
# 提交 .gitignore 的变更
git commit -m "chore: add .gitignore for common artifacts"
```

## 7. 常见问题
若加载失败或图标不显示，请确认 manifest_version 为 3、icons 路径正确且文件存在，并确认 action.default_popup 指向 popup/index.html。若数据异常或未显示，检查浏览器是否清理了站点数据，或使用开发者工具查看控制台日志以排查 chrome.storage 调用是否失败。本项目未提供数据导出功能，如需导出可在后续迭代中在弹窗加入导出 JSON 的入口。

## 8. 版本策略
主分支为 main，用于可发布的稳定代码。功能开发以特性分支进行并通过 Pull Request 合并。在重要节点使用语义化标签进行标记，例如 v0.1.0 表示 MVP 首个可用版本。

# 简历自动填充助手

一个油猴（UserScript）脚本：在企业招聘官网的在线申请表页面上点一下按钮，姓名、手机、邮箱、学校、专业、学历、实习经历、自我评价这些字段就自动填好了。

脚本本身不含任何个人信息，资料只存在你自己的浏览器里，也不会替你点提交。

## 功能

- 一次点击填充整页表单，覆盖原生输入框、下拉框、单选按钮组，以及常见组件库的自定义下拉框。
- 多套资料方案，可以按岗位方向分别维护，投递时切换方案再填充。
- 面板内直接编辑资料，也可以导出成 `我的资料.json` 备份，或者从文件导入覆盖。
- 补充规则：脚本认不出来的字段，可以自己写一条「网页上的文字 → 要填进去的内容」。
- 申请表放在 iframe 里时，主页面上的按钮会指挥子框架一起填。
- 日期与时间：`type=date` / `month` / `time` / `datetime-local`、年 / 月 / 日 分开的下拉框、组件库的日期选择器都能填；填不进去的会列进「需要手动处理」。
- 页面上新出现的编辑框自动填：点「添加」新增的经历区块、弹出的对话框。
- 资料支持多段教育经历、工作经历、证书、专利、论文、奖励与家庭关系，可以按段数自动点「添加」把区块补足。
- 字段名写在控件属性里的表单（`msg`、`data-label`、`data-name`、`data` 里的 json `name`）也能识别；属性名只用来排优先级。
- 可搜索下拉（学校、公司这类字段）会点开、输入关键词、再点候选项；学校、专业这类「只读展示框 + 候选弹层」的控件同样处理；省 / 市 / 区 分开的地址控件按段填；手机号前面的国家 / 地区代码下拉会自动选中。
- 一栏经历属于哪种类型由栏内字段投票判断，「开始时间」「结束时间」这类中性名字在教育、工作、项目、活动各栏里都能对上正确的资料项。
- 只收年月的日期控件会自动截到月（`type=month`、`YYYY-MM` 提示、字段名带「年月」、`maxlength=7`），资料本身保持精确到日。
- 填充结束后列出已填字段、需要手动处理的字段、没认出来的字段。

## 安装

1. 在 Chrome 或 Edge 里安装 [Tampermonkey](https://www.tampermonkey.net/)（中文名「篡改猴」）扩展。
2. 打开 [`dist/resume-autofill.user.js`](dist/resume-autofill.user.js)，Tampermonkey 会弹出安装页面，点「安装」；也可以把这个文件直接拖进浏览器窗口。
3. 打开企业招聘官网的申请表页面，右下角会出现「填表」按钮；没出现就按 `Alt+Shift+F`。

安装地址：

```
https://raw.githubusercontent.com/Zinnober02/resume-autofill-userscript/main/dist/resume-autofill.user.js
```

脚本头部写了 `@downloadURL` 与 `@updateURL`，Tampermonkey 会按这个地址检查新版本。

## 使用

第一次使用之前需要先准备一份自己的资料。点面板上的「编辑资料」逐项填写，或者把 [`examples/profile.example.json`](examples/profile.example.json) 复制成 `我的资料.json` 改好内容，再点面板上的「载入资料文件」选中它。

详细步骤、常见问题和已经支持的叫法见 [docs/usage.md](docs/usage.md)。

## 隐私

脚本里没有任何个人信息。你的资料只存在两个地方：Tampermonkey 的本地存储，以及你自己维护的 `我的资料.json`。脚本不会上传任何数据，也不会替你点击提交按钮。

## 仓库结构

| 路径 | 用途 |
| --- | --- |
| `src/main.js` | 入口：判断页面是否像申请表，挂上按钮与菜单命令 |
| `src/core/rules.js` | 字段识别规则，把网页上的标签文字映射成资料字段 |
| `src/core/profile-schema.js` | 资料字段模板与各类卡片的字段定义 |
| `src/core/dom.js` | DOM 查询与标签文字提取 |
| `src/core/form-control.js` | 往输入框、下拉框、自定义下拉框里写值 |
| `src/core/value.js` | 教育经历分段、日期格式、字段中文名 |
| `src/core/storage.js` | 用 `GM_getValue` / `GM_setValue` 读写资料 |
| `src/core/filler.js` | 填充引擎 |
| `src/core/date-widget.js` | 年 / 月 / 日 分开的控件组与组件库日期选择器 |
| `src/core/search-select.js` | 可搜索下拉：点开、输入关键词、再点候选 |
| `src/core/floating-picker.js` | 弹层选择控件（只读展示框 + 候选浮层），按行为与结构识别 |
| `src/core/cascade.js` | 分级控件：认组、分角色、逐级驱动、等就绪 |
| `src/core/region-names.js` | 行政区名的归一化与层级判断 |
| `src/core/wait.js` | 等条件成立的通用等待 |
| `src/core/address.js` | 省 / 市 / 区 地址的分段与填充 |
| `src/core/regions.js` | 内置的省市区数据（来自 area-data，MIT） |
| `src/core/blocks.js` | 经历区块的分段识别 |
| `src/core/watcher.js` | 页面上新出现的编辑框自动填充 |
| `src/core/block-adder.js` | 按资料段数点「添加」补足经历区块 |
| `src/core/messaging.js` | 跨 iframe 调度 |
| `src/core/env.js` | 顶层框架判断与界面节点 id |
| `src/ui/panel.js` | 网页面板 |
| `src/userscript.meta.txt` | 油猴脚本头部，构建时填入版本号与下载地址 |
| `scripts/build.mjs` | 把 `src/` 打包成 `dist/resume-autofill.user.js` |
| `tests/` | 规则单元测试与 jsdom 端到端测试 |
| `dist/resume-autofill.user.js` | 发布产物，装进 Tampermonkey 的就是这个文件 |
| `examples/profile.example.json` | 空白资料模板 |
| `docs/usage.md` | 详细使用说明 |

## 开发

需要 Node 26 或更新版本（`package.json` 里的 `engines` 与 `.npmrc` 里的 `engine-strict` 会在版本不符时直接报错）。

```bash
npm install
npm run build   # 生成 dist/resume-autofill.user.js
npm test        # 运行测试
npm run check   # 构建并运行测试
```

`dist/` 里的产物和源码一起提交，`.github/workflows/ci.yml` 会检查两者是否同步。修改版本号时只需要改 `package.json` 里的 `version`，构建时会写进脚本头部。

## 许可证

MIT

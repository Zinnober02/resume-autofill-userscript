# 级联下拉框（省-市-区 / 省-市）填充设计

> 目标：泛化处理「N 级选择控件、第 i 级的选项依赖第 i-1 级的选择结果」这类级联控件。
> 省市区只是值域之一，方案不为任何具体站点做特判。
> 验证基线：`.scratch/telecom/page-0.html`（中国电信招聘，AngularJS 1.x + bootstrap-select，省-市两级联动）。

## 一、现状与失败点分析

级联填充的主体已经存在：

- `src/core/address.js`：`regionLevelOf`（按选项内容比对内置区划名判断层级）、`assignRoles`（角色分配）、`fillAddressSegment`（逐级填）
- `src/core/filler.js`：`computeAddressGroup`（一栏内连续同标签控件成组，L283）、`fillAddressGroup`（L306）
- `src/core/regions.js`：内置全国省/市/区县数据（area-data 的 pcaa）

电信快照的级联结构（`page-0.html:1304-1318`）：两个原生 `<select class="selectpicker" data-live-search="true">` 被 bootstrap-select 包装；第一级省份选项静态渲染（"北京"与"河北省"混合格式）；第二级初始只有"请选择"，市级选项由第一级的 `ng-change` 异步加载。

对照走一遍现有代码，会断在四个地方：

1. **被包装组件隐藏的原生 select 会被主循环跳过**。`skipNode`（filler.js:226-235）对不可见控件直接 return，而 bootstrap-select 在真实浏览器里会隐藏原生 select、镜像一个 button + ul。跳过了就没有 `addressGroupAt` 的机会，整组根本不会进入级联流程。
2. **写值方式只有一档**。`fillAddressSegment`（address.js:161-170）对 select 直接 `setVal` 写原生值。这对 AngularJS 的 `ng-change` 大概率有效，但镜像 UI 不更新，换了别的框架（React 受控、组件内部状态机）就不认。`fillSearchSelect` 只作为"选项没等到"时的兜底，两条路径的等待逻辑互相重叠又各自不完整。
3. **等待是固定轮询**。`bestOptionWithWait` 只有 4×200ms（address.js:144-152），真实接口慢一点就直接放弃；没有事件驱动的"选项就绪"通知。
4. **值解析有死角**。`splitAddress` 对直辖市（"北京市朝阳区…"）拆不出市级，`fillAddressSegment` 里 `want` 为空就静默跳过（address.js:160）；而单控件路径的 `addressValueFor`（filler.js:58-64）却有 `city || province` 兜底——两条路径取值逻辑不一致。另外组识别失败时，第二级下拉会被当成普通地址字段塞省名进去（`addressValueFor` 对认不出角色的控件默认给省），必然选不中。

## 二、设计原则

- **认"形态"不认"站点"**：级联是通用概念——N 级选择控件、第 i 级选项依赖第 i-1 级选择结果。
- **认"行为"不认"类名"**：控件类型靠交互特征推断（点开后出现什么、写完值什么变了），不靠 `ant-cascader` 这类类名硬编码。
- **等待是事件驱动的**：选项加载是异步的，用 MutationObserver + 超时兜底，不用固定 sleep。
- **宁缺毋滥**：认不准就不填，记入「需要手动处理」，不猜。

## 三、方案：组识别 → 角色分配 → 逐级驱动 → 就绪等待

### 3.1 组识别（detectCascade）

把 `computeAddressGroup` 泛化为 `detectCascade(el)`，识别信号按强度排序：

- **强信号**：同容器内 2~3 个同类选择控件、标签相同或首级无标签（现有逻辑，保留）。
- **内容信号**：`regionLevelOf` 的选项内容比对（保留，但名称匹配要做归一化，见 3.4）。
- **弱信号**：id/name 的 `firstLevl/secondLevl`、`level1/level2`、`parent/child` 等命名模式——只作 tiebreak，不单独成组（避免误判）。
- **单控件多级面板**（antd Cascader 那类）：一个只读展示框，点开后浮层里出现多列同构列表。复用 floating-picker 已有的「点击后新出现的浮层 + 同构子元素组」识别能力，探测列为几级。

同时修掉跳过的洞：**对「不可见但存在可见镜像代理」的 select 放行**（如 `closest('.bootstrap-select')` 且镜像按钮可见），让它能进入级联流程而不是被 `skipNode` 丢掉。

### 3.2 角色分配

保留现有 `assignRoles`（自己看得出角色的用自己的，看不出的按顺序补：第一级省、第二级市、第三级区县），补两条规则：

- **级数对齐**：页面 2 级、资料 3 级 → 填前两级，第三级记 manual 提示；页面 3 级、资料 2 级 → 填前两级，第三级留空记 manual。不硬凑。
- **禁止跨级猜测**：组识别失败时，第二级及以后的控件绝不拿省名去试（修掉现在「往市下拉里塞省名」的行为）。

### 3.3 逐级驱动（CascadeDriver 策略链）

每一级的写入抽成统一接口的 driver 链，按「对组件的保真度」从高到低尝试，失败降级：

1. **UI 驱动**：能点开的就点开——bootstrap-select / search-select 走「点按钮 → 关键词进搜索框 → 点候选」，自定义 dropdown 走现有 `fillCustomSelect` / `fillFloatingPicker`。
2. **原生写值**：`setVal` + `input`/`change`（现在的做法，作为降级档）。
3. 每档写完**验证**：原生 value 非占位、镜像文本更新、或只读框文本更新——验不过就换下一档重试，全部失败记 manual（报告里带层级信息，如「籍贯（市级）：没有匹配项」）。

单控件多级面板（Cascader 类）的 driver 是一个循环：在当前激活列里搜/点匹配项 → 等浮层切换到下一列 → 继续，直到最后一级。

### 3.4 值处理：行政区名归一化 + 集中取值

- **归一化比较**：匹配前剥离行政后缀（省/市/区/县/自治区/特别行政区/自治州/地区/盟/旗，含「壮族/回族/维吾尔」这类嵌套），让「北京」≡「北京市」、「内蒙古自治区」≡「内蒙古」。这个函数同时服务于 `regionLevelOf`（层级推断）和 `bestOptionIndex`（选项匹配），顺便处理「海外/港澳台」特例。
- **取值收口**：把「某一角色该填什么」收进一个函数（含直辖市的 `city || province` 兜底、省级简称映射），单控件路径和组路径共用，消除现在两条路径不一致的问题。
- **歧义消解靠顺序**：同名区（北京、长春都有「朝阳区」）不靠猜，靠「严格按序逐级、父级选定后再在子级选项里匹配」天然消歧——逐级驱动的顺序性本身就是正确性的一部分。

### 3.5 等待：统一的 waitFor 原语

所有「等选项加载」收编为一个原语：`waitFor(predicate, { timeout, interval })`，内部是 MutationObserver 监听目标子树 + 定时兜底。predicate 是「下一级选项就绪」（option 数 > 占位项 / 浮层出现候选 / 面板列数增加）。超时预算给足（每级 5~8s），但选项一到就立刻放行——比现在 4×200ms 的固定轮询既快又稳。`bestOptionWithWait`、`fillSearchSelect` 里的两处手写轮询都换成它。

## 四、接入点与测试

### 接入点（只动两处）

1. `filler.js` 主循环的跳过逻辑：放行被镜像隐藏的 select。
2. `addressGroupAt` 换成 `detectCascade`，组的处理走新管线。

`ADDRESS_KEYS`、`splitAddress`、面板编辑器都不用动。

### 测试矩阵（手写 mini-fixture，不依赖真实站点）

| 维度 | 取值 |
| --- | --- |
| 控件形态 | 原生 select / bootstrap-select 镜像 / 纯 div/li / 单控件多列面板 |
| 级数 | 2 级 / 3 级 |
| 选项加载 | 同步 / 异步（定时器模拟） |
| 名称格式 | 全称（浙江省） / 简称（北京） |

### 快照回归

电信快照抽一个「籍贯片段」做 fixture（`page-0.html:1304-1318` 那段，不用整页），放进 `tests/fixtures/`，断言组识别正确 + 两级驱动流程被触发，作为泛化方案的回归基准。

## 五、落地顺序

1. `waitFor` 原语 + hidden select 放行（基础，改动小）；
2. 级联管线 driver 化（先 native + bootstrap-select 两档，电信就属于这类，立刻见效）；
3. 区划名归一化 + 直辖市取值收口；
4. 单控件多级面板 driver（Cascader 类，工作量最大，放最后）；
5. 快照 fixture 回归。

## 六、明确不做的事

- 不按站点加 URL 特判；
- 不把 bootstrap-select 的 DOM 结构当唯一形态（driver 化正是为了避免这个）；
- 不内置「先睡 800ms」这类针对某个站点调出来的参数。

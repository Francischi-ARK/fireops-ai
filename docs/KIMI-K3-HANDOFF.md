# FireOps AI 复赛任务书：Kimi K3

## 任务目标

为 FireOps AI 的角色化改造准备一套可校验的合成数据合同。当前只做数据、场景夹具和校验脚本，不修改产品页面、后端状态机或视觉资产。

这项工作的用途是让后续开发有稳定输入，避免前端继续硬编码角色、车间、楼层、路线和事件步骤。

## 开始前必读

按顺序阅读：

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/FireOps-AI-completion-spec.md`

本任务书已经写明本轮需要的角色、空间和流程规则。若它与上述两份公开文档冲突，停止执行并向用户说明，不要自行猜测。

## Git 与协作要求

- 从当前最新提交新建独立分支，建议命名 `kimi/semifinal-fixtures`。
- 不在 `main` 或 `codex/semifinal-ux-flow` 上直接提交。
- 不合并、不推送到主分支。完成后只交付分支名、提交哈希、变更清单和测试结果。
- 开始和结束时都运行 `git status --short`。不得覆盖已有未提交修改。
- 不调用其他 Agent，不并行改同一批文件。

## 本轮允许修改的文件

只允许新增或修改以下路径：

```text
demo-data/semifinal/role_permissions.json
demo-data/semifinal/site_spatial.json
demo-data/semifinal/scenarios/fire-confirmed.json
demo-data/semifinal/scenarios/false-alarm-maintenance.json
demo-data/semifinal/scenarios/inspection-rectification.json
scripts/validate_semifinal_fixtures.cjs
docs/semifinal-data-dictionary.md
```

除上述文件外，不得修改其他文件。确实需要改动范围时，先停止并说明原因。

## 禁止修改

本轮不得触碰：

- `app.js`、`engine.cjs`、`index.html`、`styles.css`、`monitoring-3d.js`
- `backend/` 下任何文件
- `specs/` 和 `.codex/plan/`
- `docs/submission/`、PPT、PDF、视频、图片和 3D 资产
- 依赖文件、锁文件和启动脚本

不得增加 npm、Python 或系统依赖。校验脚本只使用 Node.js 标准库。

## 任务一：角色与权限合同

创建 `demo-data/semifinal/role_permissions.json`。

必须包含八类固定角色：

| ID | 中文名称 |
| --- | --- |
| `company_management` | 公司管理层 |
| `control_room_operator` | 消控室值班员 |
| `fire_patrol` | 防火巡查人员 |
| `full_time_fire_brigade` | 专职消防队 |
| `workshop_ert` | 车间 ERT |
| `facility_department` | 消防设施部门 |
| `maintenance_contractor` | 消防维保单位 |
| `workshop_liaison` | 车间问题对接人 |

每个角色至少定义：

- `id`
- `label`
- `scope`：`factory`、`assigned_workshop`、`assigned_workorder` 或 `assigned_incident`
- `visible_modules`
- `allowed_actions`
- `forbidden_actions`
- `data_visibility`

权限硬规则：

- 管理层默认只读全厂汇总和合法下钻，不执行核实、派单、验收或关闭。
- 消控室负责接警、调度、记录和经过授权的设备操作确认。
- 巡查人员负责现场核实、隐患上报和整改复查。
- 专职消防队负责真实火警处置和现场反馈。
- ERT 只能查看本车间或分配给自己的应急任务。
- 设施部门负责故障审核、维保派单和最终验收关闭。
- 维保单位只能处理分配的工单，不能自行验收关闭。
- 车间对接人只能查看本车间隐患，不能自行复查关闭。

## 任务二：厂区与车间合成空间数据

创建 `demo-data/semifinal/site_spatial.json`。

固定空间层级：

```text
厂区 → 建筑/车间 → 楼层 → 工艺区/房间 → 设备点位
```

至少包含以下五类建筑，且布局和工艺区必须明显不同：

- 电池车间
- 涂装车间
- 总装车间
- 冲压车间
- 立体仓库

每个建筑至少定义：

- 稳定英文 `id` 和中文名称
- 独立的 `layout_profile`
- 楼层及工艺区
- 外门、室内门、楼梯或必要的垂直交通节点
- 归一化坐标，统一使用 `0–100`
- 路线节点和双向/单向边
- 消防设备点位
- 工艺危险源
- 可用消防资源
- 所属车间和数据访问范围

必须遵守：

- 消防泵房只作为厂区级独立建筑或设施存在，不复制到每个车间。
- 原料仓库只在合理的仓储建筑或相应工艺区出现，不复制到每栋建筑。
- 五个车间不得复用相同的工艺区集合、路线图或 `layout_profile`。
- 数据不得引用不存在的图片、GLB、设备、门或人员。
- 所有数据必须标记 `is_simulation: true`、`external_system: "none"`。
- 不使用真实企业名称、地址、人员、图纸或生产数据。

## 任务三：三个评委演示场景

在 `demo-data/semifinal/scenarios/` 创建三个 JSON 文件。

每个步骤至少包含：

- `step_id`
- `actor_role`
- `route`
- `action`
- `from_state`
- `to_state`
- `entity_refs`
- `evidence_refs`
- `human_gate`
- `display_title`
- `next_step_id`

### `fire-confirmed.json`

覆盖：设备报警、消控室接警、派巡查核实、巡查按推荐路线到场、确认真实火警、调派专职消防队与对应车间 ERT、推荐厂区入口和室内路线、到场反馈、现场处置、经授权的设备操作确认、火情受控、出警报告、战评会议、改进行动和归档。

确认火警后，消防队和 ERT 进入处置，不再重复承担“是否真实火警”的核实闸门。

### `false-alarm-maintenance.json`

覆盖：报警、巡查核实、确认误报或设备故障、设施部门审核、派维保工单、维保处理、测试证据、设施部门验收、关闭。

维保单位提交完成后必须进入待验收，不能直接关闭。

### `inspection-rectification.json`

覆盖：巡查计划、现场检查、拍照/语音草稿、人工确认、派给车间问题对接人、整改、提交证据、巡查复查、通过关闭或不通过退回、周报数据更新。

车间问题对接人不能自行关闭隐患。

## 任务四：校验脚本

创建 `scripts/validate_semifinal_fixtures.cjs`，只使用 Node.js 标准库。

脚本必须检查：

1. 所有 JSON 可解析。
2. ID 唯一，跨文件引用存在。
3. 八类角色齐全。
4. 每个场景的 `next_step_id` 连续且无环；终态除外。
5. 执行动作的角色在权限合同中拥有该动作。
6. 三条流程不存在未授权关闭或非法跳步。
7. 五个车间的 `layout_profile` 和工艺区集合不相同。
8. 泵房没有复制到每个车间，原料仓库没有无差别复制。
9. 所有顶层对象标记为合成数据，外部系统为 `none`。
10. 场景中不存在自动拨打 119、自动启动灭火装置、自动操作真实设备或 AI 自动确认火警的动作。

校验失败时输出具体文件、字段和原因，并以非零状态退出；成功时输出文件数量、角色数量、建筑数量和场景步骤数量。

## 文档要求

创建 `docs/semifinal-data-dictionary.md`，说明：

- 每个 JSON 文件的用途；
- 主要字段含义；
- ID 命名规则；
- 空间坐标规则；
- 角色权限边界；
- 三个场景的状态路径；
- 合成数据和真实系统边界。

文档不要重复整个 JSON，也不要写宣传文案。

## 验收命令

必须执行：

```bash
node scripts/validate_semifinal_fixtures.cjs
git diff --check
git status --short
```

三个命令都成功后才能提交。

## 完成时的回复格式

```text
分支：
提交哈希：
修改文件：
校验命令与结果：
已满足的验收项：
未完成或存在疑问：
```

不要只回复“已完成”，不要隐藏失败测试，也不要顺手修改任务范围外的问题。

## 可直接交给 Kimi 的提示词

```text
你正在接手 FireOps AI 复赛项目的一组独立任务。请完整阅读仓库中的 docs/KIMI-K3-HANDOFF.md，并严格按其中的文件范围、业务规则和验收命令执行。

不要修改 app.js、engine.cjs、前端页面、后端、规格文件、PPT、视频或 3D 资产；不要增加依赖；不要调用其他 Agent。请在独立分支 kimi/semifinal-fixtures 工作，完成后提交一次原子 commit，并按任务书规定的格式报告分支、提交哈希、文件清单和真实测试结果。遇到业务冲突或需要扩大范围时停止，不要自行推断。
```

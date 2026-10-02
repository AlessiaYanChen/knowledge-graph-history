# 历史之间 · 第一阶段

从一个历史问题出发，阅读简短解释，选择下一步问题，并保存走过的探索路径。首个主题为「河流、城市与文明」，起点是「为什么古代城市经常建在河边？」。当前内容是**结构化示例数据**，没有接入 AI。

## 第一版范围

- 精选问题入口；每个问题有解释、三条下一步推荐及各自的推荐理由。
- 区分两种关系：`knowledgeRelations` 描述知识地图中的事实或待验证假设；`recommendations` 描述从一个问题走向另一个问题的编辑建议。
- 每个问题保留年代、地点、不同历史解释的备注、来源 ID 与审校状态。没有直接证据支撑的推论标记为「待审核」。
- 探索路径可返回、命名保存、重新打开。SQLite 存储在后端的 `App_Data/exploration.db`。
- 单机演示范围：不含账户、多人隔离、内容编辑后台、AI 生成或全文检索。保存列表对所有访问此本地服务的人可见，勿存放私人信息。

## 技术与目录

| 部分 | 实现 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite 8，`frontend/` |
| API | ASP.NET Core (.NET 10)、`backend/HistoryExplorer.Api/` |
| 存储 | SQLite，`Microsoft.Data.Sqlite` |
| 示例内容 | `backend/HistoryExplorer.Api/Data/exploration.json` |

选用 .NET 10 LTS 和本环境可用的 Node.js 24；包版本由 `frontend/package-lock.json` 与后端项目文件固定。开发时 Vite 把 `/api` 转发到后端。

## 启动

需要 .NET 10 SDK、Node.js 24 与 npm。分别打开两个终端，在仓库根目录执行：

```powershell
dotnet run --project backend/HistoryExplorer.Api --urls http://127.0.0.1:5055
```

```powershell
cd frontend
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173>。首次运行 API 时自动创建 SQLite 数据库与表。当前示例环境中的 Node.js 可执行文件位于 `C:\Program Files\nvm\v24.7.0`；若命令行找不到 `npm`，请在前端终端临时执行 `$env:Path='C:\Program Files\nvm\v24.7.0;'+$env:Path`。

`npm ci` 只需在首次安装或更新锁文件后执行。Windows 上重新运行 `npm ci` 前，先用 Ctrl+C 停止正在运行的 `npm run dev`；Vite 占用的原生模块文件会使安装报 `EPERM`。

生产构建检查：

```powershell
dotnet build backend/HistoryExplorer.Api
cd frontend
npm run build
```

## API 与数据约定

- `GET /api/exploration`：完整示例主题、问题、知识节点、知识关系、推荐和来源。
- `GET /api/paths`、`GET /api/paths/{id}`：最近 30 条保存路径和单条路径。
- `POST /api/paths`：提交 `{ "title": "沿河寻找城市", "questionIds": ["river-city", "irrigation"] }`。API 验证起点、问题 ID 与每一步推荐关系。

问题的 `reviewStatus` 可为 `reviewed`、`partial` 或 `pending`。来源的 `reviewed` 仅表示所列来源页面与所注明的内容已对应，不代表由此引申的所有历史解释已得到证实。年代、地点、解释备注分别存于 `context.period`、`context.place`、`context.interpretationNote`。知识关系有明确的 `type`，如 `enables`、`exposes_to`，避免用统一的“相关”代替不同含义。

## 内容来源与审校

已核对来源均来自大都会艺术博物馆：[两河流域年表](https://www.metmuseum.org/toah/ht/02/wam.html)、[欧贝德时期](https://www.metmuseum.org/essays/the-ubaid-period-5500-4000-b-c)、[最早的城市](https://www.metmuseum.org/exhibitions/listings/2003/art-of-the-first-cities)。年表支持两河流域南部的灌溉聚落、城市与行政记录；后两项分别支持灌溉农业和当地不稳定的降雨、洪水。水路运输、跨地区比较和强因果解释目前以待审核状态出现，尚未编造专门来源。

## 简短实施计划

1. **本阶段（已完成）**：搭建前后端、内容模型、完整示例、路径保存和响应式界面；验证构建及 API 流程。
2. **下一阶段**：对每个历史主张建立更细的来源定位与编辑审校流程；增加具体城市案例和跨地区比较。
3. **后续**：用户账户、私有路径、内容管理与搜索。引入 AI 前先确定引用和人工审核机制。

## 验证记录

已执行前后端构建；API 实测返回 6 个问题、起点 3 条推荐、6 条知识关系。沿 `river-city → irrigation → organization` 保存并重新读取成功；跳过推荐、直接提交 `river-city → organization` 返回 HTTP 400。

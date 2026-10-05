# 深读之间 · 深度阅读伴侣

在 `feature/deep-reading` 分支上，首页已改为深度阅读工作台。用户可建立书籍和章节，选择阅读片段，从四种入口追问文本，并保存、重新打开自己的笔记。第一阶段**不接 AI，也不模拟生成回答**：入口只提供引导问题和空白记录区。

历史知识探索演示仍可从首页进入，或直接打开 `/?view=history`。旧的 `/?path=历史路径ID` 链接继续有效。

## 当前范围

- `Book`、`Chapter`、`ReadingExcerpt`、`ReadingNote` 存于 SQLite。同一数据库保留原有 `saved_paths` 表，启动时只新增阅读表。
- 书籍、章节、片段可新增、编辑和删除；删除父级内容时会提示其子项及笔记一同删除。笔记可新建、编辑、删除和重新打开，并始终关联到一个片段。
- 四种探索入口为「读懂文字」「提出问题」「建立联系」「留下想法」。每个入口有引导问题；用户自行记录观察。
- 首次启动添加《河岸练习》及三段本站原创的虚构示例文字。示例只初始化一次；之后的编辑和删除不会被重启覆盖。
- 单机演示仍无账户和权限隔离。所有连接本地服务的人会看到同一书架与笔记，请勿录入私人内容。

## 技术与结构

| 部分 | 位置 |
| --- | --- |
| 阅读工作台 | `frontend/src/ReadingWorkspace.tsx`、`frontend/src/reading.css` |
| 历史演示 | `frontend/src/HistoryExplorer.tsx`、`frontend/src/styles.css` |
| 入口路由 | `frontend/src/App.tsx` |
| 阅读 API 与数据层 | `backend/HistoryExplorer.Api/ReadingEndpoints.cs`、`ReadingStore.cs` |
| 历史 API 与数据 | `Program.cs`、`PathStore.cs`、`Data/exploration.json` |
| SQLite | `backend/HistoryExplorer.Api/App_Data/exploration.db`（自动创建，不纳入 Git） |

前端使用 React 19、TypeScript 和 Vite 8；后端使用 ASP.NET Core (.NET 10) 与 `Microsoft.Data.Sqlite`。依赖版本由 `frontend/package-lock.json` 和后端项目文件固定。

## 启动

需要 .NET 10 SDK、Node.js 24 和 npm。先停止旧的后端与 Vite 进程，然后在仓库根目录打开两个终端：

```powershell
dotnet run --project backend/HistoryExplorer.Api --urls http://127.0.0.1:5055
```

```powershell
cd frontend
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173>。`npm ci` 只需在首次安装或依赖变更后执行；Windows 上重装前先用 Ctrl+C 停止 Vite，否则其原生模块可能被占用而报 `EPERM`。若命令行找不到 npm，本机可临时执行 `$env:Path='C:\Program Files\nvm\v24.7.0;'+$env:Path`。

## API

- `GET /api/reading/` 返回书籍、章节、片段与笔记的快照。
- `POST/PUT/DELETE /api/reading/books`、`/chapters`、`/excerpts`、`/notes` 管理阅读数据。`PUT`、`DELETE` 的资源路径需加 `/{id}`。
- 笔记创建请求包含 `excerptId`、`mode` 和 `text`；`mode` 为 `understand`、`question`、`connect` 或 `reflect`。API 校验片段存在，数据库用外键保证关联。
- 历史接口 `GET /api/exploration`、`GET /api/paths`、`GET /api/paths/{id}`、`POST /api/paths` 保持可用。

## 验证

前后端构建通过。在隔离的 SQLite 数据库中创建书籍、章节、片段、笔记和历史路径后重启 API，再次读取时全部存在；笔记的 `excerptId` 与原片段一致，旧历史路径仍可按 ID 打开。笔记修改保持片段关联，非法探索入口返回 HTTP 400。书籍、章节、片段的编辑及级联删除也已验证。浏览器检查了阅读首页、已保存笔记的重新打开，以及旧格式 `?path=...` 历史链接。测试没有改动现有用户数据库。

历史演示中的资料仍来自大都会艺术博物馆：[两河流域年表](https://www.metmuseum.org/toah/ht/02/wam.html)、[欧贝德时期](https://www.metmuseum.org/essays/the-ubaid-period-5500-4000-b-c)、[最早的城市](https://www.metmuseum.org/exhibitions/listings/2003/art-of-the-first-cities)。未经核实的历史推论继续标为待审核。

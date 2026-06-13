# NewBie Anime Generator

NewBie Anime Generator 是一个面向 AI 图像与视频创作的多工作流 Web 应用。它把提示词编辑、参数管理、ComfyUI/NovelAI 调用、生成队列、历史记录、画廊收藏和数据分析集中在同一个界面中，适合持续迭代个人或团队的 AIGC 创作流程。

## 项目特点

- **多工作流集成**：内置标准文生图、双人构图、NovelAI、图生视频等创作入口，可在顶部导航快速切换。
- **面向动画风格创作**：提供结构化提示词构建、正向/反向提示词、角色描述、风格模板、LoRA 与模型选择等能力。
- **前后端一体化**：前端负责交互与状态管理，后端负责认证、代理、数据库、上传文件、任务记录与服务端密钥保护。
- **历史与画廊体系**：生成结果可同步到服务端历史，支持画廊、收藏、缩略图、来源区分和跨工作流查看。
- **任务与队列状态**：对长耗时生成任务进行轮询、进度恢复、状态追踪，减少刷新页面或网络波动导致的丢失。
- **移动端适配**：设置面板、历史面板和主创作区支持移动端抽屉式布局。
- **多语言界面**：内置中文与英文文案，方便不同使用习惯的用户切换。
- **数据分析看板**：记录生成日志，可查看不同来源、模型、耗时和成功率等统计信息。

## 核心工作流

### 1. 标准文生图工作流

标准工作流面向常规 ComfyUI 文生图场景，适合单角色或通用画面生成。

主要能力：

- 结构化 Prompt Builder：拆分角色、服装、表情、动作、背景、光照、质量词等字段。
- 原始提示词模式：支持直接输入完整 prompt，适合高级用户快速调参。
- ComfyUI 队列提交与状态轮询。
- 生成历史、本地状态恢复、云端历史同步。
- 图片放大 / Upscale 相关流程。
- 服务器连通性检测、CORS/混合内容提示。

### 2. 双人图像工作流

双人工作流针对两个角色同屏构图设计，用独立参数和提示词组织方式降低多人画面的提示词复杂度。

主要能力：

- 独立的双人生成设置与默认参数。
- 模型、LoRA、资源列表加载。
- WebSocket / 轮询结合的 ComfyUI 状态追踪。
- 双人来源的历史记录保存、云端同步与画廊归档。
- 风格库入口，便于复用常用画风和组合。

### 3. NovelAI 工作流

NovelAI 工作流通过后端代理调用 NovelAI 服务，避免在前端暴露服务端密钥，并保留 NovelAI 特有参数。

主要能力：

- NovelAI 模型、采样器、尺寸、步数、CFG、seed 等参数配置。
- UC Preset、负面提示词、NAI v4 角色提示词相关参数。
- Vibe Transfer / 参考图相关参数透传。
- 服务端队列控制，降低并发请求冲突。
- 生成日志记录，支持数据分析统计。
- 本地历史过期清理、云端历史合并去重。

### 4. 图生视频工作流

图生视频工作流用于从图片生成视频，并支持首尾帧模式，适合角色动效、镜头运动和短视频生成。

主要能力：

- 上传首帧图片作为视频生成输入。
- 可选首尾帧模式，上传末帧控制视频结尾。
- 视频 LoRA 列表加载与参数配置。
- 任务提交防重复、轮询恢复、后台切换恢复。
- 队列等待时间和任务耗时记录。
- 视频历史记录、云端同步和播放状态管理。

### 5. 画廊、收藏与历史系统

项目将不同生成来源统一接入历史与画廊系统，方便长期管理生成结果。

主要能力：

- 按来源区分 `standard`、`duo`、`novelai`、`video` 等记录。
- 上传生成图片到画廊，并自动生成缩略图。
- 收藏页面集中管理精选作品。
- 本地历史与服务端历史同步，减少换设备或清缓存后的数据丢失。
- 支持图片、视频、prompt、metadata 等信息保存。

### 6. 数据分析工作流

数据分析看板用于查看生成行为和任务质量，帮助判断模型、参数和服务状态。

主要能力：

- 记录不同来源的生成日志。
- 统计生成数量、成功/失败状态、耗时、队列等待等指标。
- 支持按模型、工作流、尺寸、采样器等信息做后续分析。

## 技术栈

- 前端：React 19、TypeScript、Vite、Tailwind CSS、React Router、Recharts
- 后端：Node.js、Express、SQLite、Session、Multer、Sharp
- 生成服务：ComfyUI、NovelAI
- 辅助 AI 服务：Gemini、SiliconFlow

## 目录结构

```text
.
├── App.tsx                      # 标准文生图工作流
├── DuoApp.tsx                   # 双人图像工作流
├── NovelAIApp.tsx               # NovelAI 工作流
├── VideoApp.tsx                 # 图生视频工作流
├── components/                  # 通用组件与各工作流组件
├── contexts/                    # 登录与语言上下文
├── locales/                     # 中英文文案
├── pages/                       # 画廊、收藏、登录、数据分析页面
├── public/                      # 静态资源与公开数据
├── server/                      # Express API、数据库、上传、队列与服务端脚本
├── services/                    # 前端 API / ComfyUI / NovelAI / 视频服务封装
├── workflows/                   # ComfyUI API 与前端参考工作流
├── src/                         # 全局样式与 Vite 类型声明
├── types.ts                     # 共享类型定义
├── constants.ts                 # 默认配置与常量
├── package.json                 # 前端依赖与脚本
└── server/package.json          # 后端依赖与脚本
```

## 本地运行

### 环境要求

- Node.js 20+ 推荐
- npm
- 可访问的 ComfyUI / NovelAI 服务（按需配置）

### 安装依赖

```bash
npm install
cd server && npm install
```

### 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env.local
```

按需填写 `.env.local` 或 `.env.server`：

```env
VITE_COMFY_URL=http://localhost:8188
VITE_COMFY_URL_STANDARD=http://localhost:8189
SESSION_SECRET=change-me
NOVELAI_API_KEY=your_novelai_key
SILICONFLOW_API_KEY=your_siliconflow_key
GEMINI_API_KEY=your_gemini_key
```

### 启动开发服务

前端开发服务：

```bash
npm run dev
```

后端服务：

```bash
npm start
```

也可以进入后端目录单独启动：

```bash
cd server
npm start
```

### 构建生产包

```bash
npm run build
```

构建产物输出到 `dist/`。

## 后端能力

后端主要承担以下职责：

- 用户登录、Session 与权限控制。
- ComfyUI 代理与跨域处理。
- NovelAI 服务端调用与队列保护。
- 图片上传、缩略图生成、静态文件访问。
- SQLite 数据库读写，包括用户、历史、画廊、收藏、生成日志等。
- 任务状态接口与清理服务。

## 配置说明

常用环境变量：

| 变量                         | 说明                                      |
| ---------------------------- | ----------------------------------------- |
| `VITE_COMFY_URL`             | 默认 ComfyUI 服务地址                     |
| `VITE_COMFY_URL_STANDARD`    | 标准/双人/视频等工作流使用的 ComfyUI 地址 |
| `SESSION_SECRET`             | Express Session 加密密钥                  |
| `NOVELAI_API_KEY`            | NovelAI 服务端 API Key                    |
| `SILICONFLOW_API_KEY`        | AI 助手接口使用的 API Key                 |
| `GEMINI_API_KEY` / `API_KEY` | Gemini 相关能力使用的 API Key             |
| `PORT`                       | 后端监听端口，默认 `3001`                 |

## 适用场景

- 动画风格图像生成工作台。
- 多工作流 ComfyUI 前端控制台。
- NovelAI 私有代理与参数管理界面。
- 图生视频 / 首尾帧视频生成实验台。
- 个人作品画廊、收藏夹和生成数据分析系统。

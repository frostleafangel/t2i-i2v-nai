# ComfyUI Workflows

这里保存项目相关的 ComfyUI 参考工作流，方便在 ComfyUI 后台直接导入、对照或调试。

## 目录说明

```text
workflows/
├── api/       # ComfyUI API 格式，适合程序提交到 /prompt
├── comfyui/   # ComfyUI 前端工作流格式，适合在 ComfyUI 页面 Load/导入查看
└── i2v/       # 图生视频扩展参考工作流，包括首尾帧、保存尾帧、插帧超分
```

## 文件说明

### api/

- `newbie.api.json`：NewBie 基础 API 工作流。
- `standard-t2i-upscale.api.json`：标准文生图 + 放大 API 工作流。
- `duo.api.json`：双人图像 API 工作流。
- `video-i2v.api.json`：图生视频 API 工作流。
- `image-upscale.api.json`：加载图像放大 API 工作流。

### comfyui/

- `newbie.workflow.json`：NewBie 基础 ComfyUI 前端工作流。
- `standard-t2i-upscale.workflow.json`：标准文生图 + 放大 ComfyUI 前端工作流。
- `duo.workflow.json`：双人图像 ComfyUI 前端工作流。
- `video-i2v.workflow.json`：图生视频 ComfyUI 前端工作流。
- `image-upscale.workflow.json`：加载图像放大 ComfyUI 前端工作流。

### i2v/

- `first-last-frame.api.json` / `first-last-frame.workflow.json`：首尾帧图生视频工作流。
- `save-last-frame.api.json` / `save-last-frame.workflow.json`：保存尾帧工作流。
- `interpolate-upscale.api.json` / `interpolate-upscale.workflow.json`：插帧超分工作流。

## 使用说明

- `.api.json` 文件是 ComfyUI API prompt 格式，适合开发时与 `services/*ComfyService.ts` 中动态拼装的 workflow 对照。
- `.workflow.json` 文件是 ComfyUI 前端导出的工作流格式，适合在 ComfyUI 页面中导入查看节点布局。
- 项目运行时主要使用代码内的模板与动态参数注入；本目录保存的是可复现和可检查的参考工作流本体。

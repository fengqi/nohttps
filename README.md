# NoHTTPS Redirector (Chrome MV3)

一个 Chrome Manifest V3 扩展：将你配置的 `https://` 主导航请求自动重定向到 `http://`。

## 功能

- 仅处理主导航请求（`main_frame`）。
- 支持多条重定向配置。
- 支持通配符域名（如 `*.example.com`）。
- 支持忽略列表（精确域名和通配符都支持）。
- 冲突时忽略优先：同一请求命中重定向和忽略时，最终不重定向。
- 保留路径、查询参数、锚点和端口，仅改写 scheme 为 `http`。

## 配置入口

点击扩展图标打开 popup，包含两块配置：

- `Redirect Domains`：需要从 HTTPS 降级到 HTTP 的域名/模式
- `Ignore Domains`：需要排除的域名/模式（优先级高于重定向）

输入规则：

- 每行一条
- 支持域名或 URL（会自动提取 host）
- 支持 `*.example.com` 通配符
- 自动转小写、去重、过滤非法输入

## 示例

`Redirect Domains`:

```text
example.com
*.fengqi.io
```

`Ignore Domains`:

```text
www.fengqi.io
api.fengqi.io
```

以上配置表示：

- `https://speedtest.fengqi.io/...` 会被改写为 `http://speedtest.fengqi.io/...`
- `https://www.fengqi.io/...` 不会被改写（被忽略规则命中）

## 本地开发与加载

1. 克隆仓库后打开目录。
2. 在 Chrome 访问 `chrome://extensions`。
3. 打开「开发者模式」。
4. 点击「加载已解压的扩展程序」，选择本项目目录。

## 测试

```bash
npm test
```

## 限制说明

- 某些站点启用 HSTS 时，浏览器可能强制 HTTPS，无法降级到 HTTP（属于预期限制）。
- 建议把这类站点加入忽略列表。

## License

本项目使用 GNU General Public License v3.0，见 [LICENSE](./LICENSE)。

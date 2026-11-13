# 部署说明

## 1. 准备 PostgreSQL

本项目不携带 PostgreSQL 运行时。请安装 PostgreSQL 16/17，然后在超级用户下执行：

```sql
\i deploy/init-db.sql
```

或手动创建：

```sql
CREATE USER xiangmu WITH PASSWORD 'xiangmu_dev';
CREATE DATABASE xiangmu OWNER xiangmu;
```

默认连接参数：

- URL：`jdbc:postgresql://127.0.0.1:5432/xiangmu`
- 用户：`xiangmu`
- 密码：`xiangmu_dev`

首次启动会自动建表并导入 `server/src/main/resources/seed.json` 演示数据。数据库已有数据时不会重复导入。

## 2. 构建与启动

需要 JDK 21 和 Maven 3.9+。

```powershell
cd D:\xiangmuuuu\server
mvn clean package
cd ..
.\start-server.ps1
```

也可以直接运行：

```powershell
java -jar server\target\zhixue-server-2.0.0.jar
```

默认地址：<http://127.0.0.1:8080>

可用环境变量覆盖：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `SERVER_PORT` | `8080` | 服务端口 |
| `DB_URL` | `jdbc:postgresql://127.0.0.1:5432/xiangmu` | PostgreSQL JDBC URL |
| `DB_USER` | `xiangmu` | 数据库用户 |
| `DB_PASSWORD` | `xiangmu_dev` | 数据库密码 |
| `DEMO_RESET_ENABLED` | `false` | 设为 `true` 后才允许课程负责人调用 `/api/demo/reset` |
| `AI_ENABLED` | `false` | 兼容旧版的环境变量兜底开关；日常使用「模型设置」页面切换 |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | 首次启动时默认供应商的接口地址 |
| `AI_API_KEY` | 空 | 首次启动时默认供应商的 API Key，也可在页面填写 |
| `AI_MODEL` | `deepseek-chat` | 首次启动时默认供应商的模型 ID |

## 3. 演示账号

| 角色 | 账号 | 密码 | 入口 |
| --- | --- | --- | --- |
| 课程负责人 | `admin` | `123456` | 课程、知识点、题库、教师、教学班、统计、审计 |
| 教师 | `zhaolin` | `123456` | 软件24201（40 人）、软件67（5 名测试学生）；多教学班切换、组卷发布、统计、报告 |
| 学生 | `20260001` | `123456` | 袁仕郡，参加 p1 测评、查看结果与诊断 |

全部 40 名种子学生都可以用学号登录，初始密码均为 `123456`。

## 4. Nginx

参考 `deploy/nginx.conf`。修改 `root` 为项目目录，确认 `proxy_pass` 指向 Spring Boot 的 8080 端口。Nginx 与 Spring Boot 同源时 Session Cookie 可直接复用。

如果使用 HTTPS，请在 Nginx 上配置证书并确保 Cookie 的 `SameSite=Lax` 不会阻断同站请求。生产环境应将 `application.yml` 中的 `ddl-auto=update` 改为 `validate` 并引入 Flyway/Liquibase 迁移，同时恢复 CSRF 防护。

## 5. 云端 AI 与模型切换

未配置模型时，学生报告使用完全本地的规则诊断，仍然可用。课程负责人登录后，在「系统 → 模型设置」中新增 OpenAI 兼容供应商，填写接口地址、模型 ID 和 API Key，测试连接后点击「启用」即可切换；无需重启服务。

可保存多套供应商配置，在 DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、Ollama 等模型之间切换，也可随时编辑或删除。API Key 只保存在服务端，页面仅显示末四位。首次启动可从环境变量生成默认供应商：

```powershell
$env:AI_API_KEY = "你的 Key"
$env:AI_BASE_URL = "https://api.deepseek.com/v1"
$env:AI_MODEL = "deepseek-chat"
.\start-server.ps1
```

学生报告页会出现「云端 AI 解读」按钮；服务端组装分数、知识点、错题事实后调用当前模型。分数与正确率仍由服务端规则计算，不交给模型。

## 6. CSV 批量导入

课程负责人可在题库/知识点/教师页面导入，教师可在学生页面导入。仅支持 UTF-8 编码的 CSV；Excel 请先“另存为 CSV UTF-8”。模板由页面按钮直接下载，导入前会先做服务端预检，再确认入库。

## 7. 重置演示数据

只有设置 `DEMO_RESET_ENABLED=true` 并重启后，课程负责人才能调用：

```powershell
POST /api/demo/reset
```

它会清空业务表并重新导入种子，适合演示前恢复初始状态。生产环境请保持关闭。

## 8. 交付包说明

交付 ZIP 不包含：

- PostgreSQL 运行时目录；
- `.local` 本地数据、日志和测试脚本；
- 数据库物理文件。

数据库需要按本文档单独安装和初始化。

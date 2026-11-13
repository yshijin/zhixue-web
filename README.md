# 课程知识点智能测评与学习诊断智能体

V2.0 多用户服务端版。保留原静态 SPA 的中文界面与三角色流程，后端改为 Spring Boot + PostgreSQL，支持真实账号、共享数据库、服务端计时/判分、并发提交和角色权限隔离。

## 1. 技术栈

- JDK 21
- Spring Boot 3.4.5
- Spring Security（服务端 Session + BCrypt）
- Spring Data JPA + PostgreSQL 16/17
- 原生 HTML / CSS / JavaScript SPA
- Nginx（可选，用于静态资源与反向代理）
- 云端 AI（可选，OpenAI-compatible 接口，默认关闭）

不使用 Node.js、Docker、本地大模型或 H2 作为多人运行方案。

## 2. 快速启动

### 2.1 准备 PostgreSQL

安装 PostgreSQL 后，用超级用户执行：

```sql
CREATE USER xiangmu WITH PASSWORD 'xiangmu_dev';
CREATE DATABASE xiangmu OWNER xiangmu;
```

也可以在 `psql` 中执行 `deploy/init-db.sql`。

默认连接：

- `jdbc:postgresql://127.0.0.1:5432/xiangmu`
- 用户：`xiangmu`
- 密码：`xiangmu_dev`

首次启动会自动建表并导入 `server/src/main/resources/seed.json`。数据库已有数据时不会重复导入。

### 2.2 构建

```powershell
cd D:\xiangmuuuu\server
mvn clean package
cd ..
```

### 2.3 启动

```powershell
.\start-server.ps1
```

或者：

```powershell
java -jar server\target\zhixue-server-2.0.0.jar
```

访问 <http://127.0.0.1:8080>。

如需修改数据库或端口，使用环境变量：

```powershell
$env:DB_URL = "jdbc:postgresql://127.0.0.1:5432/xiangmu"
$env:DB_USER = "xiangmu"
$env:DB_PASSWORD = "xiangmu_dev"
$env:SERVER_PORT = "8080"
.\start-server.ps1
```

## 3. 演示账号

| 角色 | 账号 | 密码 | 说明 |
| --- | --- | --- | --- |
| 课程负责人 | `admin` | `123456` | 课程、知识点、题库、教师、教学班、统计、审计 |
| 教师 | `zhaolin` | `123456` | 软件24201，组卷、发布、学生、统计、报告 |
| 学生 | `20260001` | `123456` | 袁仕郡，参加 p1 测评、查看结果与诊断 |

全部 40 名种子学生都可以使用学号登录，初始密码均为 `123456`。首次演示时 p1 为进行中，37/40 人已提交，袁仕郡尚未作答。

## 4. 已实现功能

### 课程负责人

- 课程、知识点、题库、教师与教学班总览
- 新增知识点、题目、教师、课程
- 为现有教师批量添加多个教学班，查看教师与教学班的全部对应关系
- 教师密码重置与审计记录
- 课程统计、教学班横向对比、试卷中心
- CSV 导出
- CSV 批量导入知识点、题库、教师、学生
- 可选演示数据重置接口

### 教师

- 可负责多个教学班，登录后在顶部切换「全部班级 / 具体教学班」
- 登录后只看到本人负责的教学班、学生与试卷
- 仪表盘、学生、组卷、试卷、进度、统计、报告、导出均按当前教学班范围过滤
- 向本人教学班添加学生、批量导入学生；教师导入默认目标为当前教学班，也可按文件中的教学班，成功后自动切换并定位到新增学生页
- 学生列表显示所属教学班；当前教学班无学生但其他班有学生时，可一键切换到「全部班级」查看
- 按知识点智能组卷、预览、发布、结束试卷
- 测试进度、班级统计、学生报告、CSV 导出
- 教师不能操作其他教学班或其他教师的试卷

### 学生

- 学号登录，只能看到本教学班的试卷
- 开始考试、逐题作答、自动保存到服务器
- 服务端时间校准、超时自动交卷、服务端判分
- 结果页、知识点诊断、错题复盘、历史记录
- 个人错题本：汇总历次已提交作答中的错题，支持按来源测试/知识点筛选、勾选生成仅本人可见的错题测试
- 手机浏览器自动使用学生移动端（顶栏、底部导航、卡片式测试与历史、移动作答与报告），电脑浏览器保持桌面端；错题本同时适配桌面与手机布局
- 答案展示策略：提交后展示 / 截止后展示 / 不展示
- 可选云端 AI 学习解读（需配置 API Key）

## 5. 服务端设计

- 登录成功后使用 HttpSession 保存认证上下文，密码使用 BCrypt 哈希。
- `/api/bootstrap` 一次返回当前角色可见的数据；前端不再把业务数据保存在 `localStorage`。
- 试卷发布后保存题目、选项、答案、知识点快照。
- 开始考试使用数据库唯一约束（试卷 + 学生）避免重复作答；单实例下 `start()` 同步，提交使用 `PESSIMISTIC_WRITE` 行锁。
- 交卷时由服务器根据试卷快照和标准答案判分，客户端提交的分数不会被信任。
- 考试时间以服务器 `startedAt` 为准；客户端使用 `serverTime` 校正本地时钟，超时由服务端再次兜底。
- 学生端未到开放时间时不会下发题目内容；答案和解析根据 `answerPolicy` 脱敏。
- 错题本从已提交 `attempt` 和试卷快照实时汇总，不重复保存题目正文；个人错题测试复用试卷/作答流程，通过 `paper.owner_student_id` 标记归属，只对本人可见和可作答。
- 一个教师通过多条 `ClassGroup.teacherId` 关联多个教学班，不新增关联表；教师端仅用 `localStorage` 保存当前教学班选择，不保存业务数据。
- 为现有教师添加教学班时，服务端先校验整批名称；任一名称重复或非法则整批不写入，课程负责人可在教师列表和教学班总览看到全部对应关系。
- 关键操作写入审计日志；个人错题测试的生成、作答、删除不写审计日志，避免改变教师/负责人现有审计内容。

## 6. 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 账号密码登录 |
| GET | `/api/auth/me` | 当前会话 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/bootstrap` | 按角色加载工作台数据 |
| POST | `/api/attempts/start` | 开始考试/恢复未完成考试 |
| PUT | `/api/attempts/{id}/answers` | 自动保存答案 |
| POST | `/api/attempts/{id}/submit` | 交卷并判分 |
| POST | `/api/wrongbook/tests` | 学生用选中错题生成个人错题测试 |
| DELETE | `/api/wrongbook/tests/{id}` | 学生删除本人的错题测试 |
| POST | `/api/papers` | 教师/负责人发布试卷 |
| POST | `/api/papers/{id}/end` | 结束试卷 |
| POST | `/api/students` | 添加学生 |
| POST | `/api/teachers/{id}/classes` | 为现有教师批量添加教学班；任一名称重复/非法则整批不写入 |
| POST | `/api/import/{kind}` | CSV 预检/导入：`student`、`teacher`、`kp`、`question` |
| GET | `/api/ai/status` | 当前 AI 模型配置状态 |
| POST | `/api/ai/diagnose` | 云端 AI 学习解读 |
| GET | `/api/ai/providers` | 课程负责人查看模型供应商 |
| POST | `/api/ai/providers` | 新增模型供应商 |
| PUT | `/api/ai/providers/{id}` | 修改供应商配置 |
| POST | `/api/ai/providers/{id}/activate` | 切换当前模型 |
| POST | `/api/ai/providers/{id}/test` | 测试供应商连接 |
| DELETE | `/api/ai/providers/{id}` | 删除供应商 |
| GET | `/api/health` | 健康检查 |
| POST | `/api/demo/reset` | 重置演示数据（需显式开启） |

## 7. 云端 AI 与模型切换

默认使用本地规则诊断，不影响测评与报告。课程负责人登录后，在「系统 → 模型设置」中配置 OpenAI 兼容供应商，可保存多套配置并随时切换当前模型，无需重启服务。

支持 DeepSeek、OpenAI、通义千问、Kimi、智谱 GLM、Ollama 等兼容 `/chat/completions` 的接口。可填写供应商名称、接口地址、模型 ID 和 API Key，并测试连接；API Key 只保存在服务端，页面仅显示末四位。

首次启动时，系统会按环境变量创建默认供应商，之后以页面配置为准：

```powershell
$env:AI_BASE_URL = "https://api.deepseek.com/v1"
$env:AI_MODEL = "deepseek-chat"
$env:AI_API_KEY = "你的 API Key"
.\start-server.ps1
```

服务端只把分数、知识点、错题事实发送给当前模型；分数与正确率始终由服务端规则计算。

## 8. CSV 批量导入

仅支持 UTF-8 编码的 CSV。Excel 文件请先“另存为 CSV UTF-8”。页面提供模板下载，先在服务端预检，再确认入库。

- 学生：学号 / 姓名 / 教学班 / 专业 / 行政班
- 教师：教师工号 / 教师姓名 / 教学班名称 / 手机号 / 邮箱
- 知识点：知识点编号 / 知识点名称 / 显示顺序 / 知识点说明
- 题目：题目编号 / 题型 / 知识点编号 / 题干 / 选项 A-F / 标准答案 / 答案解析 / 难度

## 9. Nginx

参考 `deploy/nginx.conf`。可让 Nginx 托管静态文件，并把 `/api/` 反向代理到 `127.0.0.1:8080`。部署说明见 `deploy/README.md`。

## 10. 目录结构

```text
index.html                  登录页
app.html                    SPA 壳层
assets/css/style.css        视觉样式
assets/js/api.js            API 客户端与服务端时钟同步
assets/js/core.js           数据、路由、统计与诊断
assets/js/views-*.js        三角色页面
assets/js/actions.js        交互动作、自动刷新、导入
server/                     Spring Boot 后端
server/src/main/resources/seed.json  演示种子
deploy/                     Nginx、数据库初始化、部署说明
start-server.ps1            本地启动脚本
```

## 11. 当前已知限制

- 并发控制按单实例设计；多实例部署需要数据库级唯一约束与分布式锁/重试。
- 当前一份试卷每名学生只支持一次作答；`attemptsAllowed` 字段已保留，但多尝试流程尚未开放。
- 联调阶段使用 `ddl-auto=update` 且关闭 CSRF；正式部署应改为受控迁移（Flyway/Liquibase）并恢复 CSRF。
- 导出为浏览器端 CSV，不是服务端异步导出。
- 云端 AI 需要自备 API Key；未配置时自动使用本地规则诊断。
- 交付包不包含 PostgreSQL 运行时、数据库物理文件和 `.local` 本地数据。

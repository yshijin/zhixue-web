# 智学测评项目 · 一键启动器

这个文件夹里是一键启动脚本，不需要在 IDEA 里点运行，也不需要自己开 PowerShell 窗口。

## 桌面快捷方式

- `智学测评项目-一键启动.lnk`
  双击后会自动：
  1. 检查 PostgreSQL，没启动就启动；
  2. 检查 8080 端口和已有服务；
  3. 如果源码比 jar 新，自动用 Maven 重新打包；
  4. 在后台启动后端；
  5. 等待 `/api/health` 返回正常；
  6. 自动打开浏览器 `http://127.0.0.1:8080`。

- `智学测评项目-一键停止.lnk`
  双击后只停止智学测评后端，PostgreSQL 保持运行，避免影响其他数据。

## 日志

- 后端标准输出：`D:\xiangmuuuu\.local\server-launcher.out.log`
- 后端错误输出：`D:\xiangmuuuu\.local\server-launcher.err.log`
- PostgreSQL 日志：`D:\xiangmuuuu\.local\pg.log`
- 后端进程号：`D:\xiangmuuuu\.local\server.pid`

## 说明

- 第一次启动或源码更新后，脚本会调用 Maven 打包，可能多等几十秒。
- 以后没有改代码时，直接启动现有 jar，速度会快很多。
- 关闭启动窗口不会停止服务；要停止请用“一键停止”快捷方式。
- 如果 8080 被其他程序占用，启动器会提示，不会强行结束别的程序。
- 如果启动失败，窗口会停住并显示原因，按回车关闭。

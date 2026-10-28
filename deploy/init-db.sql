-- 在 PostgreSQL 超级用户（通常是 postgres）下执行一次。
-- 数据库名、用户名和密码可按需修改，并同步修改 start-server.ps1 / 环境变量。
CREATE USER xiangmu WITH PASSWORD 'xiangmu_dev';
CREATE DATABASE xiangmu OWNER xiangmu;

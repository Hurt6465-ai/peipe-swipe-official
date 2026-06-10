Peipe Partners 划卡模块

本文件夹为 nodebb-plugin-peipe-partners 添加一个全屏语言伙伴划卡页面。

文件结构

```text
plugin.json
package.json
library.js
swipe/
  index.js
  tags.js
  client.js
  style.scss
  static/vendor/README.md
templates/
  peipe-partners-swipe.tpl
languages/
  zh-CN/peipe-partners-swipe.json
  en-GB/peipe-partners-swipe.json
  my-MM/peipe-partners-swipe.json
  vi/peipe-partners-swipe.json
```

路由

```text
/partners/swipe
```

API

```text
GET /api/peipe-partners/swipe/feed?mode=recommend&limit=18
GET /api/peipe-partners/swipe/me
PUT /api/peipe-partners/swipe/me
GET /api/peipe-partners/swipe/tags
```

推荐流接口封装了已有的 partner.list(req) 结果，并为每个用户附加以下信息：

· displayName
· photos
· tags
· 伙伴资料字段

必填资料字段

首次访问划卡页面前需填写：

· 用户名 / 显示名称：peipe_partner_display_name
· 头像图片链接：peipe_partner_photo
· 国家：language_flag
· 母语：language_fluent
· 学习语言：language_learning
· 性别：gender
· 年龄：age
· 标签：peipe_partner_tags

Swiper 本地资源

请将 Swiper 文件放入：

```text
swipe/static/vendor/swiper-bundle.min.js
swipe/static/vendor/swiper-bundle.min.css
```

插件通过 staticDirs 对外提供，访问路径为：

```text
/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.js
/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.css
```

从 GitHub 安装

推送至 GitHub 后，在 NodeBB 所在服务器执行：

```bash
docker update --restart=no nodebb

if docker exec nodebb sh -lc '
set -e
cd /usr/src/app

if [ -f /opt/config/config.json ]; then
  CFG=/opt/config/config.json
elif [ -f /usr/src/app/config.json ]; then
  CFG=/usr/src/app/config.json
else
  echo "找不到 NodeBB config.json，停止执行，避免启动 web installer。"
  exit 1
fi

echo "使用配置文件: $CFG"

npm uninstall peipe-swipe-official || true
npm cache clean --force

npm install --legacy-peer-deps --force https://github.com/Hurt6465-ai/peipe-swipe-official/archive/refs/heads/main.tar.gz

./nodebb build --config="$CFG"
'; then
  docker restart nodebb
  docker update --restart=always nodebb
  docker logs --tail 120 -f nodebb
else
  echo "插件安装或 NodeBB build 失败，未重启 nodebb。"
  docker update --restart=always nodebb
fi
```

然后访问：

```text
/partners/swipe
```

通过 Docker 在线安装（GitHub 源）

如果你的 NodeBB 运行在 Docker 容器中，可按以下步骤安装：

1. 暂时关闭容器的自动重启策略：
   ```bash
   docker update --restart=no nodebb
   ```
2. 进入容器并在线安装插件（同时完成构建）：
   ```bash
   docker exec -it nodebb sh -lc 'cd /usr/src/app && npm install --legacy-peer-deps --force https://github.com/Hurt6465-ai/nodebb-plugin-peipe-partners/archive/refs/heads/main.tar.gz && ./nodebb build'
   ```
3. 重启容器使插件生效：
   ```bash
   docker restart nodebb
   ```
4. 恢复容器的自动重启策略：
   ```bash
   docker update --restart=always nodebb
   ```

完成后访问 /partners/swipe 即可使用。

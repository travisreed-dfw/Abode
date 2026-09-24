# Abode

A home page and short links for your network, on one tiny server, reachable from any device. The name on screen is whatever DNS name you give it; `a/` by default, for Abode.

Two things in one:

- **`http://a/`** is a personal home page: a search bar with a selectable engine and `!bang` shortcuts, plus bookmark buttons, personal or shared with the household. Each person on the network picks a username (no password) and gets their own.
- **`http://a/<name>`** is a short link. `http://a/aliases` is where you manage them.

```
http://a/gh                → https://github.com
http://a/gh/travisreed     → https://github.com/travisreed              (extra path is passed through)
http://a/yt/lofi           → https://www.youtube.com/results?search_query=lofi   (target contains %s)
http://a/q?q=hello         → https://duckduckgo.com/?q=hello            (query string is passed through)
http://a/nope              → http://a/aliases?new=nope                  (unknown alias: opens the manager with the add form prefilled)
```

Built with plain HTML, CSS and TypeScript. The only runtime dependency is [lowdb](https://github.com/typicode/lowdb), which stores everything in a single JSON file.

## The home page

Open `http://a/`. The first time, you'll see **Login or register**: type a username and press **Register** (or **Log in** if it already exists). There are no passwords; this is a family-network tool, and the "login" just remembers which profile the browser is using (a cookie that lasts a year). Registering a name someone already took tells you it's not available.

Once in:

- **Search bar.** The dropdown picks your default engine (Google, DuckDuckGo, Bing, Amazon, Wikipedia, YouTube, GitHub, Reddit, Google Maps, IMDb, Stack Overflow, npm); the choice is saved to your profile.
- **Bangs.** Put a `!bang` anywhere in the query to send it elsewhere: `!w cats`, `plex server !r`, `!a usb-c hub`. The built-in bangs are `!g !ddg !b !a !w !yt !gh !r !maps !imdb !so !npm`, and every alias is a bang too (`!book jackson`). Any other bang (DuckDuckGo supports thousands, like `!hn` or `!gm`) is sent to DuckDuckGo, which resolves it. Without a bang the query is an ordinary search on the dropdown engine; plain words never jump to an alias.
- **Built-in bangs are paths too.** `http://a/yt/kitty cats` searches YouTube exactly like `!yt kitty cats`, and `http://a/yt` opens YouTube. So `a/g/…`, `a/w/…`, `a/a/…` and the rest work from any device's address bar without creating aliases for them. The aliases page lists them.
- **Aliases in the search bar.** Every alias is also a bang: `!book jackson` or `jackson !book` becomes `a/book/jackson`, and `!book` alone opens it, so an alias whose target contains `%s` is a search shortcut of your own. Built-in bang names (`g`, `ddg`, `b`, `a`, `w`, `yt`, `gh`, `r`, `maps`, `imdb`, `so`, `npm`) can't be used as alias names, so the two never clash.
- **Bookmarks.** Press **Edit** to add buttons with a label and a URL. A URL can be a full address or a site path such as `/aliases` or `/plex`. Tick **Shared** to put a bookmark on every profile's page (anyone can edit shared ones); tick **Hidden** to take one off your own page without affecting others; use the arrows to set your own order. Bookmarks that point at the home network (private IPs, single-label names, or aliases to them) show a green or red status dot from a check the server runs every minute; internet sites are never pinged. Favicons are fetched once and cached in `data/icons/`; sites without a usable icon get a colored letter tile.
- **Themes.** The dropdown in the top bar picks a color theme for your profile; the tab favicon and the home-screen icon are drawn in the same colors. the default Midnight, Choose from the default Midnight or palettes inspired by Dracula, Monokai, One Dark, Solarized Dark and Light, Nord, Gruvbox, Tokyo Night, Catppuccin Mocha, GitHub Dark and Light, Night Owl, SynthWave '84, Pink Cat Boo and Doki Theme's Nekopara Chocola. Themes are a table of a dozen base colors each in `src/shared/themes.ts`; the stylesheet only ever uses variables, so adding one is adding a row.
- **Aliases** in the top bar opens the manager; **Log out** returns to the login screen.

There is a built-in help page at **`http://a/documentation`** covering all of this, with the full bang table generated from the code and a list of your own aliases as bangs.

### Calling it something other than `a`

The name is nothing more than the DNS record you create. Point `go`, `b` or `home` at the server instead and everything works the same. The pages read the host the browser used, so the brand mark, input prefixes, hints and documentation examples show `go/plex` and `http://go/yt/kittens` rather than `a/…`. Opening it by IP shows IP-based examples, which also work. Nothing on the server needs configuring.

## The alias manager (`/aliases`)

Lists every alias with an optional description, hit count and last-used time, has a filter box, inline edit and delete, and **Export** / **Import** buttons for backups. It needs no login.

It also lists every **profile** registered on the home page, with a Delete button for cleaning up names made in error. Deleting asks you to tick a confirmation box and type the username before the button enables, because it removes that profile's bookmarks too. There is no admin account: with no passwords, one would be a name anyone could type, so profile management is open like everything else on the page.

## Quick start

Two things have to be true: Abode must be reachable on **port 80** at a **fixed LAN IP**, and your network's DNS must resolve the name **`a`** (or whatever you pick) to that IP.

**Run it** with Docker (pulls a prebuilt image; about 75 MB):

```sh
git clone https://github.com/travisreed-dfw/abode.git && cd abode
docker compose up -d
```

or directly with Node.js 24+:

```sh
npm install && sudo npm start        # port 80 needs root on macOS/Linux; PORT=8080 npm start for dev
```

Then open `http://<host IP>/`, and make the name resolve: [docs/dns.md](docs/dns.md).

**Guides** for specific setups:

- [Ubuntu Docker host, optionally with Pi-hole](docs/ubuntu.md)
- [Windows 11 with Docker Desktop](docs/windows.md)
- [macOS or Linux, Docker or Node](docs/macos-linux.md)
- [Synology NAS](docs/synology.md)
- [Making `a` resolve: router, Pi-hole, AdGuard, Synology DNS, Netgear Orbi, hosts files](docs/dns.md)
- [Phones, tablets and browser tips](docs/mobile.md)

Everything Abode stores lives in `./data/`: the database, daily backups and the icon cache. Back up that folder.

## Configuration

Environment variables (all optional):

| Variable  | Default                          | Meaning                                                        |
|-----------|----------------------------------|----------------------------------------------------------------|
| `PORT`    | `80`                             | TCP port to listen on.                                          |
| `HOST`    | `0.0.0.0`                        | Interface to bind. Use `127.0.0.1` to allow local access only.  |
| `DB_PATH` | `<project>/data/db.json`         | Path of the lowdb JSON file. Cached favicons go in an `icons/` folder beside it. The Docker image sets `/data/db.json`. |

## Alias rules

- Names are lowercase; 1–64 characters of letters, numbers, `.`, `-`, `_`, starting with a letter or number. Lookups are case-insensitive (`a/GH` works). Pasting `a/foo` or `http://a/foo` into the name field is cleaned up to `foo`.
- `api`, `aliases`, `assets`, `documentation`, `favicon.ico` and `favicon.svg` are reserved, and so are the built-in search bang names listed above.
- Targets must be full `http://` or `https://` URLs. Descriptions are optional, up to 200 characters.
- **Path passthrough:** whatever follows the alias name is appended to the target's path, and any query string is appended too.
- **Search aliases:** if the target contains `%s`, the rest of the path is URL-encoded and substituted there instead. `https://www.google.com/search?q=%s` turns `a/g/red pandas` into a Google search.
- Every redirect increments the alias's hit count and last-used time, shown in the manager.
- Redirects use HTTP 302 so browsers never cache an alias that you later edit or delete.

## Profiles and bookmarks

- Usernames are lowercase; 1–32 characters of letters, numbers, `.`, `-`, `_`. Case doesn't matter when logging in.
- Bookmark labels are 1–40 characters. URLs are full `http(s)://` addresses or site paths starting with `/`. Each bookmark has an owner and a Shared flag; each profile keeps its own hidden list and order.
- Favicons are cached for 7 days; a site with no usable icon is retried after a day. Delete `data/icons/` to clear the cache.

## Backup and restore

The server writes a backup on startup and once a day into `data/backups/alias-backup-<date>.json`, keeping the last 30. **Export JSON** on the aliases page downloads the same file on demand, containing every alias, profile and bookmark. **Import JSON** reads one back: aliases and profiles that already exist are updated (aliases keep their live hit counts), new ones are added, nothing is deleted. Importing into an empty database restores hit counts from the file. Older backups that contain only aliases still import.

Everything, including profiles and bookmarks, lives in `data/db.json`, so copying the `data/` folder is a complete backup.

## HTTP API

The pages use this API; you can script it too.

| Method   | Path                   | Body                      | Result                     |
|----------|------------------------|---------------------------|----------------------------|
| `GET`    | `/api/aliases`         | –                         | `200` list of aliases      |
| `POST`   | `/api/aliases`         | `{"name","url","description"?}` | `201` created alias  |
| `GET`    | `/api/aliases/:name`   | –                         | `200` alias                |
| `PUT`    | `/api/aliases/:name`   | `{"name"?, "url"?, "description"?}` | `200` updated alias (rename allowed) |
| `DELETE` | `/api/aliases/:name`   | –                         | `204`                      |
| `GET`    | `/api/export`          | –                         | `200` JSON backup of aliases and profiles (download) |
| `POST`   | `/api/import`          | backup file, `{aliases}` and/or `{users}`, or `[{name,url,…}]` | `200` `{added, updated, users: {added, updated}}` |
| `GET`    | `/api/users`           | –                         | `200` profile summaries    |
| `DELETE` | `/api/users/:name`     | –                         | `204`                      |
| `POST`   | `/api/register`        | `{"username"}`            | `201` profile + cookie, `409` if taken |
| `POST`   | `/api/login`           | `{"username"}`            | `200` profile + cookie, `404` if unknown |
| `POST`   | `/api/logout`          | –                         | `204`, cookie cleared      |
| `GET`    | `/api/me`              | –                         | `200` current profile, `401` if not logged in |
| `PUT`    | `/api/me`              | `{"searchEngine"?, "theme"?}` | `200` updated profile |
| `GET`    | `/api/bookmarks`       | –                         | `200` bookmarks the profile can see, with hidden flag and status |
| `PUT`    | `/api/bookmarks`       | `{"bookmarks":[{id?,label,url,shared}], "remove":[ids], "hidden":[ids], "order":[ids]}` | `200` updated list; nothing is deleted by omission |
| `GET`    | `/api/icon?url=`       | –                         | `200` cached favicon for that site's origin, `404` if none |
| `GET`    | `/api/health`          | –                         | `200` `{ok, aliases, users, uptimeSeconds}` |
| `GET`    | `/:name[/path][?query]`| –                         | `302` to the target        |

`POST` and `PUT` bodies must be sent with `content-type: application/json`; anything else gets `415`. That requirement is what stops a malicious web page from creating aliases or changing your bookmarks through your browser with a hidden form (CSRF), since cross-site forms can't send JSON.

Errors come back as `{"error": "..."}` with status `400` (invalid), `401` (not logged in), `404` (missing), `405` (bad method), `409` (duplicate), `413` (body too large) or `415` (not JSON).

```sh
curl -X POST -H 'content-type: application/json' \
     -d '{"name":"gh","url":"https://github.com"}' http://a/api/aliases

curl -X POST -H 'content-type: application/json' -c cookies.txt \
     -d '{"username":"travis"}' http://a/api/register

curl -X PUT -H 'content-type: application/json' -b cookies.txt \
     -d '{"bookmarks":[{"label":"GitHub","url":"https://github.com"}]}' http://a/api/me

curl -o backup.json http://a/api/export
curl -X POST -H 'content-type: application/json' --data-binary @backup.json http://a/api/import
```

The server logs one line per redirect and API call (timestamp, client IP, method, path, status, redirect target) to stdout; see it with `docker compose logs -f`. Static assets and icon lookups are not logged.

## Development

```sh
npm run typecheck   # type-check server, shared code and tests
npm test            # unit tests (Node's built-in runner, no extra packages)
npm run build       # compile the browser code into public/assets/
```

The Docker build runs `npm run typecheck` and `npm test` in its first stage, so a failing test fails the build. The image includes a `HEALTHCHECK` that probes `/api/health`, so `docker ps` shows the container as healthy or unhealthy.

The Docker image is a two-stage build: the official Node image type-checks, runs the tests and compiles the browser code, then only the server, static files and lowdb are copied onto plain Alpine with Alpine's own Node package. CI runs the same checks on every push, and tagging a commit `v1.2.3` publishes a multi-arch image to `ghcr.io/travisreed-dfw/abode`.

## Icons

UI icons are a small SVG sprite at `public/assets/icons.svg`, vendored from [Remix Icon](https://remixicon.com) (Remix Icon License v1.0) and served with everything else, so no icon font or CDN is loaded. To add one, put its name in `scripts/vendor-icons.mjs` and run:

```sh
npm pack remixicon --pack-destination /tmp && tar -xzf /tmp/remixicon-*.tgz -C /tmp
node scripts/vendor-icons.mjs /tmp/package
```

## Project layout

The server and the browser code are both built from small classes with explicit dependencies; nothing reads the environment or the network at import time, which is what makes each piece testable on its own.

```
src/shared/types.ts          data shapes used by server, browser and tests
src/shared/search.ts         engines, bangs and the search resolver
src/shared/themes.ts         color themes and the CSS variables they set

src/server/main.ts           entry: load config, create App, listen, handle signals
src/server/config.ts         Config from environment variables
src/server/app.ts            App: wires store, repositories, router, static files; error mapping; access log
src/server/http.ts           Context (request/response helpers, JSON body with CSRF check) and HttpError
src/server/router.ts         Router: method + path matching with :params, 405 with Allow
src/server/store.ts          Store: the lowdb file plus migrations
src/server/validation.ts     name / URL / description / username / bookmark rules, reserved names
src/server/aliases.ts        AliasRepository: CRUD, hit counts, import
src/server/users.ts          UserRepository: register, login, profile updates
src/server/bookmarks.ts      BookmarkRepository: shared/personal bookmarks, per-profile hidden + order
src/server/status.ts         StatusMonitor: pings home-network URLs for the status dots
src/server/backups.ts        BackupScheduler: daily backup files in data/backups/
src/server/session.ts        CookieSession: the profile cookie
src/server/icons.ts          IconCache: favicon fetch + disk cache (fetch and clock injectable)
src/server/static.ts         StaticFiles: page allowlist and safe /assets/ serving
src/server/redirect.ts       pure helpers: path splitting and %s / suffix handling
src/server/routes/           one module per API area: aliases, profiles, bookmarks, icons, health, redirects, appicon

src/client/lib/api.ts        ApiClient: typed calls to the JSON API
src/client/lib/dom.ts        $, el, setMessage, errorText
src/client/lib/format.ts     relativeTime, hueFor
src/client/lib/site.ts       host-aware names and example rewriting
src/client/lib/theme.ts      apply / cache / clear a theme on the page
src/client/components/       LoginView, SearchBar, BookmarkGrid, BookmarkEditor,
                             AliasForm, AliasList, ImportExport, renderBuiltins
src/client/home.ts           HomePage: composes login + search + bookmarks
src/client/aliases.ts        AliasesPage: composes form + list + import/export
src/client/documentation.ts  DocsPage: fills the generated tables

public/index.html            home page shell
public/aliases.html          alias manager shell
public/documentation.html    in-app help page
public/assets/               style.css, icons.svg plus compiled JS (client/, shared/)
scripts/vendor-icons.mjs     rebuilds icons.svg from the Remix Icon package
src/server/appicon.ts        the door-ajar mark: favicon, app icons and manifest rendered per theme
test/                        unit tests: search, redirect, aliases + store, users, router + cookies, static paths, icon cache
Dockerfile, docker-compose.yml, .env.example
```

## Credits

- **[Remix Icon](https://remixicon.com)** by Remix Design provides the UI icons, used as interface elements under the [Remix Icon License v1.0](https://github.com/Remix-Design/RemixIcon/blob/master/License), which permits this use and asks only that the icons not be sold as a set or used as a brand mark. Abode's own door icon is an original drawing, not a Remix icon. The icons are vendored into `public/assets/icons.svg`; the file header carries the notice.
- **[lowdb](https://github.com/typicode/lowdb)** by typicode, MIT License, stores the data.
- Abode started life as `a/`, an alias redirector. The `a` stuck, and now it's the first letter of the name.
- The color themes are original palettes inspired by the editor themes they are named after: Dracula, Monokai, One Dark, Solarized, Nord, Gruvbox, Tokyo Night, Catppuccin, GitHub, Night Owl, [SynthWave '84](https://github.com/robb0wen/synthwave-vscode) by Robb Owen, [Pink Cat Boo](https://github.com/ftsamoyed/PinkCatBoo) by ftsamoyed, and [Doki Theme](https://github.com/doki-theme/doki-theme-vscode) (Nekopara Chocola) by Unthrottled.

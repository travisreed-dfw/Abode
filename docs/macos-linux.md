[← Back to README](../README.md)

# macOS or Linux

Two ways to run Abode on a Mac or a Linux machine. Docker is the easier one to keep running; Node directly is handy for development.

## With Docker

```sh
docker compose up -d
```

- Serves on port 80 of the host. If port 80 is already taken, copy `.env.example` to `.env` and set `HOST_PORT=8080`.
- Data lives in `./data/` on the host (mounted into the container at `/data`), so it survives rebuilds and restarts.
- Restarts automatically with Docker (`restart: unless-stopped`).
- Data lives in `./data/`: the database, daily backups and the icon cache.

```sh
docker compose logs -f          # watch the server log
docker compose stop             # stop
docker compose pull && docker compose up -d   # update to the latest release
docker compose up -d --build    # build from source instead
```

## With Node.js

Requires Node.js 24+ (`nvm install 24 && nvm use`; the repo has a `.nvmrc`). Node 24 runs the TypeScript server directly with no build step; TypeScript itself is only used to compile the browser code.

```sh
npm install
sudo npm start                  # port 80 needs root on macOS/Linux
```

For development, or if you'd rather not use root: `PORT=8080 npm start`, then open `http://localhost:8080/`.

`npm start` compiles the browser code into `public/assets/` and then runs `node src/server/main.ts`. To keep it running after logout, wrap it in a `launchd` agent (macOS) or `systemd` unit (Linux), or use Docker.

Then make the name resolve: see [Making `a` resolve](dns.md).

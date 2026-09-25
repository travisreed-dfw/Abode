[← Back to README](../README.md)

# Docker discovery

Abode can list your other containers as shared bookmarks automatically. Label a container, and it appears on everyone's home page with a status dot; remove the container and the bookmark goes. Nothing to type into Abode itself. This is opt-in and off until you mount the Docker socket.

## Turn it on

In `docker-compose.yml`, uncomment the socket line under `volumes`:

```yaml
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Or, to leave the tracked compose file untouched, put the mount in a `docker-compose.override.yml` next to it (Compose merges it automatically, and the repo ignores the file):

```yaml
services:
  abode:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
```

Then `docker compose up -d`. The startup log line ends with `docker discovery on` when it worked, and `/api/health` reports `"docker": true`.

## Label your containers

| Label | Required | Meaning |
|---|---|---|
| `abode.name` | yes | The button's label. Containers without it are ignored. |
| `abode.url` | no | Where the button goes. Defaults to the address the page was opened at plus the container's first published TCP port, so `http://a:8096` or `http://10.0.0.5:8096`. |
| `abode.group` | no | Section on the home page. |

Compose example:

```yaml
  jellyfin:
    image: jellyfin/jellyfin
    ports:
      - "8096:8096"
    labels:
      abode.name: Jellyfin
      abode.group: Media

  paperless:
    image: ghcr.io/paperless-ngx/paperless-ngx
    ports:
      - "8000:8000"
    labels:
      abode.name: Paperless
      abode.url: http://a/paperless      # e.g. via an alias, or a reverse-proxy address
      abode.group: Household
```

A container with neither `abode.url` nor a published port has nothing to link to and is skipped.

## How discovered bookmarks behave

- They show as **shared**, owned by "docker", for every profile. Each person can still **hide** them or **reorder** them like any other bookmark; those choices stay personal.
- They can't be edited or removed in Abode. The labels are the source of truth: change the label, restart the container, done.
- **Stopped containers stay listed with a red dot.** A red dot says "Plex is down"; a missing button says nothing. Only a container that no longer exists disappears. Note that `docker compose down` removes containers, so it removes their bookmarks until the stack is up again; `docker compose stop` keeps them, red.
- The dot reflects Docker's state (running or not), refreshed every 30 seconds. It doesn't ping the service, so a running container with a broken app still shows green; give it an `abode.url` that Abode can reach if you want an HTTP check as well.

## The socket, and why it deserves a paragraph

Mounting `/var/run/docker.sock` gives the Abode process the Docker Engine API. Even read-only, that API returns every container's full configuration, including environment variables, which often hold passwords and API keys. Abode only ever asks for the container list and only passes names, URLs and groups to the browser; nothing from the socket reaches a page. But the process itself could read more, so this is a trust decision about the software, the same one you make for Portainer, Homepage, Watchtower or any other tool that reads the socket.

If you'd rather not extend that trust, put a **socket proxy** in between and allow only the container-list call. Abode then talks to the proxy over TCP and never sees the socket:

```yaml
  docker-proxy:
    image: tecnativa/docker-socket-proxy
    environment:
      CONTAINERS: 1          # allow GET /containers/json
      POST: 0                # no writes of any kind
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    restart: unless-stopped

  abode:
    image: ghcr.io/travisreed-dfw/abode:latest
    environment:
      DOCKER_SOCKET: tcp://docker-proxy:2375
    # no socket mount on this service
    # ...ports, volumes as usual
```

The proxy runs with the socket; Abode runs with a `DOCKER_SOCKET` that names the proxy. Keep the proxy off any published port so only containers on the compose network can reach it.

Whichever you choose, a direct mount should be **read-only** (`:ro`). Abode never writes to Docker.

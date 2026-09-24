[← Back to README](../README.md)

# Synology NAS

DSM's own web server owns port 80, so the container publishes on 8080 and DSM's reverse proxy puts it on port 80 for the name `a`.

1. Clone the project to `/volume1/docker/abode` (or copy it there). Create a `.env` file next to `docker-compose.yml` containing `HOST_PORT=8080`.
2. Container Manager → **Project** → **Create**: name `abode`, path `/docker/abode`, *Use existing docker-compose.yml*. Start it; Container Manager pulls the release image. Check `http://<NAS IP>:8080/`. Data persists in `/volume1/docker/abode/data/`.
3. Control Panel → **Login Portal** → **Advanced** → **Reverse Proxy** → **Create**: Source HTTP, hostname `a`, port 80; Destination HTTP, `localhost`, port 8080.

For DNS, the NAS can also host the `a` record itself with the free DNS Server package: see [Synology DNS Server](dns.md#synology-dns-server).

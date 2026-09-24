[← Back to README](../README.md)

# Ubuntu Docker host (with optional Pi-hole)

A small always-on Linux box (a mini PC or an old laptop running Ubuntu Server) is a good home for Abode: Docker Engine starts at boot with nobody logged in. This page shows the plain setup, then an optional variant that runs Pi-hole on the same machine to provide the DNS for `a`. If you already have DNS sorted (a router with local records, an existing Pi-hole or AdGuard, a Synology), skip the Pi-hole parts and see [Making `a` resolve](dns.md).

If you add Pi-hole, two conflicts to know about up front:

- **Port 80.** Pi-hole's admin UI also defaults to port 80. Give this app port 80 (it's the one that needs the bare name) and publish Pi-hole's UI on another port.
- **Port 53.** Ubuntu's `systemd-resolved` runs a stub DNS listener on `127.0.0.53:53`. It only binds loopback, but Pi-hole's own docs recommend turning it off so nothing competes for port 53.

Steps:

1. **Install Ubuntu Server** (minimal, with OpenSSH). Give the machine a fixed IP, either with a DHCP reservation in the router or statically in netplan. Below, `<host IP>` is that address.
2. **Install Docker Engine** from Docker's apt repository (not Docker Desktop): follow [docs.docker.com/engine/install/ubuntu](https://docs.docker.com/engine/install/ubuntu/), then `sudo usermod -aG docker $USER` and log back in. Docker Engine is enabled at boot by default.
3. **(Pi-hole only) Free port 53 and pin the host's own resolver**, so the host can resolve names even while the Pi-hole container is down:
   ```sh
   sudo sed -i 's/^#\?DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf
   sudo sed -i 's/^#\?DNS=.*/DNS=1.1.1.2 1.0.0.2/' /etc/systemd/resolved.conf
   sudo ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf
   sudo systemctl restart systemd-resolved
   ```
4. **Run Abode**: `git clone https://github.com/travisreed-dfw/abode.git /opt/abode && cd /opt/abode && docker compose up -d`. That's the whole install if you don't need Pi-hole.

   **Optional: Pi-hole alongside.** Add a `pihole` service to the same compose file so both start with the machine:
   ```yaml
   services:
     abode:
       image: ghcr.io/travisreed-dfw/abode:latest
       build: .
       container_name: abode
       ports:
         - "80:80"
       volumes:
         - ./data:/data
       restart: unless-stopped

     pihole:
       image: pihole/pihole:latest
       container_name: pihole
       ports:
         - "53:53/tcp"
         - "53:53/udp"
         - "8080:80"          # Pi-hole admin UI at http://<host IP>:8080/admin
       environment:
         TZ: America/Chicago
         FTLCONF_webserver_api_password: "choose-a-password"
         # Cloudflare's malware-blocking resolvers (1.1.1.2 / 1.0.0.2). Pi-hole's
         # blocklists and Cloudflare's malware filtering stack; use 1.1.1.1 / 1.0.0.1
         # for the unfiltered pair instead.
         FTLCONF_dns_upstreams: "1.1.1.2;1.0.0.2"
       volumes:
         - ./pihole:/etc/pihole
       restart: unless-stopped
   ```
   Then `docker compose up -d`. Both containers restart with the machine.
5. **(Pi-hole only) Add the local DNS record in Pi-hole**: open `http://<host IP>:8080/admin`, go to *Local DNS → DNS Records*, and add domain `a` → `<host IP>`. Test from another machine: `nslookup a <host IP>`.
6. **(Pi-hole only) Point the router at Pi-hole**: on a Netgear Orbi, Advanced → Setup → Internet Setup → Domain Name Server → *Use These DNS Servers* → Primary `<host IP>`, Secondary empty (see [Netgear Orbi](dns.md#netgear-orbi) for why). Devices pick it up when their DHCP lease renews.
7. Open `http://a/` from any device. Handy extra: create an alias `pihole` → `http://<host IP>:8080/admin` so `a/pihole` opens the Pi-hole dashboard.

Everything persists in `/opt/abode/data` (Abode: database, daily backups, icon cache) and `/opt/abode/pihole` (Pi-hole). Back up both folders.

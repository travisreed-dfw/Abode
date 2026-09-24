[← Back to README](../README.md)

# Making `http://a/` resolve

Abode serves `http://a/` (or whatever name you choose). The server can't create that name; your network's DNS has to point it at the machine running Abode. This page covers the common ways to do that.

Because `a` is a single-label name, mDNS/Bonjour (`.local`) cannot serve it. You need a DNS entry that every device on the network uses. Options, easiest first:

- **Router DNS.** Many routers let you add a local hostname or DNS record: add `a` → `<host IP>`. Names vary: "Local DNS", "DNS host entry", "Static host names". On UniFi it's *Settings → Routing → DNS*; on OPNsense *Unbound DNS → Overrides*. **Netgear Orbi has no such setting**; use one of the next options and then follow [Netgear Orbi](#netgear-orbi).
- **Synology DNS Server** (free package), if you have a NAS. See [Synology DNS Server](#synology-dns-server) below.
- **Pi-hole / AdGuard Home.** Add a *Local DNS record* (Pi-hole: *Local DNS → DNS Records*) or *DNS rewrite* (AdGuard) `a` → `<host IP>`. Pi-hole can run as a container next to this app; see [the Ubuntu guide](ubuntu.md).
- **Per-device fallback.** Add a hosts entry on each computer: `192.168.1.50   a` in `/etc/hosts` (macOS/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows, edit as admin). Phones and tablets can't do this, which is why network-level DNS is preferred.

Whichever you pick, give the host a DHCP reservation in the router first so its IP never changes.

### Synology DNS Server

Install **DNS Server** from Package Center, then:

1. **Zones** → **Create** → **Master zone**. Domain type *Forward zone*, Domain name `a`, Master DNS server `<NAS IP>`. Save.
2. Select the `a` zone → **Edit** → **Resource Record** → **Create** → **A Type**. Leave the name blank (that is the zone itself, `a`) and set the IP to the **host running the app** (the Windows PC, or the NAS itself if it hosts the app). Save.
3. **Resolution** tab → tick **Enable resolution services** and **Enable forwarders**, and enter upstream servers such as `1.1.1.2` and `1.0.0.2` (Cloudflare's malware-blocking pair) or `1.1.1.1` and `1.0.0.1`. The NAS must answer every other name too, because the whole network is about to use it.

Test from any machine: `nslookup a <NAS IP>` should return the host IP, and `nslookup github.com <NAS IP>` should still work.

### Netgear Orbi

Orbi can't host local DNS records, but it will hand out a DNS server of your choice to every device. In the Orbi web admin (`http://orbilogin.com`, not the phone app):

1. Advanced → Setup → **LAN Setup** → **Address Reservation**: reserve fixed IPs for the app host and for the DNS server (NAS, Pi-hole, etc.).
2. Advanced → Setup → **Internet Setup** → **Domain Name Server** → **Use These DNS Servers**: Primary = your DNS server's IP. Leave Secondary empty. If you set a secondary, some devices will prefer it and `a` will intermittently fail to resolve.

Devices pick up the new DNS server when their DHCP lease renews; toggling Wi-Fi off and on forces it.

### Check it

From another device on the network:

```sh
ping a                       # should answer from the host IP
curl -I http://a/            # should return HTTP 200
```

Then open `http://a/` in a browser.

See also: [Ubuntu with Pi-hole](ubuntu.md), [Synology](synology.md).

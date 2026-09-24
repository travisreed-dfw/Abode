[← Back to README](../README.md)

# Windows 11 with Docker Desktop

An always-on Windows PC (a media server, say) works well. Plex uses port 32400, so port 80 is normally free on such a box.

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). It uses the WSL 2 backend; the installer enables it if needed (a reboot may be required). Virtualization must be enabled in the BIOS/UEFI, which it is on most machines.
2. Get the project: `git clone https://github.com/travisreed-dfw/abode.git C:\abode`.
3. Confirm port 80 is free (no output means it is):
   ```powershell
   netstat -ano | findstr ":80 "
   ```
4. Build and start, from PowerShell in the project folder:
   ```powershell
   cd C:\abode
   docker compose up -d
   ```
   Windows Defender Firewall may ask whether to allow Docker Desktop; allow it on **Private networks**. Make sure the network connection is set to *Private* (Settings → Network & internet → your adapter), or Windows blocks inbound connections.
5. Test from another device: `http://<PC IP>/`. Find the IP with `ipconfig`.

Everything persists in `C:\abode\data\` (database, daily backups, cached icons). Update with `git pull` then `docker compose pull && docker compose up -d`; `docker compose logs -f` shows the server log.

**Keeping it running unattended.** The container restarts on its own (`restart: unless-stopped`) whenever Docker is running. Docker Desktop, however, only starts once a user signs in. So:

- In Docker Desktop, Settings → General → tick **Start Docker Desktop when you sign in to your computer**.
- Have the PC sign in automatically after a reboot. If Plex already survives reboots for you, this is likely set up; otherwise enable it in Settings → Accounts → Sign-in options, and consider locking the screen at login with a scheduled task if the machine is somewhere public.

Windows Update reboots will then bring everything back without intervention.

Then make the name resolve: see [Making `a` resolve](dns.md).

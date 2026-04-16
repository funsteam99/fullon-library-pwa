# Remote Install (Windows + Tailscale + SSH)

This runbook records the exact remote install method we used, including pitfalls.

## Target assumptions
- Target OS: Windows 10/11
- Remote access: Tailscale IP
- SSH server: OpenSSH Server on Windows
- App repo: `fullon-library-pwa` (monorepo: `frontend/`, `backend/`)

## 0) Pre-check on target machine
Open PowerShell as Administrator:

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
New-NetFirewallRule -Name sshd -DisplayName "OpenSSH Server (sshd)" -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
Get-Service sshd
netstat -ano | findstr :22
```

## 1) Validate login account (critical)
Windows SSH login uses real local account.

```powershell
whoami
net user
net user <account> <new_password>
ssh <account>@localhost
```

## 2) Ensure Tailscale online
```powershell
tailscale up
tailscale status
tailscale ip -4
```

## 3) Install runtime
```cmd
winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
where git
where node
where npm
```

## 4) Clone and install app
```cmd
cd %USERPROFILE%
if not exist fullon-library-pwa git clone https://github.com/funsteam99/fullon-library-pwa.git
cd fullon-library-pwa
cd frontend && npm install --no-audit --no-fund
cd ..\\backend && npm install --no-audit --no-fund
```

## 5) Build/start on 4GB host (recommended)
- Use production mode, avoid `next dev` and `tsx watch`.
- Set `NODE_OPTIONS=--max-old-space-size=768` for frontend process.
- Build once: `npm run build` in frontend and backend.
- Run frontend: `npm run start -- -p 3000`.
- Run backend: `node dist/server.js`.

## 6) Health checks
- `http://127.0.0.1:3000/mobile` should return 200.
- `http://127.0.0.1:4000/api/health` should return 200.

## 7) Pitfalls encountered
1. Wrong Windows SSH account (must use real account from `whoami`).
2. `sshd` running but credential still wrong, verify with `ssh <account>@localhost` first.
3. Tailscale IP unreachable after reboot/update, rerun `tailscale up` and re-check IP.
4. Remote browser launch via SSH may not appear on active desktop session.
5. Frontend failed with `npm ENOENT package.json` when started from wrong working directory.
6. `/mobile` can load while books/members fail if PostgreSQL is down (`ECONNREFUSED 5432`).

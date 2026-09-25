# AutoZap Enterprise - Deployment Guide (Hostinger)

## Prerequisites

1. **Hostinger VPS** with Node.js 18+ installed
2. **Domain** pointed to your VPS IP
3. **MySQL/MariaDB** (recommended) or SQLite for low traffic
4. **PM2** process manager (`npm install -g pm2`)
5. **Nginx** for reverse proxy (optional)

## Step 1: Server Setup (Hostinger VPS)

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install build tools
apt install -y git python3 make g++

# Install PM2
npm install -g pm2

# Install Nginx
apt install -y nginx certbot python3-certbot-nginx
```

## Step 2: Upload Code

```bash
# Via SCP (from local):
scp -r /path/to/autozap root@YOUR_VPS_IP:/var/www/autozap

# Or Git:
cd /var/www
git clone https://github.com/YOUR_USER/autozap.git
cd autozap
```

## Step 3: Configure Environment

```bash
cp .env.production .env
nano .env  # Fill in your actual values
```

**Critical `.env` values:**
- `JWT_SECRET` & `REFRESH_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DB_HOST/DB_USER/DB_PASS/DB_NAME`: Your MySQL credentials
- `BASE_URL`: `https://yourdomain.com`
- `CORS_ORIGIN`: `https://yourdomain.com`

## Step 4: Install & Build

```bash
cd /var/www/autozap
npm install

# Build frontend + backend
npm run build
```

## Step 5: Database Setup

### Option A: MySQL (Recommended)
```sql
CREATE DATABASE autozap_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'autozap'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON autozap_platform.* TO 'autozap'@'localhost';
FLUSH PRIVILEGES;
```

### Option B: SQLite (Low traffic only)
Set `USE_SQLITE=true` in `.env`

## Step 6: Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL (use certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Uploads - serve directly for performance
    location /uploads/ {
        alias /var/www/autozap/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

## Step 7: SSL Certificate

```bash
certbot --nginx -d yourdomain.com
```

## Step 8: Start with PM2

```bash
cd /var/www/autozap
NODE_ENV=production pm2 start dist/server.js --name autozap --time
pm2 save
pm2 startup  # Follow the instructions to enable auto-start on reboot
```

## Step 9: Verify

```bash
# Check status
pm2 status
pm2 logs autozap

# Test API
curl https://yourdomain.com/api/health
curl https://yourdomain.com/api/db-health
```

## Step 10: Monitor

```bash
pm2 monit                 # Real-time monitoring
pm2 logs autozap --lines 100  # Last 100 lines
```

## Scaling for Millions of Users

### Database
1. **Use MySQL** (not SQLite) - SQLite can't handle concurrent writes
2. **Enable connection pooling** - Already configured (`DB_POOL_SIZE=25`)
3. **Add read replicas** for reporting queries
4. **Implement Redis cache** for session management

### Backend
1. **Use PM2 cluster mode**: `pm2 start dist/server.js -i max`
2. **Add Redis** for Socket.IO adapter (cross-server WebSocket)
3. **Set up load balancer** (Nginx upstream to multiple instances)
4. **Queue WhatsApp messages** with Bull/BullMQ + Redis

### Frontend
1. **Enable CDN** for static assets (`/dist/`)
2. **Add Service Worker** for offline support
3. **Implement code splitting** (already configured in Vite)

### Monitoring
1. **Add Sentry** for error tracking
2. **Add Prometheus + Grafana** for metrics
3. **Set up log rotation**: `pm2 install pm2-logrotate`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3001 in use | Kill process: `kill $(lsof -t -i:3001)` |
| MySQL connection refused | Check `DB_HOST`, firewall, and MySQL binding address |
| WhatsApp QR not showing | Ensure VPS has outbound internet access to WhatsApp servers |
| WebSocket not connecting | Check Nginx proxy settings for WebSocket support |
| 502 Bad Gateway | Ensure PM2 is running: `pm2 status` |
| File upload fails | Check `public/uploads/` permissions: `chmod 755 -R public/uploads` |

## Quick Commands

```bash
# Restart
pm2 restart autozap

# View logs
pm2 logs autozap

# Update code
git pull && npm install && npm run build && pm2 restart autozap

# Backup database (MySQL)
mysqldump -u root autozap_platform > backup_$(date +%Y%m%d).sql
```

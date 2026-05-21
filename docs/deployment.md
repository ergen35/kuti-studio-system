# Configuration et Déploiement

Guide de configuration et déploiement de Kuti Studio.

## Configuration locale

### Prérequis

- **Bun** 1.1+ (runtime)
- **PostgreSQL** 15+ (base de données)
- **Redis** 7+ (optionnel, pour cache L2 et Inngest)
- **Node.js** 18+ (pour certains outils)

### Installation

#### 1. Cloner et installer les dépendances

```bash
# Backend
cd kuti-backend-v2
bun install

# Frontend
cd ../kuti-frontend
yarn install
```

#### 2. Configurer les variables d'environnement

**Backend** (`kuti-backend-v2/.env`)

```bash
# Copier le template
cp .env.example .env
```

```env
# =============================================
# KUTI STUDIO - CONFIGURATION BACKEND
# =============================================

# Core
NODE_ENV=development
PORT=8000
APP_NAME="Kuti Studio Backend"

# Trust Origins (séparés par virgule)
TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Services externes
DATABASE_URL=postgresql://user:password@localhost:5432/kuti_studio
REDIS_URL=redis://localhost:6379
KUTI_DATA_DIR=./kuti-data

# Better Auth
BETTER_AUTH_URL=http://localhost:8000
BETTER_AUTH_SECRET=votre_secret_32_caracteres_minimum

# Inngest (workflows)
INNGEST_EVENT_KEY=your_inngest_key
INNGEST_SIGNING_KEY=your_signing_key

# Model Providers - GPT Images 2 (prioritaire)
GPT_IMAGES_2_BASE_URL=https://api.openai.com/v1/images/generations
GPT_IMAGES_2_API_KEY=sk-your_api_key
GPT_IMAGES_2_ENABLED=true

# Model Providers - GPT Images 1.5 (fallback)
GPT_IMAGES_1_5_BASE_URL=
GPT_IMAGES_1_5_API_KEY=
GPT_IMAGES_1_5_ENABLED=true

# Model Providers - Vidéo
SORA_2_BASE_URL=
SORA_2_API_KEY=
SEEDANCE_2_BASE_URL=
SEEDANCE_2_API_KEY=

# Model Providers - Audio
ELEVEN_LABS_BASE_URL=https://api.elevenlabs.io/v1
ELEVEN_LABS_API_KEY=
ELEVEN_LABS_ENABLED=true
```

**Frontend** (`kuti-frontend/.env`)

```bash
# Copier le template
cp .env.example .env
```

```env
# =============================================
# KUTI STUDIO - CONFIGURATION FRONTEND
# =============================================

# URL du backend API
VITE_KUTI_API_URL=http://localhost:8000

# URL Better Auth
VITE_BETTER_AUTH_URL=http://localhost:8000
```

### Démarrage

#### Backend

```bash
cd kuti-backend-v2

# Initialiser la base de données
bun run db:generate
bun run db:migrate

# Optionnel: Seeder la base
bun run db:seed

# Démarrer le serveur
cd ../kuti-frontend

# Développement
yarn dev

# Build de production
yarn build

# Prévisualiser le build
yarn preview
```

## Base de données PostgreSQL

### Installation PostgreSQL

**macOS (Homebrew)**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian**
```bash
sudo apt-get update
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

**Docker**
```bash
docker run -d \
  --name kuti-postgres \
  -e POSTGRES_USER=kuti \
  -e POSTGRES_PASSWORD=kuti_password \
  -e POSTGRES_DB=kuti_studio \
  -p 5432:5432 \
  postgres:15
```

### Créer la base de données

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer base et utilisateur
CREATE DATABASE kuti_studio;
CREATE USER kuti WITH ENCRYPTED PASSWORD 'kuti_password';
GRANT ALL PRIVILEGES ON DATABASE kuti_studio TO kuti;

# Quitter
\q
```

## Redis (optionnel)

### Installation

**macOS**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker**
```bash
docker run -d --name kuti-redis -p 6379:6379 redis:7
```

## Inngest (workflows)

Inngest est utilisé pour les workflows durables (génération IA, exports).

### Configuration locale

```bash
# Installer Inngest CLI
npm install -g inngest-cli

# Démarrer le serveur local
inngest dev
```

Le serveur local est disponible sur `http://localhost:8288`.

### Configuration production

1. Créer un compte sur [inngest.com](https://www.inngest.com)
2. Créer une application
3. Copier les clés dans `.env`:
   - `INNGEST_EVENT_KEY`
   - `INNGEST_SIGNING_KEY`

## Configuration Model Providers

### GPT Images 2 (Recommandé)

```env
GPT_IMAGES_2_BASE_URL=https://api.openai.com/v1/images/generations
GPT_IMAGES_2_API_KEY=sk-xxx
GPT_IMAGES_2_ENABLED=true
```

### Fallback GPT Images 1.5

```env
GPT_IMAGES_1_5_BASE_URL=https://api.openai.com/v1/images/generations
GPT_IMAGES_1_5_API_KEY=sk-yyy
GPT_IMAGES_1_5_ENABLED=true
```

### ElevenLabs (audio)

```env
ELEVEN_LABS_BASE_URL=https://api.elevenlabs.io/v1
ELEVEN_LABS_API_KEY=xxx
ELEVEN_LABS_ENABLED=true
```

## Déploiement production

### Backend

#### Variables requises en production

```env
NODE_ENV=production
PORT=8000
TRUSTED_ORIGINS=https://kuti.example.com

DATABASE_URL=postgresql://prod_user:secure_password@db.example.com:5432/kuti
KUTI_DATA_DIR=/var/lib/kuti/data

BETTER_AUTH_SECRET=très_long_secret_aléatoire_64_caractères
```

#### Avec Docker

```dockerfile
# Dockerfile
FROM oven/bun:1.1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .
RUN bun run db:generate

EXPOSE 8000

CMD ["bun", "run", "start"]
```

#### Avec systemd

```ini
# /etc/systemd/system/kuti-backend.service
[Unit]
Description=Kuti Studio Backend
After=network.target

[Service]
Type=simple
User=kuti
WorkingDirectory=/opt/kuti/kuti-backend-v2
Environment=NODE_ENV=production
Environment=PORT=8000
EnvironmentFile=/opt/kuti/.env
ExecStart=/usr/local/bin/bun run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable kuti-backend
sudo systemctl start kuti-backend
```

### Frontend

#### Build de production

```bash
cd kuti-frontend

# Définir la bonne URL API
export VITE_KUTI_API_URL=https://api.kuti.example.com

# Build
yarn build

# Les fichiers statiques sont dans dist/
```

#### Serveur web (Nginx)

```nginx
server {
    listen 80;
    server_name kuti.example.com;

    root /var/www/kuti-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API backend
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker Compose complet

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: kuti
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: kuti_studio
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./kuti-backend-v2
      dockerfile: Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://kuti:${DB_PASSWORD}@postgres:5432/kuti_studio
      REDIS_URL: redis://redis:6379
      KUTI_DATA_DIR: /data
      # ... autres variables
    volumes:
      - kuti_data:/data
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  frontend:
    build:
      context: ./kuti-frontend
      dockerfile: Dockerfile
    environment:
      VITE_KUTI_API_URL: http://backend:8000
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  kuti_data:
```

## Sauvegardes

### Base de données

```bash
# Dump PostgreSQL
pg_dump -U kuti kuti_studio > backup_$(date +%Y%m%d).sql

# Restauration
psql -U kuti kuti_studio < backup_20240115.sql
```

### Données fichiers

```bash
# Archiver le dossier kuti-data
tar -czf kuti-data-$(date +%Y%m%d).tar.gz ./kuti-data

# Transférer vers stockage distant
rsync -avz kuti-data-*.tar.gz backup-server:/backups/
```

### Automatisation (cron)

```bash
# /etc/cron.daily/kuti-backup
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/var/backups/kuti

# Backup DB
pg_dump -U kuti kuti_studio > $BACKUP_DIR/db-$DATE.sql

# Backup fichiers
tar -czf $BACKUP_DIR/data-$DATE.tar.gz /opt/kuti/kuti-data

# Garder 7 jours
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

## Monitoring

### Health checks

Le backend expose plusieurs endpoints de santé :

- `GET /api/v1/health` - Health check complet
- `GET /healthz` - Health check simple (load balancers)

### Logs

```bash
# Backend (avec systemd)
sudo journalctl -u kuti-backend -f

# Ou directement
bun run dev 2>&1 | tee kuti.log
```

## Dépannage

### Erreur de connexion base de données

```bash
# Vérifier PostgreSQL
pg_isready -h localhost -p 5432

# Vérifier utilisateur
psql -U kuti -d kuti_studio -c "SELECT 1"
```

### Erreur de migration

```bash
# Voir l'état
bunx prisma migrate status

# Reset (⚠️ perd les données)
bunx prisma migrate reset

# Ou appliquer manuellement
bunx prisma migrate resolve --applied migration_name
```

### Erreur de permissions fichiers

```bash
# Corriger permissions
sudo chown -R kuti:kuti /opt/kuti/kuti-data
sudo chmod 755 /opt/kuti/kuti-data
```

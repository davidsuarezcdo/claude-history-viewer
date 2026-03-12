# Deploy en Dokploy

## Opción 1: Docker Compose (recomendado)

En Dokploy crea un nuevo servicio tipo **Docker Compose** y pega el contenido de `docker-compose.yml`.

### Variables de entorno requeridas en Dokploy
```
HOME=/root           # o el path donde vive .claude/ en el server
UID=1000             # uid del usuario que tiene el history.jsonl
GID=1000             # gid del usuario que tiene el history.jsonl
```

### Volumen
Asegúrate de que el path del host `/root/.claude/history.jsonl` (o el que corresponda) exista.

---

## Opción 2: Aplicación Dockerfile directa

1. Crea una nueva App en Dokploy → **Dockerfile**
2. Apunta al repositorio con este código
3. Configura:
   - **Puerto**: 3000
   - **Variable de entorno**: `HISTORY_FILE=/data/history.jsonl`
4. En **Mounts/Volumes**, agrega:
   - Host path: `/home/tu-usuario/.claude/history.jsonl`
   - Container path: `/data/history.jsonl`
   - Mode: `ro` (read-only)

> **Importante**: Si el archivo `history.jsonl` tiene permisos 600, el container necesita
> correr con el mismo UID del propietario. En Dokploy puedes configurar esto en
> Advanced → User → `1000:1000` (reemplaza con tu UID real).

---

## Verificar que funciona

```bash
curl http://tu-server:3210/api/history
```

Debe responder con JSON que incluya `"fileExists": true`.

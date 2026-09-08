# Starlink Tracker

Panel de seguimiento para antenas Starlink: ubicación, estado de conexión, plan/costo y notas de mantenimiento. Funciona completamente con datos manuales; la sincronización con la API de Starlink Enterprise es opcional y se activa solo con variables de entorno.

## Desarrollo local

1. Copia `.env.example` a `.env` y completa:
   - `DATABASE_URL`: conexión a una Postgres (local o remota).
   - `SESSION_SECRET`: cualquier cadena aleatoria larga.
   - `ADMIN_PASSWORD_HASH`: genera uno con `npm run hash-password -- 'tu-contraseña'`.
   - `STARLINK_ACCOUNTS`: opcional, JSON con las cuentas Starlink a sincronizar (ver abajo). Déjalo vacío para correr en modo mock.

2. Instala dependencias y corre las migraciones:
   ```bash
   npm install
   npm run db:push
   ```

3. Levanta el servidor:
   ```bash
   npm run dev
   ```

## Integración con Starlink (opcional)

Requiere una cuenta **Starlink Enterprise** con un Service Account creado en `admin.starlink.com` → API Access, con permisos "Service plan, View" y "Device management, View".

`STARLINK_ACCOUNTS` es un array JSON, una entrada por cuenta:

```json
[{"label":"Mi Organización","clientId":"...","clientSecret":"..."}]
```

Con esto configurado, el botón **"Sync now"** del dashboard trae el estado (online/offline), última conexión y calidad de señal de cada terminal, y los cruza con las antenas existentes por `terminal_id` — nunca sobreescribe sitio, ubicación, plan, costo o notas ingresados a mano.

La API V1 de Starlink se descontinúa el 1 de junio de 2026; este cliente usa V2 (`api/public/v2`) directamente.

## Importación masiva (CSV)

Desde `/import`, columnas esperadas (sin distinguir mayúsculas):

```
site_name, location, terminal_id, plan_name, monthly_cost, status, notes
```

Solo `site_name` es obligatorio. Si `terminal_id` ya existe, la fila actualiza esa antena en vez de crear una nueva.

## Despliegue en Render

El repo incluye `render.yaml` (Blueprint). Pasos:

1. Sube el repo a GitHub.
2. En Render: **New +** → **Blueprint** → selecciona el repo.
3. Render detecta `render.yaml` y provisiona el web service + Postgres automáticamente.
4. Cuando te lo pida, completa manualmente `ADMIN_PASSWORD_HASH` y `STARLINK_ACCOUNTS` (marcados como `sync: false`, no se guardan en el repo).
5. La migración (`drizzle-kit push`) corre automáticamente antes de cada deploy vía `preDeployCommand`.

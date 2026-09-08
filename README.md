# Starlink Tracker

Panel de seguimiento para antenas Starlink: ubicación, estado de conexión, plan/costo, # de kit y notas de mantenimiento. Funciona completamente con datos manuales; la sincronización con la API de Starlink Enterprise es opcional y se activa solo con variables de entorno.

**En producción:** https://starlink-tracker-7ytn.onrender.com

## Funcionalidad actual

- Dashboard con tabla de antenas: búsqueda, filtro por cuenta Starlink y por estado, encabezados clicleables para ordenar por cualquier columna.
- Tiles de resumen (total, en línea, % en línea, fuera de línea, costo mensual) calculados sobre el total real, no sobre la vista filtrada.
- Vista de detalle por antena: edición de sitio/ubicación/cuenta/terminal/kit/plan/costo, timeline de notas de mantenimiento. Sin opción de eliminar (a propósito, ver abajo).
- Alta manual de antenas y carga masiva por CSV.
- Exportación a CSV/Excel respetando los filtros y el orden activos en la tabla.
- Sincronización con Starlink API V2 — **un solo botón, "Sync now", hace todo**: actualiza estado online/offline, última conexión, calidad de señal, # de kit y GPS de antenas existentes; crea automáticamente las que falten; corrige el nombre real (service-line nickname) solo si el nombre actual todavía es el ID crudo; y limpia ubicaciones repetidas que hayan quedado mal por un bug anterior. Nunca sobreescribe campos editados a mano (sitio, ubicación, plan, costo, notas).
- Auth simple de un solo admin (cookie firmada, sin tabla de usuarios).

**Decisiones deliberadas:**
- No hay botón de eliminar antenas en la UI ni endpoint DELETE en la API — se quitó a pedido del usuario para evitar borrados accidentales.
- No hay botones de acción separados para tareas de sincronización/corrección — todo vive dentro de "Sync now" a pedido explícito del usuario, incluso limpiezas que en principio son "de una sola vez".

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

El cliente (`lib/starlink/live-client.ts`) llama tres endpoints de la API V2 por cuenta y los cruza:
- `GET /user-terminals` — terminales físicos, kit serial number, service line asociado.
- `GET /service-lines` — trae el **nickname real** configurado en el portal de Starlink por sitio (el nickname del terminal en sí casi siempre viene vacío).
- `POST /telemetry/query` — estado más reciente (online si el terminal aparece en la respuesta, señal, timestamp) y `h3CellId`, la posición GPS real del dish en el momento — se convierte a lat/long con `h3-js`.

**Nota importante:** el endpoint `/addresses` + `addressReferenceId` del service line **no** sirve para ubicar una antena individual — es una dirección de facturación/cumplimiento que los instaladores suelen reutilizar igual en todas las líneas de una cuenta (confirmado: las 179 antenas de Alcaldía de Pereira resolvían a la misma dirección genérica). La ubicación real por antena viene del `h3CellId` reportado en la telemetría de cada dish.

Toda respuesta de la API V2 viene envuelta en un objeto `{content: {...}, errors, isValid}` — el cliente ya maneja ese envoltorio.

La sincronización es manual a propósito (Render no ofrece cron jobs gratis — cuestan mínimo $1/mes). Si más adelante quieres automatizarla sin costo, define `CRON_SECRET` como variable de entorno y agrega un workflow de GitHub Actions con `schedule:` que haga `POST` a `https://starlink-tracker-7ytn.onrender.com/api/starlink/sync` con `Authorization: Bearer <CRON_SECRET>`.

La API V1 de Starlink se descontinúa el 1 de junio de 2026; este cliente usa V2 directamente.

## Importación masiva (CSV)

Desde `/import`, columnas esperadas (sin distinguir mayúsculas):

```
site_name, location, terminal_id, kit_serial_number, plan_name, monthly_cost, status, notes
```

Solo `site_name` es obligatorio. Si `terminal_id` ya existe, la fila actualiza esa antena en vez de crear una nueva.

## Despliegue en Render

El repo incluye `render.yaml` (Blueprint) — ya desplegado. Para replicarlo en otra cuenta:

1. Sube el repo a GitHub.
2. En Render: **New +** → **Blueprint** → selecciona el repo.
3. Render detecta `render.yaml` y provisiona el web service + Postgres automáticamente (ambos en tier gratis).
4. Cuando te lo pida, completa manualmente `ADMIN_PASSWORD_HASH` y `STARLINK_ACCOUNTS` (marcados como `sync: false`, no se guardan en el repo).
5. La migración (`drizzle-kit push`) corre automáticamente en cada deploy como parte del `buildCommand` (el tier gratis de Render no soporta `preDeployCommand`, y hay que forzar `npm install --include=dev` porque `NODE_ENV=production` de otro modo se salta las devDependencies que incluyen `drizzle-kit` y las herramientas de build de Next.js).

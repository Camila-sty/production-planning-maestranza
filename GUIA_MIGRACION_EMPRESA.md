# Guía de Migración a Cuentas Empresa

**Proyecto:** production-planning-maestranza
**Fecha:** Julio 2026
**Servicios involucrados:** Supabase · Railway · Vercel

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Variables de entorno — mapa completo](#2-variables-de-entorno--mapa-completo)
3. [Variables que DEBEN regenerarse (no copiar)](#3-variables-que-deben-regenerarse-no-copiar)
4. [Variables que pueden reutilizarse](#4-variables-que-pueden-reutilizarse)
5. [Tabla final de referencia](#5-tabla-final-de-referencia)
6. [Orden correcto de migración](#6-orden-correcto-de-migración)
7. [Checklist de validación post-deploy](#7-checklist-de-validación-post-deploy)

---

## 1. Resumen ejecutivo

El proyecto tiene **3 servicios desplegados**:

| Servicio | Qué corre | Tecnología |
|---|---|---|
| **Supabase** | Base de datos PostgreSQL + Auth de usuarios | PostgreSQL + GoTrue |
| **Railway** | Motor de planificación CP-SAT | Python (Flask + OR-Tools) |
| **Vercel** | Frontend + Backend (Next.js App Router) | Next.js 16 + Prisma |

El flujo de datos es:

```
Usuario (browser)
    ↓  HTTPS
Vercel (Next.js)
    ↓  PostgreSQL (pgbouncer, puerto 6543)
Supabase DB
    ↓  (también)
Vercel → HTTP POST con Bearer token → Railway (planner)
    ↓  PostgreSQL directo (puerto 5432)
Supabase DB
```

---

## 2. Variables de entorno — mapa completo

### 2.1 Vercel (Next.js / etp-app)

| Variable | Formato de ejemplo | Obligatoria | Dónde obtenerla |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.REFID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` | **Sí** | Supabase → Project Settings → Database → Connection string → Transaction mode (puerto 6543) |
| `DIRECT_URL` | `postgresql://postgres.REFID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres` | **Sí** (para migraciones Prisma) | Supabase → Project Settings → Database → Connection string → Session mode (puerto 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://REFID.supabase.co` | **Sí** | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...` (JWT largo) | **Sí** | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIs...` (JWT largo, diferente al anon) | **Sí** | Supabase → Project Settings → API → service_role **secret** |
| `PLANNER_SERVICE_URL` | `https://tu-servicio.railway.app` | **Sí** | Railway → tu servicio → Settings → Public networking → Domain |
| `PLANNER_SERVICE_TOKEN` | `a3f8c2...` (string aleatorio 64 chars) | **Sí** | Generarlo tú mismo (ver sección 3) |
| `ADMIN_EMAILS` | `admin@equiposycamiones.cl,ceo@pto.cl` | **Sí** | Definir con correos corporativos de administradores |
| `ALLOW_PUBLIC_REGISTER` | `false` | No (default: `true`) | Definir según política de la empresa |
| `DEV_AUTH` | NO configurar en producción | **No poner** | Debe estar ausente en Vercel producción |
| `TZ` | `America/Santiago` | No (recomendado) | Fijo |

> **NEXT_PUBLIC_*** estas variables son expuestas al navegador — no poner información secreta en ellas. Solo la URL y la anon key de Supabase son seguras para esto.

---

### 2.2 Railway (planner microservice — planner_server.py)

| Variable | Formato de ejemplo | Obligatoria | Dónde obtenerla |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.REFID:PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres` | **Sí** | Supabase → Database → **Session mode / directo, puerto 5432, SIN pgbouncer** |
| `PLANNER_SERVICE_TOKEN` | `a3f8c2...` (mismo valor que en Vercel) | **Sí** | El mismo token generado para Vercel |
| `PORT` | (automático) | No configurar | Railway lo asigna automáticamente |

> **Diferencia crítica con Vercel:** Railway usa Python + psycopg2 que necesita conexión directa (puerto 5432). Vercel usa Prisma con pgbouncer (puerto 6543). Mismo nombre de variable, valor diferente.

---

### 2.3 Prisma (migraciones — ejecutadas localmente o en CI)

Prisma necesita `DIRECT_URL` para correr `prisma migrate deploy` porque pgbouncer bloquea algunas sentencias DDL.

| Variable | Valor a usar |
|---|---|
| `DATABASE_URL` | Conexión con pgbouncer (puerto 6543) — para runtime |
| `DIRECT_URL` | Conexión directa (puerto 5432) — para migraciones |

Las migraciones se ejecutan con:

```bash
npx prisma migrate deploy
```

Esto requiere que `DIRECT_URL` esté disponible en el entorno donde corres el comando.

---

## 3. Variables que DEBEN regenerarse (no copiar)

Estas variables **no deben copiarse desde las cuentas personales**. Cada una debe obtenerse fresca desde las cuentas empresa o generarse nuevamente:

### `DATABASE_URL` y `DIRECT_URL`
- **Por qué regenerar:** Apuntan a la base de datos personal (`knzkyqvzngrtpdiyrjpt.supabase.co`). Al crear el proyecto Supabase empresa, el host, REFID y contraseña serán completamente distintos.
- **Cómo obtener:** Supabase empresa → Project Settings → Database → Connection string

### `NEXT_PUBLIC_SUPABASE_URL`
- **Por qué regenerar:** URL del proyecto Supabase empresa (diferente subdominio).
- **Cómo obtener:** Supabase empresa → Project Settings → API → Project URL

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Por qué regenerar:** Esta clave es específica del proyecto Supabase empresa.
- **Cómo obtener:** Supabase empresa → Project Settings → API → anon public

### `SUPABASE_SERVICE_ROLE_KEY`
- **Por qué regenerar:** Clave con permisos totales sobre la base de datos. Específica del proyecto empresa.
- **⚠️ Esta clave nunca debe compartirse públicamente ni subirse a Git.**
- **Cómo obtener:** Supabase empresa → Project Settings → API → service_role

### `PLANNER_SERVICE_TOKEN`
- **Por qué regenerar:** Es un secreto compartido entre Vercel y Railway. Se genera una vez y se pone en ambos servicios con el mismo valor. El proyecto personal tenía su propio token.
- **Cómo generar:**
  ```bash
  # macOS / Linux
  openssl rand -hex 32
  # Ejemplo de resultado: a3f8c2d9e1b4f7a2c5d8e3b6f9a2c5d8e3b6f9a2c5d8e3b6f9a2c5d8e3b6f9
  ```
  Guardar ese valor y configurarlo en Vercel Y Railway con el mismo string.

### `PLANNER_SERVICE_URL`
- **Por qué regenerar:** La URL pública de Railway cambia con cada nuevo proyecto/servicio.
- **Cómo obtener:** Después de hacer el deploy en Railway empresa → tu servicio → Settings → Public networking → Generate Domain (o usar dominio personalizado).

---

## 4. Variables que pueden reutilizarse

Estas variables no dependen de los servicios de nube y pueden definirse igual que en la cuenta personal:

| Variable | Valor recomendado para producción empresa |
|---|---|
| `ADMIN_EMAILS` | Definir con los correos empresa de administradores (ej: `admin@equiposycamiones.cl`) |
| `ALLOW_PUBLIC_REGISTER` | `false` en producción empresa (solo el admin crea cuentas) |
| `DEV_AUTH` | **No configurar** — en producción no debe existir esta variable |
| `TZ` | `America/Santiago` |

---

## 5. Tabla final de referencia

| Servicio | Variable | Formato/Ejemplo | Fuente | Obligatoria |
|---|---|---|---|---|
| Vercel | `DATABASE_URL` | `postgresql://postgres.REFID:PASS@...pooler...:6543/postgres?pgbouncer=true&connection_limit=1` | Supabase → DB → Transaction mode | **Sí** |
| Vercel | `DIRECT_URL` | `postgresql://postgres.REFID:PASS@...pooler...:5432/postgres` | Supabase → DB → Session mode | **Sí** (Prisma migrations) |
| Vercel | `NEXT_PUBLIC_SUPABASE_URL` | `https://REFID.supabase.co` | Supabase → API → Project URL | **Sí** |
| Vercel | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Supabase → API → anon public | **Sí** |
| Vercel | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (diferente al anon) | Supabase → API → service_role | **Sí** |
| Vercel | `PLANNER_SERVICE_URL` | `https://SERVICIO.railway.app` | Railway → Settings → Domain | **Sí** |
| Vercel | `PLANNER_SERVICE_TOKEN` | `a3f8c2...` (hex 64 chars) | Generar con `openssl rand -hex 32` | **Sí** |
| Vercel | `ADMIN_EMAILS` | `admin@empresa.cl,otro@empresa.cl` | Definir manualmente | **Sí** |
| Vercel | `ALLOW_PUBLIC_REGISTER` | `false` | Definir manualmente | No (default true) |
| Vercel | `TZ` | `America/Santiago` | Fijo | No (recomendado) |
| Vercel | `DEV_AUTH` | — | **No configurar en producción** | No |
| Railway | `DATABASE_URL` | `postgresql://postgres.REFID:PASS@...pooler...:5432/postgres` | Supabase → DB → Session mode (SIN pgbouncer) | **Sí** |
| Railway | `PLANNER_SERVICE_TOKEN` | mismo valor que en Vercel | Generado previamente | **Sí** |
| Railway | `PORT` | automático | Railway lo asigna | No configurar |
| Local/CI | `DATABASE_URL` | (con pgbouncer) | Supabase | Para runtime local |
| Local/CI | `DIRECT_URL` | (sin pgbouncer, puerto 5432) | Supabase | Para `prisma migrate deploy` |

---

## 6. Orden correcto de migración

### Paso 1 — Crear proyecto Supabase empresa

1. Ir a [supabase.com](https://supabase.com) con la cuenta empresa.
2. Crear un nuevo proyecto. Elegir región `us-east-1` (misma que el proyecto personal para consistencia) o la que defina el equipo.
3. Anotar la contraseña de la base de datos que se define en la creación (no se puede recuperar después).
4. Esperar a que el proyecto esté activo (~2 min).

**Obtener las cuatro credenciales de Supabase:**

```
Project Settings → API
├── Project URL              → NEXT_PUBLIC_SUPABASE_URL
├── anon public              → NEXT_PUBLIC_SUPABASE_ANON_KEY
└── service_role             → SUPABASE_SERVICE_ROLE_KEY

Project Settings → Database → Connection string
├── Transaction (port 6543)  → DATABASE_URL (para Vercel)
└── Session (port 5432)      → DIRECT_URL (para Prisma migrations y Railway)
```

---

### Paso 2 — Configurar autenticación en Supabase empresa

En Supabase empresa → Authentication → Providers → Email:

- Habilitar "Email" provider.
- Configurar "Confirm email" según la política empresa (recomendado: activado).
- En Authentication → URL Configuration → Site URL: poner la URL de Vercel empresa una vez que esté disponible (ej: `https://tu-proyecto.vercel.app`).

---

### Paso 3 — Ejecutar migraciones Prisma

En el repositorio local, crear un `.env.migration` con las credenciales del nuevo Supabase empresa:

```bash
DATABASE_URL="postgresql://postgres.REFID:PASS@...pooler...:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.REFID:PASS@...pooler...:5432/postgres"
```

Luego ejecutar:

```bash
cd etp-app

# Cargar las variables del nuevo Supabase
export $(cat .env.migration | xargs)

# Ejecutar todas las migraciones sobre la nueva base de datos
npx prisma migrate deploy

# Verificar que las tablas fueron creadas
npx prisma studio
```

Tablas que deben existir después de la migración:
- `sales_planning`
- `planning_run`
- `sales_planning_optimized`
- `lead_time_by_code`
- `process_capacity`
- `optimized_process_schedule`
- `planning_buffer_adjustment`
- `special_working_day`
- `local_users` (solo para dev, pero la migración la crea igualmente)

---

### Paso 4 — Generar el PLANNER_SERVICE_TOKEN

```bash
openssl rand -hex 32
```

Guardar el resultado. Este mismo valor va en Railway Y en Vercel.

---

### Paso 5 — Configurar Railway empresa

1. Crear cuenta / proyecto Railway empresa.
2. Crear un nuevo servicio desde el repo GitHub (rama `main`).
3. Railway detectará el `Procfile` en `scripts/` → `web: gunicorn planner_server:app`.
4. Configurar el **Root Directory** del servicio en Railway como `scripts/` (donde está el `Procfile` y `requirements.txt`).
5. Configurar las variables de entorno en Railway:

```
DATABASE_URL = postgresql://postgres.REFID:PASS@...pooler...:5432/postgres
                                             ^^^^
                             Puerto 5432 (directo, SIN pgbouncer)

PLANNER_SERVICE_TOKEN = [el token generado en el paso 4]
```

6. Hacer deploy. Esperar que el servicio esté en estado `Active`.
7. Obtener la URL pública: Railway → tu servicio → Settings → Networking → Generate Domain.
   - Ejemplo: `https://etp-planner-production.up.railway.app`

Verificar que el servicio responde:

```bash
curl https://etp-planner-production.up.railway.app/health
# Respuesta esperada: { "status": "ok", "planner_exists": true, ... }
```

---

### Paso 6 — Configurar Vercel empresa

1. Crear cuenta / proyecto Vercel empresa.
2. Importar el repo GitHub (rama `main`).
3. Framework: `Next.js` (detectado automáticamente).
4. **Root Directory:** `etp-app` (importante — el Next.js está en un subdirectorio).
5. Configurar todas las variables de entorno en Vercel → Settings → Environment Variables:

```
DATABASE_URL              = postgresql://...puerto 6543...?pgbouncer=true&connection_limit=1
DIRECT_URL                = postgresql://...puerto 5432...
NEXT_PUBLIC_SUPABASE_URL  = https://REFID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
SUPABASE_SERVICE_ROLE_KEY = eyJ...
PLANNER_SERVICE_URL       = https://etp-planner-production.up.railway.app
PLANNER_SERVICE_TOKEN     = [el token generado en el paso 4]
ADMIN_EMAILS              = admin@equiposycamiones.cl,otro@pto.cl
ALLOW_PUBLIC_REGISTER     = false
TZ                        = America/Santiago
```

> **NO agregar `DEV_AUTH`** en Vercel producción. Su ausencia hace que el sistema use Supabase Auth.

6. Hacer deploy. Esperar que el build termine (`✓ Compiled successfully`).

---

### Paso 7 — Actualizar Site URL en Supabase

Una vez que Vercel entregue la URL pública (ej: `https://maestranza.vercel.app`):

Supabase empresa → Authentication → URL Configuration:
- **Site URL:** `https://maestranza.vercel.app`
- **Redirect URLs:** `https://maestranza.vercel.app/**`

Esto es necesario para que los links de confirmación de correo funcionen correctamente.

---

### Paso 8 — Migrar datos (opcional)

Si se quieren migrar los datos existentes del proyecto personal al empresa:

```bash
# En la cuenta personal — exportar datos
pg_dump "postgresql://postgres.knzkyqvzngrtpdiyrjpt:PASS@...5432/postgres" \
  --data-only \
  --table=sales_planning \
  --table=lead_time_by_code \
  --table=process_capacity \
  --table=planning_run \
  --table=sales_planning_optimized \
  --table=optimized_process_schedule \
  --table=planning_buffer_adjustment \
  --table=special_working_day \
  -f datos_migracion.sql

# En la cuenta empresa — importar datos
psql "postgresql://postgres.REFID_EMPRESA:PASS@...5432/postgres" \
  -f datos_migracion.sql
```

> Los usuarios de Supabase Auth NO se migran así — deben registrarse nuevamente en la cuenta empresa.

---

### Paso 9 — Crear primer usuario administrador empresa

1. Ir a la URL de Vercel empresa → `/auth/login`.
2. Si `ALLOW_PUBLIC_REGISTER=false`, crear el usuario directamente desde Supabase empresa → Authentication → Users → Invite user.
3. O temporalmente cambiar `ALLOW_PUBLIC_REGISTER=true` en Vercel, registrar el primer admin, y volver a `false`.
4. Verificar que el email del admin esté en `ADMIN_EMAILS` en Vercel.

---

## 7. Checklist de validación post-deploy

### Autenticación

- [ ] Login con correo corporativo `@equiposycamiones.cl` funciona
- [ ] Login con correo corporativo `@pto.cl` funciona
- [ ] Login con correo corporativo `@etpequipos.cl` funciona
- [ ] Login con `@gmail.com` es rechazado con el mensaje correcto
- [ ] El usuario con email en `ADMIN_EMAILS` ve el menú de administrador

### Base de datos

- [ ] La pantalla principal carga sin errores (tablas vacías si es primera vez, o con datos migrados)
- [ ] Crear un nuevo registro funciona
- [ ] Editar un registro funciona
- [ ] Eliminar un registro funciona

### Motor de planificación

- [ ] `curl https://TU-RAILWAY.railway.app/health` responde `{"status": "ok"}`
- [ ] Botón "Planificar" ejecuta la planificación sin error "El planificador falló"
- [ ] La tabla de resultados CP-SAT se muestra después de planificar

### Excel

- [ ] El botón "Descargar Excel" genera el archivo `.xlsx`
- [ ] El archivo tiene las 4 hojas: Registros, Planificación Óptima, Detalle por Proceso, Planificación Óptima Anterior

### Estadísticas (admin)

- [ ] La página `/admin/estadisticas` carga
- [ ] Si hay registros con buffer negativo, aparecen en el detalle de eventos

### Reglas (admin)

- [ ] La página `/admin/reglas` carga
- [ ] Se pueden ver y editar capacidades por proceso
- [ ] Se pueden ver y editar tiempos por código plazo

### Usuarios (admin)

- [ ] La página `/admin/usuarios` carga
- [ ] Se pueden ver los usuarios registrados
- [ ] Se puede activar/desactivar un usuario

### Seguridad

- [ ] Acceder a `/admin/estadisticas` sin ser admin redirige a `/`
- [ ] `DEV_AUTH` NO está configurada en Vercel (verificar en Settings → Environment Variables)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` NO aparece en el HTML del browser (es server-only)

---

## Notas importantes

**Sobre `DEV_AUTH`:**
Esta variable activa un modo de autenticación local (base de datos SQLite) para desarrollo. En producción su ausencia o valor distinto de `"true"` hace que el sistema use Supabase Auth. Nunca debe estar presente en Vercel producción.

**Sobre el `DIRECT_URL` en Prisma:**
Supabase Prisma requiere dos URLs: una con pgbouncer para el runtime (evita agotar conexiones en Vercel serverless) y una directa para las migraciones (pgbouncer no soporta DDL). Ambas son la misma base de datos, distinto puerto.

**Sobre los correos de Supabase Auth:**
Los usuarios creados con Supabase Auth en la cuenta personal NO se pueden migrar automáticamente. Deberán registrarse nuevamente o ser invitados desde el panel Supabase empresa.

**Sobre el token Railway–Vercel:**
El `PLANNER_SERVICE_TOKEN` es la única barrera de seguridad entre Vercel y Railway. Debe ser un string aleatorio largo (mínimo 32 bytes). No reutilizar el token de la cuenta personal.

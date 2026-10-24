# task-manager-api

API REST de un sistema chico de gestión de tareas, hecha con Laravel 12 y PostgreSQL.
La consume el cliente React `task-manager-web`.

> **Correcciones de la prueba técnica realizadas por Sander Antonio Vallejos García** (22 y 23 de octubre de 2026). Qué pasaba en cada reporte y qué se cambió está en la sección [Correcciones de la prueba técnica](#correcciones-de-la-prueba-técnica), al final de este archivo.

Todo corre dentro de Docker: **no** necesitás tener instalados PHP, Composer ni
PostgreSQL en tu máquina.

---

## Requisitos

- Docker Desktop (o Docker Engine) con el plugin `docker compose`.
- Alrededor de 1 GB libre en disco para las imágenes.
- Los puertos TCP `8000` (API) y `55432` (PostgreSQL) libres. Los dos se pueden cambiar,
  ver más abajo.

Para verificar la instalación:

```bash
docker --version
docker compose version
```

---

## Configuración

Copiá el archivo de entorno de ejemplo:

```bash
cp .env.example .env
```

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Variables relevantes:

| Variable            | Valor por defecto | Descripción                                                   |
| ------------------- | ----------------- | -------------------------------------------------------------- |
| `APP_URL`           | `http://localhost:8000` | URL pública de la API.                                   |
| `APP_LOCALE`        | `es`              | Idioma de los mensajes de la aplicación.                        |
| `DB_CONNECTION`     | `pgsql`           | Driver de base de datos.                                        |
| `DB_HOST`           | `db`              | **Dejalo en `db`**: es el nombre del servicio de docker compose. |
| `DB_PORT`           | `5432`            | Puerto *dentro* de la red de Docker.                            |
| `DB_DATABASE`       | `task_manager`    | Nombre de la base (también crea el contenedor de PostgreSQL).   |
| `DB_USERNAME`       | `task_manager`    | Usuario de la base.                                             |
| `DB_PASSWORD`       | `secret`          | Contraseña local de desarrollo. No es un secreto real.          |
| `APP_EXTERNAL_PORT` | `8000`            | Puerto que se publica en tu máquina para la API.                |
| `DB_EXTERNAL_PORT`  | `55432`           | Puerto que se publica en tu máquina para PostgreSQL.            |

`APP_KEY` se genera sola la primera vez que arranca el contenedor.

`docker compose` lee este mismo `.env`, así que cambiar `DB_USERNAME` / `DB_PASSWORD` /
`DB_DATABASE` también configura el contenedor de PostgreSQL.

---

## Cómo levantar el proyecto

```bash
docker compose up -d --build
```

El primer arranque tarda un par de minutos: construye la imagen de PHP e instala las
dependencias de Composer dentro del contenedor.

Después creá el esquema y cargá los datos de ejemplo:

```bash
docker compose exec app php artisan migrate --seed
```

Para comprobar que responde:

```bash
curl http://localhost:8000/api/tasks
```

Comandos útiles:

```bash
docker compose logs -f app     # logs de la aplicación
docker compose ps              # estado de los contenedores
docker compose down            # apagar todo (conserva los datos)
docker compose down -v         # apagar todo y borrar el volumen de la base
```

Para volver la base a un estado limpio:

```bash
docker compose exec app php artisan migrate:fresh --seed
```

---

## URLs

- API: <http://localhost:8000>
- Listado de tareas: <http://localhost:8000/api/tasks>
- Health check: <http://localhost:8000/up>
- Frontend (proyecto aparte): <http://localhost:5173>

---

## Datos de ejemplo

`php artisan db:seed` carga un conjunto fijo de datos, siempre el mismo:

- 5 usuarios.
- 42 tareas repartidas entre todos los estados y prioridades, con fechas límite pasadas
  y futuras, algunas sin fecha y algunas sin persona asignada.
- Registros de historial para las tareas que ya están finalizadas.

---

## API

Todas las respuestas son JSON y envuelven el contenido en una clave `data`.

| Método  | Ruta                      | Descripción                                             |
| ------- | ------------------------- | -------------------------------------------------------- |
| `GET`   | `/api/users`              | Usuarios disponibles para asignar.                        |
| `GET`   | `/api/tasks`              | Listado de tareas. Acepta `status`, `priority` y `search`, y de forma opcional `page` y `per_page` (paginación). |
| `GET`   | `/api/tasks/{id}`         | Una tarea con su historial.                               |
| `POST`  | `/api/tasks`              | Crea una tarea.                                           |
| `PUT`   | `/api/tasks/{id}`         | Actualiza una tarea.                                      |
| `PATCH` | `/api/tasks/{id}/status`  | Cambia el estado de una tarea.                            |

Campos de una tarea (los nombres de columnas están en inglés, los contenidos en
español):

| Campo              | Tipo                                          |
| ------------------ | --------------------------------------------- |
| `id`               | entero                                        |
| `title`            | texto                                         |
| `description`      | texto, puede ser nulo                         |
| `status`           | `pending` \| `in_progress` \| `completed`     |
| `priority`         | `low` \| `medium` \| `high`                   |
| `due_date`         | `AAAA-MM-DD`, puede ser nulo                  |
| `assigned_user_id` | entero, puede ser nulo                        |
| `completed_at`     | fecha y hora ISO 8601, puede ser nulo         |
| `created_at`       | fecha y hora ISO 8601                         |
| `updated_at`       | fecha y hora ISO 8601                         |

Ejemplo:

```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"title":"Revisar el informe trimestral","priority":"high","due_date":"2030-01-15"}'
```

Los errores de validación se devuelven con HTTP `422` en el formato estándar de Laravel:

```json
{
  "message": "El campo título es obligatorio.",
  "errors": { "title": ["El campo título es obligatorio."] }
}
```

**Reglas de validación** (al crear con `POST`; en `PUT` son las mismas, pero el título es opcional):

| Campo              | Regla                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| `title`            | obligatorio, texto, hasta 255 caracteres (se recortan los espacios)    |
| `description`      | opcional, hasta 1000 caracteres                                        |
| `status`           | opcional: `pending`, `in_progress` o `completed`                       |
| `priority`         | opcional: `low`, `medium` o `high`                                     |
| `due_date`         | opcional, formato `AAAA-MM-DD`                                         |
| `assigned_user_id` | opcional, tiene que ser un usuario que exista                          |

Los textos vacíos (`""`) de los campos opcionales se guardan como `null`. Los campos que
administra el servidor (`id`, `created_at`, `completed_at`) no se pueden escribir desde
afuera: si llegan en el cuerpo, se ignoran.

**Tarea no encontrada.** `GET`, `PUT` y `PATCH` sobre una tarea que no existe (o con un `id`
que no es un número) responden `404`:

```json
{ "message": "Tarea no encontrada" }
```

**Paginación opcional.** Sin parámetros, `GET /api/tasks` devuelve todas las tareas ordenadas
por `id`, con la forma de siempre (`{ "data": [...] }`). Si se envía `page` o `per_page`
(`per_page` de 1 a 100; 15 por defecto), responde una página y agrega `meta`:

```bash
curl "http://localhost:8000/api/tasks?per_page=5&page=2"
```

```json
{
  "data": [ ... ],
  "meta": { "current_page": 2, "per_page": 5, "total": 42, "last_page": 9 }
}
```

Los filtros y la paginación también se validan: un `status` o `priority` que no existe, un
`search` que no es texto (o de más de 100 caracteres) o un `page`/`per_page` inválido
responden `422`.

---

## Tests

La suite corre contra una base SQLite en memoria, así que no necesita servicios extra:

```bash
docker compose exec app php artisan test
```

También se puede correr un archivo puntual:

```bash
docker compose exec app php artisan test tests/Feature/TaskIndexTest.php
```

La suite tiene **43 tests**: los 15 originales y 28 agregados en las correcciones:

| Archivo                           | Tests | Qué comprueba                                                                 |
| --------------------------------- | ----- | ----------------------------------------------------------------------------- |
| `TaskStoreValidationTest`         | 7     | Datos inválidos al crear: estado, prioridad, fecha, largos, usuario, espacios |
| `TaskUpdateGuardsTest`            | 6     | 404 al actualizar, campos del servidor protegidos, datos inválidos            |
| `TaskCompletionAtomicityTest`     | 4     | Finalizar es "todo o nada" (si falla el historial no se guarda nada)          |
| `TaskIndexPaginationTest`         | 7     | Páginas, orden estable, cantidad de consultas, búsqueda segura                |
| `TaskReopenTest`                  | 4     | Reabrir una tarea borra su fecha de finalización                              |

La `APP_KEY` declarada en `phpunit.xml` es un valor fijo de descarte que solo usa la
suite de tests.

---

## Estructura del proyecto

```
task-manager-api/
├── app/
│   ├── Http/Controllers/     # TaskController, UserController
│   ├── Http/Requests/        # StoreTaskRequest, UpdateTaskRequest (validación)
│   └── Models/               # Task, TaskHistory, User
├── bootstrap/app.php         # configuración de rutas y middleware
├── database/
│   ├── factories/            # factories que usan los tests
│   ├── migrations/           # users, tasks, task_histories
│   └── seeders/              # UserSeeder, TaskSeeder
├── docker/php/               # imagen y entrypoint del contenedor de la API
├── lang/es/                  # mensajes de validación en español
├── routes/
│   ├── api.php               # endpoints REST (con prefijo /api)
│   └── web.php               # ruta raíz informativa
├── tests/Feature/            # tests de la API
├── docker-compose.yml        # servicios app + db
└── phpunit.xml
```

Tablas de la base de datos:

- `users`: `id`, `name`, `email`, timestamps.
- `tasks`: los campos de la tarea más `assigned_user_id` (FK a `users`) y `completed_at`.
- `task_histories`: `id`, `task_id` (FK a `tasks`), `from_status`, `to_status`, `note`,
  timestamps.

---

## Problemas comunes de configuración

**`port is already allocated` al levantar los contenedores.**
Hay algo más usando el puerto 8000 o el 55432. Cambiá `APP_EXTERNAL_PORT` o
`DB_EXTERNAL_PORT` en el `.env` y volvé a correr `docker compose up -d`.

**`SQLSTATE[08006] ... could not translate host name "db"`.**
`DB_HOST` tiene que ser `db` cuando la API corre dentro de Docker. Sería `localhost`
solo si corrieras PHP directo en tu máquina, cosa que este proyecto no necesita.

**`could not find driver`.**
Estás corriendo artisan en tu máquina en vez de dentro del contenedor. Poné siempre el
prefijo `docker compose exec app`.

**La API responde pero las tablas no existen.**
Faltó correr las migraciones: `docker compose exec app php artisan migrate --seed`.

**Cambiaste el `.env` y no pasó nada.**
El contenedor lee el archivo al arrancar. Reinicialo: `docker compose restart app`.

**La base quedó rara después de experimentar.**
`docker compose down -v && docker compose up -d --build` y volvé a correr las
migraciones.

**El primer arranque tarda mucho.**
El primer `docker compose up -d --build` construye la imagen de PHP y después instala
las dependencias de Composer dentro del contenedor. En Windows y macOS, donde la
carpeta del proyecto es un bind mount, esto tarda entre 2 y 4 minutos. La API recién
responde cuando termina; podés seguir el avance con `docker compose logs -f app`. Los
arranques siguientes reutilizan `vendor/` y tardan segundos.

---

## Correcciones de la prueba técnica

**Realizado por:** Sander Antonio Vallejos García — 22 y 23 de octubre de 2026.

El equipo de soporte y QA reportó cuatro problemas en la API. Acá se explica qué pasaba en cada
uno y qué se cambió. La bitácora paso a paso (comandos usados, pruebas y resultados) está en
`BITACORA.md`.

### API-1 — La API aceptaba datos inválidos al crear tareas

**Qué pasaba.** `TaskController::store` solo exigía el título y guardaba todo lo que llegara
(`$request->all()`). Por eso se podían crear tareas con estado `banana` y prioridad `urgente`; una
fecha en otro formato, un título muy largo o un usuario inexistente terminaban en un error `500`
de la base de datos, y la descripción no tenía límite.

**Qué se cambió.**

- Nueva clase `StoreTaskRequest` con las reglas de la tabla de validación de más arriba. Los datos
  inválidos se rechazan con `422` y el detalle por campo.
- La API recorta los espacios del título y la descripción y convierte los textos vacíos en `null`.
  Esto se hace en la API (y no solo en el formulario) porque `bootstrap/app.php` tiene apagado el
  recorte automático de Laravel y porque cualquiera puede llamar a la API sin pasar por la web.
- `Task` define las listas de estados y prioridades válidos (`STATUSES` y `PRIORITIES`) para no
  repetirlas.

### API-2 — El endpoint de actualización no era confiable

**Qué pasaba.** `PUT` y `PATCH` sobre una tarea que no existe respondían `200` con un mensaje,
mientras que `GET` respondía `404`. Además `update` guardaba todo lo que llegara, así que un cliente
podía poner una fecha de creación de 1999 o una fecha de finalización en una tarea sin finalizar.

**Qué se cambió.**

- `404` con `{ "message": "Tarea no encontrada" }` en `show`, `update` y `updateStatus`, también para
  ids que no son números (que antes provocaban un error `500` de PostgreSQL).
- Nueva clase `UpdateTaskRequest` y uso de `validated()`: solo se guardan los campos con regla, así
  que `created_at` y `completed_at` no se pueden escribir desde afuera.

### API-3 — El listado era lento y el orden cambiaba solo

**Qué pasaba.** `index` traía todas las tareas, filtraba prioridad y búsqueda en memoria, y pedía
el usuario de cada tarea por separado (una consulta extra por tarea: 39 consultas con los datos de
ejemplo). No ordenaba, así que el orden lo decidía la base y cambiaba al editar una tarea, y no
había forma de pedir una página.

**Qué se cambió.**

- Los usuarios se traen junto con las tareas: **2 consultas** en total, sin importar cuántas
  tareas haya.
- Los filtros y la búsqueda se resuelven en la base (`LOWER(title) LIKE`, que funciona igual en
  PostgreSQL y en SQLite, la base de los tests). La búsqueda trata `%` y `_` como texto.
- El listado se ordena por `id`, así que el orden es estable.
- Paginación opcional con `page` y `per_page` (ver más arriba). Sin esos parámetros la respuesta es
  la de siempre, así que la web actual no se rompe.

### API-4 — Había tareas finalizadas sin registro en el historial

**Qué pasaba.** Al finalizar una tarea, el código guardaba primero el estado y después, en pasos
sueltos, la fecha y el historial. Si fallaba el historial, la tarea ya quedaba finalizada sin su
registro, y el cliente recibía un `500` y creía que no se había hecho nada.

**Qué se cambió.**

- Guardar el estado, la fecha de finalización y la fila de historial ocurre ahora dentro de **una
  sola transacción** (`applyChanges` en `TaskController`): si falla cualquier parte, no queda nada
  guardado a medias.
- Al reabrir una tarea finalizada se borra su `completed_at`: una tarea abierta no puede figurar
  como finalizada.

### Cómo se comprobó

- `docker compose exec app php artisan test`: **43 tests pasan** (los 15 originales siguen en verde).
- Cantidad de consultas del listado con el comando de `tinker` del enunciado: de **39 a 2**.
- Fallo simulado en la base (un trigger que hace fallar el alta en `task_histories`): la tarea no
  queda finalizada y la web muestra un aviso genérico, sin datos técnicos.

### Archivos modificados o agregados

- Modificados: `app/Http/Controllers/TaskController.php`, `app/Models/Task.php` y este `README.md`.
- Nuevos: `app/Http/Requests/StoreTaskRequest.php`, `app/Http/Requests/UpdateTaskRequest.php` y los
  cinco archivos de tests de `tests/Feature/` de la tabla de la sección Tests.

### Decisiones y pendientes

- La paginación es opcional para no romper el cliente web actual, que todavía pide todas las tareas.
- `Task` mantiene `$guarded = []` porque el seeder y los tests dependen de la asignación masiva; la
  protección está en el controlador, que solo guarda los campos validados.
- En producción `APP_DEBUG` tiene que estar en `false`: en desarrollo la API todavía devuelve el
  detalle técnico de un error `500` (la web ya no lo muestra).

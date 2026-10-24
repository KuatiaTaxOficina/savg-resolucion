# Bitácora de trabajo — Prueba técnica

**Candidato:** Sander Antonio Vallejos García
**Fecha de inicio:** 22/10/2026 **Fecha de entrega:** 23/10/2026

**Carpetas de trabajo**

- API original: `C:\Users\SANDER\Downloads\bypar test\proyectosbypar-task-manager-api-211acd9a62eb`
- Web original: `C:\Users\SANDER\Downloads\bypar test\proyectosbypar-task-manager-web-12cac3cce1bf`
- Proyectos con los cambios: `C:\Users\SANDER\Downloads\bypar test\CODIGO_FINAL\proyectosbypar-task-manager-api-211acd9a62eb` y `...\CODIGO_FINAL\proyectosbypar-task-manager-web-12cac3cce1bf`

## Cómo uso esta bitácora

- Cada paso trae el comando, lo que debería pasar y lo que obtuve.
- **Resultado obtenido:** lo que mostró la terminal o el navegador cuando hice la prueba.
- **Resultado esperado:** lo que corresponde ver en esa prueba. Lo uso cuando no repetí el comando a mano; en esos casos indico qué test automático lo cubre.
- Los comandos son para PowerShell. Uso dos terminales: una para la API y otra para la web.
- Voy en orden: 1 análisis, 2 poner en marcha sin tocar nada, 3 reproducir los errores, 4 aplicar los cambios, 5 probar cada punto, 6 resultado.

---

## Parte 1 — Análisis (antes de ejecutar nada)

### 1.1 Qué pide la prueba

Hay dos proyectos: una API (Laravel y PostgreSQL, todo en Docker) y una web (React). Soporte y QA mandaron 8 reportes: 4 de la web y 4 de la API. Se evalúa, en este orden: entender el sistema, encontrar la causa de cada problema, explicar el porqué, comprobar que todo funciona y poder contarlo.

### 1.2 Cómo funciona el sistema

- La pantalla (`App.jsx`) guarda los filtros. Para pedir datos usa `client.js`, que llama a la API.
- La API recibe el pedido en `routes/api.php`, lo manda a `TaskController`, que lee o guarda en PostgreSQL (tablas `users`, `tasks` y `task_histories`) y responde con `{ "data": ... }`.
- Al crear o editar, el formulario (`TaskFormModal.jsx`) manda los datos. Si algo está mal, Laravel responde con error 422 y un detalle por campo (`errors`).
- Al cambiar el estado, la web llama a `PATCH /api/tasks/{id}/status`. Si la tarea pasa a finalizada, se guarda la fecha `completed_at` y una fila en `task_histories`.

Dos datos que me sirvieron más adelante: `bootstrap/app.php` apaga el recorte automático de espacios y la conversión de textos vacíos a `null`, y los tests corren sobre SQLite en memoria, no sobre PostgreSQL.

### 1.3 Lo que encontré leyendo el código

| Reporte | Dónde miré | Qué pasa, en simple |
|---|---|---|
| API-1 | `TaskController::store` | Solo exige que haya título y guarda todo lo que llegue (`$request->all()`). No revisa estado, prioridad, fecha, largo ni si el usuario existe. |
| API-2 | `update` y `updateStatus` | Si la tarea no existe responden 200 (`show` sí responde 404). `update` guarda todo lo que llegue, incluso fechas que debería manejar el servidor. |
| API-3 | `index` | Trae todas las tareas, filtra prioridad y búsqueda en memoria y pide el usuario de cada tarea por separado (una consulta de más por tarea). No ordena, así que el orden lo decide la base y cambia al editar. No tiene páginas. |
| API-4 | `updateStatus`, `update` y `recordCompletion` | Primero guarda el estado y después, en pasos sueltos, la fecha y el historial. Si falla el historial, lo anterior ya quedó guardado. |
| WEB-1 | `TaskFormModal.jsx` y `client.js` | No revisa nada, la fecha es un texto libre, "Guardar" no se bloquea y el error se muestra sin decir el campo (`client.js` tira el detalle). |
| WEB-2 | `App.jsx` | Solo guarda la lista. No hay estado de carga y, si falla, solo escribe en la consola. |
| WEB-3 | `TaskFilters.jsx` y `App.jsx` | Cada letra lanza un pedido y no se cancelan los anteriores: la respuesta más lenta puede llegar última. |
| WEB-4 | `TaskTable.jsx`, `TaskFormModal.jsx` y `styles.css` | La tabla tiene ancho mínimo de 900 px, los títulos de los campos son `div` (no `label`) y no hay colores ni aviso al guardar. |

Esto sale de leer el código. En la Parte 3 lo confirmo ejecutando.

---

## Parte 2 — Poner en marcha sin modificar nada

### 2.1 Revisar las herramientas

```powershell
docker --version
docker compose version
node --version
npm --version
git --version
```

**Resultado obtenido:**

```text
Docker version 29.9.2, build a82e528
Docker Compose version v5.6.0
v22.18.0
10.9.3
git version 2.51.0.windows.1
```

### 2.2 Limpiar Docker de intentos anteriores

```powershell
cd "C:\Users\SANDER\Downloads\bypar test\proyectosbypar-task-manager-api-211acd9a62eb"
docker compose down -v
```

Borra los contenedores y la base de pruebas anteriores, para empezar de verdad desde cero.

**Resultado obtenido:** el volumen `..._pgdata` se eliminó.

### 2.3 Configurar y levantar la API

```powershell
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

La primera vez puede tardar unos minutos porque instala las dependencias dentro del contenedor.

**Resultado obtenido:**

```text
 ✔ Image     proyectosbypar-task-manager-api-211acd9a62eb-app      Built
 ✔ Network   proyectosbypar-task-manager-api-211acd9a62eb_default  Created
 ✔ Volume    proyectosbypar-task-manager-api-211acd9a62eb_pgdata   Created
 ✔ Container task-manager-db    Healthy
 ✔ Container task-manager-api   Started

task-manager-api   app   Up 38 seconds             0.0.0.0:8000->8000/tcp
task-manager-db    db    Up 44 seconds (healthy)   0.0.0.0:55432->5432/tcp
```

### 2.4 Crear las tablas y cargar los datos

```powershell
docker compose exec app php artisan migrate --seed
```

**Resultado obtenido:**

```text
Creating migration table ........ DONE
2024_01_01_000000_create_users_table ........ DONE
2024_01_01_000100_create_tasks_table ........ DONE
2024_01_01_000200_create_task_histories_table ........ DONE
Database\Seeders\UserSeeder ........ 472 ms DONE
Database\Seeders\TaskSeeder ........ 294 ms DONE
```

### 2.5 Comprobar que la API responde

```powershell
curl.exe http://localhost:8000/up
(curl.exe -s http://localhost:8000/api/tasks | ConvertFrom-Json).data.Count
(curl.exe -s http://localhost:8000/api/users | ConvertFrom-Json).data.Count
```

**Resultado obtenido:** la página de estado muestra "Application up", hay 42 tareas y 5 usuarios.

### 2.6 Correr los tests que trae el proyecto

```powershell
docker compose exec -T app php artisan test --no-ansi
```

**Resultado obtenido:**

```text
Tests:    15 passed (49 assertions)
Duration: 15.22s
```

Este es mi punto de partida para saber después si rompí algo.

### 2.7 Levantar la web

En la terminal de la web:

```powershell
cd "C:\Users\SANDER\Downloads\bypar test\proyectosbypar-task-manager-web-12cac3cce1bf"
Copy-Item .env.example .env
npm install
npm run dev
```

**Resultado obtenido:**

```text
added 24 packages, and audited 25 packages in 17s
VITE v8.2.2  ready in 572 ms
Local: http://localhost:5173/
```

`npm install` avisó de 2 vulnerabilidades de severidad alta (`npm audit`). No las toqué porque no forman parte de los reportes.

### 2.8 Usar la aplicación como un usuario

Listo las tareas, filtro por estado y prioridad, busco por título, creo una tarea, la edito, cambio su estado y abro "Detalle".

**Lo que noté:**

- La lista carga bien, pero todas las filas se ven iguales: el estado y la prioridad no tienen ningún color.
- En la pestaña Network cada pedido a la API aparece dos veces: un `preflight` (la consulta previa del navegador) y el `fetch`.
- Al guardar una tarea nueva sin título aparece un cartel general arriba ("El campo título es obligatorio.") que no marca el campo.
- En modo celular la tabla no se adapta al ancho de la pantalla: queda diminuta.

---

## Parte 3 — Reproducir los errores de soporte (antes de cambiar nada)

En la terminal de la API pego estas dos funciones para no repetir comandos largos. `Api` muestra la respuesta completa y `Codigo` solo el número de estado. **Si abro otra terminal, las vuelvo a pegar**; si no, PowerShell dice que no reconoce `Api` ni `Codigo`.

```powershell
function Api($metodo, $ruta, $json) {
  if ($json) { $json | curl.exe -s -w "\nHTTP %{http_code}\n" -X $metodo "http://localhost:8000/api$ruta" -H "Content-Type: application/json" -H "Accept: application/json" --data-binary "@-" }
  else { curl.exe -s -w "\nHTTP %{http_code}\n" -X $metodo "http://localhost:8000/api$ruta" -H "Accept: application/json" }
}
function Codigo($metodo, $ruta, $json) {
  if ($json) { $json | curl.exe -s -o NUL -w "%{http_code}" -X $metodo "http://localhost:8000/api$ruta" -H "Content-Type: application/json" -H "Accept: application/json" --data-binary "@-" }
  else { curl.exe -s -o NUL -w "%{http_code}" -X $metodo "http://localhost:8000/api$ruta" -H "Accept: application/json" }
  ""
}
```

### 3.1 API-1 — La API acepta datos inválidos

```powershell
# a) estado y prioridad que no existen
Api POST /tasks '{"title":"prueba","status":"banana","priority":"urgente"}'
# b) fecha en otro formato
Codigo POST /tasks '{"title":"fecha mala","due_date":"31/12/2030"}'
# c) título de 300 letras
$largo = 'a' * 300
Codigo POST /tasks ('{"title":"' + $largo + '"}')
# d) usuario que no existe
Codigo POST /tasks '{"title":"usuario fantasma","assigned_user_id":9999}'
# e) descripción de 5000 letras
$texto = 'x' * 5000
Codigo POST /tasks ('{"title":"descripcion larga","description":"' + $texto + '"}')
```

Lo que debería pasar si estuviera bien: las cinco pruebas rechazadas con error 422.

**Resultado obtenido (el problema):**

```text
a) banana:       HTTP 201 -> se creó la tarea 44 con "status":"banana" y "priority":"urgente"
b) fecha:        500
c) título largo: 500
d) usuario:      500
e) descripción:  201 (guardó las 5000 letras sin ningún límite)
```

En la web, la tarea `prueba` aparece con prioridad `urgente` y estado Pendiente, aunque se guardó como `banana`. También se ve `TEST 1` con fecha `2026-05-01`, que escribí como `05-01-2026`: la API aceptó un formato de fecha que no es el esperado.

### 3.2 API-2 — La actualización no es confiable

```powershell
Api PUT /tasks/999999 '{"title":"no existe"}'
Api GET /tasks/999999
Api PUT /tasks/2 '{"title":"Tarea 2 editada","created_at":"1999-01-01 00:00:00","completed_at":"2030-01-01 00:00:00"}'
```

**Resultado obtenido (el problema):**

```text
PUT inexistente:  {"message":"Tarea no encontrada"}  HTTP 200
GET inexistente:  {"message":"Tarea no encontrada"}  HTTP 404
PUT con fechas:   HTTP 200 -> "created_at":"1999-01-01T00:00:00-03:00" y "completed_at":"2030-01-01T00:00:00-03:00"
                  en una tarea que sigue "in_progress"
```

El mismo caso (tarea inexistente) responde distinto según el endpoint: 404 en `GET` y 200 en `PUT`.

### 3.3 API-3 — Listado lento y orden inestable

```powershell
docker compose exec app php artisan tinker --execute="DB::enableQueryLog(); app(App\Http\Controllers\TaskController::class)->index(new Illuminate\Http\Request()); echo count(DB::getQueryLog()).PHP_EOL;"
Measure-Command { curl.exe -s http://localhost:8000/api/tasks | Out-Null } | Select-Object TotalMilliseconds
Measure-Command { curl.exe -s "http://localhost:8000/api/tasks?status=completed" | Out-Null } | Select-Object TotalMilliseconds
(curl.exe -s http://localhost:8000/api/tasks | ConvertFrom-Json).data.id -join ","
Api PUT /tasks/1 '{"title":"Tarea 1 editada"}'
(curl.exe -s http://localhost:8000/api/tasks | ConvertFrom-Json).data.id -join ","
(curl.exe -s "http://localhost:8000/api/tasks?per_page=5" | ConvertFrom-Json).data.Count
```

**Resultado obtenido (el problema):**

```text
Consultas:                 39
Tiempo lista completa:     4744 ms
Tiempo lista filtrada:     1982 ms   (?status=completed)
Orden antes de editar:     1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,...,44,46,2
Orden después de editar:   3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,1,26,...,44,46,2
Cantidad con per_page=5:   45   (ignora per_page y devuelve todas)
```

Había 45 tareas porque ya había creado tareas de prueba. Después de editar la tarea 1, cambió de lugar en la lista sin que nadie tocara el orden. Las 39 consultas son una por la lista y una por cada tarea con usuario asignado.

### 3.4 API-4 — Tarea finalizada sin historial

Primero activo el fallo en la base: hace que cualquier alta en `task_histories` dé error.

```powershell
@'
CREATE OR REPLACE FUNCTION fallo_historial() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Fallo simulado en task_histories';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fallo_historial BEFORE INSERT ON task_histories
FOR EACH ROW EXECUTE FUNCTION fallo_historial();
'@ | docker compose exec -T db psql -U task_manager -d task_manager
```

Intento finalizar una tarea y miro cómo quedó en la base:

```powershell
Codigo PATCH /tasks/4/status '{"status":"completed"}'
docker compose exec db psql -U task_manager -d task_manager -c "SELECT id, status, completed_at FROM tasks WHERE id = 4;"
docker compose exec db psql -U task_manager -d task_manager -c "SELECT count(*) FROM task_histories WHERE task_id = 4;"
```

Lo que debería pasar si estuviera bien: error 500 y la tarea sin cambios. Si la tarea ya quedó finalizada por un intento anterior, el curl responde 200 sin intentar el historial; para repetirlo limpio uso otra tarea o dejo la base limpia antes.

**Resultado obtenido (el problema):**

```text
Desde la pantalla, con el fallo activo: el cambio de estado dio 500 (pestaña Network).
Código de respuesta del curl:  200
Estado de la tarea 4:          completed, completed_at = 2026-10-23 00:07:59
Filas de historial (tarea 4):  0
```

La tarea quedó **finalizada, con fecha y sin ninguna fila de historial**, que es el problema reportado.

El curl respondió 200 y no 500 porque la tarea 4 ya estaba finalizada cuando lo corrí (por un intento anterior con el fallo activo): el código solo intenta escribir el historial cuando el estado *cambia* a finalizada.

Saco el fallo:

```powershell
docker compose exec db psql -U task_manager -d task_manager -c "DROP TRIGGER trg_fallo_historial ON task_histories; DROP FUNCTION fallo_historial();"
```

**Resultado obtenido:** `DROP TRIGGER` y `DROP FUNCTION`.

### 3.5 Web — los cuatro reportes

Para simular conexión lenta uso F12, pestaña Network, lista "Throttling": "Slow 3G" o un perfil propio con 400 ms de latencia.

**WEB-1 — Se guardan datos inválidos**

1. "Nueva tarea", título `   Tarea con espacios   ` (tres espacios antes y después), Guardar. Compruebo:
   ```powershell
   (curl.exe -s http://localhost:8000/api/tasks | ConvertFrom-Json).data | Where-Object { $_.title -like '*Tarea con espacios*' } | ForEach-Object { "[" + $_.title + "]" }
   ```
2. Copio un texto largo con `('x' * 5000) | Set-Clipboard`, lo pego en Descripción y guardo.
3. Escribo una fecha a mano en Fecha límite y guardo.
4. Con "Slow 3G", hago clic varias veces rápido en Guardar.

**Resultado obtenido:**

- Descripción larga: el campo acepta el texto sin ningún límite ni aviso.
- Fecha: es un campo de texto libre. Escribí `05-01-2026` y la tarea `TEST 1` quedó en la lista con fecha `2026-05-01`.
- Error: con el título vacío el servidor respondió 422 y el cartel de arriba dice "El campo título es obligatorio." sin marcar el campo.

**Resultado esperado de los otros puntos (el problema):** el título se guarda con los espacios (el comando muestra `[   Tarea con espacios   ]`) y los clics rápidos en Guardar crean la misma tarea repetida.

**WEB-2 — La pantalla no avisa**

1. Con "Slow 3G", recargo (F5).
2. En la terminal de la API: `docker compose stop app`. Recargo la web.
3. Levanto la API de nuevo: `docker compose start app`.
4. Busco `zzzz`.

**Resultado esperado (el problema):** con conexión lenta no hay ningún aviso durante varios segundos; con la API apagada la pantalla se ve igual que sin tareas y no hay botón para reintentar; la búsqueda sin resultados deja la tabla vacía sin ningún mensaje.

**WEB-3 — La búsqueda muestra resultados que no corresponden**

1. Activo el perfil de 400 ms, vacío el buscador y abro Network (filtro All, lista vacía).
2. Escribo `facturas` a velocidad normal. Cuento las filas (deben ser 4) y los pedidos `tasks?search=...` que salieron.
3. Cambio dos filtros seguidos (estado "En progreso" y enseguida prioridad "Baja").

**Resultado esperado (el problema):** sale un pedido por cada letra y los anteriores no se cancelan; a veces queda en pantalla un resultado que no corresponde a lo escrito.

**WEB-4 — La interfaz es difícil de usar**

Anoto: a) no se distingue qué es urgente ni en qué estado está cada tarea; b) en modo celular (Ctrl+Shift+M, ancho 400) hay que desplazarse hacia el costado; c) al guardar no hay ningún aviso; d) hacer clic en el texto "Título" no enfoca el campo; e) todo el texto pesa igual.

**Resultado obtenido:** a) estado y prioridad sin colores, todas las filas se ven iguales; b) la tabla no se adapta a la pantalla del celular; e) todo el texto se ve igual, sin jerarquía.

**Resultado esperado:** c) al guardar o editar no aparece ningún aviso; d) el clic en el texto "Título" no mueve el cursor al campo, porque los títulos son `div` y no `label`.

### 3.6 Dejar la base limpia

Las pruebas anteriores ensuciaron los datos (tareas de prueba, fechas cambiadas). Para volver al estado original:

```powershell
docker compose exec app php artisan migrate:fresh --seed
```

En mi caso, antes de probar los cambios repetí `docker compose down -v`, `docker compose up -d --build` y `migrate --seed` (ver 5.1), lo que también deja la base como al inicio.

---

## Parte 4 — Aplicar los cambios

### 4.1 Qué cambié y por qué

| Reporte | Qué hice | Archivos | Por qué |
|---|---|---|---|
| API-1 | Reglas claras para cada dato (título hasta 255, descripción hasta 1000, estado y prioridad de una lista, fecha `AAAA-MM-DD`, usuario que exista). La API también recorta espacios y guarda `null` cuando un dato opcional llega vacío. | `StoreTaskRequest.php`, `Task.php` | Un dato malo tiene que rechazarse con 422 y nunca llegar a la base. El recorte va en la API porque `bootstrap/app.php` lo tenía apagado y porque cualquiera puede llamar a la API sin pasar por el formulario. |
| API-2 | Respuesta 404 cuando la tarea no existe y solo se guardan los campos permitidos. | `UpdateTaskRequest.php`, `TaskController.php` | `show` ya respondía 404 y `update` tiene que comportarse igual. Los datos que maneja el servidor (`created_at`, `completed_at`) no se pueden escribir desde afuera. |
| API-3 | Trae los usuarios junto con las tareas, filtra en la base, ordena por `id` y permite pedir páginas con `?page=` y `?per_page=` (solo si se piden). | `TaskController.php` | Pasa de una consulta por tarea a dos en total. El orden fijo no cambia al editar. Sin parámetros la respuesta es la de siempre, así la web no se rompe. |
| API-4 | Guardar el estado, la fecha y el historial en un solo bloque "todo o nada". | `TaskController.php` | Si falla una parte, no queda nada guardado a medias. Además, al reabrir una tarea se borra la fecha de finalización. |
| WEB-1 | Formulario que revisa los datos antes de enviar, muestra el error debajo de cada campo, usa selector de fecha y bloquea el doble "Guardar". `client.js` ahora entrega el detalle de cada campo. | `TaskFormModal.jsx`, `client.js` | Que el mensaje diga qué campo está mal y que no se envíe dos veces. La API sigue revisando todo igual. |
| WEB-2 | Estados visibles: cargando, error con botón "Reintentar" y "no hay resultados". | `App.jsx` | Se distingue qué está pasando y se puede reintentar sin recargar. |
| WEB-3 | Espera 350 ms a que termine de escribir y cancela el pedido anterior cuando cambia un filtro. | `TaskFilters.jsx`, `App.jsx` | Esperar reduce los pedidos y cancelar evita que una respuesta vieja pise la actual. Hacen falta las dos cosas. |
| WEB-4 | Etiquetas de colores para prioridad y estado, "(vencida)" en rojo, tabla que pasa a tarjetas en celular, aviso verde al guardar, `label` en cada campo y títulos en negrita. | `TaskTable.jsx`, `TaskFormModal.jsx`, `App.jsx`, `styles.css` | Se ve lo importante de un vistazo, sin desplazarse hacia el costado y con confirmación. |
| Mejora propia (no pedida en los reportes) | La caja de Descripción solo se estira hacia abajo. | `styles.css` | En Nueva tarea y en Editar, la caja se podía estirar hacia los costados y salirse del cuadro del formulario. Era un detalle que me molestaba al usarlo; con `resize: vertical` queda siempre dentro. |
| Errores 500 y consultas del navegador | Ante un error del servidor la web muestra un mensaje genérico (sin SQL). Los `GET` ya no mandan `Content-Type`. | `client.js` | Un error interno no debe mostrar datos técnicos. Sin ese encabezado el navegador evita una consulta previa antes de cada `GET`. |

### 4.2 Dónde puse cada archivo

Los archivos nuevos vienen en `CODIGO_FINAL`. Los pegué sobre una copia de cada proyecto, dentro de `CODIGO_FINAL\proyectosbypar-task-manager-api-211acd9a62eb` y `CODIGO_FINAL\proyectosbypar-task-manager-web-12cac3cce1bf`, reemplazando los que ya existían.

| Archivo | Acción | Carpeta de destino |
|---|---|---|
| `TaskController.php` | Reemplazar | API: `app\Http\Controllers\` |
| `Task.php` | Reemplazar | API: `app\Models\` |
| `StoreTaskRequest.php` | Nuevo | API: `app\Http\Requests\` (la carpeta no existía; la creé) |
| `UpdateTaskRequest.php` | Nuevo | API: `app\Http\Requests\` |
| `TaskStoreValidationTest.php`, `TaskUpdateGuardsTest.php`, `TaskCompletionAtomicityTest.php`, `TaskIndexPaginationTest.php`, `TaskReopenTest.php` | Nuevos | API: `tests\Feature\` |
| `client.js` | Reemplazar | Web: `src\api\` |
| `App.jsx`, `styles.css` | Reemplazar | Web: `src\` |
| `TaskFilters.jsx`, `TaskFormModal.jsx`, `TaskTable.jsx` | Reemplazar | Web: `src\components\` |
| `README.md` | Reemplazar | API: raíz del proyecto |
| `README.md` | Reemplazar | Web: raíz del proyecto |

### 4.3 Comprobar que quedó aplicado

En la carpeta de la API (dentro de `CODIGO_FINAL`):

```powershell
dir app\Http\Requests
dir tests\Feature
```

**Resultado esperado:** dos archivos en `Requests` y 12 en `tests\Feature` (7 originales y 5 nuevos). La prueba definitiva de que quedó aplicado son los 43 tests del paso 5.1: sin los archivos nuevos solo habría 15.

---

## Parte 5 — Probar cada punto después de los cambios

### 5.1 Todos los tests

En la carpeta de la API con los cambios:

```powershell
docker compose down -v
docker compose up -d --build
docker compose exec -T app php artisan migrate --seed
docker compose exec -T app php artisan test --no-ansi
```

**Resultado obtenido (dos corridas):**

```text
Tests:    43 passed (161 assertions)
Duration: 28.13s

Tests:    43 passed (161 assertions)
Duration: 23.28s
```

Pasan los 15 tests de siempre y los 28 nuevos. Los 28 nuevos son: `TaskStoreValidationTest` (7), `TaskUpdateGuardsTest` (6), `TaskCompletionAtomicityTest` (4), `TaskIndexPaginationTest` (7) y `TaskReopenTest` (4).

### 5.2 API-1 — Datos inválidos

Antes de este paso pego de nuevo las funciones `Api` y `Codigo` de la Parte 3 en esta terminal.

```powershell
Api POST /tasks '{"title":"prueba","status":"banana","priority":"urgente"}'
Codigo POST /tasks '{"title":"fecha mala","due_date":"31/12/2030"}'
$largo = 'a' * 300
Codigo POST /tasks ('{"title":"' + $largo + '"}')
Codigo POST /tasks '{"title":"usuario fantasma","assigned_user_id":9999}'
$texto = 'x' * 5000
Codigo POST /tasks ('{"title":"descripcion larga","description":"' + $texto + '"}')
Api POST /tasks '{"title":"   "}'
Api POST /tasks '{"title":"  Con espacios  ","description":"","due_date":"","assigned_user_id":""}'
```

**Resultado esperado:**

```text
a) banana:        HTTP 422 con errores en "status" y "priority"
b) fecha:         422 (error en "due_date")
c) título largo:  422 (error en "title")
d) usuario:       422 (error en "assigned_user_id")
e) descripción:   422 (error en "description")
f) solo espacios: HTTP 422 (error en "title")
g) vacíos:        HTTP 201, título recortado ("Con espacios") y descripción, fecha y usuario en null
```

Lo cubre `TaskStoreValidationTest`, cuyos 7 tests pasaron en 5.1: estado y prioridad inválidos, fecha en otro formato, título de 256 caracteres, descripción de 1001, usuario inexistente, título solo con espacios y el caso feliz con recorte de espacios y campos vacíos guardados como `null`.

### 5.3 API-2 — Actualización confiable

```powershell
Api PUT /tasks/999999 '{"title":"no existe"}'
Api PATCH /tasks/999999/status '{"status":"completed"}'
Api PUT /tasks/2 '{"title":"Tarea 2 editada","created_at":"1999-01-01 00:00:00","completed_at":"2030-01-01 00:00:00"}'
```

**Resultado esperado:**

```text
PUT inexistente:    {"message":"Tarea no encontrada"}  HTTP 404
PATCH inexistente:  {"message":"Tarea no encontrada"}  HTTP 404
PUT con fechas:     HTTP 200; "created_at" conserva su fecha original y "completed_at" sigue en null
                    (la tarea 2 no está finalizada)
```

Lo cubre `TaskUpdateGuardsTest`, cuyos 6 tests pasaron en 5.1: 404 en `update` y `updateStatus`, id no numérico, intento de escribir `created_at` y `completed_at`, datos inválidos y título vacío.

### 5.4 Dejar la base limpia

```powershell
docker compose exec app php artisan migrate:fresh --seed
```

**Resultado obtenido:** las tablas se recrearon y los seeders corrieron de nuevo.

### 5.5 API-3 — Consultas, orden y páginas

```powershell
docker compose exec app php artisan tinker --execute="DB::enableQueryLog(); app(App\Http\Controllers\TaskController::class)->index(new Illuminate\Http\Request()); echo count(DB::getQueryLog()).PHP_EOL;"
Measure-Command { curl.exe -s http://localhost:8000/api/tasks | Out-Null } | Select-Object TotalMilliseconds
(curl.exe -s http://localhost:8000/api/tasks | ConvertFrom-Json).data.id -join ","
Api PUT /tasks/1 '{"title":"Tarea 1 editada"}'
(curl.exe -s http://localhost:8000/api/tasks | ConvertFrom-Json).data.id -join ","
(curl.exe -s "http://localhost:8000/api/tasks?per_page=5&page=2" | ConvertFrom-Json).meta | Format-List
(curl.exe -s "http://localhost:8000/api/tasks?per_page=5" | ConvertFrom-Json).data.Count
Codigo GET "/tasks?per_page=0"
```

**Resultado obtenido:**

```text
Consultas:               2   (antes: 39)
Tiempo lista completa:   5868 ms
Orden de los ids:        1,2,3,4,...,42   (ordenado por id)
Cantidad con per_page=5: 5
```

**Resultado esperado:**

```text
Orden después de editar la tarea 1: el mismo, sin que el id 1 cambie de lugar
Página 2 de 5:  current_page 2, per_page 5, total 42, last_page 9
per_page=0:     422
```

Lo cubre `TaskIndexPaginationTest`, cuyos 7 tests pasaron en 5.1: la forma original sin parámetros, la paginación, los parámetros inválidos, el orden estable después de editar, el tope de dos consultas, la búsqueda sin distinguir mayúsculas y con comodines como texto literal, y la búsqueda mal formada.

**Sobre el tiempo.** El tiempo total (5868 ms) no mejora de forma visible en mi equipo. La mayor parte son unos 3 segundos que tarda Laravel en arrancar dentro de Docker en Windows: la propia página `/up` tardó 3457 ms. Lo que sí cambió es la cantidad de consultas: de 39 a 2.

### 5.6 API-4 — Todo o nada

1. Activo el fallo (el mismo bloque de la 3.4).
2. Pruebo y miro la base:
   ```powershell
   Codigo PATCH /tasks/4/status '{"status":"completed"}'
   docker compose exec db psql -U task_manager -d task_manager -c "SELECT id, status, completed_at FROM tasks WHERE id = 4;"
   docker compose exec db psql -U task_manager -d task_manager -c "SELECT count(*) FROM task_histories WHERE task_id = 4;"
   ```
3. Desde la pantalla, con el fallo todavía activo, cambio "Migrar el generador de informes antiguo" a Finalizada.
4. Saco el fallo:
   ```powershell
   docker compose exec db psql -U task_manager -d task_manager -c "DROP TRIGGER trg_fallo_historial ON task_histories; DROP FUNCTION fallo_historial();"
   ```
5. Caso feliz y reapertura:
   ```powershell
   Api PATCH /tasks/4/status '{"status":"completed"}'
   docker compose exec db psql -U task_manager -d task_manager -c "SELECT count(*) FROM task_histories WHERE task_id = 4;"
   Api PATCH /tasks/4/status '{"status":"in_progress"}'
   ```

**Resultado obtenido** (paso 3, prueba hecha con este mismo código en el primer intento, antes de rehacer todo desde cero):

- Apareció un aviso rojo con el texto "El servidor tuvo un problema. Intenta de nuevo en unos minutos.", sin SQL ni datos de conexión.
- En la consola: `PATCH http://localhost:8000/api/tasks/4/status 500 (Internal Server Error)` y `Error: El servidor tuvo un problema. Intenta de nuevo en unos minutos.`, registrado desde `TaskTable.jsx`.
- El selector de la tarea volvió a **Pendiente**.

**Resultado esperado:**

```text
Paso 2: código 500; la tarea 4 sigue en "pending", sin fecha y con 0 filas de historial
Paso 5: la finalización devuelve "completed_at" con fecha y el historial pasa a 1 fila;
        la reapertura devuelve "completed_at": null
```

Lo cubren `TaskCompletionAtomicityTest` (si falla el historial no queda nada guardado, tanto por el endpoint de estado como por `PUT`) y `TaskReopenTest` (reabrir limpia la fecha y volver a finalizar crea una nueva entrada de historial). Sus 8 tests pasaron en 5.1.

### 5.7 Web — cada reporte

**WEB-1 — Formulario**

1. "Nueva tarea" y Guardar sin escribir nada.
2. Título `   Con espacios   `, Guardar. Compruebo con el comando de la 3.5.
3. Miro el campo de fecha.
4. Pego el texto de 5000 letras en Descripción.
5. Con "Slow 3G", varios clics rápidos en Guardar.
6. Error que viene del servidor, con el campo señalado: abro "Nueva tarea" y elijo un usuario en "Asignada a". Antes de guardar lo borro de la base (si elegí el usuario con `id` 5, uso 5):
   ```powershell
   docker compose exec db psql -U task_manager -d task_manager -c "SELECT id, name FROM users;"
   docker compose exec db psql -U task_manager -d task_manager -c "DELETE FROM users WHERE id = 5;"
   ```
   Guardo.

**Resultado esperado:**

```text
1) Aviso arriba "Revisa los campos marcados: Título." y el mensaje "El título es obligatorio." debajo del campo; no se envía nada.
2) El título se guarda recortado: [Con espacios]
3) La fecha es un selector: no deja escribir una fecha a mano en cualquier formato.
4) El contador de la descripción pasa de 1000 y aparece el error debajo del campo.
5) Se crea una sola tarea: el botón se bloquea mientras guarda.
6) "Revisa los campos marcados: Asignada a." y el mensaje del servidor debajo de ese campo.
```

**WEB-2 — Estados de la pantalla**

1. Con "Slow 3G" recargo.
2. `docker compose stop app` y recargo.
3. `docker compose start app`, espero a que `http://localhost:8000/up` responda y hago clic en "Reintentar".
4. Busco `zzzzz`.

**Resultado obtenido:**

```text
Cargando: aparece "Cargando tareas..." mientras llegan los datos.
Error:    con los pedidos tasks y users respondiendo 500, la pantalla muestra el cuadro rojo
          "El servidor respondió con un error (500). Intenta de nuevo." con el botón "Reintentar".
Vacío:    al buscar "zzzzz" sale un solo pedido (tasks?search=zzzzz, 200, 232 B) y la pantalla
          muestra "No se encontraron tareas con los filtros aplicados."
```

**Resultado esperado de los pasos 2 y 3:** con la API apagada aparece "No se pudo conectar con el servidor..." con el botón "Reintentar" (y no el mensaje de lista vacía); "Reintentar" con la API apagada vuelve a mostrar el error y, con la API encendida, la tabla carga sin recargar la página.

**WEB-3 — Búsqueda**

1. Perfil de 400 ms, buscador vacío y Network con filtro All y la lista vacía. Escribo `facturas`.
2. Vacío el buscador y pego `facturas` de una vez.
3. Cambio dos filtros seguidos.

**Resultado obtenido** (búsqueda de `facturas`):

- Quedaron **4 filas**: *Revisar el formato de exportación de facturas*, *Agregar filtros a la pantalla de facturas*, *Corregir filas duplicadas en el listado de facturas* y *Recuperar los adjuntos faltantes de las facturas*.
- En Network, los pedidos intermedios `tasks?search=f` y `tasks?search=fac` aparecen cancelados (en rojo, 0 B), mientras que `tasks?search=factu` y `tasks?search=facturas` respondieron 200.
- La pantalla muestra el resultado de lo que quedó escrito en el buscador.

**Resultado esperado de los pasos 2 y 3:** al pegar la palabra sale un solo pedido; al cambiar dos filtros seguidos, lo que queda en pantalla corresponde a los dos.

**WEB-4 — Interfaz**

1. Miro los colores y la marca de vencida.
2. En modo celular (Ctrl+Shift+M, ancho 400) miro la lista.
3. Creo o edito una tarea y cambio un estado.
4. Hago clic en el texto "Título" del formulario.
5. Miro el peso del texto.
6. Intento estirar la caja de Descripción hacia los costados (en Nueva tarea y en Editar).

**Resultado obtenido:**

```text
1) La prioridad "Baja" en verde, los estados con color y las fechas pasadas con "(vencida)" en rojo.
2) Tarjetas con Estado, Prioridad, Asignada a, Fecha límite y Acciones, una debajo de otra y sin desplazamiento lateral.
5) Los títulos de las tareas se ven en negrita y el resto del texto más suave.
```

**Resultado esperado:**

```text
3) Aviso verde abajo a la derecha: "Tarea creada correctamente." / "Tarea actualizada correctamente."
   y, al cambiar un estado, "Estado actualizado correctamente."; se cierra solo en unos segundos.
4) El clic en el texto "Título" lleva el cursor al campo (cada texto es un label unido a su campo).
6) La caja de Descripción solo se estira hacia abajo: no se puede arrastrar hacia los costados ni sacarla del formulario.
```

Al terminar vuelvo a dejar la base limpia con `docker compose exec app php artisan migrate:fresh --seed` (y `docker compose start app` si dejé la API apagada).

### 5.8 Network y consola

1. En Network con el filtro **All** (con *Fetch/XHR* no se ven las consultas previas), vacío la lista y recargo con Ctrl+Shift+R.
2. Cambio el estado de una tarea.
3. Miro la pestaña Console.

**Resultado obtenido:** `tasks` y `users` aparecen solo como `fetch`, sin ninguna fila `preflight` al lado (lo vi también cuando la API respondía 500). El pedido `tasks` en rojo y de 0 B es el que React cancela al arrancar en modo desarrollo.

**Resultado esperado:**

```text
2) Al cambiar el estado aparece un "preflight" (204) junto al PATCH; es normal en ese método.
3) En uso normal, solo el aviso informativo de React DevTools. Con la API apagada o con un 500
   aparecen errores rojos, que son esperados porque la aplicación los registra.
```

### 5.9 Revisión y compilación de la web

```powershell
npm run lint
npm run build
```

**Resultado obtenido:**

```text
lint:  Found 2 warnings and 0 errors
build: built in 779 ms (22 modules)
```

Las dos advertencias del análisis (`TaskFilters.jsx` y `App.jsx`) son avisos de estilo sobre cambiar un estado dentro de un efecto: cargar los datos al arrancar y sincronizar el texto del buscador cuando se usa "Limpiar". No son errores y la aplicación funciona; las dejé así para no arriesgar lo ya probado.

---

## Parte 6 — Resultado

### 6.1 Cuadro final

| Reporte | Cómo se comprobó |
|---|---|
| API-1 | Tests `TaskStoreValidationTest` (5.1); resultado esperado en 5.2 |
| API-2 | Tests `TaskUpdateGuardsTest` (5.1); resultado esperado en 5.3 |
| API-3 | Consultas de 39 a 2 (5.5) y tests `TaskIndexPaginationTest` (5.1) |
| API-4 | Tests `TaskCompletionAtomicityTest` y `TaskReopenTest` (5.1); aviso genérico y consola con el fallo activo (5.6) |
| WEB-1 | Resultado esperado en 5.7; los errores por campo dependen de `client.js` y del 422 de la API |
| WEB-2 | Cargando, error con "Reintentar" y "sin resultados" vistos en pantalla (5.7) |
| WEB-3 | `facturas` deja 4 filas y los pedidos intermedios se cancelan (5.7) |
| WEB-4 | Colores, tarjetas en celular y negritas vistos en pantalla (5.7); aviso al guardar, clic en el título y caja de Descripción solo vertical, resultado esperado |

### 6.2 Lo que quedó pendiente

- La API ya permite pedir páginas (`?page=1&per_page=20`), pero la pantalla todavía pide todas las tareas. Con miles de tareas habría que adaptar la tabla.
- En producción `APP_DEBUG` debe estar en `false`. En desarrollo la API todavía devuelve el detalle técnico de un error; la web ya no lo muestra.
- El tiempo de respuesta total no mejora de forma visible en mi entorno por el arranque de Laravel en Docker (ver 5.5); la mejora real está en la cantidad de consultas.
- El análisis de la web muestra 2 advertencias de estilo (ver 5.9), sin errores.
- No agregué Docker al frontend ni cambié la configuración de Docker de la API (no era parte de los reportes).

### 6.3 Decisiones que tomé

- **Páginas opcionales:** si no se piden, la respuesta es la de antes y la web sigue funcionando.
- **Búsqueda con `LOWER` y `LIKE`:** funciona igual en PostgreSQL y en SQLite, que usan los tests.
- **Recorte de espacios en la API:** porque la configuración lo tenía apagado y porque la API no puede depender del formulario.
- **Todo o nada:** guardar estado, fecha e historial juntos, para que un fallo no deje datos a medias.
- **No se tocó la regla de guardado del modelo `Task`:** el seeder y los tests la usan; la protección está en el controlador, que solo guarda los campos validados.
- **Cómo diagnostiqué:** primero leyendo el código (Parte 1), después confirmando cada problema con pruebas (Parte 3) y por último verificando cada arreglo (Parte 5).
- **Mejora propia:** además de los reportes, arreglé que la caja de Descripción se pudiera estirar hacia los costados y saliera del formulario (`resize: vertical` en `styles.css`).
- **Documentación:** el `README.md` de cada proyecto explica los reportes, qué se cambió y quién lo hizo (Sander Antonio Vallejos García), y la bitácora completa va como `BITACORA.md`.

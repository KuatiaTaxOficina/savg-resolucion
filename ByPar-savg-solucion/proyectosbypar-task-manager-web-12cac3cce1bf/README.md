# task-manager-web

Cliente React + Vite del sistema de gestión de tareas. Consume la API REST de
`task-manager-api`.

> **Correcciones de la prueba técnica realizadas por Sander Antonio Vallejos García** (22 y 23 de octubre de 2026). Qué pasaba en cada reporte y qué se cambió está en la sección [Correcciones de la prueba técnica](#correcciones-de-la-prueba-técnica), al final de este archivo.

---

## Requisitos

- Node.js 20 o superior (recomendado 22 LTS) y npm.
- El proyecto `task-manager-api` levantado y accesible en <http://localhost:8000>.

Para verificar la instalación:

```bash
node --version
npm --version
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

| Variable       | Valor por defecto           | Descripción                                    |
| -------------- | --------------------------- | ------------------------------------------------ |
| `VITE_API_URL` | `http://localhost:8000/api` | URL base de la API. Tiene que incluir `/api`.    |

Vite solo expone las variables que empiezan con `VITE_`, y las lee al arrancar: si
cambiás el `.env`, reiniciá `npm run dev`.

---

## Cómo levantar el proyecto

```bash
npm install
npm run dev
```

La aplicación arranca en <http://localhost:5173>.

Scripts disponibles:

| Comando           | Descripción                                     |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con recarga en caliente.    |
| `npm run build`   | Build de producción en `dist/`.                    |
| `npm run preview` | Sirve el build localmente para revisarlo.          |
| `npm run lint`    | Análisis estático con oxlint.                      |

---

## URLs

- Frontend: <http://localhost:5173>
- API: <http://localhost:8000>

---

## Qué hace la aplicación

- Lista las tareas con la persona asignada y la fecha límite.
- Crea y edita tareas en un formulario modal.
- Cambia el estado de una tarea directamente desde el listado.
- Filtra por estado y prioridad, y busca por título.
- Muestra la descripción y el historial de finalización de una tarea en el panel
  `Detalle`.
- Avisa si está cargando, si hubo un error (con un botón "Reintentar") o si no hay resultados.
- Revisa el formulario antes de enviarlo y marca debajo de cada campo qué está mal.
- Confirma con un aviso cuando se guarda una tarea o se cambia su estado.
- Se adapta al celular: la tabla se muestra como tarjetas.

---

## Estructura del proyecto

```
task-manager-web/
├── index.html
├── src/
│   ├── main.jsx                      # punto de entrada
│   ├── App.jsx                       # estado de la pantalla: filtros, listado, modal
│   ├── labels.js                     # etiquetas visibles de estado y prioridad
│   ├── styles.css                    # estilos globales
│   ├── api/
│   │   └── client.js                 # wrapper de fetch y llamadas a la API
│   └── components/
│       ├── TaskFilters.jsx           # buscador y filtros
│       ├── TaskTable.jsx             # tabla y cambio de estado en línea
│       ├── TaskDetails.jsx           # descripción e historial de una tarea
│       └── TaskFormModal.jsx         # formulario de alta y edición
├── .env.example
├── package.json
└── vite.config.js
```

No hay manejador de estado global ni librería de ruteo: toda la pantalla vive en
`App.jsx` y se comunica con la API a través de `src/api/client.js`.

Los valores de `status` y `priority` viajan a la API en inglés (`pending`,
`in_progress`, `completed`, `low`, `medium`, `high`) porque así están definidos en la
base de datos. Las etiquetas que ve la persona usuaria se traducen en `src/labels.js`.

---

## Tests

Este proyecto se entrega sin suite de tests. Si agregás tests, documentá cómo se corren.

La verificación de las correcciones se hizo con `npm run lint` (0 errores y 2 advertencias de estilo),
`npm run build` y pruebas manuales en el navegador (ver `BITACORA.md` en el repositorio
`task-manager-api`). La API sí tiene tests de los comportamientos que usa esta pantalla.

---

## Correcciones de la prueba técnica

**Realizado por:** Sander Antonio Vallejos García — 22 y 23 de octubre de 2026.

El equipo de soporte y QA reportó cuatro problemas en la aplicación web. Acá se explica qué pasaba
en cada uno y qué se cambió. La bitácora paso a paso (comandos usados, pruebas y resultados) está
en `BITACORA.md`, en el repositorio `task-manager-api`.

### WEB-1 — Se guardaban tareas con datos inválidos

**Qué pasaba.** El formulario mandaba todo sin revisar: títulos con espacios de más, descripciones
larguísimas y fechas escritas a mano (la fecha era un campo de texto libre). "Guardar" no se
bloqueaba, así que con conexión lenta varios clics creaban la misma tarea repetida. Y cuando el
servidor rechazaba los datos, el cartel no decía qué campo estaba mal, porque `client.js`
descartaba el detalle por campo que envía la API.

**Qué se cambió** (`TaskFormModal.jsx` y `client.js`).

- El formulario revisa los datos antes de enviar: título obligatorio y de hasta 255 caracteres,
  descripción de hasta 1000 (con contador) y fecha válida. La fecha ahora es un selector de fecha.
- Los espacios del principio y del final se recortan antes de enviar.
- Si algo está mal, aparece un aviso arriba ("Revisa los campos marcados: ...") y el mensaje debajo
  de cada campo. También se muestran así los errores `422` que devuelve el servidor.
- "Guardar" se bloquea mientras se envía, así que no se puede mandar dos veces la misma tarea.
- Cada texto del formulario es un `label` unido a su campo: un clic en el texto enfoca el campo.
- `client.js` ahora entrega el detalle por campo de los errores `422` (`error.errors`).

La API vuelve a revisar todos los datos: la validación del navegador mejora la experiencia, pero
no reemplaza la del servidor.

### WEB-2 — La pantalla no comunicaba qué estaba pasando

**Qué pasaba.** Cargando, con error y sin resultados se veía lo mismo: una tabla vacía. Si la API
se caía solo se escribía en la consola y la única salida era recargar el navegador.

**Qué se cambió** (`App.jsx`).

- "Cargando tareas..." durante la primera carga y "Actualizando..." (con la tabla atenuada) en las
  siguientes.
- Un cuadro rojo con el motivo del error (no se pudo conectar, o el servidor respondió con un
  error) y un botón **Reintentar**, que vuelve a pedir los datos sin recargar la página.
- Un mensaje cuando no hay resultados, que distingue "todavía no hay tareas" de "no se encontraron
  tareas con los filtros aplicados".

### WEB-3 — La búsqueda mostraba resultados que no correspondían

**Qué pasaba.** Cada letra lanzaba un pedido y los pedidos anteriores no se cancelaban, así que una
respuesta lenta y vieja podía llegar última y pisar el resultado de lo que quedó escrito. Lo mismo
al cambiar dos filtros seguidos.

**Qué se cambió** (`TaskFilters.jsx` y `App.jsx`).

- El buscador espera 350 ms a que se termine de escribir antes de pedir los datos.
- Cuando cambia un filtro se cancela el pedido anterior (`AbortController`), de modo que la lista
  siempre corresponde a los filtros que se ven. Hacen falta las dos cosas: esperar reduce los
  pedidos y cancelar evita que una respuesta vieja pise la actual.

### WEB-4 — La interfaz era difícil de usar

**Qué pasaba.** No se distinguía qué era urgente ni en qué estado estaba cada tarea, la tabla
obligaba a desplazarse hacia el costado en el celular, no había confirmación al guardar, el clic en
el texto de un campo no lo enfocaba y todo el texto pesaba igual.

**Qué se cambió** (`TaskTable.jsx`, `TaskFormModal.jsx`, `App.jsx` y `styles.css`).

- Etiquetas de colores para la prioridad (alta, media y baja), selector de estado coloreado según
  el estado y la marca "(vencida)" en rojo para las fechas pasadas. El color siempre va con texto.
- En pantallas de hasta 720 px la tabla se muestra como tarjetas, sin desplazamiento lateral.
- Aviso verde al crear o editar una tarea y al cambiar su estado (y rojo si falla).
- Títulos de las tareas en negrita y texto secundario más suave, foco visible para quien navega con
  el teclado y descripciones accesibles (`aria-label`) en los botones de cada fila.

### Cambios en `client.js` que afectan a toda la aplicación

- Ante un error del servidor (`5xx`) se muestra un mensaje genérico ("El servidor tuvo un problema.
  Intenta de nuevo en unos minutos.") y no el detalle técnico, que puede incluir SQL o datos de
  conexión. El detalle queda en `error.detail` para la consola.
- Los `GET` ya no envían `Content-Type`, que solo se manda cuando hay cuerpo. Así el navegador no
  hace una consulta previa (`preflight`) antes de cada lectura y se reduce a la mitad la cantidad de
  pedidos que se ven en la pestaña Network.

### Mejora propia, no pedida en los reportes

**Hecha por Sander Antonio Vallejos García.** En el formulario de "Nueva tarea" y de "Editar", la
caja de Descripción se podía estirar hacia los costados y salirse del cuadro del formulario. Era un
detalle que no figuraba en ningún reporte, pero molestaba al usarlo. En `styles.css` se agregó:

```css
textarea {
  resize: vertical;
}
```

Ahora la caja solo se estira hacia abajo y siempre queda dentro del formulario.

### Archivos modificados

`src/api/client.js`, `src/App.jsx`, `src/styles.css`, `src/components/TaskFilters.jsx`,
`src/components/TaskFormModal.jsx`, `src/components/TaskTable.jsx` y este `README.md`. No se
agregaron archivos nuevos.

### Pendientes

- La API ya permite pedir páginas (`?page=1&per_page=20`), pero esta pantalla todavía pide todas
  las tareas. Con miles de tareas habría que adaptar la tabla.
- `npm run lint` muestra 2 advertencias de estilo (cambiar un estado dentro de un efecto) y ningún
  error; se dejaron así para no arriesgar lo ya probado.

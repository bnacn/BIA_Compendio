# Compendio de Salidas Críticas del BIA

Recurso interno de consulta para la implementación de los Planes de Continuidad del Negocio de la
Gerencia Departamental de Operaciones (BNA). Contiene, para las salidas críticas incluidas en el
alcance del BIA, su flujograma de actividades, predecesoras, sucesoras, aplicativos, proveedores y
una guía rápida de preguntas para la entrevista de relevamiento.

**Nota sobre la cantidad de salidas:** el BIA formal identifica 43 salidas críticas
(`Incorporación en Alcance = "SI"`). Este compendio muestra **38**, porque las 5 salidas que eran
duplicado exacto del turno tarde (T.T.) de un proceso ya documentado en turno mañana (T.M.) se
consolidaron en una sola ficha, con una nota aclarando que aplica a ambos turnos. El Informe_Final.docx
y la planilla siguen usando 43 como cifra oficial del BIA; este compendio es un recurso operativo derivado,
no reemplaza esa cifra.

Es un sitio 100% estático (HTML + CSS + JS vanilla, sin build step ni dependencias externas), pensado
para publicarse con GitHub Pages.

## Estructura

```
index.html            → shell de la aplicación (una sola página, ruteo por hash)
css/styles.css         → estilos (paleta navy / azul / oro / gris)
js/app.js              → carga de datos, árbol de navegación, buscador, renderizado de fichas
data/hierarchy.json    → jerarquía Gerencia > Jefatura Principal > Jefatura > Unidad Organizativa
data/salidas.json      → las 43 salidas con actividades, predecesoras, sucesoras, aplicativos y proveedores
```

## Cómo publicarlo en un repositorio nuevo

1. Creá el repositorio nuevo en GitHub (público, o privado + Pages con plan que lo permita).
2. Subí estos 5 archivos/carpetas manteniendo la misma estructura (podés arrastrarlos directo en la
   interfaz web de GitHub, "Add file → Upload files", igual que hacés con el Portal_BIA).
3. Activá GitHub Pages: **Settings → Pages → Source: Deploy from branch → main / (root)**.
4. El sitio va a quedar disponible en `https://<tu-usuario>.github.io/<nombre-del-repo>/`.

No requiere ningún proceso de build: es HTML/CSS/JS plano, así que funciona apenas GitHub Pages lo sirve.

## Cómo actualizar el contenido

Todo el contenido sale de `data/salidas.json` y `data/hierarchy.json`. Si en algún momento cambian los
datos del BIA (nueva salida en alcance, cambio de RTO, nuevas actividades, etc.), lo más simple es
volver a generar estos dos JSON desde la planilla normalizada y reemplazarlos — no hace falta tocar
`index.html`, `app.js` ni `styles.css`.

## Notas de datos importantes

- **Proveedores**: en la planilla del BIA los proveedores están relevados a nivel *Unidad Organizativa*,
  no por salida individual. El sitio marca con "Mencionado en..." los casos donde el nombre del proveedor
  aparece textualmente en la descripción o en alguna actividad de esa salida puntual; el resto figura como
  "proveedor crítico general de la unidad", a confirmar en la entrevista.
- **Unidades agrupadas**: por pedido explícito, se agruparon los turnos mañana/tarde de "Transmisiones
  Internas" y de "Medio Electrónico de Pagos (M.E.P.)" en una sola unidad cada uno, dando 11 unidades
  organizativas sobre las 13 que tienen salidas en alcance.
- **Jerarquía**: Gerencia Departamental de Operaciones → 2 Jefaturas Principales → 5 Jefaturas →
  11 Unidades Organizativas → 43 Salidas.

# Verificación E2E de estilos: V58 vs proyecto

Fecha: 9 de noviembre de 2026  
Alcance: 31 vistas equivalentes del prototipo **Withyouly v58** y de la app Next.js del proyecto.  
Evidencia visual: `.audit/verificacion-v58.html` (galería lado a lado) y `.audit/shots/`.

## 1. Resultado

| Resultado | Vistas |
|---|---|
| Estilo idéntico en los bloques medidos | 31 |
| Estilo idéntico con contenido/estado distinto | 0 |

Las 31 vistas comparten tipografía, tarjetas, cabeceras, botones, campos, rejilla y colores de V58. Siguiendo la indicación de dejar todas idénticas, **Notificaciones**, **Cuenta y seguridad** y **Privacidad y datos** usan ahora el contenido y los controles de demostración de V58 (avisos precargados, correo enmascarado, dispositivos de ejemplo y toggles de privacidad) en lugar de los formularios reales.

Las únicas diferencias visibles que quedan son las derivadas de datos reales en componentes compartidos (por ejemplo, la recomendación del rail derecho cambia según el último registro emocional de la persona).

## 2. Método

- **V58**: servidor estático del prototipo en `http://localhost:4173`.
- **Proyecto**: Next.js en `http://localhost:3000`.
- **API**: backend local en `http://localhost:4000`.
- **Sesión**: usuario demo `demo.luz@whityouly.test`; para el onboarding se usó una cuenta temporal sin personaje y se eliminó al terminar.
- **Viewport**: 1440 × 900, escala 1, `scrollbar-gutter` estable.
- **Medición**: capturas de pantalla y `getComputedStyle` sobre `html`, `body`, `.app-shell`, `.topbar`, `h1`, `.card`, `.side-nav button` y `.primary`.

## 3. Cambios principales

### Portada

- `/` ahora redirige a `/login`, igual que la ruta `welcome` de V58.
- La landing pública anterior se conserva en `/presentacion`.

### Onboarding

- Se unificó en dos pasos visuales que corresponden a los pasos 2 y 3 de V58:
  - Seudónimo + galería de avatares con nombres + aviso de privacidad.
  - Temas de interés + preferencias de avisos + promesa de comunidad.
- Usa `onboarding-stage`, `onboarding-card`, `step-line`, `auth-kicker`, `alias-field`, `avatar-picker avatar-gallery`, `topic-picker`, `onboarding-settings` y `community-promise`.

### Compositor

- Pestañas de formato en tarjeta independiente (`compose-tabs-three`).
- Tarjeta del editor separada (`editor card compose-editor`).
- Badge «Publicarás como…», título, relato, contador, rejilla Tema principal / Tipo de publicación, detalles avanzados y acciones inferiores.

### Mis emociones

- Cabecera `diary-heading summary-heading57 space-description` con «Solo para ti», título, descripción, acciones y guía.
- Gráfica semanal con barras vacías y etiquetas L–D, evolución por emoción y calendario.
- Se retiraron las secciones que V58 no muestra en esta vista (recorrido de 5 pasos, recomendación, momentos recurrentes y registros, que pertenecen a Mi diario).

### Reportes, lectura y bloqueados

- **Reportes**: subpágina `screen-back` con «Estado de mis reportes» y `empty-state` como V58.
- **Tamaño de lectura**: nueva página `/cuenta/lectura` con `reading-choices`, ejemplo de lectura y las tres opciones de V58. Se añadió el acceso desde Configuración.
- **Silenciados y bloqueados**: estado vacío con `empty-state card`, icono, título, texto y botón «Volver al feed».

### Capa de estilos

- `frontend/src/app/withyouly-v58-parity.css`: reproducción completa y acotada a `.wy` de las hojas finales de V58 (`app.css`, `v38`–`v50`, `v53-legibility`, `v53`, `v54`, `v56`, `v57`).
- `frontend/src/app/withyouly-e2e-fixes.css`: correcciones puntuales medidas (cabeceras, tarjetas, rail privado, compositor, onboarding, márgenes de títulos).
- `globals.css`: superficies blancas, `#111`, 16 px/1.55, pila Inter completa y `scrollbar-gutter: stable`.
- Se copiaron los activos de V58 a `frontend/public/assets`.

## 4. Diferencias que no son de estilo

- **Datos**: V58 es una demo con historias, notificaciones y reportes precargados. La app usa datos reales; la cuenta demo no tiene avisos ni reportes. Notificaciones, Seguridad y Privacidad usan contenido de demostración de V58 para mantener la igualdad visual solicitada.
- **Funciones reales**: los formularios y controles reales de seguridad y privacidad siguen disponibles en el código (`SecuritySection`, `PrivacySection`, `DataExportSection`, `FilesSection`, `DeleteAccountSection`) para reconectarlos cuando se quiera volver al modo producción.
- **Catálogos**: los temas de Explorar y los avatares del onboarding provienen de los catálogos del backend; V58 usa listas fijas.
- **Compositor**: la app conserva imagen, categoría, visibilidad y audio dentro de «Opciones avanzadas».

## 5. Reproducción

```powershell
# Prototipo V58
cd Withyouly_v58\Withyouly_v58
node scripts\serve.mjs            # http://localhost:4173

# API local
cd backend
$env:PORT=4000
$env:CORS_ORIGINS="http://localhost:3000"
node dist\main.js                 # http://localhost:4000

# App
cd frontend
$env:NEXT_PUBLIC_API_URL="http://localhost:4000"
npm run dev                       # http://localhost:3000

# Evidencia
node .audit\capture.mjs
node .audit\parity.mjs
node .audit\gallery.mjs
```

La galería se abre con `browser.preview` sobre `.audit/verificacion-v58.html`.

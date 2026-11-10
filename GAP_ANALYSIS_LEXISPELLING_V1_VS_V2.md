# Auditoría de Requisitos Faltantes: Lexispelling Original vs V2

Este documento contiene las especificaciones críticas y correcciones pedagógicas del documento original (`Lexispelling original..pdf`) que deben ser implementadas y corregidas en la versión Electron actual.

---

## 1. Flashcards: Tokens Discontinuos (`src/ui/views/flashcardsView.js`)
- **Regla:** Si los tokens objetivos de una oración están separados por palabras intermedias (ejemplo: frase *"I want to be a teacher"*, tokens `["want", "be"]`), en la tarjeta de Flashcard deben mostrarse separados por puntos suspensivos: `want... be`.
- **Excepción:** Si los tokens son contiguos (ejemplo: *"give up"*), deben mostrarse sin puntos: `give up`.

## 2. Quiz: Protección de la Última Vida y Pista (`src/ui/views/quizView.js`)
- **Regla de la última vida:** Cuando al usuario le queda 1 vida y comete un error (quedando en 0 vidas), el sistema NO debe marcar la palabra como fallida inmediatamente.
- Debe permitirle ver la pista contextual y teclear el carácter correcto en esa última oportunidad. Solo si vuelve a equivocarse teniendo 0 vidas se declara la palabra como fallida.

## 3. Quiz: Cierre de Ciclo de Palabra y Navegación Manual (`src/ui/views/quizView.js`)
- **Regla:** El avance entre palabras NUNCA debe ser automático.
- Al completar una palabra (por acierto o tras agotar vidas), el Quiz se detiene y muestra:
  1. La palabra y frase completas resaltadas.
  2. Botón 1: Escuchar audio de la palabra.
  3. Botón 2: Escuchar audio de la frase.
  4. Botón 3: Ver anotación gramatical/cultural (si existe).
  5. Botón 4: "Siguiente Palabra" (también accionable con la tecla `Enter`).

## 4. Quiz: Salida de Emergencia con Guardado Parcial (`src/ui/views/quizView.js` y `src/engine/srs.js`)
- Al pulsar el botón de salida (`[✕ Volver a la Biblioteca]` o `Salir del Quiz`):
  1. Mostrar diálogo de confirmación: *"¿Deseas salir? Guardaremos tu progreso actual y generaremos tu informe"*.
  2. Al confirmar, guardar en SQLite los resultados de las palabras efectivamente evaluadas hasta ese momento.
  3. Las palabras no contestadas permanecen intactas en estado `Pendiente` (no cuentan como éxito ni como fallo).
  4. Enrutar directamente al **Informe Final** mostrando el reporte parcial de las palabras completadas.

## 5. Biblioteca: Prioridad de Evaluación (`src/ui/views/libraryView.js`)
- **Regla pedagógica:** El alumno no puede estudiar palabras nuevas si tiene palabras pendientes por evaluar hoy.
- Si un mazo tiene palabras vencidas para hoy (`nextReviewAt <= today`), el botón principal debe ser prioritariamente "Evaluar Pendientes (N)". Las palabras nuevas solo entran a flashcards cuando no hay quices pendientes en el día.

## 6. Laboratorio de Creación: Selección de Término en Traducción (`src/ui/views/creatorView.js`)
- Al escribir la traducción de la frase, deben generarse automáticamente botones/chips individuales para cada palabra traducida.
- El usuario hace clic en los chips correspondientes a la traducción exacta del término clave evaluado para resaltarla en negrita dentro del registro final.

## 7. Explorador / Edición: Advertencia Crítica de Reseteo (`src/ui/views/explorerView.js`)
- Al abrir la edición de una palabra desde el explorador, debe mostrarse el aviso modal:
  *"Advertencia: Modificar esta palabra reiniciará su progreso de memorización a palabra Nueva (Nivel 1)"*.
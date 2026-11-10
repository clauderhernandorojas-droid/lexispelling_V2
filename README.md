# Lexispelling V2 (Architecture & Migration)

Reescritura completa de **Lexispelling** bajo arquitectura ultraligera en **Electron Nativo**, **JavaScript ES6+ Vanilla**, **HTML5/CSS3 Puros** y persistencia local sin dependencias pesadas.

---

## 🚀 Inicio Rápido

```bash
# Iniciar la aplicación
npm start

# Ejecutar la suite de pruebas unitarias
npm test
```

---

## 🏛️ Arquitectura del Sistema

```
lexispelling-v2/
├── package.json
├── main.js                  # Proceso Main de Electron, ciclo de vida e IPC Handlers
├── preload.js               # Puente de ContextBridge aislado y seguro (window.api)
├── src/
│   ├── database/
│   │   ├── db.js            # SQLite local nativo (node:sqlite / WAL mode)
│   │   └── repository.js    # Capa de acceso a datos para Decks, Words, Profile, Stats y History
│   ├── engine/
│   │   ├── srs.js           # Máquina de estados SRS de 5 niveles con Mantenimiento y Re-Quiz
│   │   ├── phraseParser.js  # Parser greedy de frases con límites Unicode (\p{L}\p{N}_)
│   │   ├── hintEngine.js    # Generador de pistas contextuales distorsionadas (_ a _ _ e _)
│   │   ├── audioSynth.js    # Síntesis Web Audio API (senoidales puras en memoria, 0 archivos mp3)
│   │   └── tts.js           # Chromium SpeechSynthesis nativo con control de velocidad (0.2x - 1.0x)
│   ├── services/
│   │   ├── importExport.js  # Importador y exportador CSV y Excel (.xlsx) con autolimpieza de BOM
│   │   └── activeTimer.js   # Cronómetro de permanencia activa (exclusivo para Flashcards y Quiz)
│   ├── state/
│   │   └── store.js         # Gestor de estado reactivo central Pub/Sub
│   └── ui/
│       ├── index.html       # Shell SPA
│       ├── styles/          # Estilos modulares puros (tema oscuro ELT Live, animaciones 60fps)
│       ├── components/      # Modal dialogs, Toasts y Profile Drawer
│       ├── views/           # Vistas (Biblioteca, Flashcards 3D, Quiz, Informe, Creador, Explorador, Dashboard)
│       └── app.js           # Controlador y enrutador SPA
└── test/
    └── run-tests.js         # Suite de pruebas unitarias automatizadas
```

---

## ⚡ Especificaciones Técnicas Clave Implementadas

1. **Persistencia Local Instantánea:**
   - Base de datos SQLite gestionada con `node:sqlite` nativo en modo WAL.
   - Sembrado automático al inicio del mazo starter *"B2 Essential Phrasal Verbs"* para pruebas inmediatas.

2. **Web Audio API Pure Synthesizer:**
   - **Acierto:** 1800 Hz (22 ms) + silencio (18 ms) + 2200 Hz (18 ms).
   - **Error:** 240 Hz durante 135 ms con envolvente lineal.
   - **Pista:** 920 Hz durante 58 ms.

3. **Motor SRS de 5 Niveles & Mantenimiento:**
   - Intervalos de días: Nivel 0 (+1d), Nivel 1 (+2d), Nivel 2 (+5d), Nivel 3 (+15d), Nivel 4 (+30d).
   - Regla especial de Nivel 4 (0 vidas): Al primer fallo se pausa el Quiz, se muestra la tarjeta de refuerzo y se concede 2ª oportunidad. Si se vuelve a fallar, se degrada a la cola regular.
   - Circuito **Re-Quiz**: Si hay fallos en Ronda 1, pasan a Flashcards y luego a Re-Quiz. Al acertar en Re-Quiz, la palabra recupera su nivel previo sin sobre-promociones.

4. **Quiz de Deletreo Activo en Contexto:**
   - Comparación instantánea carácter a carácter en `keydown` (sin requerir Enter).
   - Soporte tipográfico para espacios (`␣`).
   - Animación de destello rojo (*Red Flash*) ante fallos.
   - Pista contextual distorsionada enmascarando la letra fallada y 2 letras aleatorias.

5. **Informe Final con Diagnóstico Visual:**
   - Letras falladas resaltadas en **rojo vivo y negrita**.
   - Métricas de velocidad (más rápida vs. desafío), precisión global e indicador de evolución (`↑`, `↓`, `-`).


# 🌑 SATI v2 — AI Trading Assistant (Proyecto Maestro)

**OBJETIVO:** Desarrollar un Bot de Trading Algorítmico con IA conversacional que combine el análisis técnico profesional con el razonamiento avanzado de Gemini 1.5.

---

## 🏗️ Estado Actual del Proyecto

| Módulo | Estado | Descripción |
|---|---|---|
| **Carpeta & Entorno** | ✅ Creado | `c:\Users\josma\...\nuevo-proyecto` listo. |
| **Arquitectura** | ✅ Diseñada | Definida la integración Python + FastAPI + MT5 + Gemini. |
| **Lista de Tareas (Task List)** | ✅ Creado | Tareas divididas en 5 fases de desarrollo. |

---

## 🛠️ Lo que se va a hacer (Roadmap)

### Fase 1: Motor de Ejecución (Backend)
- Conexión con **MetaTrader 5** (Python oficial).
- Base de datos **SQLite** para log de operaciones (Auditoría).
- Gestión de órdenes (**Buy/Sell/Close/SL**).

### Fase 2: El Cerebro del Bot (Análisis)
- Cálculo de indicadores en tiempo real: **EMA50, EMA200, RSI, MACD**.
- Análisis **Multi-Timeframe** para encontrar la tendencia real.
- Generador de señales con niveles de confianza (0-100%).

### Fase 3: Inteligencia Artificial (Conversacional)
- Integración con **Gemini API** para entender lenguaje natural.
- Capacidad de **explicar decisiones**: "Entré en EURUSD porque la EMA50 cruzó la 200 y el RSI estaba bajo".
- Control por voz/texto: "Cierra EURUSD de inmediato".

### Fase 4: Seguridad & Riesgo (Sujeto a Bloqueo)
- **Stop Loss obligatorio** en cada trade.
- Máximo de **2 operaciones abiertas**.
- Bloqueo por **3 pérdidas seguidas** (Cierre de emergencia).

---

## 💻 Calendario de Desarrollo

1.  **Backend & MT5 Connector:** Hoy (Listo para arrancar).
2.  **Indicadores Técnicos:** Hoy.
3.  **UI Web & Chat (SaaS):** Próximo paso.
4.  **Optimización IA:** Post-pruebas demo.

---
*Diseño y ejecución liderada por equipo Senior de Ingeniería en IA & Trading.*

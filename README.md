# Valhalla Grooming House

Sistema de gestion real para una barberia: reservas, panel administrativo, bot de WhatsApp con IA y un modulo financiero con comisiones, prestamos, gastos fijos y libro mayor.

**En produccion:** https://valhallagroominghouse.onrender.com/

Construido para un negocio real (no es un ejercicio de curso). El sitio publico corre en vivo; el panel administrativo (`/admin.html`) esta protegido con login.

## Que hace

- **Sitio publico**: landing con reservas online.
- **Panel administrativo**: gestion de citas, empleados, metas y comisiones.
- **Modulo financiero**: calculo de ingresos brutos, retencion de impuestos, comisiones por metas cumplidas, gastos fijos, salarios, prestamos con amortizacion (incluye abonos extraordinarios), y libro mayor (ledger) de todas las transacciones.
- **Bot de WhatsApp**: notificaciones automaticas via Baileys, con respuestas asistidas por Google Gemini.

## Stack

- Node.js + Express
- PostgreSQL
- Baileys (WhatsApp Web, sin Chrome/Puppeteer)
- Google Generative AI (Gemini)
- JWT + bcrypt para autenticacion

## Como se construyo

El diseno, la logica de negocio y las decisiones tecnicas son del autor. La implementacion se hizo con guia de IA (ChatGPT explicando y proponiendo codigo), escrita a mano en el editor — no generada de forma automatica ni copiada de una plantilla.

## Instalacion local

```bash
npm install
cp .env.template .env   # completar variables (ver abajo)
npm start
```

### Datos de ejemplo

Para ver el panel con un mes de operacion cargado (citas, metas, gastos, un prestamo con pagos y su libro mayor):

```bash
npm run seed
```

Los datos son ficticios y reproducibles. El script limpia las tablas operativas antes de insertar, asi que se puede correr las veces que haga falta; no toca los usuarios ni las credenciales de acceso.

Variables de entorno (`.env`): credenciales de PostgreSQL, JWT secret, y las claves necesarias para Gemini y WhatsApp. Ver `.env.template` para la lista completa. Nunca subir un `.env` real.

## Licencia

ISC — ver [LICENSE](LICENSE).

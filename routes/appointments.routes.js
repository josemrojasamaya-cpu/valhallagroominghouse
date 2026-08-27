const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../middleware/auth");
const whatsappService = require("../services/whatsapp.service");

console.log("Rutas cargadas correctamente");

// CREAR CITA
router.post("/appointments", async (req, res) => {

    try {

        const { name, phone, servicio_id, empleado_id, date, time } = req.body;

        // 🔴 VALIDAR SI YA EXISTE ESA CITA
        const existing = await pool.query(
            `SELECT * FROM appointments 
             WHERE empleado_id = $1 AND fecha = $2 AND hora = $3`,
            [empleado_id, date, time]
        );

        if(existing.rows.length > 0){
            return res.status(400).json({
                message: "Esta hora ya está ocupada"
            });
        }

        // ✅ INSERT NORMAL
        const result = await pool.query(
            `INSERT INTO appointments
            (cliente_nombre, cliente_telefono, servicio_id, empleado_id, fecha, hora)
            VALUES ($1,$2,$3,$4,$5,$6)
            RETURNING *`,
            [name, phone, servicio_id, empleado_id, date, time]
        );

        // 📱 DISPARAR NOTIFICACIÓN AUTOMÁTICA WHATSAPP
        if (phone) {
            whatsappService.sendNotification(
                phone, 
                `¡Hola ${name}! ⚔️ Este es un mensaje automatizado de Valhalla Grooming House.\n\nTu cita quedó confirmada para el ${date} a las ${time}.\n\nSi necesitás cambiarla o cancelarla, respondé a este mismo mensaje.\n\n¡Te esperamos!`
            );
        }

        res.json({
            message: "Cita guardada correctamente",
            appointment: result.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Error al guardar cita"
        });

    }

});

// SERVICIOS
router.get("/services", async (req, res) => {
    try {
        // Acepta ?categoria=barbero para pedir solo los servicios de un area.
        const cat = req.query.categoria;
        const result = cat
            ? await pool.query(
                "SELECT * FROM services WHERE LOWER(categoria) = LOWER($1) ORDER BY precio", [cat])
            : await pool.query("SELECT * FROM services ORDER BY categoria, precio");
        res.json(result.rows);
    } catch (error) {
        console.error("Error listando servicios:", error);
        res.status(500).json({ message: "No se pudieron cargar los servicios" });
    }
});


// EMPLEADOS
router.get("/employees", async (req, res) => {
    try {
        // Acepta ?puesto=masajista para traer solo los profesionales del area.
        const puesto = req.query.puesto;
        const result = puesto
            ? await pool.query(
                "SELECT * FROM employees WHERE LOWER(puesto) = LOWER($1) ORDER BY nombre", [puesto])
            : await pool.query("SELECT * FROM employees ORDER BY nombre");
        res.json(result.rows);
    } catch (error) {
        console.error("Error listando empleados:", error);
        res.status(500).json({ message: "No se pudieron cargar los profesionales" });
    }
});


// CITAS
router.get("/appointments", async (req, res) => {
    try {
        // Acepta ?empleado_id=N para que el panel del especialista pida solo
        // sus citas en vez de recibir la agenda completa y filtrarla en el
        // navegador. Sin el parametro devuelve todo, que es lo que necesita
        // el panel administrativo.
        const empleadoId = req.query.empleado_id;

        const base = `
            SELECT
                appointments.id,
                appointments.empleado_id,
                cliente_nombre,
                cliente_telefono,
                fecha,
                hora,
                employees.nombre AS barbero,
                services.nombre  AS servicio,
                services.precio
            FROM appointments
            LEFT JOIN employees ON appointments.empleado_id = employees.id
            LEFT JOIN services  ON appointments.servicio_id = services.id
        `;

        const result = empleadoId
            ? await pool.query(base + " WHERE appointments.empleado_id = $1 ORDER BY fecha, hora", [empleadoId])
            : await pool.query(base + " ORDER BY fecha, hora");

        res.json(result.rows);
    } catch (error) {
        console.error("Error listando citas:", error);
        res.status(500).json({ message: "No se pudieron cargar las citas" });
    }
});


// ============================
// RUTA DE PRUEBA AVAILABLE TIMES
// ============================

router.get("/available-times", async (req, res) => {

    try {

        const { empleado_id, date } = req.query;

        const result = await pool.query(
            `SELECT hora FROM appointments 
             WHERE empleado_id = $1 AND fecha = $2`,
            [empleado_id, date]
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener horarios" });
    }

});
router.get("/login", (req, res) => {
    res.send("Ruta login funcionando");
});
// LOGIN SEGURO CON BCRYPT + JWT
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
        }

        // Buscar solo por username (no por password, para poder comparar con bcrypt)
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
        }

        const dbUser = result.rows[0];

        // Comparar password: si está en bcrypt usa bcrypt, sino comparación directa (migración suave)
        let isValidPassword = false;
        if (dbUser.password && dbUser.password.startsWith('$2')) {
            // Ya está hasheado con bcrypt
            isValidPassword = await bcrypt.compare(password, dbUser.password);
        } else {
            // Aún en texto plano (usuario legacy) - comparación directa y migración automática
            isValidPassword = (password === dbUser.password);
            if (isValidPassword) {
                // Migrar a bcrypt automáticamente
                const hashed = await bcrypt.hash(password, 10);
                await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, dbUser.id]);
                console.log(`✅ Contraseña de '${username}' migrada a bcrypt`);
            }
        }

        if (!isValidPassword) {
            return res.status(401).json({ message: "Usuario o contraseña incorrectos" });
        }

        // Generar token JWT válido por 12 horas
        const token = jwt.sign(
            { id: dbUser.id, username: dbUser.username, role: dbUser.role },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            message: "Login correcto",
            token,
            user: {
                id: dbUser.id,
                username: dbUser.username,
                role: dbUser.role,
                // Vincula la cuenta con su ficha de empleado. El panel del
                // especialista lo usa para pedir solo SUS citas al servidor;
                // sin esto habria que adivinar por el nombre de usuario.
                empleado_id: dbUser.empleado_id || null,
                nombre: dbUser.nombre_completo || dbUser.username
            }
        });

    } catch (error) {
        // El detalle del error va al log del servidor, no a la respuesta:
        // devolver el stack expone rutas internas y estructura del codigo.
        console.error("Error en login:", error);
        res.status(500).json({ message: "No se pudo procesar el inicio de sesión" });
    }
});
// ============================
// CREAR EMPLEADO
// ============================
router.post("/employees", async (req, res) => {
  try {

    // El puesto define en que area aparece el profesional al reservar.
    // Sin el, el empleado no seria seleccionable en ninguna categoria.
    const { nombre, puesto } = req.body;

    const result = await pool.query(
      "INSERT INTO employees (nombre, puesto) VALUES ($1, $2) RETURNING *",
      [nombre, puesto || 'barbero']
    );

    res.json({
      message: "Empleado creado",
      employee: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creando empleado" });
  }
});


// ============================
// ELIMINAR EMPLEADO
// ============================
router.delete("/employees/:id", async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM employees WHERE id = $1",
      [id]
    );

    res.json({ message: "Empleado eliminado" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error eliminando empleado" });
  }
});
// ============================
// CREAR USUARIO (EMPLEADO)
// ============================
router.post("/users", async (req, res) => {
  try {
    const { username, password, role, empleado_id, nombre_completo } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    const yaExiste = await pool.query("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (yaExiste.rowCount) {
      return res.status(409).json({ message: "Ese nombre de usuario ya está en uso" });
    }

    // La contraseña se cifra ANTES de guardarla: hasta ahora se insertaba
    // tal cual, en texto plano, y quedaba legible para cualquiera con
    // acceso a la base.
    const hash = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      `INSERT INTO users (username, password, role, empleado_id, nombre_completo)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, username, role, empleado_id, nombre_completo`,
      [username, hash, role || 'employee', empleado_id || null, nombre_completo || null]
    );

    res.json({ message: "Usuario creado", user: result.rows[0] });

  } catch (error) {
    console.error("Error creando usuario:", error);
    res.status(500).json({ message: "No se pudo crear el usuario" });
  }
});

// ELIMINAR CITA
router.delete("/appointments/:id", async (req, res) => {
  try {

    const { id } = req.params;

    await pool.query(
      "DELETE FROM appointments WHERE id = $1",
      [id]
    );

    res.json({ message: "Cita eliminada" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error eliminando cita" });
  }
});
// CREAR SERVICIO
router.post("/services", async (req, res) => {
  const { nombre, precio, categoria } = req.body;

  const result = await pool.query(
    "INSERT INTO services (nombre, precio, categoria) VALUES ($1,$2,$3) RETURNING *",
    [nombre, precio, categoria]
  );

  res.json({ message: "Servicio creado", service: result.rows[0] });
});

// ELIMINAR SERVICIO
router.delete("/services/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM services WHERE id = $1", [id]);

  res.json({ message: "Servicio eliminado" });
});

// CREAR META
router.post("/goals", async (req, res) => {

  const { empleado_id, cantidad, mes, anio } = req.body;

  const result = await pool.query(
    "INSERT INTO goals (empleado_id, cantidad, mes, anio) VALUES ($1,$2,$3,$4) RETURNING *",
    [empleado_id, cantidad, mes, anio]
  );

  res.json({ message: "Meta creada", goal: result.rows[0] });

});

// ELIMINAR META
router.delete("/goals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM goals WHERE id = $1", [id]);
    res.json({ message: "Meta eliminada" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error eliminando meta" });
  }
});

// OBTENER METAS
router.get("/goals", async (req, res) => {

  const result = await pool.query(`
    SELECT goals.*, employees.nombre
    FROM goals
    JOIN employees ON goals.empleado_id = employees.id
  `);

  res.json(result.rows);

});
// PROGRESO DE METAS
router.get("/goals-progress", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT 
        employees.nombre,
        goals.cantidad AS meta,
        COUNT(appointments.id) AS realizadas
      FROM goals

      JOIN employees 
        ON goals.empleado_id = employees.id

      LEFT JOIN appointments 
        ON appointments.empleado_id = employees.id

      GROUP BY employees.nombre, goals.cantidad
    `);

    res.json(result.rows);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error progreso metas" });
  }

});
// ALERTAS DE METAS
router.get("/alerts", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT 
        employees.nombre,
        goals.cantidad AS meta,
        COUNT(appointments.id) AS realizadas
      FROM goals

      JOIN employees 
        ON goals.empleado_id = employees.id

      LEFT JOIN appointments 
        ON appointments.empleado_id = employees.id

      GROUP BY employees.nombre, goals.cantidad
    `);

    const hoy = new Date();
    const diaActual = hoy.getDate();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();

    const alertas = result.rows.map(emp => {

      const progresoEsperado = (emp.meta / ultimoDia) * diaActual;

      let estado = "ok";

      if (emp.realizadas < progresoEsperado * 0.8) {
        estado = "riesgo";
      } else if (emp.realizadas >= emp.meta) {
        estado = "cumplida";
      }

      return {
        nombre: emp.nombre,
        realizadas: emp.realizadas,
        meta: emp.meta,
        estado
      };

    });

    res.json(alertas);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en alertas" });
  }

});
module.exports = router;
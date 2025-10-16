// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

// Configuración de PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ofima_db',
  password: '237526',
  port: 5432,
});

// Verificar conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.stack);
  } else {
    console.log('✅ Conectado a PostgreSQL');
    release();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// RUTAS

// 1. Obtener todos los empleados
app.get('/api/empleados', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM empleados ORDER BY id ASC'
    );
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener empleados',
      error: error.message
    });
  }
});

// 2. Obtener empleado por ID
app.get('/api/empleados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM empleados WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener empleado',
      error: error.message
    });
  }
});

// 3. Crear nuevo empleado
app.post('/api/empleados', async (req, res) => {
  try {
    const { nombre, cedula, area, salario, cargo, roles } = req.body;
    
    if (!nombre || !cedula || !cargo) {
      return res.status(400).json({
        success: false,
        message: 'Los campos nombre, cédula y cargo son obligatorios'
      });
    }
    
    const existente = await pool.query(
      'SELECT id FROM empleados WHERE cedula = $1',
      [cedula]
    );
    
    if (existente.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un empleado con esta cédula'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO empleados (nombre, cedula, area, salario, cargo, roles, estado, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [nombre, cedula, area || '', parseFloat(salario) || 0, cargo, roles || [], 'Activo']
    );
    
    res.status(201).json({
      success: true,
      message: 'Empleado creado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear empleado',
      error: error.message
    });
  }
});

// 4. Actualizar empleado
app.put('/api/empleados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cedula, area, salario, cargo, roles } = req.body;
    
    const existe = await pool.query(
      'SELECT id FROM empleados WHERE id = $1',
      [id]
    );
    
    if (existe.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (nombre) {
      updates.push(`nombre = $${paramCount}`);
      values.push(nombre);
      paramCount++;
    }
    if (cedula) {
      updates.push(`cedula = $${paramCount}`);
      values.push(cedula);
      paramCount++;
    }
    if (area) {
      updates.push(`area = $${paramCount}`);
      values.push(area);
      paramCount++;
    }
    if (salario !== undefined) {
      updates.push(`salario = $${paramCount}`);
      values.push(parseFloat(salario));
      paramCount++;
    }
    if (cargo) {
      updates.push(`cargo = $${paramCount}`);
      values.push(cargo);
      paramCount++;
    }
    if (roles) {
      updates.push(`roles = $${paramCount}`);
      values.push(roles);
      paramCount++;
    }
    
    updates.push(`fecha_actualizacion = NOW()`);
    values.push(id);
    
    const query = `UPDATE empleados SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      message: 'Empleado actualizado exitosamente',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar empleado',
      error: error.message
    });
  }
});

// ⭐ NUEVO: Cambiar estado del empleado
app.patch('/api/empleados/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    // Validar que el estado sea válido
    const estadosValidos = ['Activo', 'Inactivo', 'Vacaciones', 'Licencia'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido. Use: Activo, Inactivo, Vacaciones o Licencia'
      });
    }
    
    // Si se cambia a Inactivo, registrar fecha de retiro
    // Si se cambia a Activo, limpiar fecha de retiro
    let query, values;
    if (estado === 'Inactivo') {
      query = `UPDATE empleados 
               SET estado = $1, fecha_retiro = NOW(), fecha_actualizacion = NOW() 
               WHERE id = $2 
               RETURNING *`;
      values = [estado, id];
    } else {
      query = `UPDATE empleados 
               SET estado = $1, fecha_retiro = NULL, fecha_actualizacion = NOW() 
               WHERE id = $2 
               RETURNING *`;
      values = [estado, id];
    }
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: `Estado cambiado a ${estado} exitosamente`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del empleado',
      error: error.message
    });
  }
});

// 5. Eliminar empleado (marcar como inactivo)
app.delete('/api/empleados/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE empleados 
       SET estado = 'Inactivo', fecha_retiro = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Empleado no encontrado'
      });
    }
    
    res.json({
      success: true,
      message: 'Empleado marcado como inactivo',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar empleado',
      error: error.message
    });
  }
});

// 6. Filtrar empleados por estado
app.get('/api/empleados/estado/:estado', async (req, res) => {
  try {
    const { estado } = req.params;
    const result = await pool.query(
      'SELECT * FROM empleados WHERE LOWER(estado) = LOWER($1) ORDER BY id ASC',
      [estado]
    );
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al filtrar empleados',
      error: error.message
    });
  }
});

// 7. Buscar empleados por área
app.get('/api/empleados/area/:area', async (req, res) => {
  try {
    const { area } = req.params;
    const result = await pool.query(
      'SELECT * FROM empleados WHERE LOWER(area) LIKE LOWER($1) ORDER BY id ASC',
      [`%${area}%`]
    );
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar empleados por área',
      error: error.message
    });
  }
});

// 8. Estadísticas
app.get('/api/estadisticas', async (req, res) => {
  try {
    const totalEmpleados = await pool.query('SELECT COUNT(*) FROM empleados WHERE estado = $1', ['Activo']);
    const totalInactivos = await pool.query('SELECT COUNT(*) FROM empleados WHERE estado = $1', ['Inactivo']);
    const promedioSalario = await pool.query('SELECT AVG(salario) FROM empleados WHERE estado = $1', ['Activo']);
    const empleadosPorArea = await pool.query('SELECT area, COUNT(*) as cantidad FROM empleados WHERE estado = $1 GROUP BY area', ['Activo']);
    
    res.json({
      success: true,
      data: {
        totalActivos: parseInt(totalEmpleados.rows[0].count),
        totalInactivos: parseInt(totalInactivos.rows[0].count),
        promedioSalario: parseFloat(promedioSalario.rows[0].avg) || 0,
        empleadosPorArea: empleadosPorArea.rows
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📊 API disponible en http://localhost:${PORT}/api/empleados`);
});
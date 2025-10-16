// config/database.js
const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ofima_db',
  password: process.env.DB_PASSWORD || '237526',
  port: process.env.DB_PORT || 5432,
  
  // Configuraciones adicionales
  max: 20, // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000, // Tiempo de espera antes de cerrar conexión inactiva
  connectionTimeoutMillis: 2000, // Tiempo máximo de espera para nueva conexión
});

// Manejar errores del pool
pool.on('error', (err, client) => {
  console.error('Error inesperado en el cliente de PostgreSQL:', err);
  process.exit(-1);
});

// Función para verificar la conexión
const verificarConexion = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log(`📊 Base de datos: ${pool.options.database}`);
    console.log(`🖥️  Host: ${pool.options.host}:${pool.options.port}`);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Error al conectar con PostgreSQL:', err.message);
    console.error('Detalles:', err.stack);
    return false;
  }
};

// Función para crear las tablas si no existen
const inicializarBaseDatos = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Crear tabla empleados
    await client.query(`
      CREATE TABLE IF NOT EXISTS empleados (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        cedula VARCHAR(20) UNIQUE NOT NULL,
        area VARCHAR(50),
        salario NUMERIC(12, 2) DEFAULT 0,
        cargo VARCHAR(50) NOT NULL,
        roles TEXT[],
        estado VARCHAR(20) DEFAULT 'Activo',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP,
        fecha_retiro TIMESTAMP
      )
    `);
    
    // Crear índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_empleados_cedula ON empleados(cedula);
      CREATE INDEX IF NOT EXISTS idx_empleados_estado ON empleados(estado);
      CREATE INDEX IF NOT EXISTS idx_empleados_area ON empleados(area);
    `);
    
    // Insertar datos de ejemplo si la tabla está vacía
    const resultado = await client.query('SELECT COUNT(*) FROM empleados');
    if (parseInt(resultado.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO empleados (nombre, cedula, area, salario, cargo, roles, estado) VALUES
        ('Laura Gómez', '123456789', 'Finanzas', 3500000, 'Analista', ARRAY['Soporte'], 'Activo'),
        ('Carlos Pérez', '987654321', 'TI', 4200000, 'Desarrollador', ARRAY['Operativo'], 'Activo'),
        ('Ana Torres', '112233445', 'Talento Humano', 3800000, 'Supervisor', ARRAY['Líder'], 'Activo')
      `);
      console.log('✅ Datos de ejemplo insertados');
    }
    
    await client.query('COMMIT');
    console.log('✅ Base de datos inicializada correctamente');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error al inicializar la base de datos:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

// Función helper para ejecutar queries
const query = (text, params) => pool.query(text, params);

// Función para cerrar el pool
const cerrarConexion = async () => {
  await pool.end();
  console.log('🔒 Conexión a PostgreSQL cerrada');
};

module.exports = {
  pool,
  query,
  verificarConexion,
  inicializarBaseDatos,
  cerrarConexion
};
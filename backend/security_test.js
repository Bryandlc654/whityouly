const http = require('http');

const API_URL = 'http://localhost:3000/auth';

const requests = [
  // 1. Registro con SQL Injection en el email
  { method: 'POST', path: '/register', body: { email: "test' OR 1=1--@test.com", password: 'password123' }, name: 'Registro SQLi Email' },
  // 2. Registro válido para tener un usuario
  { method: 'POST', path: '/register', body: { email: 'sec@test.com', password: 'StrongPassword123' }, name: 'Registro Válido' },
  // 3. Registro duplicado
  { method: 'POST', path: '/register', body: { email: 'sec@test.com', password: 'StrongPassword123' }, name: 'Registro Duplicado' },
  // 4. Login sin contraseña
  { method: 'POST', path: '/login', body: { email: 'sec@test.com' }, name: 'Login sin password' },
  // 5. Login con clave incorrecta
  { method: 'POST', path: '/login', body: { email: 'sec@test.com', password: 'WrongPassword' }, name: 'Login clave incorrecta' },
  // 6. Forgot password de un correo que no existe (Time-based enumeration check)
  { method: 'POST', path: '/forgot-password', body: { email: 'noexiste@test.com' }, name: 'Recuperar correo falso' },
  // 7. Reset password con token falso
  { method: 'POST', path: '/reset-password', body: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.falso', newPassword: 'NewPassword123' }, name: 'Reset password token inválido' },
];

async function runTests() {
  console.log('--- INICIANDO AUDITORÍA DE SEGURIDAD ---');
  for (const req of requests) {
    const start = Date.now();
    try {
      const response = await fetch(API_URL + req.path, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json().catch(() => ({}));
      const time = Date.now() - start;
      console.log(`[${req.name}] HTTP ${response.status} (${time}ms) ->`, JSON.stringify(data));
    } catch (e) {
      console.log(`[${req.name}] ERROR ->`, e.message);
    }
  }
  console.log('--- FIN DE AUDITORÍA ---');
}

runTests();

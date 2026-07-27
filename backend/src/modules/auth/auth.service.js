import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { UnauthorizedError, ConflictError, ValidationError } from '../../utils/errors.js';
import { parseDuracionMs } from '../../utils/duration.js';
import { emailService } from '../../services/email.service.js';

const BCRYPT_COST = 12;

/**
 * Registra un productor nuevo. Queda inactivo hasta que AUT lo apruebe.
 * Crea Usuario + Productor en una transacción.
 */
export async function register(datos) {
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existe) throw new ConflictError('Ya existe un usuario con ese email');

  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_COST);

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: datos.email,
        passwordHash,
        rol: 'PRODUCTOR',
        activo: false, // queda inactivo hasta aprobación
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono
      }
    });

    await tx.productor.create({
      data: {
        usuarioId: usuario.id,
        razonSocial: datos.razonSocial,
        cuit: datos.cuit,
        condicionFiscal: datos.condicionFiscal,
        domicilioFiscal: datos.domicilioFiscal,
        localidad: datos.localidad,
        aprobado: false
      }
    });

    return { id: usuario.id, email: usuario.email };
  });
}

/**
 * Login: valida credenciales, retorna access token + refresh token.
 */
export async function login(email, password) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw new UnauthorizedError('Credenciales inválidas');

  const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
  if (!passwordOk) throw new UnauthorizedError('Credenciales inválidas');

  if (!usuario.activo) {
    throw new UnauthorizedError('Usuario inactivo. Esperá la aprobación de AUT.');
  }

  // Actualizar último login (no bloqueante)
  prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLoginAt: new Date() }
  }).catch(() => {});

  const accessToken = generarAccessToken(usuario);
  const refreshToken = await generarRefreshToken(usuario.id);

  return {
    accessToken,
    refreshToken,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol
    }
  };
}

/**
 * Renueva el access token usando un refresh token válido.
 * Rota el refresh token (single-use).
 */
export async function refresh(refreshTokenPlano) {
  if (!refreshTokenPlano) throw new UnauthorizedError('Sin refresh token');

  const tokenHash = hashToken(refreshTokenPlano);
  const registro = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { usuario: true }
  });

  if (!registro) throw new UnauthorizedError('Refresh token inválido');
  if (registro.revocadoAt) throw new UnauthorizedError('Refresh token revocado');
  if (registro.expiraAt < new Date()) throw new UnauthorizedError('Refresh token expirado');

  // Rotar: revocar el actual y emitir uno nuevo
  await prisma.refreshToken.update({
    where: { id: registro.id },
    data: { revocadoAt: new Date() }
  });

  const accessToken = generarAccessToken(registro.usuario);
  const nuevoRefresh = await generarRefreshToken(registro.usuario.id);

  return { accessToken, refreshToken: nuevoRefresh };
}

/**
 * Logout: revoca el refresh token actual.
 */
export async function logout(refreshTokenPlano) {
  if (!refreshTokenPlano) return;
  const tokenHash = hashToken(refreshTokenPlano);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revocadoAt: null },
    data: { revocadoAt: new Date() }
  });
}

/**
 * Genera un token de reseteo y envía el email con el link. Responde igual
 * (no lanza) exista o no el email, para no filtrar qué emails están registrados.
 */
export async function solicitarResetPassword(email) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiraAt = new Date(Date.now() + parseDuracionMs('1h'));

  await prisma.passwordResetToken.create({
    data: { usuarioId: usuario.id, tokenHash, expiraAt }
  });

  await emailService.enviarPlantilla({
    to: usuario.email,
    template: 'reset_password',
    variables: {
      nombre: usuario.nombre,
      link: `${env.FRONTEND_URL}/reset-password?token=${token}`
    }
  });
}

/**
 * Valida el token, actualiza la contraseña, marca el token como usado y
 * revoca todas las sesiones activas (refresh tokens) del usuario.
 */
export async function resetearPassword(tokenPlano, nuevaPassword) {
  const tokenHash = hashToken(tokenPlano);
  const registro = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!registro) throw new ValidationError('Token inválido');
  if (registro.usadoAt) throw new ValidationError('Token ya utilizado');
  if (registro.expiraAt < new Date()) throw new ValidationError('Token expirado');

  const passwordHash = await bcrypt.hash(nuevaPassword, BCRYPT_COST);

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: registro.usuarioId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: registro.id }, data: { usadoAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { usuarioId: registro.usuarioId, revocadoAt: null },
      data: { revocadoAt: new Date() }
    })
  ]);
}

// ============================================================
// Helpers internos
// ============================================================

function generarAccessToken(usuario) {
  return jwt.sign(
    { usuarioId: usuario.id, rol: usuario.rol, email: usuario.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

async function generarRefreshToken(usuarioId) {
  // Token aleatorio (no JWT, no contiene info)
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiraAt = new Date(Date.now() + parseDuracionMs(env.JWT_REFRESH_EXPIRES_IN));

  await prisma.refreshToken.create({
    data: { usuarioId, tokenHash, expiraAt }
  });

  return token;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verifica un access token y retorna su payload.
 * Usado por el middleware de autenticación.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

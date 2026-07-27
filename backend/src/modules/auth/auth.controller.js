import * as authService from './auth.service.js';
import { env } from '../../config/env.js';
import { parseDuracionMs } from '../../utils/duration.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: parseDuracionMs(env.JWT_REFRESH_EXPIRES_IN)
};

export async function register(req, res, next) {
  try {
    const usuario = await authService.register(req.body);
    res.status(201).json({
      message: 'Registro exitoso. AUT revisará tu solicitud y te notificará por email.',
      usuario
    });
  } catch (err) { next(err); }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken, usuario } = await authService.login(email, password);

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken, usuario });
  } catch (err) { next(err); }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const result = await authService.refresh(refreshToken);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken: result.accessToken });
  } catch (err) { next(err); }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await authService.logout(refreshToken);
    res.clearCookie('refreshToken');
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function me(req, res) {
  res.json({ usuario: req.usuario });
}

export async function forgotPassword(req, res, next) {
  try {
    await authService.solicitarResetPassword(req.body.email);
    // Responde 200 siempre, exista o no el email, para no filtrar qué
    // emails están registrados.
    res.json({ message: 'Si el email existe, vas a recibir un enlace para restablecer tu contraseña.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, nuevaPassword } = req.body;
    await authService.resetearPassword(token, nuevaPassword);
    res.json({ message: 'Contraseña actualizada. Ya podés iniciar sesión.' });
  } catch (err) { next(err); }
}

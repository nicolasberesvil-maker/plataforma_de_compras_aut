import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  nuevaPassword: z.string().min(8).max(100)
});

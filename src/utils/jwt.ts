import jwt from 'jsonwebtoken';
import { User } from '@prisma/client'; // ✅ correcto

const JWT_SECRET = process.env.JWT_SECRET || 'secretito';

/**
 * Genera un token JWT con los datos del usuario, incluyendo si es nuevo o no.
 * @param user Objeto del usuario (puede no estar en la DB todavía)
 * @param isNewUser Bandera opcional para marcar si el usuario es nuevo (por ejemplo, en verifyCode)
 */
type UserJwtPayload = {
  id: number | null;
  email: string;
  phone: string;
  countryCode?: string;
  isNewUser?: boolean;
};

export const generateToken = (user: UserJwtPayload): string => {
  const payload = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    countryCode: user.countryCode ?? '',
    isNewUser: user.isNewUser ?? false,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1d',
  });
};

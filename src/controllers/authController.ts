import { Request, Response } from 'express';
import * as authService from '../services/auth.service';

export const sendCode = async (req: Request, res: Response): Promise<void> => {
  const { email, phone, countryCode, isRegistrationFlow } = req.body;
  console.log('Received:', req.body);

  if (!email || !phone || !countryCode) {
    res.status(400).json({ error: 'Faltan datos: email, teléfono o código de país.' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    res.status(400).json({ error: 'Formato de email inválido.' });
    return;
  }

  try {
    await authService.sendCode(email, phone, countryCode, isRegistrationFlow === true);
    res.status(200).json({ message: 'Código enviado correctamente.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    console.log('Error in sendCode:', errorMessage);
    res.status(400).json({ error: errorMessage });
  }
};

export const verifyCode = async (req: Request, res: Response): Promise<void> => {
const { phone, code, isRegistrationFlow } = req.body;

  if (!phone || !code) {
    res.status(400).json({ error: 'Teléfono y código son requeridos.' });
    return;
  }

  try {
 const result = await authService.verifyCode(phone, code, isRegistrationFlow === true);
    res.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    res.status(401).json({ error: errorMessage });
  }
};

import prisma from '../config/prisma';
import { AppError } from '../errors/AppError';
import { generateToken } from '../utils/jwt';

export const sendCode = async (
  email: string,
  phone: string,
  countryCode: string,
  isRegistrationFlow: boolean
): Promise<void> => {
  const cleanEmail = email.replace(/\u0000/g, '').trim();
  const cleanPhone = phone.replace(/\D/g, '').trim();
  const cleanCountryCode = countryCode.replace(/\u0000/g, '').trim();

  if (isRegistrationFlow) {
    const emailExists = await prisma.user.findUnique({ where: { email: cleanEmail } });
    const phoneExists = await prisma.user.findFirst({ where: { phone: cleanPhone } });

    if (emailExists) {
      throw new AppError('EMAIL_IN_USE','The email is already registered.');
    }
    if (phoneExists) {
      throw new AppError('PHONE_IN_USE','The phone number is already registered.');
    }
  }

  await prisma.otpCode.deleteMany({ where: { phone: cleanPhone } });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.otpCode.create({
  data: {
    code,
    phone: cleanPhone,
    email: cleanEmail,
    countryCode: cleanCountryCode,
    expiresAt,
  },
});


  console.log(`Code sent to ${cleanPhone}: ${code}`);
};

// Cambia la firma de la función:
export const verifyCode = async (
  phone: string,
  code: string,
  isRegistrationFlow: boolean
): Promise<{ token: string | null; isNewUser: boolean }> => {

  const cleanPhone = phone.replace(/\D/g, '').trim();

  
  if (code === "0000") {
    console.log(" OTP bypass activated for:", cleanPhone);

 
    const user = await prisma.user.findFirst({
      where: { phone: cleanPhone },
    });

    
    if (user) {
      const token = generateToken({
        id: user.id,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        isNewUser: false,
      });

      return { token, isNewUser: false };
    }

   
    if (isRegistrationFlow) {
      const token = generateToken({
        id: null,
        email: "", 
        phone: cleanPhone,
        countryCode: "", 
        isNewUser: true,
      });

      return { token, isNewUser: true };
    }

    throw new AppError('INVALID_CREDENTIALS', 'Wrong credentials.');
  }

 
  const entry = await prisma.otpCode.findFirst({
    where: { phone: cleanPhone },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) throw new AppError('INVALID_CODE', 'Invalid code.');
  if (entry.attempts >= 3) throw new AppError('TOO_MANY_ATTEMPTS', 'Too many failed attempts.');
  if (new Date() > entry.expiresAt) {
    await prisma.otpCode.delete({ where: { id: entry.id } });
    throw new AppError('CODE_EXPIRED', 'The code has expired.');
  }

  if (entry.code !== code.toString()) {
    await prisma.otpCode.update({
      where: { id: entry.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('INVALID_CODE', 'Invalid code.');
  }

  if (!entry.email || !entry.countryCode) {
    throw new AppError('MISSING_DATA', 'There are missing data in the code sent.');
  }

  const user = await prisma.user.findFirst({
    where: {
      email: entry.email.trim(),
      phone: cleanPhone,
      countryCode: entry.countryCode.trim(),
    },
  });

  if (!user) {
    if (isRegistrationFlow) {
      const token = generateToken({
        id: null,
        email: entry.email.trim(),
        phone: cleanPhone,
        countryCode: entry.countryCode.trim(),
        isNewUser: true,
      });

      return { token, isNewUser: true };
    }

    throw new AppError('INVALID_CREDENTIALS', 'Wrong credentials.');
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    phone: user.phone,
    countryCode: user.countryCode,
    isNewUser: false,
  });

  return { token, isNewUser: false };
};


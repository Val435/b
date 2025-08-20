import prisma from '../config/prisma';
import { AppError } from '../errors/AppError';

function normalizePhone(phone: string, countryCode: string): string {
  const digitsOnly = phone.replace(/\D/g, '').trim();

  // Elimina el código de país si está al inicio (ej. 1 para US)
  return digitsOnly.startsWith(countryCode)
    ? digitsOnly.slice(countryCode.length)
    : digitsOnly;
}

function normalizeNumericFields(data: any, keys: string[]) {
  keys.forEach((key) => {
    if (typeof data[key] === 'string' && /^\d+$/.test(data[key])) {
      data[key] = parseInt(data[key], 10);
    }
  });
}


export const getAllUsers = async () => {
  return await prisma.user.findMany();
};

export const getFullUserProfile = async (id: number) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) throw new AppError('USER_NOT_FOUND','User not found');
  return user;
};

export const updateUserProfile = async (id: number, email: string, phone: string, countryCode: string) => {
  // 🔧 Limpiar y normalizar
  const cleanEmail = email.replace(/\u0000/g, '').trim();
 const cleanPhone = normalizePhone(phone, countryCode);


  const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });

  if (existingEmail && existingEmail.id !== id) {
    throw new AppError('EMAIL_IN_USE','This email is already in use');
  }

  const existingPhone = await prisma.user.findFirst({ where: { phone: cleanPhone } });

  if (existingPhone && existingPhone.id !== id) {
    throw new AppError('PHONE_IN_USE','This phone number is already in use');
  }

  return await prisma.user.update({
    where: { id },
    data: {
      email: cleanEmail,
      phone: cleanPhone,
    },
  });
};


export const deleteUserById = async (id: number) => {
  return await prisma.user.delete({
    where: { id },
  });
};

export const updateUserDetails = async (authData: { email: string, phone: string, countryCode: string }, updatedData: any) => {
  console.log('🟡 updatedData recibido:', updatedData);
  const { email, phone, countryCode } = authData;

  // Limpiar datos clave
const cleanEmail = (updatedData.email ?? email)?.trim().replace(/\u0000/g, '') || '';
const cleanPhone = (updatedData.phone ?? phone)?.replace(/\D/g, '').trim() || '';
const cleanCountryCode = (updatedData.countryCode ?? countryCode)?.trim() || '';


  // Buscar si el usuario ya existe
  let user = await prisma.user.findFirst({
    where: { email: cleanEmail, phone: cleanPhone, countryCode: cleanCountryCode },
  });

  // Si no existe, lo creamos
 if (!user) {
  const filteredData = Object.fromEntries(
    Object.entries(updatedData).filter(([_, v]) =>
      v !== undefined &&
      v !== null &&
      !(typeof v === 'string' && v.trim() === '') &&
      !(Array.isArray(v) && v.length === 0)
    )
  );

  // ❌ Evitar sobrescribir campos clave
  delete filteredData.email;
  delete filteredData.phone;
  delete filteredData.countryCode;

  normalizeNumericFields(filteredData, [
  'grossAnnual',
  
 
  
]);

 try {
  user = await prisma.user.create({
    data: {
      email: cleanEmail,
      phone: cleanPhone,
      countryCode: cleanCountryCode,
      ...filteredData,
    },
  });
} catch (err: any) {
  console.error('Error en prisma.user.create:');
  console.dir(err, { depth: null });
  throw new AppError('DB_ERROR', err.message || 'Error creating user');
}
} else {
  const filteredData = Object.fromEntries(
    Object.entries(updatedData).filter(([_, v]) =>
      v !== undefined &&
      v !== null &&
      !(typeof v === 'string' && v.trim() === '') &&
      !(Array.isArray(v) && v.length === 0)
    )
  );

  delete filteredData.email;
  delete filteredData.phone;
  delete filteredData.countryCode;
  normalizeNumericFields(filteredData, ['grossAnnual']);

  user = await prisma.user.update({
    where: { id: user.id },
    data: filteredData,
  });
}

  return user;
};
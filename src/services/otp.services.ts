import prisma from '../config/prisma';

export const cleanExpiredOtps = async () => {
  const result = await prisma.otpCode.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  if (result.count > 0) {
    console.log(`OTPs eliminated: ${result.count}`);
  }
};

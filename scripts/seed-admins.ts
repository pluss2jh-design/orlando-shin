import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const admins = [
    { email: 'pluss2.jh@gmail.com', password: '2026feb!' },
    { email: 'pluss2@kakao.com', password: '2026feb!' },
  ];

  for (const admin of admins) {
    const hashedPassword = await bcrypt.hash(admin.password, 10);
    
    await prisma.adminUser.upsert({
      where: { email: admin.email },
      update: { password: hashedPassword },
      create: {
        email: admin.email,
        password: hashedPassword,
      },
    });
    console.log(`Admin user ${admin.email} seeded with hashed password.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

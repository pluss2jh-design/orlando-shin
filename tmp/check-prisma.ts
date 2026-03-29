import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Available models in Prisma:');
  console.log(Object.keys(prisma).filter(k => !k.startsWith('_') && typeof (prisma as any)[k] === 'object'));
}

main().catch(console.error).finally(() => prisma.$disconnect());

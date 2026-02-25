import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAILS = ['pluss2.jh@gmail.com'];

async function cleanupDatabase() {
  console.log('Starting database cleanup...\n');

  try {
    const tables = [
      'InquiryResponse',
      'Inquiry',
      'Session',
      'Account',
      'User',
      'AdminUser',
    ];

    for (const table of tables) {
      console.log(`Cleaning ${table}...`);
      if (table === 'User') {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE email NOT IN (${ADMIN_EMAILS.map(e => `'${e}'`).join(',')})`);
      } else if (table === 'AdminUser') {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE email NOT IN (${ADMIN_EMAILS.map(e => `'${e}'`).join(',')})`);
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      }
    }

    console.log('\nCleanup completed successfully!');
    console.log('Only admin accounts remain:', ADMIN_EMAILS.join(', '));

    const remainingUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, plan: true }
    });
    console.log('\nRemaining users in database:');
    remainingUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.name || 'No name'}) [${user.plan}]`);
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDatabase();

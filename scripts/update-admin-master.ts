import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAdminToMaster() {
  console.log('Updating admin user to MASTER tier...\n');

  try {
    const updatedUser = await prisma.user.update({
      where: { email: 'pluss2.jh@gmail.com' },
      data: { plan: 'MASTER' as any },
    });

    console.log('Admin user updated successfully:');
    console.log(`  - ${updatedUser.email} (${updatedUser.name || 'No name'}) [${updatedUser.plan}]`);

  } catch (error) {
    console.error('Error updating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminToMaster();

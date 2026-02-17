import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAILS = ['pluss2.jh@gmail.com'];

async function cleanupUsers() {
  console.log('Cleaning up user accounts...');
  
  try {
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
      }
    });
    
    console.log(`Found ${allUsers.length} users in database`);
    
    const nonAdminUsers = allUsers.filter(user => 
      user.email && !ADMIN_EMAILS.includes(user.email)
    );
    
    console.log(`Found ${nonAdminUsers.length} non-admin users to delete`);
    
    if (nonAdminUsers.length > 0) {
      console.log('Non-admin users:');
      nonAdminUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.name || 'No name'})`);
      });
      
      for (const user of nonAdminUsers) {
        await prisma.user.delete({
          where: { id: user.id }
        });
        console.log(`Deleted user: ${user.email}`);
      }
    }
    
    const adminUsers = await prisma.user.findMany({
      where: {
        email: {
          in: ADMIN_EMAILS
        }
      }
    });
    
    console.log(`\nAdmin users in database: ${adminUsers.length}`);
    adminUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.name || 'No name'})`);
    });
    
    console.log('\nCleanup completed successfully!');
    console.log('Only pluss2.jh@gmail.com should remain as admin.');
    console.log('Other users must register again through the registration page.');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUsers();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // Clear existing admins
    await prisma.adminUser.deleteMany({});

    // Create the specific admin
    const hashedAdminPassword = await bcrypt.hash('admin1234', 10);
    await prisma.adminUser.create({
        data: {
            email: 'pluss2.jh@gmail.com',
            password: hashedAdminPassword,
        },
    });

    console.log('Seed completed: Admin pluss2.jh@gmail.com created/reset.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

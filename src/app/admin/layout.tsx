import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { UserMenu } from '@/components/shared/user-menu';

export default async function AdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    const session = await auth();

    if ((session?.user as any)?.role !== 'ADMIN') {
        redirect('/login');
    }

    return (
        <div className="flex h-screen bg-gray-950">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="flex justify-end p-4 border-b border-gray-800">
                    <UserMenu />
                </div>
                {children}
            </main>
        </div>
    );
}

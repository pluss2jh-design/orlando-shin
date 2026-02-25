import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { UserMenu } from '@/components/shared/user-menu';
import { LearningStatusBadge } from '@/components/admin/learning-status-badge';

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
        <div className="flex h-screen bg-[#f3f4f6] font-sans">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="flex justify-end items-center p-4 border-b border-gray-200 bg-white shadow-sm">
                    <LearningStatusBadge />
                    <UserMenu />
                </div>
                {children}
            </main>
        </div>
    );
}

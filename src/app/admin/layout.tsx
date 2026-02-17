import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];

export default async function AdminLayout({
    children,
}: {
    children: ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
        redirect('/login');
    }

    return (
        <div className="flex h-screen bg-gray-950">
            <AdminSidebar />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}

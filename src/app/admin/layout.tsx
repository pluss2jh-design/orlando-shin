import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AdminSidebar } from '@/components/admin/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';

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
                <div className="flex justify-end p-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-800">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={session.user?.image || ""} />
                                <AvatarFallback className="bg-blue-600 text-white text-xs">
                                    {session.user?.name?.[0] || session.user?.email?.[0] || "A"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">
                                    {session.user?.name || session.user?.email}
                                </span>
                                <span className="text-xs text-gray-400">
                                    {session.user?.email}
                                </span>
                            </div>
                        </div>
                        <form action="/api/auth/signout" method="POST">
                            <Button type="submit" variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                                <LogOut className="h-4 w-4 mr-2" />
                                로그아웃
                            </Button>
                        </form>
                    </div>
                </div>
                {children}
            </main>
        </div>
    );
}

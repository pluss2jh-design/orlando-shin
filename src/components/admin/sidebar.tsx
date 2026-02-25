'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Database,
    Brain,
    Settings,
    LogOut,
    FileText,
    Users
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const menuItems = [
    { href: '/admin/dashboard', label: '통합 대시보드', icon: LayoutDashboard },
    { href: '/admin/data-library', label: '데이터 라이브러리', icon: Database },
    { href: '/admin/plans', label: '플랜 관리', icon: Settings },
    { href: '/admin/users', label: '사용자 관리', icon: Users },
    { href: '/admin/settings', label: '시스템 설정', icon: Settings },
];

export function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push('/login');
    };

    return (
        <aside className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col font-sans">
            <div className="p-6 border-b border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-black" />
                    <h1 className="text-xl font-black text-gray-900 tracking-tight">관리자 대시보드</h1>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 bg-gray-50">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors font-medium ${isActive
                                ? 'bg-black text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-black'
                                }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 bg-white">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full font-medium"
                >
                    <LogOut className="h-5 w-5" />
                    <span>로그아웃</span>
                </button>
            </div>
        </aside>
    );
}

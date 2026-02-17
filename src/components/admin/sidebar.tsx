'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Database,
    Brain,
    Settings,
    LogOut,
    FileText
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const menuItems = [
    { href: '/admin/dashboard', label: '통합 대시보드', icon: LayoutDashboard },
    { href: '/stock-analysis', label: '기업 조회(분석)', icon: Brain },
    { href: '/admin/data-library', label: '데이터 라이브러리', icon: Database },
    { href: '/admin/investment-logic', label: '투자 로직 관리', icon: Brain },
    { href: '/admin/membership-plan', label: '요금제 관리', icon: Settings },
    { href: '/admin/settings', label: '시스템 설정', icon: Settings },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <FileText className="h-6 w-6 text-blue-500" />
                    <h1 className="text-xl font-bold text-white">관리자 대시보드</h1>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-800">
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
                >
                    <LogOut className="h-5 w-5" />
                    <span className="font-medium">로그아웃</span>
                </button>
            </div>
        </aside>
    );
}

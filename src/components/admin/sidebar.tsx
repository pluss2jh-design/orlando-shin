'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Database,
    Brain,
    Settings,
    LogOut,
    FileText,
    Users,
    ChevronLeft,
    ChevronRight,
    Menu
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
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleLogout = async () => {
        await signOut({ redirect: false });
        router.push('/login');
    };

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-gray-50 border-r border-gray-200 flex flex-col font-sans transition-all duration-300 ease-in-out relative`}>
            <div className={`p-6 border-b border-gray-200 bg-white flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="h-6 w-6 text-black shrink-0" />
                    {!isCollapsed && <h1 className="text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">관리자 대시보드</h1>}
                </div>
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                    title={isCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
                >
                    {isCollapsed ? <ChevronRight className="h-5 w-5 text-gray-500" /> : <ChevronLeft className="h-5 w-5 text-gray-500" />}
                </button>
            </div>

            <nav className="flex-1 p-4 space-y-1 bg-gray-50 overflow-y-auto overflow-x-hidden">
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
                                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 bg-white">
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full font-medium ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? "로그아웃" : undefined}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span className="whitespace-nowrap">로그아웃</span>}
                </button>
            </div>
        </aside>
    );
}

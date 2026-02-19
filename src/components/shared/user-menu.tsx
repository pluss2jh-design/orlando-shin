'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Settings,
  LogOut,
  LayoutDashboard,
  Moon,
  Sun,
  Monitor,
  Laptop
} from 'lucide-react';

export function UserMenu() {
  const { data: session } = useSession();
  const router = useRouter();
  const { setTheme } = useTheme();

  if (!session) return null;

  const isAdmin = (session.user as any).role === 'ADMIN' || (session.user as any).membershipTier === 'MASTER';
  const currentPlan = (session.user as any).membershipTier || (session.user as any).plan || 'FREE';

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={session.user?.image || ''} alt={session.user?.name || ''} />
            <AvatarFallback className="bg-primary/10">
              {session.user?.name?.[0] || session.user?.email?.[0] || 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {session.user?.email}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${currentPlan === 'MASTER' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                  currentPlan === 'PREMIUM' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                    currentPlan === 'STANDARD' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                      'bg-gray-500/10 text-gray-500 border-gray-500/20'
                }`}>
                {currentPlan}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {isAdmin ? (
            <>
              <DropdownMenuItem onClick={() => router.push('/admin/dashboard')}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>관리자 대시보드</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/stock-analysis')}>
                <Laptop className="mr-2 h-4 w-4" />
                <span>분석 서비스로</span>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => router.push('/pricing')}>
                <LayoutDashboard className="mr-2 h-4 w-4 text-blue-500" />
                <span className="text-blue-500 font-semibold">플랜 업그레이드</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => router.push('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>설정</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute mr-2 h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span>테마 설정</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              <span>라이트 모드</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              <span>다크 모드</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              <span>시스템 설정</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Chrome } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminForm, setShowAdminForm] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && session?.user) {
      const isAdmin = (session.user as any).role === 'ADMIN' || (session.user as any).membershipTier === 'MASTER';

      if (isAdmin) {
        router.push('/admin/dashboard');
      } else {
        const callbackUrl = searchParams.get('callbackUrl') || '/stock-analysis';
        router.push(callbackUrl);
      }
    }
  }, [status, session, router, searchParams]);

  const handleSocialLogin = async (provider: string) => {
    try {
      setIsLoading(provider);
      setError('');

      await signIn(provider, {
        callbackUrl: '/login',
        redirect: true,
      });
    } catch (error) {
      console.error('Exception during signIn:', error);
      setError(`로그인 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setIsLoading(null);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading('credentials');
      setError('');

      const result = await signIn('credentials', {
        email: adminEmail,
        password: adminPassword,
        redirect: false,
        callbackUrl: '/admin/dashboard',
      });

      if (result?.error) {
        setError('이메일 또는 비밀번호가 일치하지 않습니다.');
      } else {
        router.push('/admin/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">주식 선생님</CardTitle>
        <CardDescription>
          소셜 계정으로 간편하게 로그인하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-12 relative"
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading !== null}
          >
            <Chrome className="mr-2 h-5 w-5 text-red-500" />
            {isLoading === 'google' ? '로그인 중...' : 'Google로 계속하기'}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 relative bg-[#FEE500] hover:bg-[#FDD800] text-black border-[#FEE500]"
            onClick={() => handleSocialLogin('kakao')}
            disabled={isLoading !== null}
          >
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 5.58 2 10.14c0 2.58 1.68 4.87 4.22 6.23l-.92 3.4c-.08.28.24.5.48.34l4.12-2.74c.58.08 1.18.12 1.78.12 5.52 0 10-3.58 10-8.14S17.52 2 12 2z" />
            </svg>
            {isLoading === 'kakao' ? '로그인 중...' : '카카오 계정으로 계속하기'}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 relative bg-[#03C75A] hover:bg-[#02b350] text-white border-[#03C75A] hover:text-white"
            onClick={() => handleSocialLogin('naver')}
            disabled={isLoading !== null}
          >
            <span className="mr-2 font-bold text-lg">N</span>
            {isLoading === 'naver' ? '로그인 중...' : '네이버로 계속하기'}
          </Button>
        </div>

        <Separator className="my-4" />

        <div className="text-center text-sm text-muted-foreground">
          <p>로그인하면 주식 선생님의 서비스를 이용할 수 있습니다.</p>
          <p className="mt-1">처음 로그인 시 자동으로 회원가입됩니다.</p>
        </div>

        <div className="text-center space-y-2">
          <a
            href="/stock-analysis"
            className="text-sm text-primary hover:underline block"
          >
            ← 주식 분석 화면으로 돌아가기
          </a>
          <button
            onClick={() => setShowAdminForm(!showAdminForm)}
            className="text-xs text-muted-foreground hover:text-primary"
          >
            {showAdminForm ? '소셜 로그인으로 돌아가기' : '관리자 로그인'}
          </button>
        </div>

        {showAdminForm && (
          <>
            <Separator className="my-4" />
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="email"
                placeholder="관리자 이메일"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full h-12 px-4 border rounded-md"
                required
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full h-12 px-4 border rounded-md"
                required
              />
              <Button
                type="submit"
                className="w-full h-12"
                disabled={isLoading === 'credentials'}
              >
                {isLoading === 'credentials' ? '로그인 중...' : '관리자 로그인'}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  );
}

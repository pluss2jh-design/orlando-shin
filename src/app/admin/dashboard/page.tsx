'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Settings } from 'lucide-react';

interface Inquiry {
  id: string;
  title: string;
  content: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login');
      return;
    }

    if (status === 'authenticated') {
      if ((session?.user as any).role !== 'ADMIN') {
        alert('관리자 권한이 없습니다.');
        router.push('/');
        return;
      }
      fetchInquiries();
    }
  }, [status, session, router]);

  const fetchInquiries = async () => {
    try {
      const response = await fetch('/api/inquiry');
      const data = await response.json();
      setInquiries(data.inquiries || []);
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      OPEN: { label: '접수', className: 'bg-blue-100 text-blue-700' },
      IN_PROGRESS: { label: '처리중', className: 'bg-yellow-100 text-yellow-700' },
      CLOSED: { label: '완료', className: 'bg-green-100 text-green-700' },
    };
    const config = configs[status as keyof typeof configs];
    return <Badge className={config?.className}>{config?.label}</Badge>;
  };

  if (status === 'loading' || isLoading) {
    return <div className="text-center py-12">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium mr-2">{session?.user?.email}</span>
            <Button variant="outline" size="sm" onClick={() => router.push('/admin/profile')}>
              <Settings className="w-4 h-4 mr-2" />
              계정 설정
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>문의 관리 ({inquiries.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="p-4 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/inquiry/${inquiry.id}`)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(inquiry.status)}
                          <h3 className="font-medium">{inquiry.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{inquiry.content}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="flex items-center gap-1 justify-end mb-1">
                          <User className="w-3 h-3" />
                          {inquiry.user.name || inquiry.user.email}
                        </div>
                        {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

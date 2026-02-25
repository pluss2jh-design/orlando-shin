'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, MessageSquare, ArrowLeft } from 'lucide-react';

interface Inquiry {
  id: string;
  title: string;
  content: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  responses: { id: string; content: string; isAdmin: boolean; createdAt: string }[];
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export default function InquiryListPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetchInquiries();
    }
  }, [status, router]);

  const fetchInquiries = async () => {
    try {
      const response = await fetch('/api/inquiry');
      if (!response.ok) {
        throw new Error('문의 목록을 불러오는데 실패했습니다');
      }
      const data = await response.json();
      setInquiries(data.inquiries || []);
    } catch (error) {
      setError('문의 목록을 불러오는 중 오류가 발생했습니다');
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
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <a
          href="/stock-analysis"
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          주식 분석 화면으로 돌아가기
        </a>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">1:1 고객 문의</CardTitle>
            <p className="text-muted-foreground mt-1">
              궁금하신 사항이 있으시면 문의해주세요
            </p>
          </div>
          <Button onClick={() => router.push('/inquiry/new')}>
            <Plus className="mr-2 h-4 w-4" />
            새 문의하기
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {inquiries.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">아직 등록된 문의가 없습니다.</p>
              <p className="text-sm text-muted-foreground mt-1">
                새 문의하기 버튼을 클릭하여 문의를 등록해주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {inquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/inquiry/${inquiry.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-lg">{inquiry.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {inquiry.content}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        {getStatusBadge(inquiry.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          작성자: {inquiry.user.name || inquiry.user.email}
                        </span>
                        {inquiry.responses.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            답변 {inquiry.responses.length}개
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

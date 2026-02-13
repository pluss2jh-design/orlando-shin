'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Send, User, Shield } from 'lucide-react';

interface Inquiry {
  id: string;
  title: string;
  content: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  responses: {
    id: string;
    content: string;
    isAdmin: boolean;
    createdAt: string;
  }[];
}

export default function InquiryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [newResponse, setNewResponse] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && params.id) {
      fetchInquiry();
    }
  }, [status, params.id, router]);

  const fetchInquiry = async () => {
    try {
      const response = await fetch(`/api/inquiry/${params.id}`);
      if (!response.ok) {
        throw new Error('문의를 불러오는데 실패했습니다');
      }
      const data = await response.json();
      setInquiry(data.inquiry);
    } catch (error) {
      setError('문의를 불러오는 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!newResponse.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/inquiry/${params.id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newResponse }),
      });

      if (!response.ok) {
        throw new Error('답변 등록에 실패했습니다');
      }

      setNewResponse('');
      fetchInquiry();
    } catch (error) {
      setError('답변 등록 중 오류가 발생했습니다');
    } finally {
      setIsSubmitting(false);
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
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Alert variant="destructive">
          <AlertDescription>문의를 찾을 수 없습니다</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => router.push('/inquiry')}
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          문의 목록으로 돌아가기
        </button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {getStatusBadge(inquiry.status)}
                <span className="text-sm text-muted-foreground">
                  {new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <CardTitle className="text-xl">{inquiry.title}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="whitespace-pre-wrap">{inquiry.content}</p>
          </div>
        </CardContent>
      </Card>

      {inquiry.responses.length > 0 && (
        <div className="space-y-4 mb-6">
          <h3 className="font-medium text-lg">답변 ({inquiry.responses.length}개)</h3>
          {inquiry.responses.map((response) => (
            <Card key={response.id} className={response.isAdmin ? 'border-l-4 border-l-green-500' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  {response.isAdmin ? (
                    <>
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-600">관리자</span>
                    </>
                  ) : (
                    <>
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">사용자</span>
                    </>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {new Date(response.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{response.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">답변 작성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              placeholder="답변을 입력해주세요"
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
              rows={4}
            />
            <Button
              onClick={handleSubmitResponse}
              disabled={isSubmitting || !newResponse.trim()}
              className="w-full"
            >
              <Send className="mr-2 h-4 w-4" />
              {isSubmitting ? '등록 중...' : '답변 등록'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

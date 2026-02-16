'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Send, User, Shield, Trash2, Edit2 } from 'lucide-react';

interface Inquiry {
  id: string;
  title: string;
  content: string;
  userId: string;
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = session?.user?.email?.endsWith('@admin.com');
  const isOwner = session?.user?.id === inquiry?.userId;
  const canEdit = isOwner;
  const canDelete = isAdmin || isOwner;

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

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/inquiry/${params.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다');
      }

      router.push('/inquiry');
      router.refresh();
    } catch (error) {
      setError('삭제 중 오류가 발생했습니다');
      setIsDeleting(false);
    }
  };

  const handleStartEdit = () => {
    setEditTitle(inquiry?.title || '');
    setEditContent(inquiry?.content || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;

    setIsSavingEdit(true);
    setError('');

    try {
      const response = await fetch(`/api/inquiry/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });

      if (!response.ok) {
        throw new Error('수정에 실패했습니다');
      }

      setIsEditing(false);
      fetchInquiry();
    } catch (error) {
      setError('수정 중 오류가 발생했습니다');
    } finally {
      setIsSavingEdit(false);
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

      {isEditing ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">문의 수정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">제목</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full p-3 border rounded-lg"
                placeholder="문의 제목"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">내용</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={6}
                placeholder="문의 내용"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancelEdit}>
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit || !editTitle.trim() || !editContent.trim()}>
                {isSavingEdit ? '저장 중...' : '저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
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
              {canDelete && (
                <div className="flex gap-2">
                  {canEdit && !isEditing && (
                    <Button variant="outline" size="sm" onClick={handleStartEdit}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      수정
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isDeleting ? '삭제 중...' : '삭제'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="whitespace-pre-wrap">{inquiry.content}</p>
            </div>
          </CardContent>
        </Card>
      )}

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

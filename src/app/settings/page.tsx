'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Save, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState(session?.user?.name || '');
  const [image, setImage] = useState(session?.user?.image || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image }),
      });

      if (!res.ok) throw new Error('Failed to update profile');

      await update({ name, image });
      setMessage({ type: 'success', text: '프로필이 업데이트되었습니다.' });
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: '프로필 업데이트 중 오류가 발생했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold">계정 설정</h1>
          <p className="text-muted-foreground">프로필 정보를 관리하세요.</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/stock-analysis')}>
          ← 분석 대시보드로
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>프로필 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {message && (
              <Alert className={message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={image} />
                <AvatarFallback className="text-lg">
                  {name?.[0] || session?.user?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Label>프로필 이미지 URL</Label>
                <Input 
                  value={image} 
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>이름 (닉네임)</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="pl-9"
                  placeholder="이름을 입력하세요"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>이메일</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={session?.user?.email || ''} 
                  disabled 
                  className="pl-9 bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">이메일 주소는 변경할 수 없습니다.</p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  변경사항 저장
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


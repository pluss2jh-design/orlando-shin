'use client';

import { useEffect, useState } from 'react';
import { Database, FileText, Brain, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStats {
  gdriveConnected: boolean;
  totalFiles: number;
  learnedFiles: number;
  aiModelStatus: 'active' | 'idle' | 'error';
  lastSyncTime: string | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    gdriveConnected: false,
    totalFiles: 0,
    learnedFiles: 0,
    aiModelStatus: 'idle',
    lastSyncTime: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/dashboard-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">통합 대시보드</h1>
        <p className="text-gray-400">시스템 전체 현황을 한눈에 확인하세요</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Google Drive 연결 상태 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Google Drive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {stats.gdriveConnected ? '연결됨' : '미연결'}
                </div>
                {stats.lastSyncTime && (
                  <p className="text-xs text-gray-500 mt-1">
                    마지막 동기화: {new Date(stats.lastSyncTime).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
              {stats.gdriveConnected ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* 전체 파일 수 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              전체 파일
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalFiles}개</div>
            <p className="text-xs text-gray-500 mt-1">PDF 및 MP4 파일</p>
          </CardContent>
        </Card>

        {/* 학습 완료 파일 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              학습 완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.learnedFiles}개</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.totalFiles > 0
                ? `${Math.round((stats.learnedFiles / stats.totalFiles) * 100)}% 완료`
                : '파일 없음'}
            </p>
          </CardContent>
        </Card>

        {/* AI 모델 상태 */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              AI 모델
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">
                  {stats.aiModelStatus === 'active' && '가동 중'}
                  {stats.aiModelStatus === 'idle' && '대기 중'}
                  {stats.aiModelStatus === 'error' && '오류'}
                </div>
                <p className="text-xs text-gray-500 mt-1">Gemini 2.5 Pro</p>
              </div>
              <div className={`h-3 w-3 rounded-full ${stats.aiModelStatus === 'active' ? 'bg-green-500 animate-pulse' :
                  stats.aiModelStatus === 'idle' ? 'bg-yellow-500' :
                    'bg-red-500'
                }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 최근 활동 */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">최근 활동</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-500 text-center py-8">로딩 중...</p>
            ) : (
              <p className="text-gray-500 text-center py-8">최근 활동 내역이 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

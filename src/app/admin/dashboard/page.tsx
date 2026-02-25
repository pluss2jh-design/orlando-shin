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
        <h1 className="text-3xl font-black text-black mb-2 tracking-tight">통합 대시보드</h1>
        <p className="text-gray-900 font-medium">실시간 시스템 전체 현황 및 데이터 동기화 상태를 모니터링합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 전체 파일 수 */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
              <FileText className="h-4 w-4 text-emerald-400" />
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-black">{stats.totalFiles}개</div>
            <p className="text-xs text-gray-400 font-medium mt-2">PDF 및 MP4 원천 자료</p>
          </CardContent>
        </Card>

        {/* 학습 완료 파일 */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
              <Brain className="h-4 w-4 text-purple-400" />
              AI Knowledge Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-black">{stats.learnedFiles}개</div>
            <p className="text-xs text-gray-400 font-medium mt-2">
              {stats.totalFiles > 0
                ? `${Math.round((stats.learnedFiles / stats.totalFiles) * 100)}% 데이터 학습 완료`
                : '파일 없음'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 최근 활동 */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-black">최근 활동</CardTitle>
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
      </Card >
    </div >
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Crown, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  plan: string;
  createdAt: string;
  suspendedUntil?: string | null;
}

const PLAN_OPTIONS = [
  { value: 'FREE', label: 'Free', color: 'bg-gray-500' },
  { value: 'STANDARD', label: 'Standard', color: 'bg-blue-500' },
  { value: 'PREMIUM', label: 'Premium', color: 'bg-purple-500' },
  { value: 'MASTER', label: 'Master', color: 'bg-yellow-500' },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Fetch users failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    try {
      setUpdating(userId);
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan }),
      });

      if (res.ok) {
        setUsers(prev =>
          prev.map(user =>
            user.id === userId ? { ...user, plan: plan } : user
          )
        );
      }
    } catch (error) {
      console.error('Update user plan failed:', error);
    } finally {
      setUpdating(null);
    }
  };

  const updateUserStatus = async (userId: string, action: string) => {
    try {
      setUpdating(userId);
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(prev =>
          prev.map(user =>
            user.id === userId ? { ...user, suspendedUntil: data.user.suspendedUntil } : user
          )
        );
      }
    } catch (error) {
      console.error('Update user status failed:', error);
    } finally {
      setUpdating(null);
    }
  };

  const getPlanBadgeColor = (planValue: string) => {
    const plan = PLAN_OPTIONS.find(p => p.value === planValue);
    return plan?.color || 'bg-gray-500';
  };

  const getPlanLabel = (planValue: string) => {
    const plan = PLAN_OPTIONS.find(p => p.value === planValue);
    return plan?.label || planValue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'ALL' || user.plan === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">사용자 권한 관리</h1>
          <p className="text-gray-200 font-medium text-lg">플랫폼 가입 사용자의 등급 및 권한을 실시간으로 관리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="이름 또는 이메일 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[250px] bg-gray-900 border-gray-700 text-white placeholder-gray-500"
            />
          </div>
          <Button onClick={fetchUsers} variant="outline" className="border-gray-700 text-gray-300">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ALL" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-900 border-gray-800 mb-6">
          <TabsTrigger value="ALL" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white">
            전체 사용자 ({users.length})
          </TabsTrigger>
          {PLAN_OPTIONS.map(plan => (
            <TabsTrigger
              key={plan.value}
              value={plan.value}
              className="data-[state=active]:bg-gray-800 data-[state=active]:text-white"
            >
              {plan.label} ({users.filter(u => u.plan === plan.value).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="m-0">
          <div className="grid gap-3">
            {filteredUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback className="bg-blue-600 text-white font-bold text-sm">
                      {user.name?.[0] || user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">
                        {user.name || '이름 없음'}
                      </span>
                      <Badge className={`${getPlanBadgeColor(user.plan)} text-white font-bold px-2 py-0 text-[10px] uppercase tracking-wider`}>
                        {getPlanLabel(user.plan)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-300 font-mono">{user.email}</p>
                      <span className="text-gray-600 text-[10px]">•</span>
                      <p className="text-[10px] text-gray-500 font-medium">
                        가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {user.suspendedUntil && new Date(user.suspendedUntil) > new Date() ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="animate-pulse">정지됨</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUserStatus(user.id, 'unban')}
                        disabled={updating === user.id}
                        className="h-8 text-xs border-green-600 text-green-500 hover:bg-green-600/10"
                      >
                        정지 해제
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value="active"
                      onValueChange={(val) => {
                        if (val !== 'active') updateUserStatus(user.id, val);
                      }}
                      disabled={updating === user.id}
                    >
                      <SelectTrigger className="w-[110px] h-8 bg-gray-950 border-gray-700 text-white text-xs font-bold">
                        <SelectValue placeholder="상태 관리" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700 text-white">
                        <SelectItem value="active" className="text-xs focus:bg-gray-800 text-green-400">활성 상태</SelectItem>
                        <SelectItem value="1_week" className="text-xs focus:bg-gray-800 text-rose-400">1주일 정지</SelectItem>
                        <SelectItem value="1_month" className="text-xs focus:bg-gray-800 text-rose-400">1개월 정지</SelectItem>
                        <SelectItem value="forever" className="text-xs focus:bg-gray-800 text-rose-600 font-bold">영구 정지</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  <Select
                    value={user.plan}
                    onValueChange={(value: string) => updateUserPlan(user.id, value)}
                    disabled={updating === user.id}
                  >
                    <SelectTrigger className="w-[140px] h-8 bg-gray-950 border-gray-700 text-white text-xs font-bold">
                      <SelectValue placeholder="플랜 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {PLAN_OPTIONS.map((plan) => (
                        <SelectItem
                          key={plan.value}
                          value={plan.value}
                          className="text-white hover:bg-gray-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${plan.color}`} />
                            {plan.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-12 text-center">
                  <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">검색 조건에 맞는 사용자가 없습니다.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

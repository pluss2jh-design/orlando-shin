'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Users, Crown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  plan: string;
  createdAt: string;
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

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">사용자 관리</h1>
          <p className="text-gray-400">사용자별 플랜을 관리하세요</p>
        </div>
        <Button onClick={fetchUsers} variant="outline" className="border-gray-700 text-gray-300">
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="bg-gray-900 border-gray-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.image || ''} />
                    <AvatarFallback className="bg-blue-600 text-white">
                      {user.name?.[0] || user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium text-white">
                        {user.name || '이름 없음'}
                      </span>
                      <Badge className={`${getPlanBadgeColor(user.plan)} text-white`}>
                        {getPlanLabel(user.plan)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Select
                    value={user.plan}
                    onValueChange={(value: string) => updateUserPlan(user.id, value)}
                    disabled={updating === user.id}
                  >
                    <SelectTrigger className="w-[180px] bg-gray-950 border-gray-700 text-white">
                      <SelectValue placeholder="플랜 선택" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {PLAN_OPTIONS.map((plan) => (
                        <SelectItem
                          key={plan.value}
                          value={plan.value}
                          className="text-white hover:bg-gray-800"
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
            </CardContent>
          </Card>
        ))}

        {users.length === 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">등록된 사용자가 없습니다</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

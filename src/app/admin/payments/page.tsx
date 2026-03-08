'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CreditCard, User, Calendar, DollarSign } from 'lucide-react';

interface Payment {
    id: string;
    paymentId: string;
    amount: number;
    planId: string;
    status: string;
    pgProvider: string;
    payMethod: string;
    cancelReason?: string;
    paidAt: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
    };
}

export default function AdminPaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        userName: '',
        planId: '',
        startDate: '',
        endDate: ''
    });

    const fetchPayments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.userName) params.append('userName', filter.userName);
            if (filter.planId) params.append('planId', filter.planId);
            if (filter.startDate) params.append('startDate', filter.startDate);
            if (filter.endDate) params.append('endDate', filter.endDate);

            const res = await fetch(`/api/admin/payments?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setPayments(data);
            }
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, [filter.planId, filter.startDate, filter.endDate]); // userName is usually handled by a button or debounce

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">결제완료</Badge>;
            case 'CANCELLED':
                return <Badge className="bg-gray-100 text-gray-500 hover:bg-gray-100 border-none">취소완료</Badge>;
            case 'FAILED':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">결제실패</Badge>;
            case 'READY':
                return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none">결제대기</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none">{status}</Badge>;
        }
    };

    const handleCancelPayment = async (paymentId: string) => {
        const reason = window.prompt('환불 사유를 입력하세요 (예: 유저 변심)');
        if (reason === null) return;

        if (window.confirm('정말 이 결제 건을 환불 처리하시겠습니까? 사용자 플랜이 멤버십 없음(FREE)으로 즉시 변경됩니다.')) {
            try {
                const res = await fetch('/api/admin/payments/cancel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentId, reason }),
                });
                if (res.ok) {
                    alert('결제가 취소되었습니다.');
                    fetchPayments();
                } else {
                    const err = await res.json();
                    alert(`취소 실패: ${err.error}`);
                }
            } catch (e) {
                alert('취소 처리 중 오류가 발생했습니다.');
            }
        }
    };

    return (
        <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">결제 관리</h1>
                    <p className="text-gray-500 mt-1 font-medium">사용자들의 실시간 결제 내역 및 구독 상태를 확인합니다.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-white p-1 rounded-none border border-gray-200 flex items-center h-11">
                        <input
                            type="text"
                            placeholder="사용자명 검색..."
                            className="px-4 py-2 text-sm focus:outline-none w-48"
                            value={filter.userName}
                            onChange={(e) => setFilter({ ...filter, userName: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && fetchPayments()}
                        />
                        <Button onClick={fetchPayments} variant="ghost" className="h-9 px-3 hover:bg-gray-100 rounded-none">검색</Button>
                    </div>
                    <select
                        className="bg-white border border-gray-200 h-11 px-4 text-sm focus:outline-none rounded-none text-gray-600 font-bold"
                        value={filter.planId}
                        onChange={(e) => setFilter({ ...filter, planId: e.target.value })}
                    >
                        <option value="">모든 플랜</option>
                        <option value="STANDARD">STANDARD</option>
                        <option value="PREMIUM">PREMIUM</option>
                    </select>
                    <div className="flex items-center bg-white border border-gray-200 h-11 rounded-none px-4 gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <input
                            type="date"
                            className="text-sm focus:outline-none text-gray-600"
                            value={filter.startDate}
                            onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                        />
                        <span className="text-gray-300">~</span>
                        <input
                            type="date"
                            className="text-sm focus:outline-none text-gray-600"
                            value={filter.endDate}
                            onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                        />
                    </div>
                    <Button onClick={fetchPayments} variant="outline" className="gap-2 bg-white font-bold h-11 px-6">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        새로고침
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-100 pb-6">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        최근 결제 내역
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-white">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-gray-50/50 text-gray-400 font-bold">
                                <TableRow className="hover:bg-transparent border-b border-gray-100">
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">주문/결제 ID</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">사용자</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">플랜</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">결제금액</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">수단/PG</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">상태</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">결제일시</TableHead>
                                    <TableHead className="py-4 px-6 uppercase text-xs tracking-wider">작업</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 text-center text-gray-400 font-medium">
                                            데이터를 불러오는 중입니다...
                                        </TableCell>
                                    </TableRow>
                                ) : payments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-48 text-center text-gray-400 font-medium">
                                            결제 내역이 존재하지 않습니다.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    payments.map((payment) => (
                                        <TableRow key={payment.id} className="hover:bg-gray-50/50 border-b border-gray-50 transition-colors">
                                            <TableCell className="py-5 px-6 font-mono text-xs text-blue-600 font-semibold">
                                                {payment.paymentId}
                                            </TableCell>
                                            <TableCell className="py-5 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900">{payment.user?.name || '알 수 없음'}</span>
                                                    <span className="text-xs text-gray-400">{payment.user?.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 px-6">
                                                <Badge variant="outline" className="font-black text-[10px] tracking-tight border-gray-200">
                                                    {payment.planId}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-5 px-6 font-black text-gray-900">
                                                ₩{payment.amount.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="py-5 px-6">
                                                <div className="flex flex-col text-xs text-gray-500 font-medium leading-relaxed">
                                                    <span>{payment.payMethod}</span>
                                                    <span className="text-[10px] text-gray-300">{payment.pgProvider}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 px-6">
                                                {getStatusBadge(payment.status)}
                                            </TableCell>
                                            <TableCell className="py-5 px-6 text-sm text-gray-500 font-medium">
                                                <div className="flex flex-col">
                                                    <span>{new Date(payment.paidAt || payment.createdAt).toLocaleString()}</span>
                                                    {payment.status === 'CANCELLED' && payment.cancelReason && (
                                                        <span className="text-[10px] text-red-400 mt-1 font-bold">사유: {payment.cancelReason}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 px-6">
                                                {payment.status === 'PAID' && (
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        className="h-8 text-[10px] font-black uppercase px-3 rounded-none bg-red-600 hover:bg-red-700"
                                                        onClick={() => handleCancelPayment(payment.paymentId)}
                                                    >
                                                        환불하기
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

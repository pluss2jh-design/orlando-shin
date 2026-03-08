/**
 * PortOne V2 REST API 서버 통신 유틸리티
 */

const PORTONE_API_BASE = 'https://api.portone.io';

/**
 * 결제 ID(paymentId)로 결제 상세 내역 조회 (V2)
 */
export async function getPaymentDataV2(paymentId: string) {
    const apiSecret = process.env.PORTONE_API_SECRET;

    if (!apiSecret) {
        throw new Error('PORTONE_API_SECRET이 설정되지 않았습니다.');
    }

    const response = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: {
            'Authorization': `PortOne ${apiSecret}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`PortOne API 오류: ${response.status} ${errorData.message || ''}`);
    }

    const data = await response.json();
    return data; // V2는 status, amount 등이 최상위에 있거나 구조가 다를 수 있음
}

/**
 * 프로젝트의 실제 상품 가격과 결제된 가격이 일치하는지 확인
 */
export function verifyPaymentAmount(paymentData: any, expectedAmount: number): boolean {
    // V2의 경우 paymentData.amount.total 혹은 구조에 따라 확인 필요
    // 보통 { amount: { total: 1000, ... }, status: 'PAID', ... }
    const actualAmount = paymentData.amount?.total ?? paymentData.amount;
    return actualAmount === expectedAmount;
}
/**
 * 결제 취소 (환불) 요청 (V2)
 */
export async function cancelPaymentV2(paymentId: string, reason: string) {
    const apiSecret = process.env.PORTONE_API_SECRET;

    if (!apiSecret) {
        throw new Error('PORTONE_API_SECRET이 설정되지 않았습니다.');
    }

    const response = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: 'POST',
        headers: {
            'Authorization': `PortOne ${apiSecret}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            reason: reason,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`PortOne 취소 오류: ${response.status} ${errorData.message || ''}`);
    }

    return await response.json();
}

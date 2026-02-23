import { useEffect, useState } from 'react';

declare global {
    interface Window {
        IMP?: any;
    }
}

export function usePortOne() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // 1. 포트원 SDK 스크립트 동적 로드
        const script = document.createElement('script');
        script.src = 'https://cdn.iamport.kr/v1/iamport.js';
        script.async = true;
        script.onload = () => {
            // 2. 관리자 페이지에서 발급받은 '가맹점 식별코드' (store_id) 를 초기화
            // 이 코드는 클라이언트 환경 변수에서 가져옵니다.
            const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
            if (window.IMP && storeId) {
                window.IMP.init(storeId);
                setIsReady(true);
            } else {
                console.error('PortOne(Iamport) SDK Load Error or Missing Store ID');
            }
        };
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const requestPayment = (
        paymentData: {
            pg: string; // 예: "html5_inicis", "kakaopay" 등
            pay_method: string; // 예: "card", "trans", "vbank", "phone"
            merchant_uid: string; // 고유 주문번호 (서버에서 생성 권장)
            name: string; // 결제창에 보일 상품명
            amount: number; // 결제할 금액
            buyer_email: string; // 구매자 이메일
            buyer_name: string; // 구매자 이름
            buyer_tel?: string; // 구매자 연락처
        },
        callback: (response: any) => void
    ) => {
        if (!window.IMP || !isReady) {
            alert('결제 모듈이 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        // 포트원 결제창 호출
        window.IMP.request_pay(paymentData, callback);
    };

    return { isReady, requestPayment };
}

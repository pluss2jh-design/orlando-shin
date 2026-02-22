import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { action } = await request.json();

        let suspendedUntil: Date | null = null;
        const now = new Date();

        if (action === '1_week') {
            suspendedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (action === '1_month') {
            suspendedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else if (action === 'forever') {
            suspendedUntil = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000); // Effectively forever
        } else if (action === 'unban') {
            suspendedUntil = null;
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: { suspendedUntil },
        });

        return NextResponse.json({ user: updatedUser });
    } catch (error) {
        console.error('Error suspending user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

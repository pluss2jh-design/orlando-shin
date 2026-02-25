import fs from 'fs/promises';
import path from 'path';

interface Feature {
    id: string;
    name: string;
    enabled: boolean;
}

interface Plan {
    id: string;
    name: string;
    features: Feature[];
}

export async function checkFeatureAccess(userPlanId: string, featureId: string): Promise<boolean> {
    try {
        const PLANS_FILE = path.join(process.cwd(), 'uploads', 'config', 'plans.json');
        const plansData = await fs.readFile(PLANS_FILE, 'utf-8');
        const plans: Plan[] = JSON.parse(plansData);

        const userPlan = plans.find(p => p.id.toLowerCase() === userPlanId.toLowerCase());
        if (!userPlan) return false;

        const feature = userPlan.features.find(f => f.id === featureId);
        return feature ? feature.enabled : false;
    } catch (error) {
        console.error('Permission check failed:', error);
        return false;
    }
}

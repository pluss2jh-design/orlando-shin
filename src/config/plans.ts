export const plans = [
  {
    id: "free",
    name: "Free",
    description: "Get started for free",
    price: 0,
    features: ["1 project", "Basic analytics", "Community support"],
    stripePriceId: "",
  },
  {
    id: "pro",
    name: "Pro",
    description: "For professionals",
    price: 19,
    features: [
      "Unlimited projects",
      "Advanced analytics",
      "Priority support",
      "Custom domain",
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || "",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For large teams",
    price: 99,
    features: [
      "Everything in Pro",
      "SSO",
      "Dedicated support",
      "Custom integrations",
      "SLA",
    ],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
  },
] as const;

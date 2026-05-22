import type { LucideIcon } from "lucide-react";
import { Globe, Share2, Users, Video } from "lucide-react";

export const PUBLIC_CONTACT = {
  email: "hello@masomobest.com",
  phone: "+256 700 000 000",
  whatsapp: "+256 700 000 000",
  address: "Kampala, Uganda",
} as const;

export const PUBLIC_NAV = [
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Demo" },
  { to: "/integrations", label: "Integrations" },
  { to: "/contact", label: "Contact", emphasis: true as const },
] as const;

export const FOOTER_QUICK_LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About us" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Request demo" },
  { to: "/contact", label: "Help & support" },
  { to: "/s/school-a/portal/login", label: "Parent portal" },
] as const;

export const FOOTER_PRODUCTS = [
  { to: "/features", label: "School ERP" },
  { to: "/features#academics", label: "Academics & exams" },
  { to: "/features#finance", label: "Fees & finance" },
  { to: "/integrations", label: "Integrations" },
  { to: "/s/school-a/portal/login", label: "Parent & student app" },
] as const;

export const FOOTER_SOCIAL: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "https://facebook.com", label: "Facebook", icon: Users },
  { href: "https://instagram.com", label: "Instagram", icon: Share2 },
  { href: "https://linkedin.com", label: "LinkedIn", icon: Globe },
  { href: "https://youtube.com", label: "YouTube", icon: Video },
];

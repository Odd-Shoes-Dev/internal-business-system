import { Region } from './regional-pricing';

// Generated Whop plan and module IDs (created 2026-02-20T03:03:00.890Z)
// Note: Some plans may be missing if they exceed Whop's $2500 transaction limit
export const WHOP_PLAN_IDS: Record<string, Partial<Record<Region, string>>> = {
  "starter-monthly": {
    "AFRICA": "plan_iIh0zIbRu26Id",
    "ASIA": "plan_xqGYTibP3BoWW",
    "EU": "plan_F6GYl2cR0ExwW",
    "GB": "plan_2xV1Dc11taSna",
    "US": "plan_ElSYE60KIciaM",
    "DEFAULT": "plan_oY7KiEc3QuScB"
  },
  "starter-annual": {
    "AFRICA": "plan_o3kpOmXtUSUmI",
    "ASIA": "plan_1Ik8ltQqJ9WKl",
    "EU": "plan_3YrxfzoBKphoi",
    "GB": "plan_EOFIQo2dRsZdO",
    "US": "plan_NDBI6Ghq3SK06",
    "DEFAULT": "plan_MyE29AIQdnvDx"
  },
  "professional-monthly": {
    "AFRICA": "plan_09u2eo4wQz6pn",
    "ASIA": "plan_FDK6YzHJJG6nS",
    "EU": "plan_w57T6NhzIA8QV",
    "GB": "plan_5eNLGp7dkDzOE",
    "US": "plan_mQuINZ9PTLwd6",
    "DEFAULT": "plan_HPQIt3Vu7qmbE"
  },
  "professional-annual": {
    "AFRICA": "plan_GQTMtac2C2uOK",
    "ASIA": "plan_Bi7CJ4iyPzqLG",
    "EU": "plan_eti0rBM2Hnnut",
    "GB": "plan_IeRG15oioaLmN",
    "US": "plan_6OHqpi2CVDaH3",
    "DEFAULT": "plan_IrEPKMObp2vpx"
  },
  "enterprise-monthly": {
    "AFRICA": "plan_CSIzogVBLHhqg",
    "ASIA": "plan_bahd9MfCxgb71",
    "EU": "plan_nW3ayHl05DRdp",
    "GB": "plan_cSiSuBkpJV4kj",
    "US": "plan_fncQyH81q8F3V",
    "DEFAULT": "plan_N29rx5IASWA64"
  }
};

export const WHOP_MODULE_IDS: Record<string, Partial<Record<Region, string>>> = {
  "tours": {
    "AFRICA": "plan_tPOoRF2Zv2Jlj",
    "ASIA": "plan_o6MvLc8sGsz8P",
    "EU": "plan_HHcwVmXZRgWBe",
    "GB": "plan_8wqBal28NHzOU",
    "US": "plan_1mpOsMvrEbE7B",
    "DEFAULT": "plan_PVQkhl9USApz1"
  },
  "fleet": {
    "AFRICA": "plan_QPHNfuMchvMaT",
    "ASIA": "plan_xAGVjN5u3IFhL",
    "EU": "plan_tqEfhEagcyt5A",
    "GB": "plan_Ll9wHyS6qUepc",
    "US": "plan_Z9iRfuHFeElJe",
    "DEFAULT": "plan_rca3UViN6vOHj"
  },
  "hotels": {
    "AFRICA": "plan_F1QVGrT9qwiBU",
    "ASIA": "plan_yuHaISsyyZ0rB",
    "EU": "plan_8LaMFs6P7yQjx",
    "GB": "plan_te0FePerQGdIY",
    "US": "plan_Dy4sVIJoxfMFb",
    "DEFAULT": "plan_qdOWE6t8aZ7g4"
  },
  "cafe": {
    "AFRICA": "plan_UIFwyVjjQgfRS",
    "ASIA": "plan_mapQqFpPGSZYc",
    "EU": "plan_sV9TU372HtPnM",
    "GB": "plan_udPZawU3Et8w1",
    "US": "plan_yVQdUjuE3QbAF",
    "DEFAULT": "plan_Chbut7NjXrfP7"
  },
  "inventory": {
    "AFRICA": "plan_xTaBRYqKpHWiU",
    "ASIA": "plan_8fEqvwYfiCI7B",
    "EU": "plan_5Cy9BxVPZEVOV",
    "GB": "plan_YgNxKbGkH4XoL",
    "US": "plan_W2QMWf9lkRblz",
    "DEFAULT": "plan_oLaCpXC38LVaJ"
  },
  "payroll": {
    "AFRICA": "plan_2JfDy6DDAToS4",
    "ASIA": "plan_2x7pUOO8MFqLs",
    "EU": "plan_AbowVFBcKOnhh",
    "GB": "plan_9u43Fr9xldbnO",
    "US": "plan_n7ad2q9Gv5dCG",
    "DEFAULT": "plan_0NWcJyFbwsu5O"
  }
};

export function getPlanId(planTier: string, billingPeriod: string, region: Region): string | undefined {
  const key = `${planTier}-${billingPeriod}`;
  const id = (WHOP_PLAN_IDS as any)[key]?.[region];
  return id;
}

export function getModulePlanId(moduleId: string, region: Region): string | undefined {
  const id = (WHOP_MODULE_IDS as any)[moduleId]?.[region];
  return id;
}

import { Region } from './regional-pricing';

// Generated Whop plan and module IDs (created 2026-02-18T07:55:57.120Z)
export const WHOP_PLAN_IDS: Record<string, Record<Region, string>> = {
  "starter-monthly": {
    "ASIA": "plan_rLYEwIBou3UxH",
    "EU": "plan_Wmz2wLPeHrBPs",
    "GB": "plan_h56y3lCkCoOib",
    "US": "plan_wtjWWBHRmYtpt",
    "DEFAULT": "plan_VUeCzvWKUBIdC"
  },
  "starter-annual": {
    "AFRICA": "plan_O7EpaCfG3m1qi",
    "ASIA": "plan_O14rPW42xHcnJ",
    "EU": "plan_6eCPRXic5ysEZ",
    "GB": "plan_dDiaNDwSroZKr",
    "US": "plan_krCfadrnAiGKL",
    "DEFAULT": "plan_DoSOO7UR62Vun"
  },
  "professional-monthly": {
    "ASIA": "plan_O5dceFy3p3Nxq",
    "EU": "plan_kEEV52HJDXThs",
    "GB": "plan_3cUziYn2ZBk05",
    "US": "plan_mYzxgJ5p2WGee",
    "DEFAULT": "plan_Jrva9eQQNMFA5"
  },
  "professional-annual": {
    "AFRICA": "plan_Y09pYKOhi3szP",
    "ASIA": "plan_cMvmvfIEra1qY",
    "EU": "plan_RHXFD37tqGnkz",
    "GB": "plan_0uHakbg7mrxTl",
    "US": "plan_DgAqF5VBC5KLg",
    "DEFAULT": "plan_vrf0MSIlvIp0w"
  },
  "enterprise-monthly": {
    "ASIA": "plan_5UpUMdGWB1cq1",
    "EU": "plan_7L2uSb9bOuB05",
    "GB": "plan_yYnYJNpiLw0Pb",
    "US": "plan_cZfjeIhCTDvfD",
    "DEFAULT": "plan_FVwior5Teqgk1"
  }
};

export const WHOP_MODULE_IDS: Record<string, Record<Region, string>> = {
  "tours": {
    "AFRICA": "plan_uDCR7l4S0iDI6",
    "ASIA": "plan_B2f5jgPcRAq6A",
    "EU": "plan_SAUw3VETzJsmL",
    "GB": "plan_V1fEaalVOAfsK",
    "US": "plan_ygOPJGqFi5BOX",
    "DEFAULT": "plan_dBH8JBoShXjuI"
  },
  "fleet": {
    "AFRICA": "plan_fpGK8x3zc5buC",
    "ASIA": "plan_2tRUGAJBBNgcE",
    "EU": "plan_WSpK6RrQrt53W",
    "GB": "plan_BuO7s9bd9wkq0",
    "US": "plan_2QbIvqRKbIOsc",
    "DEFAULT": "plan_9OX6IBr1Qs9AE"
  },
  "hotels": {
    "AFRICA": "plan_xvlXAAkpg7nQc",
    "ASIA": "plan_H8kZF2Eg3ndTY",
    "EU": "plan_BkRBzJxUTvKOn",
    "GB": "plan_MDskCaNbEJb5S",
    "US": "plan_icRuxWOedTpcg",
    "DEFAULT": "plan_eiPSKRZERWLvW"
  },
  "cafe": {
    "AFRICA": "plan_1JLgjjTRDOFRf",
    "ASIA": "plan_bbkl2UsZovjTG",
    "EU": "plan_5RJ1jwgC9Yedh",
    "GB": "plan_KH7TszsogLSSt",
    "US": "plan_Wgq9G1V60Esjq",
    "DEFAULT": "plan_rW4e8jKldarwU"
  },
  "inventory": {
    "AFRICA": "plan_3BI9gzuecXYQW",
    "ASIA": "plan_fmDQKHRWtKxnu",
    "EU": "plan_kusBvjIAwfIcX",
    "GB": "plan_jiLMQtZ3wcr4D",
    "US": "plan_x8pqsvGKGkqsG",
    "DEFAULT": "plan_Hee6zjv4MgUDL"
  },
  "payroll": {
    "AFRICA": "plan_DqU6S5OUuKHaT",
    "ASIA": "plan_VZ7lUJ5wqANjD",
    "EU": "plan_VIXBlrBy4BWYR",
    "GB": "plan_vMoJgdvVQ8lji",
    "US": "plan_P3qgHglKnsnXl",
    "DEFAULT": "plan_SpdK8umWpA5nm"
  }
};

export function getPlanId(planTier: string, billingPeriod: string, region: Region): string {
  const key = `${planTier}-${billingPeriod}`;
  const id = (WHOP_PLAN_IDS as any)[key]?.[region];
  if (!id) throw new Error(`No Whop plan id for ${key} in ${region}`);
  return id;
}

export function getModulePlanId(moduleId: string, region: Region): string {
  const id = (WHOP_MODULE_IDS as any)[moduleId]?.[region];
  if (!id) throw new Error(`No Whop module plan id for ${moduleId} in ${region}`);
  return id;
}

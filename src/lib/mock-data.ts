export type RiskLevel = "Low" | "Medium" | "High" | "Critical" | "Obsolete";

export const projects = [
  {
    id: "p1",
    customer: "Elbit Systems",
    name: "Radar Control Board v3",
    code: "ELB-RCB-003",
    activeVersion: "v4.2",
    status: "In Review",
    customerValue: 184350,
    internalCost: 142100,
    grossDelta: 42250,
    critical: 7,
    needsReview: 14,
    lastUpdated: "2026-06-12",
  },
  {
    id: "p2",
    customer: "Rafael",
    name: "UAV Power Distribution",
    code: "RFL-UPD-011",
    activeVersion: "v2.0",
    status: "Active",
    customerValue: 76420,
    internalCost: 58200,
    grossDelta: 18220,
    critical: 3,
    needsReview: 6,
    lastUpdated: "2026-06-10",
  },
  {
    id: "p3",
    customer: "IAI",
    name: "Satellite Comm Module",
    code: "IAI-SCM-007",
    activeVersion: "v1.5",
    status: "Quoting",
    customerValue: 312800,
    internalCost: 247600,
    grossDelta: 65200,
    critical: 12,
    needsReview: 22,
    lastUpdated: "2026-06-13",
  },
  {
    id: "p4",
    customer: "Plasan",
    name: "Vehicle Telemetry Unit",
    code: "PLS-VTU-002",
    activeVersion: "v3.1",
    status: "Archived",
    customerValue: 42900,
    internalCost: 35100,
    grossDelta: 7800,
    critical: 1,
    needsReview: 2,
    lastUpdated: "2026-05-28",
  },
];

export const bomLines = [
  { line: 1, originalMpn: "STM32F407VGT6", cleanedMpn: "STM32F407VGT6", matchedMpn: "STM32F407VGT6", manufacturer: "STMicroelectronics", originalDesc: "MCU 32-bit ARM Cortex-M4", normalizedDesc: "ARM Cortex-M4 MCU, 168MHz, 1MB Flash, LQFP-100", descUpdated: true, qty: 1, requiredQty: 100, custUnit: 8.42, custTotal: 842, intUnit: 5.78, intTotal: 578, custSource: "Digi-Key", intSource: "China Buyer", stock: 12450, moq: 1, leadTime: "12w", lifecycle: "Active", confidence: 99, risk: "Low" as RiskLevel, needsReview: false, notes: "" },
  { line: 2, originalMpn: "LM358N", cleanedMpn: "LM358N", matchedMpn: "LM358N", manufacturer: "Texas Instruments", originalDesc: "Dual Op-Amp", normalizedDesc: "Dual Operational Amplifier, DIP-8", descUpdated: false, qty: 2, requiredQty: 200, custUnit: 0.42, custTotal: 84, intUnit: 0.18, intTotal: 36, custSource: "Mouser", intSource: "China Buyer", stock: 50000, moq: 10, leadTime: "4w", lifecycle: "Active", confidence: 100, risk: "Low" as RiskLevel, needsReview: false, notes: "" },
  { line: 3, originalMpn: "TPS54331DR", cleanedMpn: "TPS54331DR", matchedMpn: "TPS54331DR", manufacturer: "Texas Instruments", originalDesc: "Buck Converter 3A", normalizedDesc: "Step-Down DC/DC Converter 3A, SOIC-8", descUpdated: true, qty: 1, requiredQty: 100, custUnit: 2.18, custTotal: 218, intUnit: 1.45, intTotal: 145, custSource: "Digi-Key", intSource: "Official Rep", stock: 320, moq: 100, leadTime: "26w", lifecycle: "Active", confidence: 98, risk: "Medium" as RiskLevel, needsReview: false, notes: "Long lead" },
  { line: 4, originalMpn: "XC7A35T-1FTG256C", cleanedMpn: "XC7A35T-1FTG256C", matchedMpn: "XC7A35T-1FTG256C", manufacturer: "Xilinx / AMD", originalDesc: "FPGA Artix-7", normalizedDesc: "Artix-7 FPGA, 33K Logic Cells, FTBGA-256", descUpdated: true, qty: 1, requiredQty: 100, custUnit: 68.5, custTotal: 6850, intUnit: 54.2, intTotal: 5420, custSource: "Avnet", intSource: "Official Rep", stock: 48, moq: 1, leadTime: "52w", lifecycle: "Active", confidence: 95, risk: "High" as RiskLevel, needsReview: true, notes: "Allocation" },
  { line: 5, originalMpn: "ADXL345BCCZ", cleanedMpn: "ADXL345BCCZ", matchedMpn: "ADXL345BCCZ", manufacturer: "Analog Devices", originalDesc: "Accelerometer", normalizedDesc: "3-Axis Digital Accelerometer ±16g, LGA-14", descUpdated: false, qty: 1, requiredQty: 100, custUnit: 4.85, custTotal: 485, intUnit: 3.12, intTotal: 312, custSource: "Digi-Key", intSource: "China Buyer", stock: 8200, moq: 1, leadTime: "8w", lifecycle: "Active", confidence: 100, risk: "Low" as RiskLevel, needsReview: false, notes: "" },
  { line: 6, originalMpn: "MAX232CPE", cleanedMpn: "MAX232CPE", matchedMpn: "MAX232CPE+", manufacturer: "Maxim Integrated", originalDesc: "RS-232 Driver", normalizedDesc: "RS-232 Line Driver/Receiver, DIP-16", descUpdated: true, qty: 1, requiredQty: 100, custUnit: 1.95, custTotal: 195, intUnit: 0.78, intTotal: 78, custSource: "Mouser", intSource: "China Buyer", stock: 2400, moq: 25, leadTime: "16w", lifecycle: "NRND", confidence: 92, risk: "High" as RiskLevel, needsReview: true, notes: "NRND - propose alt" },
  { line: 7, originalMpn: "BC547B", cleanedMpn: "BC547B", matchedMpn: "BC547B", manufacturer: "ON Semiconductor", originalDesc: "NPN Transistor", normalizedDesc: "NPN BJT 45V 100mA, TO-92", descUpdated: false, qty: 4, requiredQty: 400, custUnit: 0.08, custTotal: 32, intUnit: 0.03, intTotal: 12, custSource: "Mouser", intSource: "China Buyer", stock: 100000, moq: 100, leadTime: "2w", lifecycle: "Active", confidence: 100, risk: "Low" as RiskLevel, needsReview: false, notes: "" },
  { line: 8, originalMpn: "PIC16F877A", cleanedMpn: "PIC16F877A", matchedMpn: "PIC16F877A-I/P", manufacturer: "Microchip", originalDesc: "8-bit MCU", normalizedDesc: "8-bit PIC MCU, 14KB Flash, PDIP-40", descUpdated: true, qty: 1, requiredQty: 100, custUnit: 5.60, custTotal: 560, intUnit: 3.85, intTotal: 385, custSource: "Digi-Key", intSource: "Official Rep", stock: 1500, moq: 1, leadTime: "20w", lifecycle: "Active", confidence: 88, risk: "Medium" as RiskLevel, needsReview: true, notes: "Confirm package" },
  { line: 9, originalMpn: "AD7920ARTZ", cleanedMpn: "AD7920ARTZ", matchedMpn: "AD7920ARTZ-REEL7", manufacturer: "Analog Devices", originalDesc: "ADC 12-bit", normalizedDesc: "12-bit SAR ADC, 250kSPS, SOT-23-6", descUpdated: true, qty: 2, requiredQty: 200, custUnit: 3.40, custTotal: 680, intUnit: 2.10, intTotal: 420, custSource: "Digi-Key", intSource: "China Buyer", stock: 0, moq: 1, leadTime: "40w", lifecycle: "Active", confidence: 97, risk: "Critical" as RiskLevel, needsReview: true, notes: "Out of stock globally" },
  { line: 10, originalMpn: "LT1086CT-5", cleanedMpn: "LT1086CT-5", matchedMpn: "LT1086CT-5", manufacturer: "Analog Devices", originalDesc: "5V LDO", normalizedDesc: "1.5A 5V LDO Regulator, TO-220", descUpdated: false, qty: 1, requiredQty: 100, custUnit: 3.20, custTotal: 320, intUnit: 2.30, intTotal: 230, custSource: "Digi-Key", intSource: "Official Rep", stock: 850, moq: 1, leadTime: "18w", lifecycle: "EOL", confidence: 100, risk: "Obsolete" as RiskLevel, needsReview: true, notes: "EOL - find replacement" },
];

export const chinaQuotes = [
  { mpn: "STM32F407VGT6", supplier: "Shenzhen Huaqiang", unitPrice: 5.78, currency: "USD", moq: 100, available: 5000, leadTime: "6w", date: "2026-06-01", validUntil: "2026-07-01", custPrice: 8.42, savings: 264 },
  { mpn: "LM358N", supplier: "Guangzhou Yikai", unitPrice: 0.18, currency: "USD", moq: 1000, available: 50000, leadTime: "3w", date: "2026-06-01", validUntil: "2026-07-15", custPrice: 0.42, savings: 48 },
  { mpn: "TPS54331DR", supplier: "Shenzhen Power", unitPrice: 1.62, currency: "USD", moq: 500, available: 2000, leadTime: "10w", date: "2026-06-02", validUntil: "2026-07-02", custPrice: 2.18, savings: 56 },
  { mpn: "ADXL345BCCZ", supplier: "Shenzhen Huaqiang", unitPrice: 3.12, currency: "USD", moq: 100, available: 1500, leadTime: "8w", date: "2026-06-03", validUntil: "2026-07-03", custPrice: 4.85, savings: 173 },
  { mpn: "MAX232CPE", supplier: "Guangzhou Yikai", unitPrice: 0.78, currency: "USD", moq: 500, available: 10000, leadTime: "5w", date: "2026-06-04", validUntil: "2026-07-04", custPrice: 1.95, savings: 117 },
];

export const repQuotes = [
  { mpn: "STM32F407VGT6", rep: "Arrow Israel", unitPrice: 7.95, currency: "USD", moq: 100, leadTime: "10w", validUntil: "2026-08-01", market: 8.42, china: 5.78 },
  { mpn: "TPS54331DR", rep: "Avnet Israel", unitPrice: 2.05, currency: "USD", moq: 250, leadTime: "16w", validUntil: "2026-08-15", market: 2.18, china: 1.62 },
  { mpn: "XC7A35T-1FTG256C", rep: "Avnet Israel", unitPrice: 62.4, currency: "USD", moq: 1, leadTime: "26w", validUntil: "2026-09-01", market: 68.5, china: null },
  { mpn: "PIC16F877A-I/P", rep: "Future Electronics", unitPrice: 5.20, currency: "USD", moq: 100, leadTime: "14w", validUntil: "2026-08-30", market: 5.60, china: 3.85 },
];

export const versions = [
  { name: "v4.2", date: "2026-06-12", by: "Yossi Cohen", file: "ELB-RCB_v4.2.xlsx", status: "Active", comparedTo: "v4.1", changes: "8 changed, 3 added", active: true },
  { name: "v4.1", date: "2026-05-20", by: "Yossi Cohen", file: "ELB-RCB_v4.1.xlsx", status: "Archived", comparedTo: "v4.0", changes: "12 changed, 1 removed", active: false },
  { name: "v4.0", date: "2026-04-08", by: "Dana Levi", file: "ELB-RCB_v4.0.xlsx", status: "Archived", comparedTo: "v3.5", changes: "Initial v4 baseline", active: false },
  { name: "v3.5", date: "2026-02-14", by: "Dana Levi", file: "ELB-RCB_v3.5.xlsx", status: "Archived", comparedTo: "v3.4", changes: "5 changed", active: false },
];

export const changes = [
  { type: "Added", line: 47, old: "—", new: "ESP32-WROOM-32", impact: "+$420", action: "Verify source" },
  { type: "Qty Changed", line: 12, old: "2", new: "4", impact: "+$84", action: "Approve" },
  { type: "MPN Changed", line: 23, old: "LM7805", new: "LM7805CT", impact: "$0", action: "Auto-approved" },
  { type: "Removed", line: 31, old: "TL431", new: "—", impact: "-$22", action: "Confirm removal" },
  { type: "Description Changed", line: 8, old: "8-bit MCU", new: "8-bit PIC MCU 14KB", impact: "—", action: "Review" },
];

import {
  LayoutGrid,
  FileSpreadsheet,
  Table2,
  Upload,
  ShieldCheck,
  Globe2,
  Building2,
  GitBranch,
  GitCompare,
  FileDown,
  FolderTree,
  Settings,
} from "lucide-react";

export const navItems = [
  { to: "/", label: "פרויקטים", icon: LayoutGrid },
  { to: "/project", label: "סקירת פרויקט", icon: FileSpreadsheet },
  { to: "/bom", label: "טבלת BOM", icon: Table2 },
  { to: "/upload-bom", label: "טעינת BOM", icon: Upload },
  { to: "/quality", label: "איכות BOM", icon: ShieldCheck },
  { to: "/china-quote", label: "מחירון סין", icon: Globe2 },
  { to: "/rep-quote", label: "נציגים רשמיים", icon: Building2 },
  { to: "/versions", label: "גרסאות", icon: GitBranch },
  { to: "/changes", label: "השוואת שינויים", icon: GitCompare },
  { to: "/export", label: "דוחות וייצוא", icon: FileDown },
  { to: "/files", label: "קבצי פרויקט", icon: FolderTree },
  { to: "/settings", label: "הגדרות", icon: Settings },
] as const;
